import { useCallback, useEffect, useState } from "react"
import type { QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { suscribirse } from "@/lib/almacen"
import { olvidarUsuario, suscribirseSesion, usuarioActual } from "@/lib/sesion"
import type { Usuario } from "@/lib/types"
import { olvidarAvisos } from "@/features/tareas/AvisoRecordatorios"

export { CLAVE_USUARIO, entrarComo, idUsuarioActual, usuarioActual } from "@/lib/sesion"

/** Sesión simulada: no hay autenticación, solo el usuario con el que se está trabajando. */
export interface SesionSimulada {
  usuarioId: string
  usuario: Usuario
}

export interface EstadoSesion {
  sesion: SesionSimulada | null
  /** Se mantiene por compatibilidad: leer el almacén local es inmediato, así que siempre es false. */
  cargando: boolean
}

/**
 * Cierra la sesión y limpia la caché de consultas (memoria y disco) más los avisos ya
 * mostrados, para que el siguiente usuario de la misma pestaña no vea nada del anterior.
 * Los datos del CRM no se tocan: siguen guardados en este navegador.
 */
export async function cerrarSesion(queryClient?: QueryClient): Promise<void> {
  olvidarUsuario()
  queryClient?.clear()
  // Descarta los toasts de recordatorio, que se muestran con duration: Infinity.
  toast.dismiss()
  olvidarAvisos()
  try {
    localStorage.removeItem("crm.cache")
  } catch {
    // sin localStorage (modo privado): no pasa nada
  }
  return Promise.resolve()
}

function calcular(): EstadoSesion {
  const usuario = usuarioActual()
  return { sesion: usuario ? { usuarioId: usuario.id, usuario } : null, cargando: false }
}

/** Usuario con el que se está trabajando. Se actualiza al entrar, al salir y desde otras pestañas. */
export function useSesion(): EstadoSesion {
  const [estado, setEstado] = useState<EstadoSesion>(calcular)

  const refrescar = useCallback(() => {
    setEstado((anterior) => {
      const nuevo = calcular()
      const mismo =
        anterior.sesion?.usuarioId === nuevo.sesion?.usuarioId && anterior.sesion?.usuario === nuevo.sesion?.usuario
      return mismo ? anterior : nuevo
    })
  }, [])

  useEffect(() => {
    refrescar()
    const cancelarSesion = suscribirseSesion(refrescar)
    // La tabla de usuarios puede cambiar (renombrar, desactivar) aquí o en otra pestaña.
    const cancelarAlmacen = suscribirse((tablas) => {
      if (tablas.includes("usuarios")) refrescar()
    })
    return () => {
      cancelarSesion()
      cancelarAlmacen()
    }
  }, [refrescar])

  return estado
}
