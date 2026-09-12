import { supabase } from "@/lib/supabase"
import { fetchAll } from "@/lib/fetchAll"
import type { HistorialEtapa } from "@/lib/types"
import { rangoLima } from "./comun"

/**
 * Historial de etapas de un rango de días (Lima, 'yyyy-MM-dd'), con todas las
 * filas (fetchAll). Base del embudo del panel. Sin `hasta` trae hasta hoy.
 */
export async function listarHistorial(desde?: string, hasta?: string): Promise<HistorialEtapa[]> {
  const { desdeIso, hastaIso } = rangoLima(desde, hasta)
  return fetchAll<HistorialEtapa>((inicio, fin) => {
    let q = supabase.from("historial_etapas").select("*").order("created_at", { ascending: true }).order("id", { ascending: true })
    if (desdeIso) q = q.gte("created_at", desdeIso)
    if (hastaIso) q = q.lte("created_at", hastaIso)
    return q.range(inicio, fin)
  })
}
