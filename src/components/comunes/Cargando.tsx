import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export interface CargandoProps {
  /** Número de filas o tarjetas. */
  filas?: number
  tipo?: "lista" | "tarjetas" | "texto" | "pantalla"
  className?: string
}

/** Skeletons de carga. 'pantalla' centra un indicador para toda la vista. */
export function Cargando({ filas = 4, tipo = "lista", className }: CargandoProps) {
  if (tipo === "pantalla") {
    return (
      <div className={cn("flex min-h-[50vh] items-center justify-center", className)} role="status" aria-label="Cargando">
        <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    )
  }
  if (tipo === "texto") {
    return (
      <div className={cn("space-y-2", className)} role="status" aria-label="Cargando">
        {Array.from({ length: filas }).map((_, i) => (
          <Skeleton key={i} className={cn("h-4", i % 3 === 2 ? "w-2/3" : "w-full")} />
        ))}
      </div>
    )
  }
  if (tipo === "tarjetas") {
    return (
      <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", className)} role="status" aria-label="Cargando">
        {Array.from({ length: filas }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    )
  }
  return (
    <div className={cn("space-y-3", className)} role="status" aria-label="Cargando">
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
