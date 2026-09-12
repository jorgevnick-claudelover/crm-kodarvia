/**
 * Consultas de apoyo del módulo de oportunidades (tablero y lista):
 * cierre del mes en curso y fecha del último cambio de etapa por oportunidad.
 * Archivo aparte de oportunidades.ts para no tocar la base de la fase 1.
 */
import { supabase } from "@/lib/supabase"
import type { EstadoOportunidad } from "@/lib/types"
import { desdeLima, inicioDeMesLima } from "@/lib/utils/fechas"
import { lanzarSi } from "./comun"

export interface ResumenCerradasMes {
  ganadas: number
  importeGanado: number
  perdidas: number
  /** 'yyyy-MM-dd' del primer día del mes en Lima. */
  desde: string
}

interface FilaCerrada {
  id: string
  estado: EstadoOportunidad
  importe: number
  ganada_at: string | null
  perdida_at: string | null
}

/** Ganadas y perdidas cuyo cierre cae en el mes actual (hora de Lima). */
export async function cerradasEsteMes(): Promise<ResumenCerradasMes> {
  const desde = inicioDeMesLima()
  const desdeIso = desdeLima(desde, "00:00")
  const { data, error } = await supabase
    .from("oportunidades")
    .select("id, estado, importe, ganada_at, perdida_at")
    .neq("estado", "abierta")
    .or(`ganada_at.gte.${desdeIso},perdida_at.gte.${desdeIso}`)
    .limit(5000)
    .overrideTypes<FilaCerrada[], { merge: false }>()
  lanzarSi(error, "No se pudieron cargar las oportunidades cerradas")
  const resumen: ResumenCerradasMes = { ganadas: 0, importeGanado: 0, perdidas: 0, desde }
  for (const fila of data ?? []) {
    if (fila.estado === "ganada" && fila.ganada_at && fila.ganada_at >= desdeIso) {
      resumen.ganadas += 1
      resumen.importeGanado += Number(fila.importe) || 0
    } else if (fila.estado === "perdida" && fila.perdida_at && fila.perdida_at >= desdeIso) {
      resumen.perdidas += 1
    }
  }
  return resumen
}

interface FilaUltimoCambio {
  oportunidad_id: string
  created_at: string
}

/**
 * Fecha del último registro de historial_etapas de cada oportunidad (para "N días en etapa").
 * Devuelve un mapa id -> ISO. Las que no aparezcan usan updated_at como respaldo.
 */
export async function ultimoCambioEtapa(ids: readonly string[]): Promise<Record<string, string>> {
  const resultado: Record<string, string> = {}
  if (ids.length === 0) return resultado
  // PostgREST acepta listas largas en .in(); troceamos por seguridad de tamaño de URL.
  const TROZO = 200
  for (let i = 0; i < ids.length; i += TROZO) {
    const trozo = ids.slice(i, i + TROZO)
    const { data, error } = await supabase
      .from("historial_etapas")
      .select("oportunidad_id, created_at")
      .in("oportunidad_id", trozo)
      .order("created_at", { ascending: false })
      .limit(5000)
      .overrideTypes<FilaUltimoCambio[], { merge: false }>()
    lanzarSi(error, "No se pudo cargar el historial de etapas")
    for (const fila of data ?? []) {
      // Vienen ordenadas de más reciente a más antigua: la primera de cada id es la última.
      if (!(fila.oportunidad_id in resultado)) resultado[fila.oportunidad_id] = fila.created_at
    }
  }
  return resultado
}
