import { leer } from "@/lib/almacen"
import type { HistorialEtapa } from "@/lib/types"
import { rangoLima } from "./comun"

/**
 * Historial de etapas de un rango de días (Lima, 'yyyy-MM-dd'), con todas las
 * filas. Base del embudo del panel. Sin `hasta` trae hasta hoy.
 */
export async function listarHistorial(desde?: string, hasta?: string): Promise<HistorialEtapa[]> {
  const { desdeIso, hastaIso } = rangoLima(desde, hasta)
  const filas = leer()
    .historial_etapas.filter((h) => {
      if (desdeIso && h.created_at < desdeIso) return false
      if (hastaIso && h.created_at > hastaIso) return false
      return true
    })
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id - b.id))
  return Promise.resolve(filas)
}
