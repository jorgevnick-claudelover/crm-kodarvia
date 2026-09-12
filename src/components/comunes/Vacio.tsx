import type { ReactNode } from "react"
import { Inbox, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface VacioProps {
  icono?: LucideIcon
  titulo: string
  descripcion?: string
  /** Botón o enlace de acción. */
  accion?: ReactNode
  className?: string
}

/** Estado vacío con icono y texto. */
export function Vacio({ icono: Icono = Inbox, titulo, descripcion, accion, className }: VacioProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-12 text-center", className)}>
      <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icono className="size-7" aria-hidden />
      </div>
      <p className="text-base font-medium">{titulo}</p>
      {descripcion && <p className="max-w-sm text-sm text-muted-foreground">{descripcion}</p>}
      {accion && <div className="mt-2">{accion}</div>}
    </div>
  )
}
