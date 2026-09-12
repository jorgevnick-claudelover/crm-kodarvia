/**
 * Hooks de la página de configuración (solo admin): catálogos (etapas, motivos, orígenes),
 * usuarios y conteo de oportunidades abiertas por etapa.
 * Claves de TanStack Query: ['etapas'], ['motivos_perdida'], ['origenes'], ['usuarios'],
 * ['configuracion'] y ['oportunidades', 'abiertas_por_etapa'].
 */
import { useCallback } from "react"
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import * as apiCatalogos from "@/lib/api/catalogos"
import * as apiOportunidades from "@/lib/api/oportunidades"
import * as apiUsuarios from "@/lib/api/usuarios"
import type { Etapa, EtapaUpdate, MotivoPerdida, MotivoPerdidaUpdate, Origen, OrigenUpdate, RolUsuario } from "@/lib/types"
import type { ElementoCatalogo } from "./logica"

export type TipoCatalogo = "etapas" | "motivos_perdida" | "origenes"

export interface CambiosElemento {
  nombre?: string
  color?: string
  activo?: boolean
}

// ---------- adaptadores a un tipo común ----------
export function etapaAElemento(e: Etapa): ElementoCatalogo {
  return { id: e.id, nombre: e.nombre, orden: e.orden, activo: e.activa, color: e.color }
}

export function catalogoAElemento(c: MotivoPerdida | Origen): ElementoCatalogo {
  return { id: c.id, nombre: c.nombre, orden: c.orden, activo: c.activo }
}

interface OperacionesCatalogo {
  crear: (nombre: string) => Promise<void>
  guardar: (id: string, cambios: CambiosElemento) => Promise<void>
  reordenar: (ids: string[]) => Promise<void>
}

const OPERACIONES: Record<TipoCatalogo, OperacionesCatalogo> = {
  etapas: {
    crear: async (nombre) => {
      await apiCatalogos.crearEtapa({ nombre })
    },
    guardar: async (id, cambios) => {
      const parche: EtapaUpdate = {}
      if (cambios.nombre !== undefined) parche.nombre = cambios.nombre
      if (cambios.color !== undefined) parche.color = cambios.color
      if (cambios.activo !== undefined) parche.activa = cambios.activo
      await apiCatalogos.actualizarEtapa(id, parche)
    },
    reordenar: apiCatalogos.reordenarEtapas,
  },
  motivos_perdida: {
    crear: async (nombre) => {
      await apiCatalogos.crearMotivo({ nombre })
    },
    guardar: async (id, cambios) => {
      const parche: MotivoPerdidaUpdate = {}
      if (cambios.nombre !== undefined) parche.nombre = cambios.nombre
      if (cambios.activo !== undefined) parche.activo = cambios.activo
      await apiCatalogos.actualizarMotivo(id, parche)
    },
    reordenar: apiCatalogos.reordenarMotivos,
  },
  origenes: {
    crear: async (nombre) => {
      await apiCatalogos.crearOrigen({ nombre })
    },
    guardar: async (id, cambios) => {
      const parche: OrigenUpdate = {}
      if (cambios.nombre !== undefined) parche.nombre = cambios.nombre
      if (cambios.activo !== undefined) parche.activo = cambios.activo
      await apiCatalogos.actualizarOrigen(id, parche)
    },
    reordenar: apiCatalogos.reordenarOrigenes,
  },
}

export function mensajeError(e: unknown, porDefecto: string): string {
  return e instanceof Error && e.message ? e.message : porDefecto
}

/** Invalida la clave del catálogo y las consultas que muestran sus nombres. */
function invalidarCatalogo(queryClient: QueryClient, tipo: TipoCatalogo): void {
  void queryClient.invalidateQueries({ queryKey: [tipo] })
  if (tipo === "etapas") {
    void queryClient.invalidateQueries({ queryKey: ["oportunidades"] })
    void queryClient.invalidateQueries({ queryKey: ["historial_etapas"] })
  }
  if (tipo === "origenes") void queryClient.invalidateQueries({ queryKey: ["contactos"] })
}

export interface MutacionesCatalogo {
  crear: (nombre: string) => Promise<boolean>
  guardar: (id: string, cambios: CambiosElemento) => Promise<boolean>
  reordenar: (ids: string[]) => Promise<boolean>
  guardando: boolean
}

/** Crear, renombrar, colorear, activar/desactivar y reordenar un catálogo. */
export function useMutacionesCatalogo(tipo: TipoCatalogo): MutacionesCatalogo {
  const queryClient = useQueryClient()
  const ops = OPERACIONES[tipo]

  const crear = useMutation({ mutationFn: (nombre: string) => ops.crear(nombre) })
  const guardar = useMutation({
    mutationFn: ({ id, cambios }: { id: string; cambios: CambiosElemento }) => ops.guardar(id, cambios),
  })
  const reordenar = useMutation({ mutationFn: (ids: string[]) => ops.reordenar(ids) })

  const tras = useCallback(() => invalidarCatalogo(queryClient, tipo), [queryClient, tipo])

  return {
    crear: async (nombre) => {
      try {
        await crear.mutateAsync(nombre)
        tras()
        return true
      } catch (e) {
        toast.error(mensajeError(e, "No se pudo crear."))
        return false
      }
    },
    guardar: async (id, cambios) => {
      try {
        await guardar.mutateAsync({ id, cambios })
        tras()
        return true
      } catch (e) {
        toast.error(mensajeError(e, "No se pudo guardar."))
        return false
      }
    },
    reordenar: async (ids) => {
      try {
        await reordenar.mutateAsync(ids)
        tras()
        return true
      } catch (e) {
        toast.error(mensajeError(e, "No se pudo cambiar el orden."))
        return false
      }
    },
    guardando: crear.isPending || guardar.isPending || reordenar.isPending,
  }
}

/** Oportunidades abiertas por etapa: impide desactivar una etapa que aún tiene trabajo dentro. */
export function useAbiertasPorEtapa(ids: readonly string[]) {
  const clave = [...ids].sort().join(",")
  const consulta = useQuery({
    queryKey: ["oportunidades", "abiertas_por_etapa", clave],
    queryFn: async () => {
      const pares = await Promise.all(
        ids.map(async (id) => [id, await apiOportunidades.contarAbiertasEnEtapa(id)] as const),
      )
      return Object.fromEntries(pares) as Record<string, number>
    },
    enabled: ids.length > 0,
    staleTime: 60_000,
  })
  return { conteo: consulta.data ?? {}, cargando: consulta.isPending && ids.length > 0 }
}

/** Vuelve a contar (sin caché) justo antes de desactivar una etapa. */
export function useComprobarEtapaDesactivable(): (etapaId: string) => Promise<number> {
  const queryClient = useQueryClient()
  return useCallback(
    async (etapaId: string) => {
      const n = await apiOportunidades.contarAbiertasEnEtapa(etapaId)
      void queryClient.invalidateQueries({ queryKey: ["oportunidades", "abiertas_por_etapa"] })
      return n
    },
    [queryClient],
  )
}

export interface MutacionesUsuarios {
  cambiarRol: (id: string, rol: RolUsuario) => Promise<boolean>
  cambiarActivo: (id: string, activo: boolean) => Promise<boolean>
  guardando: boolean
}

/** Rol y estado de los usuarios (solo admin; el alta se hace con el script o en Supabase). */
export function useMutacionesUsuarios(): MutacionesUsuarios {
  const queryClient = useQueryClient()
  const guardar = useMutation({
    mutationFn: ({ id, cambios }: { id: string; cambios: { rol?: RolUsuario; activo?: boolean } }) =>
      apiUsuarios.actualizar(id, cambios),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["usuarios"] })
    },
  })

  const aplicar = async (id: string, cambios: { rol?: RolUsuario; activo?: boolean }, porDefecto: string) => {
    try {
      await guardar.mutateAsync({ id, cambios })
      return true
    } catch (e) {
      toast.error(mensajeError(e, porDefecto))
      return false
    }
  }

  return {
    cambiarRol: (id, rol) => aplicar(id, { rol }, "No se pudo cambiar el rol."),
    cambiarActivo: (id, activo) => aplicar(id, { activo }, "No se pudo cambiar el estado del usuario."),
    guardando: guardar.isPending,
  }
}
