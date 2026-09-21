/**
 * Lógica pura del módulo de contactos (sin React ni acceso a datos): se prueba con vitest.
 */
import { FILTROS_CONTACTOS_DEFAULT, type FiltrosContactos } from "@/lib/api/contactos"
import type { ContactoConRelaciones, DocTipo } from "@/lib/types"
import { formatearFechaHora } from "@/lib/utils/fechas"
import { formatearTelefono } from "@/lib/utils/telefono"
import type { ColumnaCSV } from "@/lib/utils/csv"

/** Días sin actividad a partir de los cuales un contacto se considera "sin seguimiento". */
export const DIAS_SIN_SEGUIMIENTO = 14

const MS_POR_DIA = 24 * 60 * 60 * 1000

export interface DatosSeguimiento {
  /** contactos.ultima_actividad_at (ISO) o null si nunca se registró actividad. */
  ultimaActividadAt: string | null | undefined
  /** true/false si se sabe si tiene tarea pendiente; undefined si no se dispone del dato. */
  tienePendiente?: boolean
}

/**
 * "Sin seguimiento": no hay actividad registrada, o la última fue hace más de
 * DIAS_SIN_SEGUIMIENTO días, y no hay tarea pendiente (cuando se conoce ese dato).
 * Una tarea pendiente siempre cuenta como seguimiento planificado.
 */
export function estaSinSeguimiento(datos: DatosSeguimiento, ahora: Date = new Date()): boolean {
  if (datos.tienePendiente === true) return false
  if (!datos.ultimaActividadAt) return true
  const ultima = new Date(datos.ultimaActividadAt)
  if (Number.isNaN(ultima.getTime())) return true
  const dias = (ahora.getTime() - ultima.getTime()) / MS_POR_DIA
  return dias > DIAS_SIN_SEGUIMIENTO
}

/** Título por defecto de la oportunidad: "{Nombre} – {titulo_oportunidad_default}". */
export function tituloOportunidadPorDefecto(nombre: string | null | undefined, tituloDefault: string | null | undefined): string {
  const n = (nombre ?? "").trim().replace(/\s+/g, " ")
  const t = (tituloDefault ?? "").trim()
  if (n && t) return `${n} – ${t}`
  return n || t
}

/** Clave de localStorage con el último origen usado por el usuario. */
export function claveOrigenPorDefecto(uid: string | null | undefined): string {
  return `crm.origen.${uid ?? "anonimo"}`
}

export function leerOrigenPorDefecto(uid: string | null | undefined): string | null {
  try {
    return localStorage.getItem(claveOrigenPorDefecto(uid)) || null
  } catch {
    return null
  }
}

export function guardarOrigenPorDefecto(uid: string | null | undefined, origenId: string | null): void {
  try {
    if (origenId) localStorage.setItem(claveOrigenPorDefecto(uid), origenId)
    else localStorage.removeItem(claveOrigenPorDefecto(uid))
  } catch {
    // sin localStorage (modo privado): no pasa nada
  }
}

/** Texto legible del documento: "DNI 12345678", "RUC 20123456789" o "". */
export function textoDocumento(tipo: DocTipo | null | undefined, numero: string | null | undefined): string {
  const n = (numero ?? "").trim()
  if (!n) return ""
  return tipo ? `${tipo} ${n}` : n
}

/** Columnas legibles de la exportación de contactos (criterio 7). */
export const COLUMNAS_EXPORTACION_CONTACTOS: ColumnaCSV[] = [
  { clave: "nombre", titulo: "Nombre" },
  { clave: "empresa", titulo: "Empresa" },
  { clave: "celular", titulo: "Celular" },
  { clave: "correo", titulo: "Correo" },
  { clave: "documento", titulo: "Documento" },
  { clave: "origen", titulo: "Origen" },
  { clave: "responsable", titulo: "Responsable" },
  { clave: "ultima_actividad", titulo: "Última actividad" },
  { clave: "creado", titulo: "Creado" },
]

/** Convierte un contacto en la fila legible que va al CSV (nombres en vez de ids, fechas en Lima). */
export function filaExportacionContacto(c: ContactoConRelaciones): Record<string, unknown> {
  return {
    nombre: c.nombre,
    empresa: c.empresa ?? "",
    celular: c.telefono ? formatearTelefono(c.telefono) : (c.telefono_raw ?? ""),
    correo: c.email ?? "",
    documento: textoDocumento(c.doc_tipo, c.doc_numero),
    origen: c.origen?.nombre ?? "",
    responsable: c.responsable?.nombre ?? "",
    ultima_actividad: formatearFechaHora(c.ultima_actividad_at),
    creado: formatearFechaHora(c.created_at),
  }
}

// ---------- Filtros de la lista (URL) ----------

/** Mios / Todos. '' = por defecto según el rol (Mios para miembros, Todos para el administrador). */
export type QuienContactos = "mios" | "todos" | ""

/** Defaults estables para useFiltrosURL: los de la api más el chip Mios/Todos. */
export const FILTROS_URL_CONTACTOS = { ...FILTROS_CONTACTOS_DEFAULT, quien: "" as QuienContactos }
export type FiltrosURLContactos = typeof FILTROS_URL_CONTACTOS

/** true si con estos filtros la lista muestra solo los contactos del usuario. */
export function verSoloMios(quien: QuienContactos, esAdmin: boolean): boolean {
  if (quien === "mios") return true
  if (quien === "todos") return false
  return !esAdmin
}

/**
 * Convierte los filtros de la URL en los filtros de la api. La lista y la exportación
 * usan exactamente este mismo objeto (criterio 7).
 */
export function filtrosEfectivosContactos(f: FiltrosURLContactos, uid: string | null, esAdmin: boolean): FiltrosContactos {
  const soloMios = verSoloMios(f.quien, esAdmin) && !!uid
  return {
    texto: f.texto,
    responsableId: soloMios ? (uid as string) : f.responsableId,
    origenId: f.origenId,
    sinSeguimiento: f.sinSeguimiento,
    desde: f.desde,
    hasta: f.hasta,
    orden: f.orden,
  }
}

/** Para el aviso de duplicado por celular: el candidato tiene el mismo número normalizado. */
export function mismoTelefono(telefonoNormalizado: string | null, candidato: { telefono: string | null }): boolean {
  return !!telefonoNormalizado && candidato.telefono === telefonoNormalizado
}
