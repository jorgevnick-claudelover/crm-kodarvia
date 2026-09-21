import { useEffect, useState } from "react"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { ChevronRight, ShieldCheck } from "lucide-react"
import { Toaster } from "@/components/ui/sonner"
import { AvatarUsuario } from "@/components/comunes/AvatarUsuario"
import { Cargando } from "@/components/comunes/Cargando"
import { useSesion } from "@/hooks/useSesion"
import { entrarComo } from "@/lib/sesion"
import { leer, suscribirse } from "@/lib/almacen"
import type { Usuario } from "@/lib/types"

interface EstadoDesde {
  desde?: string
}

/** Usuarios activos, el administrador primero y luego por nombre. */
function usuariosDisponibles(): Usuario[] {
  return leer()
    .usuarios.filter((u) => u.activo)
    .sort((a, b) => {
      if (a.rol !== b.rol) return a.rol === "admin" ? -1 : 1
      return a.nombre.localeCompare(b.nombre, "es")
    })
}

/**
 * Entrada al CRM: no hay contraseñas. Se elige con quién trabajar y un toque entra.
 * Es una versión de demostración; los datos viven en este navegador.
 */
export function PaginaLogin() {
  const { sesion, cargando } = useSesion()
  const navigate = useNavigate()
  const location = useLocation()
  const [usuarios, setUsuarios] = useState<Usuario[]>(usuariosDisponibles)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => suscribirse((tablas) => {
    if (tablas.includes("usuarios")) setUsuarios(usuariosDisponibles())
  }), [])

  if (cargando) return <Cargando tipo="pantalla" className="min-h-dvh" />
  if (sesion) {
    const desde = (location.state as EstadoDesde | null)?.desde
    return <Navigate to={desde && desde !== "/login" ? desde : "/"} replace />
  }

  const entrar = (usuario: Usuario) => {
    setError(null)
    try {
      entrarComo(usuario.id)
      const desde = (location.state as EstadoDesde | null)?.desde
      navigate(desde && desde !== "/login" ? desde : "/", { replace: true })
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "No se pudo entrar. Inténtalo de nuevo.")
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-card p-6 text-card-foreground shadow-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="CRM" width={160} height={46} className="h-12 w-auto" />
          <div>
            <h1 className="text-xl font-semibold">Entra al CRM</h1>
            <p className="text-sm text-muted-foreground">Estudio contable · Arequipa</p>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Elige con quién quieres entrar. Es una versión de demostración: los datos se guardan en este navegador.
        </p>

        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {usuarios.length === 0 ? (
          <p className="rounded-lg bg-muted px-3 py-4 text-center text-sm text-muted-foreground">
            No hay usuarios activos en este navegador. Recarga la página para volver a crear los de ejemplo.
          </p>
        ) : (
          <ul className="space-y-2">
            {usuarios.map((usuario) => (
              <li key={usuario.id}>
                <button
                  type="button"
                  onClick={() => entrar(usuario)}
                  className="flex w-full min-h-16 items-center gap-3 rounded-xl border bg-background p-3 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:bg-accent"
                >
                  <AvatarUsuario nombre={usuario.nombre} id={usuario.id} tamano="lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium">{usuario.nombre}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      {usuario.rol === "admin" ? (
                        <>
                          <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
                          Administrador del estudio
                        </>
                      ) : (
                        "Miembro del equipo"
                      )}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Toaster />
    </main>
  )
}

export default PaginaLogin
