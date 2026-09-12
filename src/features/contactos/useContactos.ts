/**
 * Hooks de datos del módulo de contactos (TanStack Query).
 * Claves: ['contactos', filtros] (lista paginada), ['contactos', id] (ficha),
 * ['oportunidades', { contactoId }], ['tareas', { contactoId }], ['actividades', { contactoId }],
 * ['tareas', 'resumen-seguimiento'] (ids con tarea pendiente o vencida).
 * Realtime invalida por el primer elemento de la clave.
 */
import { useMemo } from "react"
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import * as apiActividades from "@/lib/api/actividades"
import * as apiContactos from "@/lib/api/contactos"
import { type FiltrosContactos } from "@/lib/api/contactos"
import { TAMANO_PAGINA_CONTACTOS, listarPagina, resumenSeguimientoContactos } from "@/lib/api/contactosPagina"
import * as apiOportunidades from "@/lib/api/oportunidades"
import * as apiTareas from "@/lib/api/tareas"
import type { Contacto, ContactoConRelaciones, ContactoInsert, ContactoUpdate, Oportunidad, OportunidadInsert } from "@/lib/types"

export interface ResultadoContactos {
  contactos: ContactoConRelaciones[]
  /** Total que cumple los filtros (aunque solo se hayan cargado algunas páginas). */
  total: number
  cargando: boolean
  error: Error | null
  hayMas: boolean
  cargarMas: () => void
  cargandoMas: boolean
  refrescar: () => void
}

/** Lista paginada de 50 en 50 con los filtros dados. */
export function useContactos(filtros: FiltrosContactos, opciones: { enabled?: boolean } = {}): ResultadoContactos {
  const consulta = useInfiniteQuery({
    queryKey: ["contactos", filtros],
    queryFn: ({ pageParam }) => listarPagina(filtros, pageParam, TAMANO_PAGINA_CONTACTOS),
    initialPageParam: 0,
    getNextPageParam: (ultima) => {
      const siguiente = ultima.desde + ultima.filas.length
      if (ultima.filas.length < TAMANO_PAGINA_CONTACTOS || siguiente >= ultima.total) return undefined
      return siguiente
    },
    enabled: opciones.enabled ?? true,
  })
  const contactos = useMemo(() => consulta.data?.pages.flatMap((p) => p.filas) ?? [], [consulta.data])
  const ultimaPagina = consulta.data?.pages[consulta.data.pages.length - 1]
  return {
    contactos,
    total: ultimaPagina?.total ?? contactos.length,
    cargando: consulta.isPending && (opciones.enabled ?? true),
    error: consulta.error,
    hayMas: consulta.hasNextPage,
    cargarMas: () => {
      if (!consulta.isFetchingNextPage) void consulta.fetchNextPage()
    },
    cargandoMas: consulta.isFetchingNextPage,
    refrescar: () => void consulta.refetch(),
  }
}

/** Ficha de un contacto (clave ['contactos', id]). */
export function useContacto(id: string | undefined) {
  return useQuery({
    queryKey: ["contactos", id ?? ""],
    queryFn: () => apiContactos.obtener(id as string),
    enabled: !!id,
  })
}

export interface ResumenSeguimiento {
  conPendiente: Set<string>
  conVencida: Set<string>
  cargado: boolean
}

/** Contactos con tarea pendiente o vencida, para los indicadores de la lista. */
export function useResumenSeguimiento(activo = true): ResumenSeguimiento {
  const consulta = useQuery({
    queryKey: ["tareas", "resumen-seguimiento"],
    queryFn: resumenSeguimientoContactos,
    enabled: activo,
    staleTime: 60_000,
  })
  return useMemo(
    () => ({
      conPendiente: new Set(consulta.data?.conPendiente ?? []),
      conVencida: new Set(consulta.data?.conVencida ?? []),
      cargado: consulta.isSuccess,
    }),
    [consulta.data, consulta.isSuccess],
  )
}

function invalidarContactos(queryClient: ReturnType<typeof useQueryClient>, extras: string[] = []): void {
  void queryClient.invalidateQueries({ queryKey: ["contactos"] })
  void queryClient.invalidateQueries({ queryKey: ["oportunidades"] })
  for (const clave of extras) void queryClient.invalidateQueries({ queryKey: [clave] })
}

export function useCrearContacto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (datos: ContactoInsert): Promise<Contacto> => apiContactos.crear(datos),
    onSuccess: () => invalidarContactos(queryClient, ["buscar"]),
  })
}

export function useActualizarContacto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, cambios }: { id: string; cambios: ContactoUpdate }): Promise<Contacto> => apiContactos.actualizar(id, cambios),
    onSuccess: (contacto) => {
      invalidarContactos(queryClient, ["buscar"])
      void queryClient.invalidateQueries({ queryKey: ["contactos", contacto.id] })
    },
  })
}

export function useEliminarContacto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiContactos.eliminar(id),
    onSuccess: (_r, id) => {
      queryClient.removeQueries({ queryKey: ["contactos", id] })
      invalidarContactos(queryClient, ["tareas", "actividades", "buscar"])
    },
  })
}

/** Oportunidades de la ficha (clave ['oportunidades', { contactoId }]). */
export function useOportunidadesDeContacto(contactoId: string | undefined) {
  return useQuery({
    queryKey: ["oportunidades", { contactoId: contactoId ?? "" }],
    queryFn: () => apiOportunidades.listarPorContacto(contactoId as string),
    enabled: !!contactoId,
  })
}

/** Tareas pendientes de la ficha (clave ['tareas', { contactoId, estado }]). */
export function useTareasPendientesDeContacto(contactoId: string | undefined) {
  const filtros = useMemo(() => ({ contactoId: contactoId ?? "", estado: "pendiente" as const, orden: "vence" as const }), [contactoId])
  return useQuery({
    queryKey: ["tareas", filtros],
    queryFn: () => apiTareas.listar(filtros),
    enabled: !!contactoId,
  })
}

/** Actividad de la ficha (clave ['actividades', { contactoId }]). */
export function useActividadesDeContacto(contactoId: string | undefined) {
  return useQuery({
    queryKey: ["actividades", { contactoId: contactoId ?? "" }],
    queryFn: () => apiActividades.listarPorContacto(contactoId as string),
    enabled: !!contactoId,
  })
}

/** Crea una oportunidad desde el formulario de contacto o la ficha. */
export function useCrearOportunidadContacto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (datos: OportunidadInsert): Promise<Oportunidad> => apiOportunidades.crear(datos),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["oportunidades"] })
      void queryClient.invalidateQueries({ queryKey: ["contactos"] })
      void queryClient.invalidateQueries({ queryKey: ["buscar"] })
    },
  })
}

export function useCompletarTareaContacto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiTareas.completar(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tareas"] })
      void queryClient.invalidateQueries({ queryKey: ["contactos"] })
    },
  })
}
