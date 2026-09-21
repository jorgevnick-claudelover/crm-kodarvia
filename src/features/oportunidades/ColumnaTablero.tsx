import { useDroppable } from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Importe } from "@/components/comunes/Importe"
import type { Etapa, OportunidadConRelaciones } from "@/lib/types"
import { cn } from "@/lib/utils"
import { sumaImportes } from "./logica"
import { colorPuntoEtapa } from "./SheetMoverA"
import { TarjetaOportunidad } from "./TarjetaOportunidad"

export const PREFIJO_ETAPA = "etapa:"
export const ZONA_GANADA = "zona:ganada"
export const ZONA_PERDIDA = "zona:perdida"

export function idColumna(etapaId: string): string {
  return `${PREFIJO_ETAPA}${etapaId}`
}

export interface DatosArrastre {
  tipo: "tarjeta" | "etapa" | "zona"
  etapaId?: string
  oportunidad?: OportunidadConRelaciones
}

export interface PropsTarjetaArrastrable {
  oportunidad: OportunidadConRelaciones
  diasEnEtapa: number
  tareaVencida: boolean
  sinTarea: boolean
  onAbrir: () => void
  /** Sin permiso para moverla: no se puede arrastrar. */
  bloqueada?: boolean
}

/** Tarjeta ordenable dentro de una columna. */
export function TarjetaArrastrable({ oportunidad, diasEnEtapa, tareaVencida, sinTarea, onAbrir, bloqueada = false }: PropsTarjetaArrastrable) {
  const datos: DatosArrastre = { tipo: "tarjeta", etapaId: oportunidad.etapa_id, oportunidad }
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: oportunidad.id,
    data: datos,
    disabled: bloqueada,
  })
  const style = { transform: CSS.Translate.toString(transform), transition }
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn("touch-manipulation", isDragging && "opacity-30", bloqueada ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing")}
      title={bloqueada ? "Solo su responsable o el administrador puede moverla" : undefined}
    >
      <TarjetaOportunidad
        oportunidad={oportunidad}
        diasEnEtapa={diasEnEtapa}
        tareaVencida={tareaVencida}
        sinTarea={sinTarea}
        onAbrir={onAbrir}
        compacta
      />
    </div>
  )
}

export interface ColumnaTableroProps {
  etapa: Etapa
  oportunidades: OportunidadConRelaciones[]
  /** Resaltada como destino durante un arrastre. */
  destino?: boolean
  diasEnEtapaDe: (o: OportunidadConRelaciones) => number
  tieneVencida: (o: OportunidadConRelaciones) => boolean
  sinTarea: (o: OportunidadConRelaciones) => boolean
  puedeMover: (o: OportunidadConRelaciones) => boolean
  onAbrir: (o: OportunidadConRelaciones) => void
  className?: string
}

/** Columna del tablero: cabecera con contador y suma de importes, tarjetas ordenables, zona de soltar. */
export function ColumnaTablero({
  etapa,
  oportunidades,
  destino = false,
  diasEnEtapaDe,
  tieneVencida,
  sinTarea,
  puedeMover,
  onAbrir,
  className,
}: ColumnaTableroProps) {
  const datos: DatosArrastre = { tipo: "etapa", etapaId: etapa.id }
  const { setNodeRef, isOver } = useDroppable({ id: idColumna(etapa.id), data: datos })
  const ids = oportunidades.map((o) => o.id)
  const resaltada = destino || isOver

  return (
    <section
      ref={setNodeRef}
      aria-label={`Etapa ${etapa.nombre}`}
      className={cn(
        "flex h-full w-72 shrink-0 flex-col rounded-xl border bg-muted/40 transition-colors",
        resaltada && "border-primary bg-primary/10 ring-2 ring-primary/30",
        className,
      )}
    >
      <header className="flex items-center gap-2 px-3 py-2.5">
        <span className={cn("size-2.5 shrink-0 rounded-full", colorPuntoEtapa(etapa.color))} aria-hidden />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{etapa.nombre}</h2>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground" aria-label={`${oportunidades.length} oportunidades`}>
          {oportunidades.length}
        </span>
      </header>
      <div className="px-3 pb-2 text-xs text-muted-foreground">
        <Importe valor={sumaImportes(oportunidades)} />
      </div>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
          {oportunidades.map((o) => (
            <TarjetaArrastrable
              key={o.id}
              oportunidad={o}
              diasEnEtapa={diasEnEtapaDe(o)}
              tareaVencida={tieneVencida(o)}
              sinTarea={sinTarea(o)}
              onAbrir={() => onAbrir(o)}
              bloqueada={!puedeMover(o)}
            />
          ))}
          {oportunidades.length === 0 && (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              Arrastra aquí
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  )
}

export interface ZonaCierreProps {
  tipo: "ganada" | "perdida"
  destino?: boolean
  visible: boolean
}

/** Zona de soltar "Ganada" (verde) o "Perdida" (roja), al final del tablero. */
export function ZonaCierre({ tipo, destino = false, visible }: ZonaCierreProps) {
  const datos: DatosArrastre = { tipo: "zona" }
  const { setNodeRef, isOver } = useDroppable({ id: tipo === "ganada" ? ZONA_GANADA : ZONA_PERDIDA, data: datos })
  const resaltada = destino || isOver
  const verde = tipo === "ganada"
  return (
    <div
      ref={setNodeRef}
      aria-label={verde ? "Soltar para marcar como ganada" : "Soltar para marcar como perdida"}
      className={cn(
        "flex flex-1 items-center justify-center rounded-xl border-2 border-dashed text-base font-semibold transition-all",
        verde ? "border-green-400 bg-green-50 text-green-800" : "border-red-400 bg-red-50 text-red-800",
        resaltada && (verde ? "border-solid bg-green-200 ring-4 ring-green-300" : "border-solid bg-red-200 ring-4 ring-red-300"),
        !visible && "opacity-60",
      )}
    >
      {verde ? "Ganada" : "Perdida"}
    </div>
  )
}
