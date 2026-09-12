import { useEffect, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { supabase, supabaseConfigurado } from "@/lib/supabase"

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

/** Cierra la sesión y limpia la caché local de consultas. */
export async function cerrarSesion(): Promise<void> {
  await supabase.auth.signOut()
  try {
    localStorage.removeItem("crm.cache")
  } catch {
    // sin localStorage (modo privado): no pasa nada
  }
}
