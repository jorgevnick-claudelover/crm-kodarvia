/**
 * Almacén local del CRM. Toda la aplicación guarda y lee de aquí: una sola clave
 * de localStorage (`crm.datos`) con un único objeto JSON.
 *
 * Reglas de uso para `src/lib/api/*`:
 *  - `leer()` devuelve el objeto CACHEADO: es de solo lectura, nunca lo mutes.
 *  - `escribir(mutador)` es el ÚNICO camino de escritura. El mutador recibe una
 *    copia profunda; devuelve lo que quieras y eso es lo que recibe quien llama.
 *  - Al guardar se detectan las tablas que cambiaron y se avisa a los suscriptores
 *    (`suscribirse`) de esta pestaña y de las demás pestañas del mismo navegador.
 */
import type {
  Actividad,
  Contacto,
  Etapa,
  HistorialEtapa,
  Importacion,
  MotivoPerdida,
  Oportunidad,
  Origen,
  Tarea,
  Usuario,
} from "@/lib/types"
import { VERSION_DATOS, crearSemilla } from "@/lib/semilla"

export { VERSION_DATOS }

/** Clave única de localStorage donde vive toda la base de datos. */
export const CLAVE_DATOS = "crm.datos"

/** Evento propio para avisar a la PESTAÑA ACTUAL (el evento `storage` solo llega a las otras). */
export const EVENTO_CAMBIO = "crm:cambio"

/** Forma del objeto guardado en `crm.datos`. */
export interface BaseDatos {
  /** Para futuras migraciones del formato. */
  version: number
  usuarios: Usuario[]
  etapas: Etapa[]
  motivos_perdida: MotivoPerdida[]
  origenes: Origen[]
  contactos: Contacto[]
  oportunidades: Oportunidad[]
  historial_etapas: HistorialEtapa[]
  tareas: Tarea[]
  actividades: Actividad[]
  importaciones: Importacion[]
  configuracion: Record<string, unknown>
}

/** Tablas del almacén, en el orden en que se serializan. */
export const TABLAS = [
  "usuarios",
  "etapas",
  "motivos_perdida",
  "origenes",
  "contactos",
  "oportunidades",
  "historial_etapas",
  "tareas",
  "actividades",
  "importaciones",
  "configuracion",
] as const
export type TablaAlmacen = (typeof TABLAS)[number]

/** Cuota típica de localStorage: 5 MB. Se avisa al pasar del 80 %. */
export const LIMITE_BYTES = 5 * 1024 * 1024
const UMBRAL_AVISO = 0.8

// -----------------------------------------------------------------------------
// localStorage tolerante (modo privado, cuota agotada, navegador sin soporte)
// -----------------------------------------------------------------------------

let memoria: string | null = null

function almacenamiento(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null
    return window.localStorage
  } catch {
    return null
  }
}

function leerCrudo(): string | null {
  const s = almacenamiento()
  if (!s) return memoria
  try {
    return s.getItem(CLAVE_DATOS)
  } catch {
    return memoria
  }
}

function guardarCrudo(texto: string): void {
  memoria = texto
  const s = almacenamiento()
  if (!s) return
  try {
    s.setItem(CLAVE_DATOS, texto)
  } catch {
    throw new Error(
      "El navegador se está quedando sin espacio y no pudo guardar. Exporta una copia de seguridad desde Configuración y borra datos que ya no necesites.",
    )
  }
}

// -----------------------------------------------------------------------------
// Caché en memoria: el objeto parseado y el JSON de cada tabla
// -----------------------------------------------------------------------------

type JsonPorTabla = Record<TablaAlmacen, string>

interface Cache {
  db: BaseDatos
  texto: string
  porTabla: JsonPorTabla
}

let cache: Cache | null = null

function serializar(db: BaseDatos): { texto: string; porTabla: JsonPorTabla } {
  const porTabla = {} as JsonPorTabla
  const partes: string[] = [`"version":${JSON.stringify(db.version)}`]
  for (const tabla of TABLAS) {
    const json = JSON.stringify(db[tabla] ?? (tabla === "configuracion" ? {} : []))
    porTabla[tabla] = json
    partes.push(`${JSON.stringify(tabla)}:${json}`)
  }
  return { texto: `{${partes.join(",")}}`, porTabla }
}

/** Completa las tablas que falten (datos de una versión anterior o importación parcial). */
function normalizar(valor: unknown): BaseDatos {
  if (valor === null || typeof valor !== "object" || Array.isArray(valor)) {
    throw new Error("Los datos no tienen el formato esperado.")
  }
  const bruto = valor as Record<string, unknown>
  const db = crearSemilla()
  db.version = typeof bruto.version === "number" ? bruto.version : VERSION_DATOS
  for (const tabla of TABLAS) {
    const filas = bruto[tabla]
    if (tabla === "configuracion") {
      if (filas && typeof filas === "object" && !Array.isArray(filas)) {
        db.configuracion = { ...db.configuracion, ...(filas as Record<string, unknown>) }
      }
      continue
    }
    if (Array.isArray(filas)) {
      // Cada tabla es homogénea; el tipado real lo garantiza la capa de datos.
      ;(db as unknown as Record<string, unknown[]>)[tabla] = filas
    }
  }
  return db
}

function fijarCache(db: BaseDatos): Cache {
  const { texto, porTabla } = serializar(db)
  cache = { db, texto, porTabla }
  return cache
}

function sembrarYGuardar(): Cache {
  const db = crearSemilla()
  const c = fijarCache(db)
  guardarCrudo(c.texto)
  return c
}

function cargar(): Cache {
  if (cache) return cache
  const crudo = leerCrudo()
  if (crudo == null) return sembrarYGuardar()
  try {
    return fijarCache(normalizar(JSON.parse(crudo) as unknown))
  } catch (error) {
    console.error("Los datos guardados en este navegador estaban dañados; se vuelven a crear los de ejemplo.", error)
    return sembrarYGuardar()
  }
}

// -----------------------------------------------------------------------------
// Suscripción a cambios (esta pestaña y las demás del mismo navegador)
// -----------------------------------------------------------------------------

type Escucha = (tablas: string[]) => void
const oyentes = new Set<Escucha>()

function avisar(tablas: string[]): void {
  if (tablas.length === 0) return
  for (const oyente of [...oyentes]) {
    try {
      oyente(tablas)
    } catch (error) {
      console.error("Un suscriptor de crm:cambio falló", error)
    }
  }
}

function tablasDistintas(antes: JsonPorTabla, despues: JsonPorTabla): TablaAlmacen[] {
  return TABLAS.filter((tabla) => antes[tabla] !== despues[tabla])
}

interface DetalleCambio {
  tablas: string[]
}

function emitir(tablas: TablaAlmacen[]): void {
  if (tablas.length === 0) return
  if (typeof window === "undefined") {
    avisar([...tablas])
    return
  }
  window.dispatchEvent(new CustomEvent<DetalleCambio>(EVENTO_CAMBIO, { detail: { tablas: [...tablas] } }))
}

/** Otra pestaña guardó: se rehace la caché y se avisa solo de las tablas que cambiaron. */
function recargarDesdeOtraPestana(textoNuevo: string | null): void {
  const antes = cache?.porTabla ?? null
  cache = null
  if (textoNuevo == null) {
    // La otra pestaña borró los datos (por ejemplo, "borrar datos de ejemplo").
    cargar()
    avisar([...TABLAS])
    return
  }
  let nueva: Cache
  try {
    nueva = fijarCache(normalizar(JSON.parse(textoNuevo) as unknown))
  } catch (error) {
    console.error("Otra pestaña guardó datos ilegibles; se recargan los de este navegador.", error)
    nueva = cargar()
  }
  avisar(antes ? tablasDistintas(antes, nueva.porTabla) : [...TABLAS])
}

if (typeof window !== "undefined") {
  window.addEventListener(EVENTO_CAMBIO, (evento: Event) => {
    const detalle = (evento as CustomEvent<DetalleCambio>).detail
    avisar(detalle?.tablas ?? [...TABLAS])
  })
  window.addEventListener("storage", (evento: StorageEvent) => {
    if (evento.key !== null && evento.key !== CLAVE_DATOS) return
    recargarDesdeOtraPestana(evento.key === null ? null : evento.newValue)
  })
}

/**
 * Escucha los cambios del almacén (esta pestaña y las demás del mismo navegador).
 * Devuelve la función para desuscribirse.
 */
export function suscribirse(escucha: Escucha): () => void {
  oyentes.add(escucha)
  return () => {
    oyentes.delete(escucha)
  }
}

// -----------------------------------------------------------------------------
// API pública
// -----------------------------------------------------------------------------

/** Base de datos completa. SOLO LECTURA: para cambiar algo usa `escribir`. */
export function leer(): BaseDatos {
  return cargar().db
}

/**
 * Único camino de escritura. `mutador` recibe una copia profunda de la base de
 * datos, la modifica y devuelve lo que quiera; al terminar se guarda, se detectan
 * las tablas tocadas y se avisa a las demás pestañas.
 *
 * Detectamos las tablas comparando su JSON antes y después, así da igual si el
 * mutador reemplaza el array o modifica una fila por dentro. Con `tablas` puedes
 * forzar que se invalide alguna más.
 */
export function escribir<T>(mutador: (db: BaseDatos) => T, tablas?: readonly TablaAlmacen[]): T {
  const anterior = cargar()
  const copia = normalizar(JSON.parse(anterior.texto) as unknown)
  const resultado = mutador(copia)

  const { texto, porTabla } = serializar(copia)
  const bytes = texto.length * 2 // localStorage guarda UTF-16
  if (bytes > LIMITE_BYTES * UMBRAL_AVISO) {
    throw new Error(
      `El navegador se está quedando sin espacio (${Math.round((bytes / LIMITE_BYTES) * 100)} % de lo que permite). ` +
        "Exporta una copia de seguridad desde Configuración y borra datos que ya no necesites antes de seguir guardando.",
    )
  }

  guardarCrudo(texto)
  cache = { db: copia, texto, porTabla }

  const cambiadas = new Set<TablaAlmacen>(tablasDistintas(anterior.porTabla, porTabla))
  for (const tabla of tablas ?? []) cambiadas.add(tabla)
  emitir([...cambiadas])

  return resultado
}

/** Identificador nuevo para cualquier fila. */
export function nuevoId(): string {
  const cripto = typeof globalThis.crypto === "undefined" ? undefined : globalThis.crypto
  if (cripto && typeof cripto.randomUUID === "function") return cripto.randomUUID()
  // Navegadores antiguos o contextos sin crypto.randomUUID.
  const bytes = new Uint8Array(16)
  if (cripto && typeof cripto.getRandomValues === "function") cripto.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Instante actual en ISO UTC (las fechas se guardan siempre en UTC). */
export function ahora(): string {
  return new Date().toISOString()
}

/** Borra todo y vuelve a sembrar (lo usa "borrar datos de ejemplo"). */
export function reiniciar(): void {
  cache = null
  memoria = null
  const s = almacenamiento()
  if (s) {
    try {
      s.removeItem(CLAVE_DATOS)
    } catch {
      // sin localStorage: basta con la copia en memoria
    }
  }
  sembrarYGuardar()
  emitir([...TABLAS])
}

/** Copia de seguridad manual: todo el CRM como texto JSON. */
export function exportarTodo(): string {
  return JSON.stringify(leer(), null, 2)
}

/** Restaura una copia de seguridad hecha con `exportarTodo`. Lanza si el texto no sirve. */
export function importarTodo(json: string): void {
  let valor: unknown
  try {
    valor = JSON.parse(json) as unknown
  } catch {
    throw new Error("El archivo no es una copia de seguridad válida: no se pudo leer el JSON.")
  }
  let db: BaseDatos
  try {
    db = normalizar(valor)
  } catch {
    throw new Error("El archivo no es una copia de seguridad de este CRM.")
  }
  const { texto, porTabla } = serializar(db)
  if (texto.length * 2 > LIMITE_BYTES * UMBRAL_AVISO) {
    throw new Error("El navegador se está quedando sin espacio: esa copia de seguridad es demasiado grande para guardarla aquí.")
  }
  guardarCrudo(texto)
  cache = { db, texto, porTabla }
  emitir([...TABLAS])
}

/** Cuánto ocupan los datos y qué porcentaje de la cuota del navegador es (0-100). */
export function tamanoAproximado(): { bytes: number; porcentaje: number } {
  const bytes = cargar().texto.length * 2
  return { bytes, porcentaje: Math.round((bytes / LIMITE_BYTES) * 1000) / 10 }
}
