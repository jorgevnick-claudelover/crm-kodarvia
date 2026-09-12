import { useQuery } from "@tanstack/react-query"
import type { Usuario } from "@/lib/types"
import * as apiUsuarios from "@/lib/api/usuarios"
import { useSesion } from "./useSesion"

export interface UsuarioActual {
  /** Perfil de la tabla usuarios del uid actual (null si no hay sesión o aún carga). */
  usuario: Usuario | null
  uid: string | null
  email: string | null
  esAdmin: boolean
  cargando: boolean
  error: Error | null
}

/** Perfil del usuario con sesión. Clave ['usuarios', 'actual', uid]: realtime la invalida por 'usuarios'. */
export function useUsuarioActual(): UsuarioActual {
  const { sesion, cargando: cargandoSesion } = useSesion()
  const uid = sesion?.user.id ?? null
  const consulta = useQuery({
    queryKey: ["usuarios", "actual", uid],
    queryFn: () => (uid ? apiUsuarios.obtener(uid) : Promise.resolve(null)),
    enabled: !!uid,
    staleTime: 5 * 60 * 1000,
  })
  const usuario = consulta.data ?? null
  return {
    usuario,
    uid,
    email: sesion?.user.email ?? null,
    esAdmin: usuario?.rol === "admin" && usuario.activo,
    cargando: cargandoSesion || (!!uid && consulta.isPending),
    error: consulta.error,
  }
}
