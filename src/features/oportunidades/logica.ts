/**
 * Lógica pura del módulo de oportunidades (sin React ni acceso a datos): posiciones
 * fraccionarias del tablero, sumas por columna, agrupación, filas de exportación.
 */
import type { Etapa, EstadoOportunidad, OportunidadConRelaciones } from "@/lib/types"
import type { ColumnaCSV } from "@/lib/utils/csv"
import { diasEntre, formatearFecha, formatearFechaHora } from "@/lib/utils/fechas"
import { importeParaCSV } from "@/lib/utils/moneda"
import { ETIQUETA_ESTADO_OPORTUNIDAD } from "@/lib/types"

/** Lo mínimo que hace falta de una tarjeta para calcular posiciones. */
export interface TarjetaPosicion {
  id: string
  posicion: number
  created_at?: string
}

/** Posición fraccionaria entre dos vecinas; si falta alguna, un entero por fuera. */
export function posicionEntre(anterior: number | null | undefined, siguiente: number | null | undefined): number {
  const hayAnterior = typeof anterior === "number" && Number.isFinite(anterior)
  const haySiguiente = typeof siguiente === "number" && Number.isFinite(siguiente)
  if (hayAnterior && haySiguiente) return (anterior + siguiente) / 2
  if (hayAnterior) return anterior + 1
  if (haySiguiente) return siguiente - 1
  return 1
}

/** Posición para dejar una tarjeta al final de una columna (máximo + 1; 1 si está vacía). */
export function posicionAlFinal(tarjetas: readonly TarjetaPosicion[], excluirId?: string): number {
  let max: number | null = null
  for (const t of tarjetas) {
    if (t.id === excluirId) continue
    if (max === null || t.posicion > max) max = t.posicion
  }
  return posicionEntre(max, null)
}

/** Orden de una columna: posición ascendente y, a igualdad, la más reciente primero. */
export function ordenarTarjetas<T extends TarjetaPosicion>(tarjetas: readonly T[]): T[] {
  return [...tarjetas].sort((a, b) => {
    if (a.posicion !== b.posicion) return a.posicion - b.posicion
    return (b.created_at ?? "").localeCompare(a.created_at ?? "")
  })
}

/**
 * Posición que debe tomar la tarjeta `activoId` al soltarla en una columna.
 * `tarjetas` es la columna destino ya ordenada (puede incluir la propia tarjeta si es la misma columna).
 * `sobreId` es la tarjeta sobre la que se soltó; null = al final.
 * Si venía de más arriba en la misma columna, se coloca después de `sobreId`; si no, antes.
 */
export function calcularPosicionDestino(
  tarjetas: readonly TarjetaPosicion[],
  activoId: string,
  sobreId: string | null,
): number {
  const sinActivo = tarjetas.filter((t) => t.id !== activoId)
  if (!sobreId || sobreId === activoId) return posicionAlFinal(sinActivo)
  const indice = sinActivo.findIndex((t) => t.id === sobreId)
  if (indice === -1) return posicionAlFinal(sinActivo)
  const indiceActivo = tarjetas.findIndex((t) => t.id === activoId)
  const indiceSobre = tarjetas.findIndex((t) => t.id === sobreId)
  const veniaDeArriba = indiceActivo !== -1 && indiceActivo < indiceSobre
  const anterior = veniaDeArriba ? sinActivo[indice] : sinActivo[indice - 1]
  const siguiente = veniaDeArriba ? sinActivo[indice + 1] : sinActivo[indice]
  const posAnterior = anterior?.posicion ?? null
  const posSiguiente = siguiente?.posicion ?? null
  // Vecinas empatadas (filas antiguas nacidas todas con la misma posición): no hay hueco
  // fraccionario, así que se desplaza medio punto en el sentido del arrastre para que
  // soltar no devuelva la posición actual y la mutación no se descarte en silencio.
  if (posAnterior !== null && posSiguiente !== null && posAnterior === posSiguiente) {
    return veniaDeArriba ? posAnterior + 0.5 : posAnterior - 0.5
  }
  return posicionEntre(posAnterior, posSiguiente)
}

/** Suma de importes (ignora valores no numéricos). */
export function sumaImportes(oportunidades: readonly { importe: number | null | undefined }[]): number {
  let total = 0
  for (const o of oportunidades) {
    const n = Number(o.importe)
    if (Number.isFinite(n)) total += n
  }
  return Math.round(total * 100) / 100
}

/** Agrupa por etapa (solo las etapas dadas, en su orden) con cada columna ya ordenada. */
export function agruparPorEtapa<T extends TarjetaPosicion & { etapa_id: string }>(
  oportunidades: readonly T[],
  etapas: readonly Etapa[],
): Map<string, T[]> {
  const mapa = new Map<string, T[]>()
  for (const e of etapas) mapa.set(e.id, [])
  for (const o of oportunidades) {
    const lista = mapa.get(o.etapa_id)
    if (lista) lista.push(o)
  }
  for (const [id, lista] of mapa) mapa.set(id, ordenarTarjetas(lista))
  return mapa
}

/** Etapa que sigue a la actual en el orden (null si es la última o no está). */
export function siguienteEtapa(etapas: readonly Etapa[], etapaActualId: string): Etapa | null {
  const i = etapas.findIndex((e) => e.id === etapaActualId)
  if (i === -1 || i + 1 >= etapas.length) return null
  return etapas[i + 1]
}

/** Días en la etapa actual: desde el último cambio de etapa o, si no lo hay, desde updated_at. */
export function diasEnEtapa(oportunidad: { updated_at: string; created_at: string }, ultimoCambioIso?: string | null): number {
  const base = ultimoCambioIso ?? oportunidad.updated_at ?? oportunidad.created_at
  return Math.max(0, diasEntre(base))
}

/** Título por defecto: "{contacto} – {título por defecto}". */
export function tituloPorDefecto(nombreContacto: string | null | undefined, tituloDefault: string): string {
  const contacto = (nombreContacto ?? "").trim()
  const titulo = (tituloDefault ?? "").trim() || "Oportunidad"
  return contacto ? `${contacto} – ${titulo}` : titulo
}

/** Validación de pérdida: motivo obligatorio (la base de datos lo exige también). */
export function validarPerdida(motivoId: string | null | undefined): { ok: boolean; error?: string } {
  if (!motivoId) return { ok: false, error: "Elige un motivo de pérdida." }
  return { ok: true }
}

/** Colores por estado para chips y cabeceras. */
export const COLOR_ESTADO: Record<EstadoOportunidad, string> = {
  abierta: "sky",
  ganada: "green",
  perdida: "red",
}

// ---------- Exportación (criterio 7) ----------

export const COLUMNAS_EXPORTACION: ColumnaCSV[] = [
  { clave: "contacto", titulo: "Contacto" },
  { clave: "titulo", titulo: "Título" },
  { clave: "etapa", titulo: "Etapa" },
  { clave: "estado", titulo: "Estado" },
  { clave: "importe", titulo: "Importe (S/)" },
  { clave: "responsable", titulo: "Responsable" },
  { clave: "origen", titulo: "Origen del contacto" },
  { clave: "motivo_perdida", titulo: "Motivo de pérdida" },
  { clave: "fecha_prevista", titulo: "Fecha prevista" },
  { clave: "creada", titulo: "Creada" },
  { clave: "cerrada", titulo: "Ganada/Perdida" },
]

export interface CatalogoNombres {
  origenPorId: (id: string | null | undefined) => { nombre: string } | undefined
}

/** Convierte una oportunidad con relaciones en una fila legible para el CSV. */
export function filaExportacion(o: OportunidadConRelaciones, catalogo?: CatalogoNombres): Record<string, unknown> {
  const origen = o.contacto?.origen_id ? catalogo?.origenPorId(o.contacto.origen_id)?.nombre ?? "" : ""
  return {
    contacto: o.contacto?.nombre ?? "",
    titulo: o.titulo,
    etapa: o.etapa?.nombre ?? "",
    estado: ETIQUETA_ESTADO_OPORTUNIDAD[o.estado] ?? o.estado,
    importe: importeParaCSV(o.importe),
    responsable: o.responsable?.nombre ?? "",
    origen,
    motivo_perdida: o.motivo_perdida?.nombre ?? "",
    fecha_prevista: o.fecha_cierre_prevista ? formatearFecha(`${o.fecha_cierre_prevista}T12:00:00Z`) : "",
    creada: formatearFechaHora(o.created_at),
    cerrada: o.estado === "ganada" ? formatearFechaHora(o.ganada_at) : o.estado === "perdida" ? formatearFechaHora(o.perdida_at) : "",
  }
}
