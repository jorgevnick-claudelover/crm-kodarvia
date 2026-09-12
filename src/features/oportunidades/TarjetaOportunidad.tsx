import type { KeyboardEvent, MouseEvent } from "react"
import { ArrowRight, ArrowRightLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AvatarUsuario } from "@/components/comunes/AvatarUsuario"
import { Importe } from "@/components/comunes/Importe"
import type { Etapa, OportunidadConRelaciones } from "@/lib/types"
import { cn } from "@/lib/utils"

export interface TarjetaOportunidadProps {
  oportunidad: OportunidadConRelaciones
  diasEnEtapa: number
  /** Punto rojo: tarea pendiente vencida (de la oportunidad o del contacto). */
  tareaVencida?: boolean
  /** Punto ámbar: sin ninguna tarea pendiente. */
  sinTarea?: boolean
  /** Abrir el detalle. */
  onAbrir?: () => void
  /** Botón "Mover a" (lista de celular). */
  onMoverA?: () => void
  /** Flecha "Siguiente etapa"; se oculta si no hay siguiente. */
  siguiente?: Etapa | null
  onSiguiente?: () => void
  /** Sin botones ni sombra de tarjeta (tablero). */
  compacta?: boolean
  arrastrando?: boolean
  className?: string
}

/** Tarjeta de oportunidad para la lista (celular) y el tablero (computadora). */
export function TarjetaOportunidad({
  oportunidad: o,
  diasEnEtapa,
  tareaVencida = false,
  sinTarea = false,
  onAbrir,
  onMoverA,
  siguiente,
  onSiguiente,
  compacta = false,
  arrastrando = false,
  className,
}: TarjetaOportunidadProps) {
  const abrir = (e: MouseEvent | KeyboardEvent) => {
    e.stopPropagation()
    onAbrir?.()
  }
  const alTeclado = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      abrir(e)
    }
  }
  const cerrada = o.estado !== "abierta"

  return (
    <div
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-xs transition-shadow",
        arrastrando && "shadow-lg ring-2 ring-primary/40",
        cerrada && o.estado === "ganada" && "border-green-200 bg-green-50/40",
        cerrada && o.estado === "perdida" && "border-red-200 bg-red-50/40",
        className,
      )}
      data-testid="tarjeta-oportunidad"
    >
      <div
        role={onAbrir ? "button" : undefined}
        tabIndex={onAbrir ? 0 : undefined}
        onClick={onAbrir ? abrir : undefined}
        onKeyDown={onAbrir ? alTeclado : undefined}
        className={cn("flex cursor-pointer flex-col gap-1.5 p-3", compacta && "p-2.5")}
        aria-label={`Abrir ${o.titulo}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {tareaVencida && <span className="size-2.5 shrink-0 rounded-full bg-red-500" title="Tarea vencida" aria-label="Tarea vencida" />}
              {!tareaVencida && sinTarea && (
                <span className="size-2.5 shrink-0 rounded-full bg-amber-400" title="Sin tarea pendiente" aria-label="Sin tarea pendiente" />
              )}
              <span className="truncate text-base font-semibold leading-tight">{o.contacto?.nombre ?? "Sin contacto"}</span>
            </div>
            <div className="truncate text-sm text-muted-foreground">{o.titulo}</div>
          </div>
          <AvatarUsuario nombre={o.responsable?.nombre} id={o.responsable_id} tamano="sm" />
        </div>
        <div className="flex items-center justify-between gap-2 text-sm">
          <Importe valor={o.importe} className="font-medium" />
          <span className="text-xs text-muted-foreground">
            {cerrada ? (o.estado === "ganada" ? "Ganada" : "Perdida") : diasEnEtapa === 1 ? "1 día en etapa" : `${diasEnEtapa} días en etapa`}
          </span>
        </div>
      </div>

      {!compacta && !cerrada && (onMoverA || (onSiguiente && siguiente)) && (
        <div className="flex items-center gap-2 border-t px-2 py-1.5">
          {onMoverA && (
            <Button type="button" variant="ghost" size="lg" className="min-h-11 flex-1 gap-1.5" onClick={onMoverA}>
              <ArrowRightLeft />
              Mover a
            </Button>
          )}
          {onSiguiente && siguiente && (
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="min-h-11 flex-1 gap-1.5 text-primary"
              onClick={onSiguiente}
              aria-label={`Pasar a ${siguiente.nombre}`}
              title={`Pasar a ${siguiente.nombre}`}
            >
              <span className="truncate">{siguiente.nombre}</span>
              <ArrowRight />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export default TarjetaOportunidad
