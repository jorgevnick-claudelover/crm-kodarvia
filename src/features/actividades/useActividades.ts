/** Hooks del módulo de actividades. Claves ['actividades', { contactoId }] y ['actividades', { oportunidadId }]. */
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import * as apiActividades from "@/lib/api/actividades"
import type { ActividadInsert, ActividadUpdate } from "@/lib/types"

export function useActividadesPorContacto(contactoId: string | null | undefined, limite = 200) {
  return useQuery({
    queryKey: ["actividades", { contactoId }],
    queryFn: () => apiActividades.listarPorContacto(contactoId as string, limite),
    enabled: !!contactoId,
  })
}

export function useActividadesPorOportunidad(oportunidadId: string | null | undefined, limite = 200) {
  return useQuery({
    queryKey: ["actividades", { oportunidadId }],
    queryFn: () => apiActividades.listarPorOportunidad(oportunidadId as string, limite),
    enabled: !!oportunidadId,
  })
}

function invalidar(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ["actividades"] })
  // ultima_actividad_at del contacto cambia por trigger.
  void queryClient.invalidateQueries({ queryKey: ["contactos"] })
  void queryClient.invalidateQueries({ queryKey: ["buscar"] })
}

export function useMutacionesActividades() {
  const queryClient = useQueryClient()
  const crear = useMutation({
    mutationFn: (datos: ActividadInsert) => apiActividades.crear(datos),
    onSuccess: () => invalidar(queryClient),
  })
  const actualizar = useMutation({
    mutationFn: ({ id, cambios }: { id: string; cambios: ActividadUpdate }) => apiActividades.actualizar(id, cambios),
    onSuccess: () => invalidar(queryClient),
  })
  const eliminar = useMutation({
    mutationFn: (id: string) => apiActividades.eliminar(id),
    onSuccess: () => invalidar(queryClient),
  })
  return { crear, actualizar, eliminar }
}
