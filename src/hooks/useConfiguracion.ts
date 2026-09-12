import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ValoresConfiguracion } from "@/lib/types"
import * as apiConfiguracion from "@/lib/api/configuracion"

export interface ResultadoConfiguracion {
  /** Valores (por defecto mientras carga). */
  configuracion: ValoresConfiguracion
  cargando: boolean
  error: Error | null
  /** Guarda una o varias claves (solo admin). */
  guardar: (valores: Partial<ValoresConfiguracion>) => Promise<void>
  guardando: boolean
}

/** Clave ['configuracion']; realtime la invalida. */
export function useConfiguracion(): ResultadoConfiguracion {
  const queryClient = useQueryClient()
  const consulta = useQuery({
    queryKey: ["configuracion"],
    queryFn: apiConfiguracion.obtenerTodo,
    staleTime: 10 * 60 * 1000,
  })
  const mutacion = useMutation({
    mutationFn: apiConfiguracion.guardarVarias,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["configuracion"] }),
  })
  return {
    configuracion: consulta.data ?? apiConfiguracion.CONFIGURACION_DEFAULT,
    cargando: consulta.isPending,
    error: consulta.error,
    guardar: (valores) => mutacion.mutateAsync(valores),
    guardando: mutacion.isPending,
  }
}
