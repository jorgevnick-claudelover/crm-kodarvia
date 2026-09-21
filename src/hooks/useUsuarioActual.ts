import type { Usuario } from "@/lib/types"
import { esAdmin as esAdministrador } from "@/lib/reglas"
import { useSesion } from "./useSesion"

export interface UsuarioActual {
  /** Perfil del usuario con el que se está trabajando (null si nadie ha entrado). */
  usuario: Usuario | null
  uid: string | null
  email: string | null
  esAdmin: boolean
  cargando: boolean
  error: Error | null
}

/**
 * Usuario con el que se está trabajando, leído del almacén local. Se actualiza solo
 * cuando cambia la tabla `usuarios` (aquí o en otra pestaña) o cuando se cambia de usuario.
 */
export function useUsuarioActual(): UsuarioActual {
  const { sesion, cargando } = useSesion()
  const usuario = sesion?.usuario ?? null
  return {
    usuario,
    uid: usuario?.id ?? null,
    email: usuario?.email ?? null,
    esAdmin: esAdministrador(usuario),
    cargando,
    error: null,
  }
}
