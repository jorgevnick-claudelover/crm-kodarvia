import { Link, useLocation, useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { LogOut } from "lucide-react"
import { AvatarUsuario } from "@/components/comunes/AvatarUsuario"
import { Button } from "@/components/ui/button"
import { useUsuarioActual } from "@/hooks/useUsuarioActual"
import { cerrarSesion } from "@/hooks/useSesion"
import { cn } from "@/lib/utils"
import { NAVEGACION, rutaActiva } from "./navegacion"

/** Barra lateral de computadora con todas las secciones. */
export function BarraLateral() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { usuario, esAdmin } = useUsuarioActual()

  const salir = async () => {
    await cerrarSesion(queryClient)
    navigate("/login", { replace: true })
  }

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex" aria-label="Barra lateral">
      <Link to="/" className="flex h-14 items-center gap-2 border-b px-4">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-8 rounded-lg" />
        <span className="text-base font-semibold">CRM Gestoría</span>
      </Link>
      <nav className="flex-1 space-y-1 p-3" aria-label="Secciones">
        {NAVEGACION.filter((i) => !i.soloAdmin || esAdmin).map((item) => {
          const activo = rutaActiva(pathname, item.ruta)
          return (
            <Link
              key={item.ruta}
              to={item.ruta}
              aria-current={activo ? "page" : undefined}
              className={cn(
                "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                activo ? "bg-primary/10 text-primary" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              <item.icono className="size-5" aria-hidden />
              {item.etiqueta}
            </Link>
          )
        })}
      </nav>
      <div className="flex items-center gap-3 border-t p-3">
        <AvatarUsuario nombre={usuario?.nombre} id={usuario?.id} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{usuario?.nombre ?? "Usuario"}</div>
          <div className="truncate text-xs text-muted-foreground">{esAdmin ? "Administrador" : "Miembro"}</div>
        </div>
        <Button variant="ghost" size="icon" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={() => void salir()}>
          <LogOut />
        </Button>
      </div>
    </aside>
  )
}

export default BarraLateral
