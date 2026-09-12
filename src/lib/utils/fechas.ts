/**
 * Fechas siempre en America/Lima. Se guarda UTC (ISO) y se muestra/captura en Lima.
 * Nunca usar new Date().toLocaleString() sin zona fuera de aquí.
 */
import { addDays, differenceInCalendarDays, format, isValid, parse } from "date-fns"
import { es } from "date-fns/locale"
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz"

export const ZONA = "America/Lima"

type Fecha = string | Date | null | undefined

function aDate(valor: Fecha): Date | null {
  if (valor == null || valor === "") return null
  const d = valor instanceof Date ? valor : new Date(valor)
  return isValid(d) ? d : null
}

/** Convierte un instante (ISO UTC o Date) en una Date "de pared" con la hora de Lima. */
export function aLima(iso: Fecha): Date {
  const d = aDate(iso) ?? new Date()
  return toZonedTime(d, ZONA)
}

/**
 * Construye un instante UTC (ISO) a partir de fecha 'yyyy-MM-dd' y hora 'HH:mm' (o 'HH:mm:ss') en Lima.
 */
export function desdeLima(fechaStr: string, horaStr = "00:00"): string {
  const hora = horaStr.length === 5 ? `${horaStr}:00` : horaStr
  return fromZonedTime(`${fechaStr}T${hora}`, ZONA).toISOString()
}

/** Fin del día en Lima (23:59:59.999) como ISO UTC; útil para filtros "hasta". */
export function finDeDiaLima(fechaStr: string): string {
  const inicio = fromZonedTime(`${fechaStr}T00:00:00`, ZONA)
  return new Date(addDays(inicio, 1).getTime() - 1).toISOString()
}

export function formatearFecha(iso: Fecha): string {
  const d = aDate(iso)
  return d ? formatInTimeZone(d, ZONA, "dd/MM/yyyy") : ""
}

export function formatearFechaHora(iso: Fecha): string {
  const d = aDate(iso)
  return d ? formatInTimeZone(d, ZONA, "dd/MM/yyyy HH:mm") : ""
}

export function formatearHora(iso: Fecha): string {
  const d = aDate(iso)
  return d ? formatInTimeZone(d, ZONA, "HH:mm") : ""
}

/** Fecha larga legible: "lunes 15 de septiembre". */
export function formatearFechaLarga(iso: Fecha): string {
  const d = aDate(iso)
  return d ? formatInTimeZone(d, ZONA, "EEEE d 'de' MMMM", { locale: es }) : ""
}

/** 'yyyy-MM-dd' de hoy en Lima. */
export function hoyLima(): string {
  return formatInTimeZone(new Date(), ZONA, "yyyy-MM-dd")
}

/** 'HH:mm' de ahora en Lima. */
export function ahoraHoraLima(): string {
  return formatInTimeZone(new Date(), ZONA, "HH:mm")
}

/** Primer día del mes (en Lima) del instante dado, como 'yyyy-MM-dd'. Sin argumento: mes actual. */
export function inicioDeMesLima(iso?: Fecha): string {
  const d = aDate(iso) ?? new Date()
  return formatInTimeZone(d, ZONA, "yyyy-MM-01")
}

/** 'yyyy-MM' del instante en Lima. */
export function mesDeLima(iso: Fecha): string {
  const d = aDate(iso) ?? new Date()
  return formatInTimeZone(d, ZONA, "yyyy-MM")
}

/** 'yyyy-MM-dd' del instante en Lima. */
export function diaDeLima(iso: Fecha): string {
  const d = aDate(iso) ?? new Date()
  return formatInTimeZone(d, ZONA, "yyyy-MM-dd")
}

/** Suma días a una fecha 'yyyy-MM-dd' (calendario de Lima). */
export function sumarDias(fechaStr: string, dias: number): string {
  const base = parse(fechaStr, "yyyy-MM-dd", new Date())
  return format(addDays(base, dias), "yyyy-MM-dd")
}

/** Días de calendario (en Lima) entre a y b: positivo si b es posterior a a. */
export function diasEntre(a: Fecha, b: Fecha = new Date()): number {
  const da = aDate(a)
  const db = aDate(b)
  if (!da || !db) return 0
  return differenceInCalendarDays(toZonedTime(db, ZONA), toZonedTime(da, ZONA))
}

/** true si el instante ya pasó. */
export function esVencida(iso: Fecha): boolean {
  const d = aDate(iso)
  return d ? d.getTime() < Date.now() : false
}

/** Hoy, Mañana, Ayer o dd/MM según el día de Lima. */
export function etiquetaRelativa(iso: Fecha): string {
  const d = aDate(iso)
  if (!d) return ""
  const dias = diasEntre(new Date(), d)
  if (dias === 0) return "Hoy"
  if (dias === 1) return "Mañana"
  if (dias === -1) return "Ayer"
  return formatInTimeZone(d, ZONA, "dd/MM")
}

/** Hora en Lima con etiqueta relativa: "Hoy 09:00", "15/09 14:30". */
export function etiquetaRelativaConHora(iso: Fecha): string {
  const d = aDate(iso)
  if (!d) return ""
  return `${etiquetaRelativa(d)} ${formatInTimeZone(d, ZONA, "HH:mm")}`
}

/** Descompone un ISO en { fecha: 'yyyy-MM-dd', hora: 'HH:mm' } en Lima (para rellenar formularios). */
export function partesLima(iso: Fecha): { fecha: string; hora: string } {
  const d = aDate(iso) ?? new Date()
  return { fecha: formatInTimeZone(d, ZONA, "yyyy-MM-dd"), hora: formatInTimeZone(d, ZONA, "HH:mm") }
}
