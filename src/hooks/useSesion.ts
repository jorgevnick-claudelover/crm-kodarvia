import { useEffect, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import type { QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { supabase, supabaseConfigurado } from "@/lib/supabase"
import { olvidarAvisos } from "@/features/tareas/AvisoRecordatorios"

export interface EstadoSesion {
  sesion: Session | null
  /** true hasta que supabase responde la primera vez. */
  cargando: boolean
}

/** Sesión de Supabase Auth, actualizada con onAuthStateChange. */
export function useSesion(): EstadoSesion {
  const [estado, setEstado] = useState<EstadoSesion>({ sesion: null, cargando: supabaseConfigurado })

  useEffect(() => {
    if (!supabaseConfigurado) return
    let activo = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (activo) setEstado({ sesion: data.session, cargando: false })
      })
      .catch(() => {
        if (activo) setEstado({ sesion: null, cargando: false })
      })
    const { data: suscripcion } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      if (activo) setEstado({ sesion, cargando: false })
    })
    return () => {
      activo = false
      suscripcion.subscription.unsubscribe()
    }
  }, [])

  return estado
}

/**
 * Cierra la sesión y limpia la caché de consultas (memoria y disco) más los avisos ya mostrados,
 * para que el siguiente usuario de la misma pestaña no vea nada del anterior (criterio 4).
 */
export async function cerrarSesion(queryClient: QueryClient): Promise<void> {
  await supabase.auth.signOut()
  queryClient.clear()
  // Descarta los toasts de recordatorio, que se muestran con duration: Infinity.
  toast.dismiss()
  olvidarAvisos()
  try {
    localStorage.removeItem("crm.cache")
  } catch {
    // sin localStorage (modo privado): no pasa nada
  }
}
