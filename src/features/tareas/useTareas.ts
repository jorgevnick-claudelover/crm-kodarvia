/**
 * Hooks de TanStack Query del módulo de tareas. Claves: ['tareas', filtros] para listas,
 * ['tareas', 'detalle', id] para una tarea. Realtime invalida por 'tareas'.
 */
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import * as apiContactos from "@/lib/api/contactos"
import * as apiOportunidades from "@/lib/api/oportunidades"
import * as apiTareas from "@/lib/api/tareas"
import { FILTROS_TAREAS_DEFAULT, type FiltrosTareas } from "@/lib/api/tareas"
import type { Contacto, OportunidadConRelaciones, Tarea, TareaConRelaciones, TareaInsert, TareaUpdate } from "@/lib/types"

/** Pendientes del usuario actual (Hoy, badge y avisos locales). Constante estable para compartir caché. */
export const FILTROS_MIAS_PENDIENTES: Required<FiltrosTareas> = { ...FILTROS_TAREAS_DEFAULT, soloMias: true }

export function useTareas(filtros: FiltrosTareas, opciones: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["tareas", filtros],
    queryFn: () => apiTareas.listar(filtros),
    enabled: opciones.enabled ?? true,
  })
}

export function useTarea(id: string | undefined) {
  return useQuery({
    queryKey: ["tareas", "detalle", id],
    queryFn: () => apiTareas.obtener(id as string),
    enabled: !!id,
  })
}

/** Contacto por id para fijarlo en los formularios (clave ['contactos', id]). */
export function useContactoDeFormulario(id: string | null | undefined) {
  return useQuery({
    queryKey: ["contactos", id],
    queryFn: () => apiContactos.obtener(id as string),
    enabled: !!id,
    staleTime: 60_000,
  })
}

/** Oportunidades abiertas de un contacto (para vincular la actividad o la tarea). */
export function useOportunidadesAbiertas(contactoId: string | null | undefined) {
  const consulta = useQuery({
    queryKey: ["oportunidades", "abiertas_de_contacto", contactoId],
    queryFn: () => apiOportunidades.listarPorContacto(contactoId as string),
    enabled: !!contactoId,
    staleTime: 60_000,
    select: (lista: OportunidadConRelaciones[]) => lista.filter((o) => o.estado === "abierta"),
  })
  return { abiertas: consulta.data ?? [], cargando: !!contactoId && consulta.isPending }
}

function invalidarRelacionadas(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ["tareas"] })
  void queryClient.invalidateQueries({ queryKey: ["contactos"] })
  void queryClient.invalidateQueries({ queryKey: ["oportunidades"] })
  void queryClient.invalidateQueries({ queryKey: ["buscar"] })
}

function esListaDeTareas(datos: unknown): datos is Tarea[] {
  return Array.isArray(datos)
}

/** Cambia una tarea en todas las listas cacheadas (actualización optimista). */
function parchearEnCache(queryClient: QueryClient, id: string, cambios: Partial<Tarea>) {
  queryClient.setQueriesData<Tarea[]>({ queryKey: ["tareas"], predicate: (q) => esListaDeTareas(q.state.data) }, (lista) =>
    lista?.map((t) => (t.id === id ? { ...t, ...cambios } : t)),
  )
}

function mensajeError(e: unknown, porDefecto: string): string {
  return e instanceof Error && e.message ? e.message : porDefecto
}

/** Mutaciones de tareas: crear, editar, Hecha (con Deshacer 5 s), reabrir, eliminar y Visto. */
export function useMutacionesTareas() {
  const queryClient = useQueryClient()

  const crear = useMutation({
    mutationFn: (datos: TareaInsert) => apiTareas.crear(datos),
    onSuccess: () => invalidarRelacionadas(queryClient),
  })

  const actualizar = useMutation({
    mutationFn: ({ id, cambios }: { id: string; cambios: TareaUpdate }) => apiTareas.actualizar(id, cambios),
    onSuccess: () => invalidarRelacionadas(queryClient),
  })

  const eliminar = useMutation({
    mutationFn: (id: string) => apiTareas.eliminar(id),
    onSuccess: () => invalidarRelacionadas(queryClient),
  })

  const reabrir = useMutation({
    mutationFn: (id: string) => apiTareas.reabrir(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["tareas"] })
      const previas = queryClient.getQueriesData<Tarea[]>({ queryKey: ["tareas"] })
      parchearEnCache(queryClient, id, { estado: "pendiente", hecha_at: null })
      return { previas }
    },
    onError: (e, _id, contexto) => {
      contexto?.previas.forEach(([clave, datos]) => queryClient.setQueryData(clave, datos))
      toast.error(mensajeError(e, "No se pudo reabrir la tarea."))
    },
    onSettled: () => invalidarRelacionadas(queryClient),
  })

  const completar = useMutation({
    mutationFn: (id: string) => apiTareas.completar(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["tareas"] })
      const previas = queryClient.getQueriesData<Tarea[]>({ queryKey: ["tareas"] })
      parchearEnCache(queryClient, id, { estado: "hecha", hecha_at: new Date().toISOString() })
      return { previas }
    },
    onError: (e, _id, contexto) => {
      contexto?.previas.forEach(([clave, datos]) => queryClient.setQueryData(clave, datos))
      toast.error(mensajeError(e, "No se pudo marcar la tarea como hecha."))
    },
    onSuccess: (_tarea, id) => {
      toast.success("Tarea hecha", {
        duration: 5000,
        action: { label: "Deshacer", onClick: () => reabrir.mutate(id) },
      })
    },
    onSettled: () => invalidarRelacionadas(queryClient),
  })

  const marcarVisto = useMutation({
    mutationFn: (id: string) => apiTareas.marcarRecordatorioVisto(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["tareas"] })
      parchearEnCache(queryClient, id, { recordatorio_visto_at: new Date().toISOString() })
      queryClient.setQueryData<Tarea[]>(["tareas", "recordatorios"], (lista) => lista?.filter((t) => t.id !== id))
    },
    onError: (e) => toast.error(mensajeError(e, "No se pudo marcar el recordatorio como visto.")),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["tareas"] })
    },
  })

  return { crear, actualizar, eliminar, completar, reabrir, marcarVisto }
}

export type ContactoMinimo = Pick<Contacto, "id" | "nombre" | "telefono">

/** Lista de tareas con relaciones indexada por id (para completar datos de los recordatorios). */
export function indexarTareas(tareas: readonly TareaConRelaciones[] | undefined): Map<string, TareaConRelaciones> {
  return new Map((tareas ?? []).map((t) => [t.id, t]))
}
