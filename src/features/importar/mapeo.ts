/**
 * Lógica PURA de la importación (criterio 6): detectar cabecera, sugerir mapeo,
 * normalizar filas, detectar duplicados y planificar qué pasa con cada fila.
 * Nada de acceso a datos ni de React aquí: todo se prueba en mapeo.test.ts.
 *
 * Regla de oro: cero filas descartadas. Toda fila no vacía acaba en el CRM como
 * creada, fusionada o creada-para-revisar, y el informe dice por qué.
 */
import type { Contacto, ContactoUpdate, DocTipo, EstadoOportunidad, Json, ResultadoImportacion } from "@/lib/types"
import { desdeLima } from "@/lib/utils/fechas"
import { simboloActual } from "@/lib/utils/moneda"
import { normalizarTelefonoPE } from "@/lib/utils/telefono"
import { normalizarTexto, similitud } from "@/lib/utils/texto"

// ---------------------------------------------------------------------------
// Tipos básicos
// ---------------------------------------------------------------------------

export type Celda = string | number | boolean | Date | null | undefined
export type FilaHoja = Celda[]

export interface HojaLeida {
  nombre: string
  filas: FilaHoja[]
}

export const CAMPOS_DESTINO = [
  "nombre",
  "empresa",
  "telefono",
  "telefono2",
  "email",
  "doc_numero",
  "doc_tipo",
  "direccion",
  "origen",
  "responsable",
  "notas",
  "etapa",
  "importe",
  "estado",
  "titulo_oportunidad",
  "fecha",
  "extra",
  "ignorar",
] as const
export type CampoDestino = (typeof CAMPOS_DESTINO)[number]

export const ETIQUETA_CAMPO: Record<CampoDestino, string> = {
  nombre: "Nombre",
  empresa: "Empresa / negocio",
  telefono: "Celular / teléfono",
  telefono2: "Segundo teléfono",
  email: "Correo",
  doc_numero: "RUC / DNI",
  doc_tipo: "Tipo de documento",
  direccion: "Dirección",
  origen: "Origen",
  responsable: "Responsable (vendedor)",
  notas: "Notas",
  etapa: "Etapa",
  importe: "Importe",
  estado: "Estado (abierta, ganada, perdida)",
  titulo_oportunidad: "Título de la oportunidad",
  fecha: "Fecha de registro",
  extra: "Guardar como dato extra",
  ignorar: "Ignorar",
}

/**
 * Etiqueta del campo. La del importe lleva el símbolo de la moneda elegida en Configuración;
 * la pantalla pasa el que ya tiene suscrito para que se rehaga al cambiar de moneda.
 */
export function etiquetaCampo(campo: CampoDestino, simbolo: string = simboloActual()): string {
  return campo === "importe" ? `${ETIQUETA_CAMPO.importe} (${simbolo})` : ETIQUETA_CAMPO[campo]
}

/** Campos que solo admiten una columna (extra e ignorar admiten varias). */
export const CAMPOS_UNICOS: ReadonlySet<CampoDestino> = new Set(
  CAMPOS_DESTINO.filter((c) => c !== "extra" && c !== "ignorar"),
)

/** Mapeo: índice de columna de la hoja -> campo destino. */
export type Mapeo = Record<number, CampoDestino>

// ---------------------------------------------------------------------------
// Celdas y cabecera
// ---------------------------------------------------------------------------

/** Texto recortado de una celda; los números se pasan a texto sin notación científica. */
export function textoCelda(celda: Celda): string {
  if (celda == null) return ""
  if (typeof celda === "string") return celda.trim()
  if (typeof celda === "number") {
    if (!Number.isFinite(celda)) return ""
    return Number.isInteger(celda) ? celda.toLocaleString("en-US", { useGrouping: false }) : String(celda)
  }
  if (typeof celda === "boolean") return celda ? "sí" : "no"
  if (celda instanceof Date) return Number.isNaN(celda.getTime()) ? "" : fechaAIso(celda)
  return ""
}

/** true si TODAS las celdas están en blanco. */
export function esFilaVacia(fila: FilaHoja | undefined): boolean {
  if (!fila) return true
  return fila.every((c) => textoCelda(c) === "")
}

function pareceNumero(texto: string): boolean {
  return /^[\s\d.,+\-()/%$]*$/.test(texto) && /\d/.test(texto)
}

/**
 * Índice (base 0) de la fila de cabecera: la primera con 2 o más celdas de texto
 * no numérico. Si ninguna cumple, 0.
 */
export function detectarFilaCabecera(filas: FilaHoja[]): number {
  for (let i = 0; i < filas.length; i++) {
    const textos = filas[i].filter((c) => {
      const t = textoCelda(c)
      return t !== "" && typeof c !== "number" && !(c instanceof Date) && !pareceNumero(t)
    })
    if (textos.length >= 2) return i
  }
  return 0
}

export interface ColumnaHoja {
  indice: number
  nombre: string
}

/** Columnas a partir de la fila de cabecera; las cabeceras vacías se llaman "Columna N". */
export function columnasDeHoja(filas: FilaHoja[], indiceCabecera: number): ColumnaHoja[] {
  const cabecera = filas[indiceCabecera] ?? []
  const ancho = Math.max(cabecera.length, ...filas.slice(indiceCabecera + 1, indiceCabecera + 50).map((f) => f.length))
  const usados = new Map<string, number>()
  const columnas: ColumnaHoja[] = []
  for (let i = 0; i < ancho; i++) {
    let nombre = textoCelda(cabecera[i]) || `Columna ${i + 1}`
    const veces = usados.get(nombre) ?? 0
    usados.set(nombre, veces + 1)
    if (veces > 0) nombre = `${nombre} (${veces + 1})`
    columnas.push({ indice: i, nombre })
  }
  return columnas
}

/** Filas de datos (después de la cabecera) con su número de fila real en la hoja (base 1). */
export function filasDeDatos(filas: FilaHoja[], indiceCabecera: number): { numero: number; celdas: FilaHoja }[] {
  return filas.slice(indiceCabecera + 1).map((celdas, i) => ({ numero: indiceCabecera + i + 2, celdas }))
}

// ---------------------------------------------------------------------------
// Sugerencia de mapeo por sinónimos y similitud
// ---------------------------------------------------------------------------

const SINONIMOS: Record<Exclude<CampoDestino, "extra" | "ignorar">, string[]> = {
  nombre: [
    "nombre", "nombres", "nombre completo", "nombre y apellido", "nombre y apellidos", "nombres y apellidos",
    "cliente", "contacto", "persona", "apellidos", "nombre del cliente", "nombre cliente", "nombre contacto",
    "nombre del contacto", "titular", "prospecto", "lead", "apellidos y nombres",
  ],
  empresa: [
    "empresa", "negocio", "razon social", "compania", "comercio", "entidad", "organizacion", "empresa negocio",
    "nombre comercial", "nombre de la empresa", "nombre empresa", "local", "empresa o negocio", "tienda",
  ],
  telefono: [
    "telefono", "celular", "movil", "whatsapp", "cel", "fono", "numero", "tel", "telf", "nro celular",
    "numero de celular", "numero celular", "numero de telefono", "telefono celular", "wsp", "wasap", "contacto telefonico",
    "telefono 1", "celular 1", "celular whatsapp", "telefono whatsapp",
  ],
  telefono2: [
    "telefono 2", "celular 2", "otro telefono", "telefono alternativo", "segundo telefono", "telefono fijo",
    "fijo", "otro celular", "telefono adicional",
  ],
  email: ["correo", "email", "mail", "e mail", "correo electronico", "correo electronico", "emails", "correos"],
  doc_numero: [
    "ruc", "dni", "documento", "ruc dni", "dni ruc", "nro documento", "numero de documento", "numero documento",
    "doc", "nro doc", "ce", "carnet de extranjeria", "identificacion", "cedula", "nro ruc", "numero ruc", "nro dni",
    "numero dni", "ruc o dni", "dni o ruc", "documento de identidad",
  ],
  doc_tipo: ["tipo documento", "tipo de documento", "tipo doc", "tipo de doc"],
  direccion: ["direccion", "domicilio", "ubicacion", "distrito", "direccion fiscal", "domicilio fiscal", "ciudad", "zona"],
  origen: ["origen", "fuente", "canal", "procedencia", "como nos conocio", "medio", "referencia", "canal de origen", "fuente de contacto"],
  responsable: [
    "responsable", "vendedor", "vendedora", "asesor", "asesora", "ejecutivo", "ejecutiva", "encargado", "encargada",
    "comercial", "asignado", "asignado a", "usuario", "atendido por", "gestor", "gestora", "propietario", "owner",
  ],
  notas: [
    "notas", "nota", "observaciones", "observacion", "comentarios", "comentario", "detalle", "detalles",
    "descripcion", "anotaciones", "obs",
  ],
  etapa: ["etapa", "fase", "estado", "estatus", "status", "situacion", "etapa actual", "estado actual", "paso", "etapa del embudo"],
  importe: [
    "monto", "importe", "valor", "precio", "total", "soles", "monto s", "importe s", "cotizacion", "presupuesto",
    "tarifa", "mensualidad", "honorarios", "monto soles", "valor s", "precio s", "monto mensual",
  ],
  estado: ["estado oportunidad", "estado de la oportunidad", "resultado", "cerrado", "ganada perdida", "abierta cerrada"],
  titulo_oportunidad: [
    "oportunidad", "titulo", "servicio", "producto", "asunto", "interes", "tipo de servicio", "plan", "paquete",
    "titulo oportunidad", "titulo de la oportunidad",
  ],
  fecha: [
    "fecha", "creado", "fecha de creacion", "fecha creacion", "registro", "fecha registro", "fecha de registro",
    "alta", "fecha alta", "dia", "fecha contacto", "fecha de contacto", "creado el", "fecha de alta", "fecha ingreso",
  ],
}

const ENTRADAS_SINONIMOS = Object.entries(SINONIMOS) as [Exclude<CampoDestino, "extra" | "ignorar">, string[]][]

/** Campo sugerido para el nombre de una columna. 'extra' si no se reconoce. */
export function sugerirCampo(nombreColumna: string): CampoDestino {
  const norm = normalizarTexto(nombreColumna)
  if (!norm) return "extra"
  // 1. Coincidencia exacta con un sinónimo.
  for (const [campo, lista] of ENTRADAS_SINONIMOS) if (lista.includes(norm)) return campo
  // 2. Alguna palabra de la cabecera es un sinónimo de una sola palabra ("Monto (S/)" -> monto).
  for (const token of norm.split(" ")) {
    if (token.length < 3) continue
    for (const [campo, lista] of ENTRADAS_SINONIMOS) if (lista.includes(token)) return campo
  }
  // 3. Similitud con cualquier sinónimo ("Telefono" con falta, "Observ.").
  let mejor: { campo: CampoDestino; puntaje: number } = { campo: "extra", puntaje: 0 }
  for (const [campo, lista] of ENTRADAS_SINONIMOS) {
    for (const s of lista) {
      const p = similitud(norm, s)
      if (p > mejor.puntaje) mejor = { campo, puntaje: p }
    }
  }
  return mejor.puntaje >= 0.75 ? mejor.campo : "extra"
}

/** Mapeo sugerido para todas las columnas, sin repetir campos únicos (segundo teléfono -> telefono2). */
export function sugerirMapeo(columnas: ColumnaHoja[]): Mapeo {
  const mapeo: Mapeo = {}
  const usados = new Set<CampoDestino>()
  for (const col of columnas) {
    let campo = sugerirCampo(col.nombre)
    if (CAMPOS_UNICOS.has(campo) && usados.has(campo)) {
      campo = campo === "telefono" && !usados.has("telefono2") ? "telefono2" : "extra"
    }
    if (CAMPOS_UNICOS.has(campo)) usados.add(campo)
    mapeo[col.indice] = campo
  }
  return mapeo
}

/** Mapeo legible para guardar en importaciones.mapeo: { "Celular": "telefono", ... }. */
export function mapeoParaGuardar(columnas: ColumnaHoja[], mapeo: Mapeo): Record<string, string> {
  const salida: Record<string, string> = {}
  for (const col of columnas) salida[col.nombre] = mapeo[col.indice] ?? "extra"
  return salida
}

/** Campos únicos asignados más de una vez (para avisar en el paso de mapeo). */
export function camposRepetidos(mapeo: Mapeo): CampoDestino[] {
  const veces = new Map<CampoDestino, number>()
  for (const campo of Object.values(mapeo)) veces.set(campo, (veces.get(campo) ?? 0) + 1)
  return [...veces.entries()].filter(([c, n]) => CAMPOS_UNICOS.has(c) && n > 1).map(([c]) => c)
}

// ---------------------------------------------------------------------------
// Parseo de valores
// ---------------------------------------------------------------------------

function fechaAIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${dd}`
}

function fechaValida(y: number, m: number, d: number): boolean {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false
  const prueba = new Date(Date.UTC(y, m - 1, d))
  return prueba.getUTCMonth() === m - 1 && prueba.getUTCDate() === d
}

/** Serial de Excel (días desde 1899-12-30) a 'yyyy-MM-dd'. */
export function fechaDesdeSerialExcel(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 20000 || serial > 80000) return null
  const ms = Math.round((serial - 25569) * 86_400_000)
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
}

/**
 * Fecha de la hoja a 'yyyy-MM-dd': acepta dd/mm/yyyy (también con - o .), ISO,
 * serial de Excel y objetos Date. null si no se reconoce.
 */
export function parsearFechaHoja(valor: Celda): string | null {
  if (valor == null || valor === "") return null
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : fechaAIso(valor)
  if (typeof valor === "number") return fechaDesdeSerialExcel(valor)
  if (typeof valor !== "string") return null
  const s = valor.trim()
  if (!s) return null
  let m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})(?:\s.*)?$/.exec(s)
  if (m) {
    const d = Number(m[1])
    const mes = Number(m[2])
    let y = Number(m[3])
    if (m[3].length === 2) y += 2000
    return fechaValida(y, mes, d) ? `${y}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null
  }
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(s)
  if (m) {
    const y = Number(m[1])
    const mes = Number(m[2])
    const d = Number(m[3])
    return fechaValida(y, mes, d) ? `${y}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null
  }
  if (/^\d{5}$/.test(s)) return fechaDesdeSerialExcel(Number(s))
  return null
}

/**
 * Importe de la hoja a número: quita cualquier símbolo de moneda ('S/', '$', '€', 'Bs'),
 * espacios y demás caracteres que no sean cifras; entiende
 * '1,200' (miles), '1,250.50', '1.250,50' y '350.5'. null si no hay número.
 */
export function parsearImporteHoja(valor: Celda): number | null {
  if (valor == null || valor === "") return null
  if (typeof valor === "number") return Number.isFinite(valor) ? Math.round(valor * 100) / 100 : null
  if (typeof valor !== "string") return null
  let s = valor.replace(/[^\d.,-]/g, "")
  if (!/\d/.test(s)) return null
  const negativo = s.startsWith("-")
  s = s.replace(/-/g, "")
  const comas = (s.match(/,/g) ?? []).length
  const puntos = (s.match(/\./g) ?? []).length
  if (comas > 0 && puntos > 0) {
    // El último separador es el decimal; el otro, miles.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".")
    else s = s.replace(/,/g, "")
  } else if (comas > 0) {
    // '1,200' o '1,200,300' son miles; '12,5' es decimal.
    if (comas > 1 || /^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, "")
    else s = s.replace(",", ".")
  } else if (puntos > 1) {
    s = s.replace(/\./g, "")
  }
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return null
  return Math.round((negativo ? -n : n) * 100) / 100
}

/** Separa "944222111 / 987000111" en varios números. */
export function separarTelefonos(texto: string): string[] {
  return texto
    .split(/\s*(?:\/|,|;|\||\by\b)\s*/i)
    .map((t) => t.trim())
    .filter(Boolean)
}

/** Tipo de documento a partir del número: 8 dígitos DNI, 11 dígitos RUC, 9 alfanuméricos CE. */
export function inferirDocTipo(doc: string | null): DocTipo | null {
  if (!doc) return null
  const limpio = doc.replace(/[\s.-]/g, "")
  if (/^\d{8}$/.test(limpio)) return "DNI"
  if (/^\d{11}$/.test(limpio)) return "RUC"
  if (/^[A-Za-z0-9]{9,12}$/.test(limpio) && /[A-Za-z]/.test(limpio)) return "CE"
  return null
}

function docTipoDesdeTexto(texto: string): DocTipo | null {
  const n = normalizarTexto(texto)
  if (!n) return null
  if (n.includes("ruc")) return "RUC"
  if (n.includes("dni")) return "DNI"
  if (n.includes("ce") || n.includes("extranjer") || n.includes("carnet")) return "CE"
  return null
}

/** 'Cerrado ganado', 'won', 'perdido', 'lost'... -> estado; null si no es un cierre. */
export function interpretarEstado(texto: string | null | undefined): Exclude<EstadoOportunidad, "abierta"> | null {
  const n = normalizarTexto(texto)
  if (!n) return null
  if (/\b(ganad[oa]s?|won|vendid[oa]|cerrad[oa] ganad[oa]|exito|cliente)\b/.test(n)) return "ganada"
  if (/\b(perdid[oa]s?|lost|descartad[oa]|cerrad[oa] perdid[oa]|rechazad[oa]|cancelad[oa])\b/.test(n)) return "perdida"
  return null
}

// ---------------------------------------------------------------------------
// Normalización de filas
// ---------------------------------------------------------------------------

export interface FilaNormalizada {
  /** Número de fila en la hoja (base 1, como lo ve el usuario en Excel). */
  fila: number
  vacia: boolean
  nombre: string | null
  empresa: string | null
  /** E.164 si se pudo normalizar. */
  telefono: string | null
  telefono_raw: string | null
  telefono2: string | null
  email: string | null
  doc_numero: string | null
  doc_tipo: DocTipo | null
  direccion: string | null
  origen: string | null
  responsable: string | null
  notas: string | null
  etapa: string | null
  importe: number | null
  estado: string | null
  titulo_oportunidad: string | null
  /** 'yyyy-MM-dd' */
  fecha: string | null
  extra: Record<string, Json>
}

function oNull(texto: string): string | null {
  return texto === "" ? null : texto
}

/** Convierte una fila cruda en una fila normalizada según el mapeo. */
export function normalizarFila(celdas: FilaHoja, numeroFila: number, mapeo: Mapeo, columnas: ColumnaHoja[]): FilaNormalizada {
  const fila: FilaNormalizada = {
    fila: numeroFila,
    vacia: esFilaVacia(celdas),
    nombre: null,
    empresa: null,
    telefono: null,
    telefono_raw: null,
    telefono2: null,
    email: null,
    doc_numero: null,
    doc_tipo: null,
    direccion: null,
    origen: null,
    responsable: null,
    notas: null,
    etapa: null,
    importe: null,
    estado: null,
    titulo_oportunidad: null,
    fecha: null,
    extra: {},
  }
  if (fila.vacia) return fila

  const notas: string[] = []
  let docTipoTexto: string | null = null
  let telefono2Texto: string | null = null

  for (const col of columnas) {
    const campo = mapeo[col.indice] ?? "extra"
    const celda = celdas[col.indice]
    const texto = textoCelda(celda)
    if (campo === "ignorar" || texto === "") continue
    switch (campo) {
      case "nombre":
        fila.nombre = oNull(texto.replace(/\s+/g, " "))
        break
      case "empresa":
        fila.empresa = oNull(texto.replace(/\s+/g, " "))
        break
      case "telefono":
        fila.telefono_raw = texto
        break
      case "telefono2":
        telefono2Texto = texto
        break
      case "email":
        fila.email = oNull(texto.toLowerCase())
        break
      case "doc_numero":
        fila.doc_numero = oNull(texto.replace(/[\s.-]/g, "").toUpperCase())
        break
      case "doc_tipo":
        docTipoTexto = texto
        break
      case "direccion":
        fila.direccion = oNull(texto)
        break
      case "origen":
        fila.origen = oNull(texto)
        break
      case "responsable":
        fila.responsable = oNull(texto)
        break
      case "notas":
        notas.push(texto)
        break
      case "etapa":
        fila.etapa = oNull(texto)
        break
      case "importe":
        fila.importe = parsearImporteHoja(celda)
        if (fila.importe === null) fila.extra[col.nombre] = texto
        break
      case "estado":
        fila.estado = oNull(texto)
        break
      case "titulo_oportunidad":
        fila.titulo_oportunidad = oNull(texto)
        break
      case "fecha":
        fila.fecha = parsearFechaHoja(celda)
        if (fila.fecha === null) fila.extra[col.nombre] = texto
        break
      default:
        fila.extra[col.nombre] = typeof celda === "number" ? celda : texto
    }
  }

  // Teléfonos: puede venir más de uno en la celda; el primero reconocible es el principal.
  if (fila.telefono_raw) {
    const partes = separarTelefonos(fila.telefono_raw)
    const normalizados = partes.map((p) => normalizarTelefonoPE(p))
    const indicePrincipal = normalizados.findIndex((n) => n !== null)
    if (indicePrincipal >= 0) {
      fila.telefono = normalizados[indicePrincipal]
      const resto = partes.filter((_, i) => i !== indicePrincipal)
      if (resto.length > 0 && !telefono2Texto) telefono2Texto = resto.join(" / ")
    }
  }
  if (telefono2Texto) {
    fila.telefono2 = normalizarTelefonoPE(telefono2Texto) ?? telefono2Texto
    if (!fila.telefono_raw) {
      // Solo hay segundo teléfono: pasa a ser el principal.
      fila.telefono_raw = telefono2Texto
      fila.telefono = normalizarTelefonoPE(telefono2Texto)
      fila.telefono2 = null
    }
  }
  if (fila.telefono2) fila.extra.telefono2 = fila.telefono2

  fila.doc_tipo = (docTipoTexto ? docTipoDesdeTexto(docTipoTexto) : null) ?? inferirDocTipo(fila.doc_numero)
  if (notas.length > 0) fila.notas = notas.join("\n")
  return fila
}

export function normalizarFilas(filas: FilaHoja[], indiceCabecera: number, mapeo: Mapeo, columnas: ColumnaHoja[]): FilaNormalizada[] {
  return filasDeDatos(filas, indiceCabecera).map(({ numero, celdas }) => normalizarFila(celdas, numero, mapeo, columnas))
}

// ---------------------------------------------------------------------------
// Equivalencias de catálogos (origen, etapa, responsable)
// ---------------------------------------------------------------------------

export type Equivalencia =
  | { tipo: "existente"; id: string }
  | { tipo: "crear" }
  | { tipo: "estado"; estado: "ganada" | "perdida" }
  | { tipo: "admin" }

export type TipoCatalogo = "origenes" | "etapas" | "responsables"

/** Clave normalizada del valor -> equivalencia elegida. */
export type Equivalencias = Record<TipoCatalogo, Record<string, Equivalencia>>

export interface ItemCatalogo {
  id: string
  nombre: string
}

export interface CatalogosImportacion {
  etapas: ItemCatalogo[]
  origenes: ItemCatalogo[]
  usuarios: (ItemCatalogo & { email?: string | null })[]
  motivos: ItemCatalogo[]
  /** Usuario administrador que importa: recibe los responsables desconocidos. */
  adminId: string
}

export interface ValorCatalogo {
  clave: string
  texto: string
  veces: number
  /** Elemento del catálogo que coincide exactamente (sin tildes ni mayúsculas), si lo hay. */
  coincidencia: ItemCatalogo | null
}

export function claveValor(texto: string | null | undefined): string {
  return normalizarTexto(texto)
}

function coincidenciaExacta(texto: string, items: ItemCatalogo[]): ItemCatalogo | null {
  const clave = claveValor(texto)
  return items.find((i) => claveValor(i.nombre) === clave) ?? null
}

function valoresDistintos(filas: FilaNormalizada[], campo: "origen" | "etapa" | "responsable", items: ItemCatalogo[]): ValorCatalogo[] {
  const mapa = new Map<string, ValorCatalogo>()
  for (const f of filas) {
    if (f.vacia) continue
    const texto = f[campo]
    if (!texto) continue
    const clave = claveValor(texto)
    if (!clave) continue
    const actual = mapa.get(clave)
    if (actual) actual.veces += 1
    else mapa.set(clave, { clave, texto, veces: 1, coincidencia: coincidenciaExacta(texto, items) })
  }
  return [...mapa.values()]
}

/** Valores distintos de origen, etapa y responsable que aparecen en la hoja. */
export function valoresDeCatalogos(filas: FilaNormalizada[], catalogos: CatalogosImportacion): Record<TipoCatalogo, ValorCatalogo[]> {
  return {
    origenes: valoresDistintos(filas, "origen", catalogos.origenes),
    etapas: valoresDistintos(filas, "etapa", catalogos.etapas),
    responsables: valoresDistintos(filas, "responsable", catalogos.usuarios),
  }
}

function masParecido(texto: string, items: ItemCatalogo[], minimo: number): ItemCatalogo | null {
  let mejor: { item: ItemCatalogo; p: number } | null = null
  for (const item of items) {
    const p = similitud(texto, item.nombre)
    if (p >= minimo && (!mejor || p > mejor.p)) mejor = { item, p }
  }
  return mejor?.item ?? null
}

function parecidoUsuario(texto: string, usuarios: CatalogosImportacion["usuarios"]): ItemCatalogo | null {
  const clave = claveValor(texto).replace(/\s+/g, "")
  for (const u of usuarios) {
    const nombre = claveValor(u.nombre).replace(/\s+/g, "")
    const correo = claveValor(u.email ?? "").split(" ")[0] ?? ""
    if (clave && (nombre === clave || correo === clave || nombre.startsWith(clave))) return u
    // "Luis Q." -> "luisq" es prefijo de "luisquispe"; "Ana" es prefijo de "anagarcia".
    const iniciales = claveValor(u.nombre).split(" ").filter(Boolean)
    if (iniciales.length >= 2 && clave === iniciales[0] + iniciales[1][0]) return u
  }
  return masParecido(texto, usuarios, 0.8)
}

/** Sugerencia inicial de equivalencias para todos los valores de la hoja. */
export function sugerirEquivalencias(valores: Record<TipoCatalogo, ValorCatalogo[]>, catalogos: CatalogosImportacion): Equivalencias {
  const eq: Equivalencias = { origenes: {}, etapas: {}, responsables: {} }
  for (const v of valores.origenes) {
    const item = v.coincidencia ?? masParecido(v.texto, catalogos.origenes, 0.8)
    eq.origenes[v.clave] = item ? { tipo: "existente", id: item.id } : { tipo: "crear" }
  }
  for (const v of valores.etapas) {
    const estado = interpretarEstado(v.texto)
    const item = v.coincidencia ?? (estado ? null : masParecido(v.texto, catalogos.etapas, 0.8))
    if (item) eq.etapas[v.clave] = { tipo: "existente", id: item.id }
    else if (estado) eq.etapas[v.clave] = { tipo: "estado", estado }
    else eq.etapas[v.clave] = { tipo: "crear" }
  }
  for (const v of valores.responsables) {
    const item = v.coincidencia ?? parecidoUsuario(v.texto, catalogos.usuarios)
    eq.responsables[v.clave] = item ? { tipo: "existente", id: item.id } : { tipo: "admin" }
  }
  return eq
}

// ---------------------------------------------------------------------------
// Duplicados y plan de importación
// ---------------------------------------------------------------------------

export type ContactoExistente = Pick<Contacto, "id" | "nombre" | "telefono" | "email" | "doc_numero">

export interface ContactoPlanificado {
  nombre: string
  empresa: string | null
  telefono: string | null
  telefono_raw: string | null
  email: string | null
  doc_numero: string | null
  doc_tipo: DocTipo | null
  direccion: string | null
  notas: string | null
  extra: Record<string, Json>
  requiere_revision: boolean
  origen: Equivalencia | null
  responsable: Equivalencia | null
  /** ISO UTC construido desde la fecha de la hoja (Lima), si la hay. */
  created_at: string | null
}

export interface OportunidadPlanificada {
  titulo: string
  importe: number
  /** null = primera etapa activa. */
  etapa: Equivalencia | null
  estado: EstadoOportunidad
  motivoPerdidaId: string | null
  created_at: string | null
}

export type FusionCon =
  | { origen: "base"; id: string; nombre: string }
  | { origen: "archivo"; fila: number; nombre: string }

export interface PlanFila {
  fila: number
  datos: FilaNormalizada
  resultado: ResultadoImportacion
  motivos: string[]
  fusionarCon: FusionCon | null
  /** Datos del contacto a crear (null si se fusiona). */
  contacto: ContactoPlanificado | null
  oportunidad: OportunidadPlanificada | null
}

export interface RecuentoImportacion {
  total: number
  noVacias: number
  crear: number
  fusionar: number
  revisar: number
}

export interface PlanImportacion {
  filas: PlanFila[]
  recuento: RecuentoImportacion
  creaOportunidades: boolean
}

export interface OpcionesPlan {
  mapeo: Mapeo
  equivalencias: Equivalencias
  catalogos: CatalogosImportacion
  existentes: ContactoExistente[]
  tituloDefault: string
  importeDefault: number
}

/** Similitud mínima de nombres para fusionar un duplicado (por debajo se crea y se marca para revisar). */
export const SIMILITUD_MINIMA_FUSION = 0.5

type Candidato = { via: "documento" | "celular" | "correo"; con: FusionCon }

class IndiceDuplicados {
  private porDoc = new Map<string, FusionCon>()
  private porTelefono = new Map<string, FusionCon>()
  private porEmail = new Map<string, FusionCon>()

  registrar(datos: { doc_numero: string | null; telefono: string | null; email: string | null }, con: FusionCon): void {
    if (datos.doc_numero && !this.porDoc.has(datos.doc_numero)) this.porDoc.set(datos.doc_numero, con)
    if (datos.telefono && !this.porTelefono.has(datos.telefono)) this.porTelefono.set(datos.telefono, con)
    const email = datos.email?.toLowerCase()
    if (email && !this.porEmail.has(email)) this.porEmail.set(email, con)
  }

  buscar(datos: { doc_numero: string | null; telefono: string | null; email: string | null }): Candidato | null {
    if (datos.doc_numero) {
      const con = this.porDoc.get(datos.doc_numero)
      if (con) return { via: "documento", con }
    }
    if (datos.telefono) {
      const con = this.porTelefono.get(datos.telefono)
      if (con) return { via: "celular", con }
    }
    if (datos.email) {
      const con = this.porEmail.get(datos.email.toLowerCase())
      if (con) return { via: "correo", con }
    }
    return null
  }
}

function equivalenciaDe(eq: Record<string, Equivalencia>, texto: string | null, items: ItemCatalogo[]): Equivalencia | null {
  if (!texto) return null
  const clave = claveValor(texto)
  const elegida = eq[clave]
  if (elegida) return elegida
  const exacta = coincidenciaExacta(texto, items)
  return exacta ? { tipo: "existente", id: exacta.id } : null
}

function nombreDe(items: ItemCatalogo[], id: string): string {
  return items.find((i) => i.id === id)?.nombre ?? id
}

/** Rellena los campos vacíos del contacto existente con los de la fila; nunca sobrescribe. */
export function calcularFusion(
  existente: Pick<Contacto, "empresa" | "telefono" | "telefono_raw" | "email" | "doc_numero" | "doc_tipo" | "direccion" | "notas" | "extra">,
  datos: FilaNormalizada,
): ContactoUpdate {
  const cambios: ContactoUpdate = {}
  if (!existente.empresa && datos.empresa) cambios.empresa = datos.empresa
  if (!existente.telefono && datos.telefono) {
    cambios.telefono = datos.telefono
    cambios.telefono_raw = datos.telefono_raw
  }
  if (!existente.email && datos.email) cambios.email = datos.email
  if (!existente.doc_numero && datos.doc_numero) {
    cambios.doc_numero = datos.doc_numero
    if (!existente.doc_tipo && datos.doc_tipo) cambios.doc_tipo = datos.doc_tipo
  }
  if (!existente.direccion && datos.direccion) cambios.direccion = datos.direccion
  if (datos.notas) {
    const actuales = existente.notas ?? ""
    if (!actuales.includes(datos.notas)) cambios.notas = actuales ? `${actuales}\n${datos.notas}` : datos.notas
  }
  const extraActual = existente.extra && typeof existente.extra === "object" && !Array.isArray(existente.extra) ? existente.extra : {}
  const extraNuevo: Record<string, Json> = {}
  for (const [k, v] of Object.entries(datos.extra)) {
    if (extraActual[k] === undefined || extraActual[k] === null || extraActual[k] === "") extraNuevo[k] = v
  }
  if (Object.keys(extraNuevo).length > 0) cambios.extra = { ...extraActual, ...extraNuevo } as Json
  return cambios
}

function fusionarEnPlan(destino: ContactoPlanificado, datos: FilaNormalizada): void {
  const cambios = calcularFusion(destino, datos)
  if (cambios.empresa !== undefined) destino.empresa = cambios.empresa ?? null
  if (cambios.telefono !== undefined) {
    destino.telefono = cambios.telefono ?? null
    destino.telefono_raw = cambios.telefono_raw ?? null
  }
  if (cambios.email !== undefined) destino.email = cambios.email ?? null
  if (cambios.doc_numero !== undefined) destino.doc_numero = cambios.doc_numero ?? null
  if (cambios.doc_tipo !== undefined) destino.doc_tipo = cambios.doc_tipo ?? null
  if (cambios.direccion !== undefined) destino.direccion = cambios.direccion ?? null
  if (cambios.notas !== undefined) destino.notas = cambios.notas ?? null
  if (cambios.extra !== undefined && cambios.extra && typeof cambios.extra === "object" && !Array.isArray(cambios.extra)) {
    destino.extra = cambios.extra as Record<string, Json>
  }
}

/** Planifica qué pasa con cada fila. No toca la base de datos. */
export function planificarImportacion(filas: FilaNormalizada[], opciones: OpcionesPlan): PlanImportacion {
  const { mapeo, equivalencias, catalogos, existentes, tituloDefault, importeDefault } = opciones
  const camposMapeados = new Set(Object.values(mapeo))
  const creaOportunidades =
    camposMapeados.has("etapa") || camposMapeados.has("importe") || camposMapeados.has("estado") || camposMapeados.has("titulo_oportunidad")

  const indice = new IndiceDuplicados()
  for (const c of existentes) indice.registrar(c, { origen: "base", id: c.id, nombre: c.nombre })

  const motivoOtro =
    catalogos.motivos.find((m) => claveValor(m.nombre) === "otro") ??
    catalogos.motivos.find((m) => claveValor(m.nombre).includes("import")) ??
    catalogos.motivos[0] ??
    null

  const planPorFila = new Map<number, PlanFila>()
  const plan: PlanFila[] = []

  for (const datos of filas) {
    if (datos.vacia) continue
    const motivos: string[] = []
    let requiereRevision = false
    const revisar = (motivo: string) => {
      motivos.push(motivo)
      requiereRevision = true
    }

    // 1. Duplicados (contra la base y contra filas anteriores del archivo).
    const candidato = indice.buscar(datos)
    if (candidato) {
      const parecido = datos.nombre ? similitud(datos.nombre, candidato.con.nombre) : 1
      const donde = candidato.con.origen === "base" ? "ya en el CRM" : `fila ${candidato.con.fila}`
      if (parecido >= SIMILITUD_MINIMA_FUSION) {
        const planFila: PlanFila = {
          fila: datos.fila,
          datos,
          resultado: "fusionado",
          motivos: [`Mismo ${candidato.via} que ${candidato.con.nombre} (${donde})`],
          fusionarCon: candidato.con,
          contacto: null,
          oportunidad: null,
        }
        if (candidato.con.origen === "archivo") {
          const destino = planPorFila.get(candidato.con.fila)?.contacto
          if (destino) fusionarEnPlan(destino, datos)
        }
        plan.push(planFila)
        continue
      }
      revisar(`Mismo ${candidato.via} que ${candidato.con.nombre} (${donde}) pero el nombre es distinto`)
    }

    // 2. Nombre y datos de contacto.
    let nombre = datos.nombre
    if (!nombre && !datos.telefono && !datos.email) {
      nombre = `(Sin nombre) fila ${datos.fila}`
      revisar("Sin nombre, celular ni correo")
    } else if (!nombre) {
      nombre = datos.empresa ?? datos.email ?? datos.telefono_raw ?? `(Sin nombre) fila ${datos.fila}`
      revisar("Sin nombre")
    } else if (!datos.telefono && !datos.email) {
      revisar("Sin celular ni correo")
    }
    if (datos.telefono_raw && !datos.telefono) revisar(`Celular no reconocido: ${datos.telefono_raw}`)

    // 3. Catálogos.
    const origen = equivalenciaDe(equivalencias.origenes, datos.origen, catalogos.origenes)
    let responsable = equivalenciaDe(equivalencias.responsables, datos.responsable, catalogos.usuarios)
    if (datos.responsable && (!responsable || responsable.tipo === "admin")) {
      responsable = { tipo: "admin" }
      revisar(`Responsable «${datos.responsable}» no existe; asignado al administrador`)
    }

    // 4. Oportunidad.
    let oportunidad: OportunidadPlanificada | null = null
    const created_at = datos.fecha ? desdeLima(datos.fecha, "09:00") : null
    if (creaOportunidades && (datos.etapa || datos.importe !== null || datos.estado || datos.titulo_oportunidad)) {
      const eqEtapa = equivalenciaDe(equivalencias.etapas, datos.etapa, catalogos.etapas)
      let estado: EstadoOportunidad = "abierta"
      let etapa: Equivalencia | null = null
      if (eqEtapa?.tipo === "estado") estado = eqEtapa.estado
      else if (eqEtapa) etapa = eqEtapa
      else if (datos.etapa) {
        const interpretado = interpretarEstado(datos.etapa)
        if (interpretado) estado = interpretado
        else etapa = { tipo: "crear" }
      }
      const estadoColumna = interpretarEstado(datos.estado)
      if (estadoColumna) estado = estadoColumna
      let motivoPerdidaId: string | null = null
      if (estado === "perdida") {
        if (motivoOtro) {
          motivoPerdidaId = motivoOtro.id
          revisar(`Oportunidad perdida sin motivo: se puso «${motivoOtro.nombre}»`)
        } else {
          estado = "abierta"
          revisar("Oportunidad perdida pero no hay motivos de pérdida configurados: queda abierta")
        }
      }
      oportunidad = {
        titulo: datos.titulo_oportunidad ?? `${nombre} – ${tituloDefault}`,
        importe: datos.importe ?? importeDefault,
        etapa,
        estado,
        motivoPerdidaId,
        created_at,
      }
    }

    const extra: Record<string, Json> = { ...datos.extra }
    if (oportunidad) extra._importacion_oportunidad = { titulo: oportunidad.titulo, etapa: datos.etapa ?? "", estado: oportunidad.estado }

    const contacto: ContactoPlanificado = {
      nombre,
      empresa: datos.empresa,
      telefono: datos.telefono,
      telefono_raw: datos.telefono_raw,
      email: datos.email,
      doc_numero: datos.doc_numero,
      doc_tipo: datos.doc_tipo,
      direccion: datos.direccion,
      notas: datos.notas,
      extra,
      requiere_revision: requiereRevision,
      origen,
      responsable,
      created_at,
    }

    const planFila: PlanFila = {
      fila: datos.fila,
      datos,
      resultado: requiereRevision ? "revisar" : "creado",
      motivos,
      fusionarCon: null,
      contacto,
      oportunidad,
    }
    plan.push(planFila)
    planPorFila.set(datos.fila, planFila)
    indice.registrar(datos, { origen: "archivo", fila: datos.fila, nombre })
  }

  const recuento: RecuentoImportacion = {
    total: filas.length,
    noVacias: filas.filter((f) => !f.vacia).length,
    crear: plan.filter((p) => p.resultado === "creado").length,
    fusionar: plan.filter((p) => p.resultado === "fusionado").length,
    revisar: plan.filter((p) => p.resultado === "revisar").length,
  }
  return { filas: plan, recuento, creaOportunidades }
}

/** Texto corto del resultado previsto de una fila: "Crear", "Fusionar con X", "Revisar: motivo". */
export function describirResultado(p: PlanFila): string {
  if (p.resultado === "fusionado" && p.fusionarCon) return `Fusionar con ${p.fusionarCon.nombre}`
  if (p.resultado === "revisar") return `Revisar: ${p.motivos.join("; ")}`
  return "Crear"
}

/** Nombre legible de una equivalencia para mostrar en chips y en el informe. */
export function describirEquivalencia(eq: Equivalencia | null, tipo: TipoCatalogo, catalogos: CatalogosImportacion, texto: string): string {
  if (!eq) return texto
  switch (eq.tipo) {
    case "existente":
      return nombreDe(tipo === "origenes" ? catalogos.origenes : tipo === "etapas" ? catalogos.etapas : catalogos.usuarios, eq.id)
    case "crear":
      return `Crear «${texto}»`
    case "estado":
      return eq.estado === "ganada" ? "Ganada" : "Perdida"
    case "admin":
      return "Administrador (revisar)"
  }
}

/** Filas del informe CSV: fila, resultado, motivo, nombre, contacto. */
export interface FilaInformeCSV extends Record<string, unknown> {
  fila: number
  resultado: string
  motivo: string
  nombre: string
  contacto: string
}

export const COLUMNAS_INFORME_CSV = [
  { clave: "fila", titulo: "Fila" },
  { clave: "resultado", titulo: "Resultado" },
  { clave: "motivo", titulo: "Motivo" },
  { clave: "nombre", titulo: "Nombre" },
  { clave: "contacto", titulo: "Contacto (id)" },
]

export const ETIQUETA_RESULTADO: Record<ResultadoImportacion, string> = {
  creado: "Creado",
  fusionado: "Fusionado",
  revisar: "Revisar",
}
