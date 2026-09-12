/**
 * Recordatorios vencidos y no vistos del usuario actual (criterio 4).
 * Consulta la rpc recordatorios_pendientes_usuario cada 30 s; realtime invalida
 * ['tareas'] (y por tanto ['tareas', 'recordatorios']) en cuanto cambia una tarea.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useUsuarioActual } from "@/hooks/useUsuarioActual"
import * as apiTareas from "@/lib/api/tareas"
import type { Tarea } from "@/lib/types"

export const CLAVE_RECORDATORIOS = ["tareas", "recordatorios"] as const
export const INTERVALO_RECORDATORIOS_MS = 30_000

const VACIO: Tarea[] = []

export interface ResultadoRecordatorios {
  /** Tareas pendientes con recordatorio_at <= ahora y sin marcar como vistas, ordenadas por hora. */
  recordatorios: Tarea[]
  numero: number
  cargando: boolean
  error: Error | null
  /** Vuelve a consultar ahora mismo (por ejemplo, cuando salta un temporizador local). */
  refrescar: () => void
}

export function useRecordatorios(): ResultadoRecordatorios {
  const { uid } = useUsuarioActual()
  const queryClient = useQueryClient()
  const consulta = useQuery({
    queryKey: CLAVE_RECORDATORIOS,
    queryFn: apiTareas.listarRecordatoriosPendientes,
    enabled: !!uid,
    refetchInterval: INTERVALO_RECORDATORIOS_MS,
    refetchIntervalInBackground: true,
    staleTime: 0,
  })
  const recordatorios = consulta.data ?? VACIO
  return {
    recordatorios,
    numero: recordatorios.length,
    cargando: !!uid && consulta.isPending,
    error: consulta.error,
    refrescar: () => void queryClient.invalidateQueries({ queryKey: CLAVE_RECORDATORIOS }),
  }
}
