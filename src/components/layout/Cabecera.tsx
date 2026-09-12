import type { ReactNode } from "react"
import { Link, useLocation } from "react-router-dom"
import { Search, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { tituloDeRuta } from "./navegacion"

export interface CabeceraProps {
  /** Título explícito; si no, se deduce de la ruta. */
  titulo?: string
  /** Acciones a la derecha (además de la lupa). */
  acciones?: ReactNode
  /** Muestra un aviso cuando el canal de tiempo real no está conectado. */
  sinTiempoReal?: boolean
  className?: string
}

/** Cabecera con título y lupa (lleva a /buscar). */
export function Cabecera({ titulo, acciones, sinTiempoReal = false, className }: CabeceraProps) {
  const { pathname } = useLocation()
  const texto = titulo ?? tituloDeRuta(pathname)
  const enBuscar = pathname.startsWith("/buscar")
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80",
        className,
      )}
    >
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{texto}</h1>
      {sinTiempoReal && (
        <span className="hidden items-center gap-1 text-xs text-amber-700 sm:inline-flex" title="Sin conexión en tiempo real; se actualiza cada 30 s">
          <WifiOff className="size-3.5" aria-hidden />
          Actualizando cada 30 s
        </span>
      )}
      {acciones}
      {!enBuscar && (
        <Button
          variant="ghost"
          size="icon-lg"
          className="size-11"
          aria-label="Buscar"
          nativeButton={false}
          render={<Link to="/buscar" />}
        >
          <Search className="size-5" />
        </Button>
      )}
    </header>
  )
}

export default Cabecera
