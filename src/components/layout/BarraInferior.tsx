import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { LogOut, MoreHorizontal } from "lucide-react"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { AvatarUsuario } from "@/components/comunes/AvatarUsuario"
import { useUsuarioActual } from "@/hooks/useUsuarioActual"
import { cerrarSesion } from "@/hooks/useSesion"
import { cn } from "@/lib/utils"
import { NAVEGACION_MAS, NAVEGACION_MOVIL, rutaActiva } from "./navegacion"

/** Barra inferior del celular: Hoy · Contactos · Oportunidades · Buscar · Más. */
export function BarraInferior() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { usuario, esAdmin } = useUsuarioActual()
  const [masAbierto, setMasAbierto] = useState(false)
  const masActivo = NAVEGACION_MAS.some((i) => rutaActiva(pathname, i.ruta))

  const irA = (ruta: string) => {
    setMasAbierto(false)
    navigate(ruta)
  }

  const salir = async () => {
    setMasAbierto(false)
    await cerrarSesion()
    navigate("/login", { replace: true })
  }

  const claseItem = (activo: boolean) =>
    cn(
      "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
      activo ? "text-primary" : "text-muted-foreground hover:text-foreground",
    )

  return (
    <>
      <nav
        aria-label="Navegación principal"
        className="area-segura-inferior fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden"
      >
        <div className="flex items-stretch">
          {NAVEGACION_MOVIL.map((item) => {
            const activo = rutaActiva(pathname, item.ruta)
            return (
              <Link key={item.ruta} to={item.ruta} className={claseItem(activo)} aria-current={activo ? "page" : undefined}>
                <item.icono className="size-6" aria-hidden />
                {item.etiqueta}
              </Link>
            )
          })}
          <button type="button" className={claseItem(masActivo || masAbierto)} onClick={() => setMasAbierto(true)} aria-haspopup="dialog">
            <MoreHorizontal className="size-6" aria-hidden />
            Más
          </button>
        </div>
      </nav>

      <Drawer open={masAbierto} onOpenChange={setMasAbierto} showSwipeHandle>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-3">
              <AvatarUsuario nombre={usuario?.nombre} id={usuario?.id} />
              <span className="min-w-0">
                <span className="block truncate">{usuario?.nombre ?? "Usuario"}</span>
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {esAdmin ? "Administrador" : "Miembro"} · {usuario?.email ?? ""}
                </span>
              </span>
            </DrawerTitle>
            <DrawerDescription className="sr-only">Más secciones</DrawerDescription>
          </DrawerHeader>
          <div className="area-segura-inferior grid gap-1 px-4 pb-4">
            {NAVEGACION_MAS.filter((i) => !i.soloAdmin || esAdmin).map((item) => (
              <button
                key={item.ruta}
                type="button"
                onClick={() => irA(item.ruta)}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-lg px-3 text-left text-base font-medium hover:bg-muted",
                  rutaActiva(pathname, item.ruta) && "bg-muted text-primary",
                )}
              >
                <item.icono className="size-5" aria-hidden />
                {item.etiqueta}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void salir()}
              className="mt-2 flex min-h-12 items-center gap-3 rounded-lg px-3 text-left text-base font-medium text-destructive hover:bg-destructive/10"
            >
              <LogOut className="size-5" aria-hidden />
              Cerrar sesión
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}

export default BarraInferior
