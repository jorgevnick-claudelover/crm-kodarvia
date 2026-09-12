import { useQuery } from "@tanstack/react-query"
import type { Etapa, MotivoPerdida, Origen, Usuario } from "@/lib/types"
import * as apiCatalogos from "@/lib/api/catalogos"
import * as apiUsuarios from "@/lib/api/usuarios"

const STALE = 10 * 60 * 1000

export interface Catalogos {
  /** Etapas activas ordenadas por orden. */
  etapas: Etapa[]
  /** Todas las etapas (incluye inactivas), para configuración e históricos. */
  etapasTodas: Etapa[]
  motivos: MotivoPerdida[]
  motivosTodos: MotivoPerdida[]
  origenes: Origen[]
  origenesTodos: Origen[]
  /** Usuarios activos. */
  usuarios: Usuario[]
  usuariosTodos: Usuario[]
  cargando: boolean
  error: Error | null
  /** Busca en todas las listas (también inactivos) para mostrar nombres en históricos. */
  etapaPorId: (id: string | null | undefined) => Etapa | undefined
  motivoPorId: (id: string | null | undefined) => MotivoPerdida | undefined
  origenPorId: (id: string | null | undefined) => Origen | undefined
  usuarioPorId: (id: string | null | undefined) => Usuario | undefined
}

const VACIO: never[] = []

/** Catálogos con staleTime alto; realtime invalida ['etapas'], ['motivos_perdida'], ['origenes'], ['usuarios']. */
export function useCatalogos(): Catalogos {
  const etapas = useQuery({ queryKey: ["etapas"], queryFn: () => apiCatalogos.listarEtapas(true), staleTime: STALE })
  const motivos = useQuery({ queryKey: ["motivos_perdida"], queryFn: () => apiCatalogos.listarMotivos(true), staleTime: STALE })
  const origenes = useQuery({ queryKey: ["origenes"], queryFn: () => apiCatalogos.listarOrigenes(true), staleTime: STALE })
  const usuarios = useQuery({ queryKey: ["usuarios"], queryFn: () => apiUsuarios.listar(false), staleTime: STALE })

  const etapasTodas = etapas.data ?? VACIO
  const motivosTodos = motivos.data ?? VACIO
  const origenesTodos = origenes.data ?? VACIO
  const usuariosTodos = usuarios.data ?? VACIO

  return {
    etapas: etapasTodas.filter((e) => e.activa),
    etapasTodas,
    motivos: motivosTodos.filter((m) => m.activo),
    motivosTodos,
    origenes: origenesTodos.filter((o) => o.activo),
    origenesTodos,
    usuarios: usuariosTodos.filter((u) => u.activo),
    usuariosTodos,
    cargando: etapas.isPending || motivos.isPending || origenes.isPending || usuarios.isPending,
    error: etapas.error ?? motivos.error ?? origenes.error ?? usuarios.error ?? null,
    etapaPorId: (id) => etapasTodas.find((e) => e.id === id),
    motivoPorId: (id) => motivosTodos.find((m) => m.id === id),
    origenPorId: (id) => origenesTodos.find((o) => o.id === id),
    usuarioPorId: (id) => usuariosTodos.find((u) => u.id === id),
  }
}
