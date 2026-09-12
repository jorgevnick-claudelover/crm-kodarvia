/**
 * Hooks de TanStack Query del módulo de oportunidades. Todas las claves empiezan
 * por 'oportunidades' (o por la tabla que consultan) para que useRealtime las invalide.
 */
import { useCallback, useMemo } from "react"
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import * as apiOportunidades from "@/lib/api/oportunidades"
import type { FiltrosOportunidades } from "@/lib/api/oportunidades"
import * as apiTablero from "@/lib/api/oportunidadesTablero"
import { resumenTareasPendientes } from "@/lib/api/comun"
import type { Etapa, Oportunidad, OportunidadConRelaciones, OportunidadInsert, OportunidadUpdate } from "@/lib/types"

export const CLAVE_OPORTUNIDADES = "oportunidades" as const

// ---------- consultas ----------

/** Lista con relaciones según filtros (clave ['oportunidades', filtros]). */
export function useOportunidades(filtros: FiltrosOportunidades, activo = true) {
  return useQuery({
    queryKey: [CLAVE_OPORTUNIDADES, filtros],
    queryFn: () => apiOportunidades.listar(filtros),
    enabled: activo,
    placeholderData: (previa) => previa,
  })
}

/** Detalle (clave ['oportunidades', id]). */
export function useOportunidad(id: string | undefined) {
  return useQuery({
    queryKey: [CLAVE_OPORTUNIDADES, id],
    queryFn: () => apiOportunidades.obtener(id as string),
    enabled: !!id,
  })
}

/** Historial de etapas de una oportunidad (clave ['historial_etapas', id]). */
export function useHistorialOportunidad(id: string | undefined) {
  return useQuery({
    queryKey: ["historial_etapas", id],
    queryFn: () => apiOportunidades.historial(id as string),
    enabled: !!id,
  })
}

/** Fecha del último cambio de etapa de cada oportunidad (para "N días en etapa"). */
export function useUltimoCambioEtapa(ids: readonly string[]) {
  const clave = useMemo(() => [...ids].sort().join(","), [ids])
  return useQuery({
    queryKey: ["historial_etapas", "ultimo", clave],
    queryFn: () => apiTablero.ultimoCambioEtapa(clave ? clave.split(",") : []),
    enabled: clave.length > 0,
    staleTime: 60_000,
    placeholderData: (previa) => previa,
  })
}

export interface ResumenTareasOportunidades {
  oportunidadesConPendiente: string[]
  oportunidadesConVencida: string[]
  contactosConPendiente: string[]
  contactosConVencida: string[]
}

/** Tareas pendientes/vencidas por oportunidad y contacto (puntos rojo/ámbar). Se guarda como arrays para poder persistir. */
export function useResumenTareasOportunidades() {
  return useQuery<ResumenTareasOportunidades>({
    queryKey: ["tareas", "resumen-oportunidades"],
    queryFn: async () => {
      const r = await resumenTareasPendientes()
      return {
        oportunidadesConPendiente: [...r.oportunidadesConPendiente],
        oportunidadesConVencida: [...r.oportunidadesConVencida],
        contactosConPendiente: [...r.contactosConPendiente],
        contactosConVencida: [...r.contactosConVencida],
      }
    },
    staleTime: 60_000,
  })
}

export interface IndicadoresTareas {
  /** true si la oportunidad o su contacto tiene una tarea pendiente vencida. */
  tieneVencida: (o: { id: string; contacto_id: string }) => boolean
  /** true si ni la oportunidad ni su contacto tienen tarea pendiente. */
  sinTarea: (o: { id: string; contacto_id: string }) => boolean
  disponible: boolean
}

/** Funciones de consulta rápida sobre el resumen de tareas. */
export function useIndicadoresTareas(): IndicadoresTareas {
  const { data } = useResumenTareasOportunidades()
  return useMemo(() => {
    if (!data) {
      return { tieneVencida: () => false, sinTarea: () => false, disponible: false }
    }
    const opPend = new Set(data.oportunidadesConPendiente)
    const opVenc = new Set(data.oportunidadesConVencida)
    const coPend = new Set(data.contactosConPendiente)
    const coVenc = new Set(data.contactosConVencida)
    return {
      tieneVencida: (o) => opVenc.has(o.id) || coVenc.has(o.contacto_id),
      sinTarea: (o) => !opPend.has(o.id) && !coPend.has(o.contacto_id),
      disponible: true,
    }
  }, [data])
}

/** "Cerradas este mes" del pie del tablero. */
export function useCerradasEsteMes() {
  return useQuery({
    queryKey: [CLAVE_OPORTUNIDADES, "cerradas-mes"],
    queryFn: apiTablero.cerradasEsteMes,
    staleTime: 60_000,
  })
}

// ---------- caché optimista ----------

type Instantanea = [readonly unknown[], unknown][]

function esOportunidad(valor: unknown): valor is Oportunidad {
  return typeof valor === "object" && valor !== null && "id" in valor && "etapa_id" in valor && "estado" in valor
}

/** Aplica cambios a una oportunidad en todas las consultas ['oportunidades', ...] cacheadas. */
function aplicarEnCache(queryClient: QueryClient, id: string, cambios: Partial<OportunidadConRelaciones>): Instantanea {
  const previas: Instantanea = queryClient.getQueriesData({ queryKey: [CLAVE_OPORTUNIDADES] })
  queryClient.setQueriesData<unknown>({ queryKey: [CLAVE_OPORTUNIDADES] }, (viejo: unknown) => {
    if (Array.isArray(viejo)) {
      return viejo.map((o: unknown) => (esOportunidad(o) && o.id === id ? { ...o, ...cambios } : o))
    }
    if (esOportunidad(viejo) && viejo.id === id) return { ...viejo, ...cambios }
    return viejo
  })
  return previas
}

function restaurarCache(queryClient: QueryClient, previas: Instantanea | undefined) {
  if (!previas) return
  for (const [clave, datos] of previas) queryClient.setQueryData(clave, datos)
}

async function invalidarTodo(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: [CLAVE_OPORTUNIDADES] }),
    queryClient.invalidateQueries({ queryKey: ["historial_etapas"] }),
  ])
}

// ---------- mutaciones ----------

export interface VariablesMover {
  id: string
  etapaId: string
  posicion: number
  /** Etapa completa (para la actualización optimista de la relación). */
  etapa?: Etapa | null
}

/** Mover de etapa/posición con actualización optimista y rollback + toast si falla. */
export function useMoverOportunidad() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (v: VariablesMover) => apiOportunidades.mover(v.id, v.etapaId, v.posicion),
    onMutate: async (v) => {
      await queryClient.cancelQueries({ queryKey: [CLAVE_OPORTUNIDADES] })
      const cambios: Partial<OportunidadConRelaciones> = { etapa_id: v.etapaId, posicion: v.posicion, estado: "abierta" }
      if (v.etapa) cambios.etapa = v.etapa
      return { previas: aplicarEnCache(queryClient, v.id, cambios) }
    },
    onError: (error, _v, contexto) => {
      restaurarCache(queryClient, contexto?.previas)
      toast.error(error instanceof Error ? error.message : "No se pudo mover la oportunidad.")
    },
    // Invalidar tras confirmar: así un cambio remoto posterior nunca queda pisado por la copia optimista.
    onSettled: () => invalidarTodo(queryClient),
  })
}

/** Devuelve una función que mueve y muestra un toast con "Deshacer" (5 s). */
export function useMoverConDeshacer() {
  const mover = useMoverOportunidad()
  const mutate = mover.mutate
  const moverConDeshacer = useCallback(
    (oportunidad: Oportunidad & { etapa?: Etapa | null }, destino: Etapa, posicion: number) => {
      const etapaAnteriorId = oportunidad.etapa_id
      const posicionAnterior = oportunidad.posicion
      const etapaAnterior = oportunidad.etapa ?? null
      mutate(
        { id: oportunidad.id, etapaId: destino.id, posicion, etapa: destino },
        {
          onSuccess: () => {
            toast.success(`Movida a ${destino.nombre}`, {
              duration: 5000,
              action: {
                label: "Deshacer",
                onClick: () =>
                  mutate(
                    { id: oportunidad.id, etapaId: etapaAnteriorId, posicion: posicionAnterior, etapa: etapaAnterior },
                    { onSuccess: () => toast.success(`Devuelta a ${etapaAnterior?.nombre ?? "su etapa"}`) },
                  ),
              },
            })
          },
        },
      )
    },
    [mutate],
  )
  return { moverConDeshacer, moviendo: mover.isPending }
}

export function useGanarOportunidad() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, importe }: { id: string; importe: number }) => apiOportunidades.ganar(id, importe),
    onMutate: async ({ id, importe }) => {
      await queryClient.cancelQueries({ queryKey: [CLAVE_OPORTUNIDADES] })
      return { previas: aplicarEnCache(queryClient, id, { estado: "ganada", importe, ganada_at: new Date().toISOString() }) }
    },
    onError: (error, _v, contexto) => {
      restaurarCache(queryClient, contexto?.previas)
      toast.error(error instanceof Error ? error.message : "No se pudo marcar como ganada.")
    },
    onSettled: () => invalidarTodo(queryClient),
  })
}

export function usePerderOportunidad() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, motivoId, detalle }: { id: string; motivoId: string; detalle?: string | null }) =>
      apiOportunidades.perder(id, motivoId, detalle),
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo marcar como perdida."),
    onSettled: () => invalidarTodo(queryClient),
  })
}

export function useReabrirOportunidad() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiOportunidades.reabrir(id),
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo reabrir la oportunidad."),
    onSettled: () => invalidarTodo(queryClient),
  })
}

export function useCrearOportunidad() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (datos: OportunidadInsert) => apiOportunidades.crear(datos),
    onSettled: async () => {
      await invalidarTodo(queryClient)
      await queryClient.invalidateQueries({ queryKey: ["contactos"] })
    },
  })
}

export function useActualizarOportunidad() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, cambios }: { id: string; cambios: OportunidadUpdate }) => apiOportunidades.actualizar(id, cambios),
    onSettled: () => invalidarTodo(queryClient),
  })
}

export function useEliminarOportunidad() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiOportunidades.eliminar(id),
    onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo eliminar la oportunidad."),
    onSettled: async () => {
      await invalidarTodo(queryClient)
      await queryClient.invalidateQueries({ queryKey: ["contactos"] })
    },
  })
}
