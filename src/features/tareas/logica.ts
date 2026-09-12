/**
 * Lógica pura del módulo de tareas (sin React ni Supabase) para poder probarla con vitest:
 * título por defecto, conversión fecha+hora de Lima a UTC, agrupación Vencidas/Hoy/Próximos,
 * agrupación por día, avisos locales y filas de exportación.
 */
import type { Tarea, TareaConRelaciones } from "@/lib/types"
import type { ColumnaCSV } from "@/lib/utils/csv"
import { ahoraHoraLima, desdeLima, diaDeLima, formatearFechaHora, hoyLima, sumarDias } from "@/lib/utils/fechas"

/** "Llamar a {contacto}"; vacío si no hay contacto (el usuario escribe el título). */
export function tituloPorDefecto(nombreContacto?: string | null): string {
  const nombre = nombreContacto?.trim()
  return nombre ? `Llamar a ${nombre}` : ""
}

/** Instante UTC (ISO) de una fecha 'yyyy-MM-dd' y hora 'HH:mm' elegidas en Lima. */
export function calcularVenceAt(fecha: string, hora: string): string {
  return desdeLima(fecha, hora || "00:00")
}

/** recordatorio_at = vence_at si "Avisarme" está activo; null si no. */
export function calcularRecordatorioAt(venceAt: string, avisar: boolean): string | null {
  return avisar ? venceAt : null
}

/**
 * Fecha por defecto de una tarea nueva: hoy si la hora de recordatorio aún no pasó; si ya pasó, mañana.
 * Las horas son 'HH:mm' (comparables como texto).
 */
export function fechaPorDefecto(horaRecordatorio: string, hoy: string = hoyLima(), ahoraHora: string = ahoraHoraLima()): string {
  return horaRecordatorio > ahoraHora ? hoy : sumarDias(hoy, 1)
}

type TareaMinima = Pick<Tarea, "vence_at" | "estado">

export interface GruposHoy<T> {
  /** Pendientes cuya hora ya pasó. */
  vencidas: T[]
  /** Pendientes de hoy (Lima) que aún no vencen. */
  hoy: T[]
  /** Pendientes de mañana a dentro de 7 días. */
  proximos: T[]
}

function porVencimiento<T extends Pick<Tarea, "vence_at">>(a: T, b: T): number {
  return a.vence_at < b.vence_at ? -1 : a.vence_at > b.vence_at ? 1 : 0
}

/**
 * Reparte las tareas pendientes en Vencidas · Hoy · Próximos 7 días. Vencida = su hora ya pasó
 * (mismo criterio que esVencida y que el punto rojo de las oportunidades); Hoy = resto del día de Lima.
 */
export function agruparParaHoy<T extends TareaMinima>(tareas: readonly T[], ahora: Date = new Date()): GruposHoy<T> {
  const ahoraMs = ahora.getTime()
  const hoy = diaDeLima(ahora)
  const limite = sumarDias(hoy, 7)
  const grupos: GruposHoy<T> = { vencidas: [], hoy: [], proximos: [] }
  for (const t of tareas) {
    if (t.estado !== "pendiente") continue
    if (estaVencida(t, ahoraMs)) {
      grupos.vencidas.push(t)
      continue
    }
    const dia = diaDeLima(t.vence_at)
    if (dia === hoy) grupos.hoy.push(t)
    else if (dia > hoy && dia <= limite) grupos.proximos.push(t)
  }
  grupos.vencidas.sort(porVencimiento)
  grupos.hoy.sort(porVencimiento)
  grupos.proximos.sort(porVencimiento)
  return grupos
}

/** true si la tarea sigue pendiente y su hora ya pasó. */
export function estaVencida(tarea: TareaMinima, ahoraMs: number = Date.now()): boolean {
  return tarea.estado === "pendiente" && new Date(tarea.vence_at).getTime() < ahoraMs
}

/** Tareas pendientes cuya hora ya pasó (badge de Hoy). */
export function contarVencidas(tareas: readonly TareaMinima[], ahoraMs: number = Date.now()): number {
  return tareas.filter((t) => estaVencida(t, ahoraMs)).length
}

export interface GrupoDia<T> {
  /** 'yyyy-MM-dd' en Lima. */
  dia: string
  tareas: T[]
}

/** Agrupa por día de Lima conservando el orden en que llegan (la consulta ya viene ordenada). */
export function agruparPorDia<T extends Pick<Tarea, "vence_at">>(tareas: readonly T[]): GrupoDia<T>[] {
  const grupos: GrupoDia<T>[] = []
  const indice = new Map<string, GrupoDia<T>>()
  for (const t of tareas) {
    const dia = diaDeLima(t.vence_at)
    let grupo = indice.get(dia)
    if (!grupo) {
      grupo = { dia, tareas: [] }
      indice.set(dia, grupo)
      grupos.push(grupo)
    }
    grupo.tareas.push(t)
  }
  return grupos
}

export interface AvisoProgramado {
  id: string
  /** Milisegundos hasta la hora del recordatorio. */
  retrasoMs: number
}

const DOCE_HORAS = 12 * 60 * 60 * 1000

/**
 * Recordatorios pendientes (no vistos) que vencen en el futuro dentro del horizonte:
 * se programan con setTimeout para que el aviso salte a la hora exacta aunque no haya refetch.
 */
export function proximosAvisos<T extends Pick<Tarea, "id" | "estado" | "recordatorio_at" | "recordatorio_visto_at">>(
  tareas: readonly T[],
  ahoraMs: number = Date.now(),
  horizonteMs: number = DOCE_HORAS,
): AvisoProgramado[] {
  const avisos: AvisoProgramado[] = []
  for (const t of tareas) {
    if (t.estado !== "pendiente" || !t.recordatorio_at || t.recordatorio_visto_at) continue
    const retrasoMs = new Date(t.recordatorio_at).getTime() - ahoraMs
    if (retrasoMs > 0 && retrasoMs <= horizonteMs) avisos.push({ id: t.id, retrasoMs })
  }
  return avisos.sort((a, b) => a.retrasoMs - b.retrasoMs)
}

export const COLUMNAS_EXPORTACION_TAREAS: ColumnaCSV[] = [
  { clave: "titulo", titulo: "Título" },
  { clave: "contacto", titulo: "Contacto" },
  { clave: "oportunidad", titulo: "Oportunidad" },
  { clave: "vence", titulo: "Vence" },
  { clave: "recordatorio", titulo: "Recordatorio" },
  { clave: "responsable", titulo: "Responsable" },
  { clave: "estado", titulo: "Estado" },
  { clave: "hecha_el", titulo: "Hecha el" },
]

/** Fila legible para el CSV (fechas en Lima, nombres en vez de ids). */
export function filaExportacionTarea(t: TareaConRelaciones): Record<string, unknown> {
  return {
    titulo: t.titulo,
    contacto: t.contacto?.nombre ?? "",
    oportunidad: t.oportunidad?.titulo ?? "",
    vence: formatearFechaHora(t.vence_at),
    recordatorio: t.recordatorio_at ? formatearFechaHora(t.recordatorio_at) : "",
    responsable: t.responsable?.nombre ?? "",
    estado: t.estado === "hecha" ? "Hecha" : "Pendiente",
    hecha_el: t.hecha_at ? formatearFechaHora(t.hecha_at) : "",
  }
}
