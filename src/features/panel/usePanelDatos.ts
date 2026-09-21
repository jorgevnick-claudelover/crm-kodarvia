import { useQuery } from "@tanstack/react-query"
import * as apiContactos from "@/lib/api/contactos"
import * as apiHistorial from "@/lib/api/historial"
import * as apiOportunidades from "@/lib/api/oportunidades"
import * as apiTareas from "@/lib/api/tareas"
import type { ContactoConRelaciones, HistorialEtapa, OportunidadConRelaciones, TareaConRelaciones } from "@/lib/types"

const STALE = 60_000

export interface DatosPanel {
  oportunidades: OportunidadConRelaciones[]
  tareasPendientes: TareaConRelaciones[]
  contactos: ContactoConRelaciones[]
  historial: HistorialEtapa[]
  cargando: boolean
  cargandoHistorial: boolean
  error: Error | null
  refrescar: () => void
}

const VACIO: never[] = []

/**
 * Carga todo lo que necesita el panel (listarTodo) y lo cachea por tabla, así el
 * realtime lo invalida por queryKey[0]. El historial se pide desde `desdeHistorial`
 * (el más antiguo entre el rango y el mes del embudo) hasta hoy.
 */
export function usePanelDatos(desdeHistorial: string): DatosPanel {
  const oportunidades = useQuery({
    queryKey: ["oportunidades", "panel", "todas"],
    queryFn: () => apiOportunidades.listarTodo({ estado: "todas", orden: "reciente" }),
    staleTime: STALE,
  })
  const tareas = useQuery({
    queryKey: ["tareas", "panel", "pendientes"],
    queryFn: () => apiTareas.listarTodo({ estado: "pendiente" }),
    staleTime: STALE,
  })
  const contactos = useQuery({
    queryKey: ["contactos", "panel", "todos"],
    queryFn: () => apiContactos.listarTodo(),
    staleTime: STALE,
  })
  const historial = useQuery({
    queryKey: ["historial_etapas", { desde: desdeHistorial }],
    queryFn: () => apiHistorial.listarHistorial(desdeHistorial),
    staleTime: STALE,
  })

  return {
    oportunidades: oportunidades.data ?? VACIO,
    tareasPendientes: tareas.data ?? VACIO,
    contactos: contactos.data ?? VACIO,
    historial: historial.data ?? VACIO,
    cargando: oportunidades.isPending || tareas.isPending || contactos.isPending,
    cargandoHistorial: historial.isPending,
    error: oportunidades.error ?? tareas.error ?? contactos.error ?? historial.error ?? null,
    refrescar: () => {
      void oportunidades.refetch()
      void tareas.refetch()
      void contactos.refetch()
      void historial.refetch()
    },
  }
}
