/**
 * Contador para el badge de "Hoy" (barra inferior / lateral): tareas vencidas del usuario
 * y recordatorios pendientes de marcar como vistos. El layout puede montarlo cuando quiera.
 */
import { useUsuarioActual } from "@/hooks/useUsuarioActual"
import { contarVencidas } from "@/features/tareas/logica"
import { useRecordatorios } from "@/features/tareas/useRecordatorios"
import { FILTROS_MIAS_PENDIENTES, useTareas } from "@/features/tareas/useTareas"

export interface ContadorHoy {
  /** Tareas pendientes del usuario cuya hora ya pasó. */
  vencidas: number
  /** Recordatorios vencidos sin marcar como vistos. */
  recordatorios: number
  /** Lo que se muestra en el badge (vencidas o, si no hay, recordatorios). */
  badge: number
}

export function useContadorHoy(): ContadorHoy {
  const { uid } = useUsuarioActual()
  const tareas = useTareas(FILTROS_MIAS_PENDIENTES, { enabled: !!uid })
  const { numero } = useRecordatorios()
  const vencidas = contarVencidas(tareas.data ?? [])
  return { vencidas, recordatorios: numero, badge: vencidas > 0 ? vencidas : numero }
}
