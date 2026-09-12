/**
 * Toda la lógica del panel, pura y sin React: recibe filas ya cargadas y
 * devuelve números listos para pintar. Las fechas se interpretan en Lima
 * (mesDeLima / diaDeLima); los días de rango son 'yyyy-MM-dd' en Lima.
 */
import { diaDeLima, hoyLima, inicioDeMesLima, mesDeLima } from "@/lib/utils/fechas"
import type {
  Contacto,
  Etapa,
  HistorialEtapa,
  MotivoPerdida,
  Oportunidad,
  OportunidadConRelaciones,
  Tarea,
  TareaConRelaciones,
  Usuario,
} from "@/lib/types"

// ---------- Rango de fechas ----------

export type PresetRango = "mes" | "3m" | "6m" | "anio" | "personalizado"

export interface Rango {
  /** 'yyyy-MM-dd' en Lima, inclusive. */
  desde: string
  hasta: string
}

export const ETIQUETA_PRESET: Record<PresetRango, string> = {
  mes: "Este mes",
  "3m": "Últimos 3 meses",
  "6m": "Últimos 6 meses",
  anio: "Este año",
  personalizado: "Personalizado",
}

export const PRESETS_RANGO: readonly PresetRango[] = ["mes", "3m", "6m", "anio", "personalizado"]

/** Suma meses a 'yyyy-MM' (aritmética de calendario, sin zona). */
export function sumarMeses(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number)
  const total = a * 12 + (m - 1) + n
  const anio = Math.floor(total / 12)
  const mm = (total % 12) + 1
  return `${anio}-${String(mm).padStart(2, "0")}`
}

/** Meses consecutivos 'yyyy-MM' desde `desde` hasta `hasta` inclusive. */
export function mesesEntre(desde: string, hasta: string): string[] {
  const salida: string[] = []
  let m = desde.slice(0, 7)
  const fin = hasta.slice(0, 7)
  let guarda = 0
  while (m <= fin && guarda < 240) {
    salida.push(m)
    m = sumarMeses(m, 1)
    guarda++
  }
  return salida
}

const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"]
const MESES_LARGOS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Setiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

/** 'yyyy-MM' -> 'Abr 2026'. */
export function etiquetaMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number)
  return `${MESES_CORTOS[(m || 1) - 1]} ${a}`
}

/** 'yyyy-MM' -> 'Abril 2026'. */
export function etiquetaMesLarga(mes: string): string {
  const [a, m] = mes.split("-").map(Number)
  return `${MESES_LARGOS[(m || 1) - 1]} ${a}`
}

/**
 * Rango de días (Lima) de un preset. Los presets de N meses abarcan N meses de
 * calendario incluido el actual. `personalizado` usa desde/hasta y, si faltan,
 * cae en los últimos 6 meses.
 */
export function rangoDePreset(preset: PresetRango, hoy: string = hoyLima(), desde?: string, hasta?: string): Rango {
  const mesActual = hoy.slice(0, 7)
  switch (preset) {
    case "mes":
      return { desde: `${mesActual}-01`, hasta: hoy }
    case "3m":
      return { desde: `${sumarMeses(mesActual, -2)}-01`, hasta: hoy }
    case "anio":
      return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy }
    case "personalizado": {
      if (desde && hasta) return desde <= hasta ? { desde, hasta } : { desde: hasta, hasta: desde }
      if (desde) return { desde, hasta: hoy < desde ? desde : hoy }
      if (hasta) return { desde: `${sumarMeses(hasta.slice(0, 7), -5)}-01`, hasta }
      return rangoDePreset("6m", hoy)
    }
    case "6m":
    default:
      return { desde: `${sumarMeses(mesActual, -5)}-01`, hasta: hoy }
  }
}

/** Meses que muestra el gráfico de ganado: 6 o 12 (si el rango pasa de 6) terminando en el último mes del rango. */
export function mesesDelGrafico(rango: Rango): string[] {
  const dentro = mesesEntre(rango.desde, rango.hasta)
  const cantidad = dentro.length > 6 ? 12 : 6
  const fin = rango.hasta.slice(0, 7)
  return Array.from({ length: cantidad }, (_, i) => sumarMeses(fin, i - (cantidad - 1)))
}

// ---------- Filtro de responsable ----------

export function filtrarPorResponsable<T extends { responsable_id: string }>(filas: T[], responsableId: string | null | undefined): T[] {
  if (!responsableId) return filas
  return filas.filter((f) => f.responsable_id === responsableId)
}

// ---------- Colores estables por responsable ----------

/** Paleta categórica validada (8 tonos; los responsables son como mucho 5). */
export const PALETA_SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"] as const

/** Color de un responsable según su posición en la lista de usuarios (estable mientras no cambie la lista). */
export function colorResponsable(id: string, usuarios: readonly { id: string }[]): string {
  const i = usuarios.findIndex((u) => u.id === id)
  if (i >= 0) return PALETA_SERIES[i % PALETA_SERIES.length]
  // Sin posición conocida: hash estable sobre el id.
  let h = 0
  for (let k = 0; k < id.length; k++) h = (h * 31 + id.charCodeAt(k)) >>> 0
  return PALETA_SERIES[h % PALETA_SERIES.length]
}

// ---------- Resumen ----------

export interface Resumen {
  abiertas: { n: number; suma: number }
  ganadoEsteMes: { n: number; suma: number }
  perdidasEsteMes: number
  tareasVencidas: number
  sinSeguimiento: number
}

export const DIAS_SIN_SEGUIMIENTO = 14

function ms(iso: string | null | undefined): number {
  if (!iso) return Number.NaN
  return new Date(iso).getTime()
}

/** Contactos sin tarea pendiente y sin actividad en los últimos 14 días. */
export function contactosSinSeguimiento(
  contactos: readonly Pick<Contacto, "id" | "ultima_actividad_at">[],
  tareasPendientes: readonly Pick<Tarea, "contacto_id" | "estado">[],
  ahora: Date,
): string[] {
  const conPendiente = new Set<string>()
  for (const t of tareasPendientes) if (t.estado === "pendiente" && t.contacto_id) conPendiente.add(t.contacto_id)
  const limite = ahora.getTime() - DIAS_SIN_SEGUIMIENTO * 24 * 60 * 60 * 1000
  return contactos
    .filter((c) => {
      if (conPendiente.has(c.id)) return false
      const ultima = ms(c.ultima_actividad_at)
      return Number.isNaN(ultima) || ultima < limite
    })
    .map((c) => c.id)
}

export function tareasVencidas<T extends Pick<Tarea, "estado" | "vence_at">>(tareas: readonly T[], ahora: Date): T[] {
  const t0 = ahora.getTime()
  return tareas.filter((t) => t.estado === "pendiente" && ms(t.vence_at) < t0)
}

export function calcularResumen(
  oportunidades: readonly Oportunidad[],
  tareasPendientes: readonly Tarea[],
  contactos: readonly Pick<Contacto, "id" | "ultima_actividad_at">[],
  ahora: Date,
): Resumen {
  const mesActual = mesDeLima(ahora)
  const abiertas = { n: 0, suma: 0 }
  const ganadoEsteMes = { n: 0, suma: 0 }
  let perdidasEsteMes = 0
  for (const o of oportunidades) {
    if (o.estado === "abierta") {
      abiertas.n++
      abiertas.suma += Number(o.importe) || 0
    } else if (o.estado === "ganada" && o.ganada_at && mesDeLima(o.ganada_at) === mesActual) {
      ganadoEsteMes.n++
      ganadoEsteMes.suma += Number(o.importe) || 0
    } else if (o.estado === "perdida" && o.perdida_at && mesDeLima(o.perdida_at) === mesActual) {
      perdidasEsteMes++
    }
  }
  return {
    abiertas,
    ganadoEsteMes,
    perdidasEsteMes,
    tareasVencidas: tareasVencidas(tareasPendientes, ahora).length,
    sinSeguimiento: contactosSinSeguimiento(contactos, tareasPendientes, ahora).length,
  }
}

// ---------- Abiertas por etapa y responsable ----------

export interface Celda {
  n: number
  suma: number
}

export interface SerieResponsable {
  id: string
  nombre: string
  color: string
}

export interface FilaEtapa {
  etapaId: string
  etapa: string
  color: string
  total: Celda
  /** Por id de responsable. */
  celdas: Record<string, Celda>
}

export interface MatrizEtapaResponsable {
  filas: FilaEtapa[]
  /** Solo responsables con alguna abierta, en el orden de `usuarios`. */
  series: SerieResponsable[]
  total: Celda
}

function nombreResponsable(o: OportunidadConRelaciones, usuarios: readonly Usuario[]): string {
  return usuarios.find((u) => u.id === o.responsable_id)?.nombre ?? o.responsable?.nombre ?? "Sin responsable"
}

export function porEtapaYResponsable(
  oportunidades: readonly OportunidadConRelaciones[],
  etapas: readonly Etapa[],
  usuarios: readonly Usuario[],
): MatrizEtapaResponsable {
  const abiertas = oportunidades.filter((o) => o.estado === "abierta")
  const nombres = new Map<string, string>()
  const filasPorEtapa = new Map<string, FilaEtapa>()
  const etapasOrdenadas = [...etapas].sort((a, b) => a.orden - b.orden)
  for (const e of etapasOrdenadas) filasPorEtapa.set(e.id, { etapaId: e.id, etapa: e.nombre, color: e.color, total: { n: 0, suma: 0 }, celdas: {} })
  const total: Celda = { n: 0, suma: 0 }
  for (const o of abiertas) {
    let fila = filasPorEtapa.get(o.etapa_id)
    if (!fila) {
      // Etapa inactiva o desconocida: se muestra igual al final para no perder oportunidades.
      fila = { etapaId: o.etapa_id, etapa: o.etapa?.nombre ?? "Otra etapa", color: o.etapa?.color ?? "slate", total: { n: 0, suma: 0 }, celdas: {} }
      filasPorEtapa.set(o.etapa_id, fila)
    }
    const importe = Number(o.importe) || 0
    const celda = (fila.celdas[o.responsable_id] ??= { n: 0, suma: 0 })
    celda.n++
    celda.suma += importe
    fila.total.n++
    fila.total.suma += importe
    total.n++
    total.suma += importe
    if (!nombres.has(o.responsable_id)) nombres.set(o.responsable_id, nombreResponsable(o, usuarios))
  }
  const ordenUsuarios = new Map(usuarios.map((u, i) => [u.id, i]))
  const series: SerieResponsable[] = [...nombres.entries()]
    .sort((a, b) => (ordenUsuarios.get(a[0]) ?? 999) - (ordenUsuarios.get(b[0]) ?? 999) || a[1].localeCompare(b[1]))
    .map(([id, nombre]) => ({ id, nombre, color: colorResponsable(id, usuarios) }))
  return { filas: [...filasPorEtapa.values()], series, total }
}

// ---------- Ganado por mes ----------

export interface PuntoMes {
  mes: string
  etiqueta: string
  n: number
  suma: number
}

/** Suma de importe de ganadas por mes (ganada_at en Lima); meses sin datos a cero. */
export function ganadoPorMes(oportunidades: readonly Oportunidad[], meses: readonly string[]): PuntoMes[] {
  const acumulado = new Map<string, PuntoMes>()
  for (const m of meses) acumulado.set(m, { mes: m, etiqueta: etiquetaMes(m), n: 0, suma: 0 })
  for (const o of oportunidades) {
    if (o.estado !== "ganada" || !o.ganada_at) continue
    const punto = acumulado.get(mesDeLima(o.ganada_at))
    if (!punto) continue
    punto.n++
    punto.suma += Number(o.importe) || 0
  }
  return [...acumulado.values()]
}

// ---------- Embudo mensual ----------

export interface PasoEmbudo {
  etapaId: string
  nombre: string
  color: string
  orden: number
  alcanzaron: number
  /** alcanzaron(k) / alcanzaron(k-1); null en el primer paso o si el anterior es 0. */
  conversion: number | null
  /** alcanzaron / total de la cohorte (0..1). */
  proporcion: number
}

export interface ResultadoEmbudo {
  mes: string
  total: number
  pasos: PasoEmbudo[]
  ganadas: number
  perdidas: number
  abiertas: number
  porcentajeGanadas: number
  porcentajePerdidas: number
}

/**
 * Cohorte de oportunidades creadas en `mes` (created_at en Lima). Una oportunidad
 * alcanza la etapa k si en el historial tiene un evento con a_etapa_id de orden
 * >= orden(k) o si su etapa actual tiene orden >= orden(k) (alcance implícito).
 * `etapasTodas` sirve para conocer el orden de etapas inactivas; los pasos se
 * pintan solo para las activas.
 */
export function embudo(
  oportunidades: readonly Oportunidad[],
  historial: readonly HistorialEtapa[],
  etapasTodas: readonly Etapa[],
  mes: string,
): ResultadoEmbudo {
  const ordenPorEtapa = new Map(etapasTodas.map((e) => [e.id, e.orden]))
  const cohorte = oportunidades.filter((o) => mesDeLima(o.created_at) === mes)
  const ids = new Set(cohorte.map((o) => o.id))
  const maxOrden = new Map<string, number>()
  for (const o of cohorte) maxOrden.set(o.id, ordenPorEtapa.get(o.etapa_id) ?? Number.NEGATIVE_INFINITY)
  for (const h of historial) {
    if (!ids.has(h.oportunidad_id) || !h.a_etapa_id) continue
    const orden = ordenPorEtapa.get(h.a_etapa_id)
    if (orden === undefined) continue
    if (orden > (maxOrden.get(h.oportunidad_id) ?? Number.NEGATIVE_INFINITY)) maxOrden.set(h.oportunidad_id, orden)
  }
  const activas = etapasTodas.filter((e) => e.activa).sort((a, b) => a.orden - b.orden)
  const total = cohorte.length
  let anterior: number | null = null
  const pasos: PasoEmbudo[] = activas.map((e) => {
    let alcanzaron = 0
    for (const v of maxOrden.values()) if (v >= e.orden) alcanzaron++
    const conversion = anterior === null ? null : anterior > 0 ? alcanzaron / anterior : null
    anterior = alcanzaron
    return {
      etapaId: e.id,
      nombre: e.nombre,
      color: e.color,
      orden: e.orden,
      alcanzaron,
      conversion,
      proporcion: total > 0 ? alcanzaron / total : 0,
    }
  })
  const ganadas = cohorte.filter((o) => o.estado === "ganada").length
  const perdidas = cohorte.filter((o) => o.estado === "perdida").length
  return {
    mes,
    total,
    pasos,
    ganadas,
    perdidas,
    abiertas: total - ganadas - perdidas,
    porcentajeGanadas: total > 0 ? ganadas / total : 0,
    porcentajePerdidas: total > 0 ? perdidas / total : 0,
  }
}

// ---------- Perdidas por motivo ----------

export interface FilaMotivo {
  motivoId: string | null
  motivo: string
  n: number
  suma: number
}

/** Perdidas con perdida_at (día Lima) dentro del rango, agrupadas por motivo y ordenadas por n desc. */
export function perdidasPorMotivo(
  oportunidades: readonly OportunidadConRelaciones[],
  rango: Rango,
  motivos: readonly MotivoPerdida[],
): FilaMotivo[] {
  const filas = new Map<string, FilaMotivo>()
  for (const o of oportunidades) {
    if (o.estado !== "perdida" || !o.perdida_at) continue
    const dia = diaDeLima(o.perdida_at)
    if (dia < rango.desde || dia > rango.hasta) continue
    const clave = o.motivo_perdida_id ?? "sin-motivo"
    let fila = filas.get(clave)
    if (!fila) {
      const nombre = motivos.find((m) => m.id === o.motivo_perdida_id)?.nombre ?? o.motivo_perdida?.nombre ?? "Sin motivo"
      fila = { motivoId: o.motivo_perdida_id, motivo: nombre, n: 0, suma: 0 }
      filas.set(clave, fila)
    }
    fila.n++
    fila.suma += Number(o.importe) || 0
  }
  return [...filas.values()].sort((a, b) => b.n - a.n || b.suma - a.suma || a.motivo.localeCompare(b.motivo))
}

// ---------- Tareas vencidas por responsable ----------

export interface FilaVencidas {
  responsableId: string
  nombre: string
  n: number
  /** La más antigua (ISO), para mostrar desde cuándo. */
  masAntigua: string
}

export function vencidasPorResponsable(tareas: readonly TareaConRelaciones[], usuarios: readonly Usuario[], ahora: Date): FilaVencidas[] {
  const filas = new Map<string, FilaVencidas>()
  for (const t of tareasVencidas(tareas, ahora)) {
    let fila = filas.get(t.responsable_id)
    if (!fila) {
      const nombre = usuarios.find((u) => u.id === t.responsable_id)?.nombre ?? t.responsable?.nombre ?? "Sin responsable"
      fila = { responsableId: t.responsable_id, nombre, n: 0, masAntigua: t.vence_at }
      filas.set(t.responsable_id, fila)
    }
    fila.n++
    if (t.vence_at < fila.masAntigua) fila.masAntigua = t.vence_at
  }
  return [...filas.values()].sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre))
}

// ---------- Utilidades ----------

/** Mes actual en Lima 'yyyy-MM'. */
export function mesActualLima(ahora: Date = new Date()): string {
  return inicioDeMesLima(ahora).slice(0, 7)
}

/** 'yyyy-MM-dd' -> 'dd/MM/yyyy' sin pasar por Date (el día ya está en Lima). */
export function diaLegible(dia: string): string {
  const [a, m, d] = dia.split("-")
  return a && m && d ? `${d}/${m}/${a}` : dia
}

export function porcentaje(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return "–"
  return `${Math.round(valor * 100)}%`
}
