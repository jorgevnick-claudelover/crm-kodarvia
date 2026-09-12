import { ArrowRight, Check, ThumbsDown, Trophy } from "lucide-react"
import { PanelFormulario } from "@/components/comunes/PanelFormulario"
import type { Etapa, Oportunidad } from "@/lib/types"
import { cn } from "@/lib/utils"
import { siguienteEtapa } from "./logica"

const COLOR_PUNTO: Record<string, string> = {
  slate: "bg-slate-500",
  sky: "bg-sky-500",
  teal: "bg-teal-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
}

export function colorPuntoEtapa(color: string | null | undefined): string {
  return COLOR_PUNTO[color ?? ""] ?? "bg-slate-500"
}

export interface SheetMoverAProps {
  abierto: boolean
  onCerrar: () => void
  oportunidad: Oportunidad | null
  /** Etapas activas ordenadas. */
  etapas: Etapa[]
  /** Un toque mueve (el que llama muestra el toast con Deshacer). */
  onMover: (etapa: Etapa) => void
  onGanar: () => void
  onPerder: () => void
}

/**
 * "Mover a": etapas activas con la actual marcada y la siguiente destacada arriba;
 * al final Ganada y Perdida con color propio. Ganada/Perdida abren sus modales
 * (el que llama cierra este sheet antes: nunca dos modales apilados).
 */
export function SheetMoverA({ abierto, onCerrar, oportunidad, etapas, onMover, onGanar, onPerder }: SheetMoverAProps) {
  const actualId = oportunidad?.etapa_id ?? ""
  const siguiente = oportunidad ? siguienteEtapa(etapas, actualId) : null
  const resto = etapas.filter((e) => e.id !== siguiente?.id)

  const filaEtapa = (etapa: Etapa, destacada: boolean) => {
    const actual = etapa.id === actualId
    return (
      <button
        key={etapa.id}
        type="button"
        disabled={actual}
        onClick={() => {
          onCerrar()
          onMover(etapa)
        }}
        className={cn(
          "flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 text-left text-base font-medium transition-colors",
          actual ? "border-primary/40 bg-primary/5 text-foreground" : "hover:bg-muted",
          destacada && "border-primary bg-primary/10",
        )}
        aria-current={actual ? "true" : undefined}
      >
        <span className={cn("size-3 shrink-0 rounded-full", colorPuntoEtapa(etapa.color))} aria-hidden />
        <span className="min-w-0 flex-1 truncate">{etapa.nombre}</span>
        {actual && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Check className="size-4" aria-hidden /> Actual
          </span>
        )}
        {destacada && !actual && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
            Siguiente <ArrowRight className="size-4" aria-hidden />
          </span>
        )}
      </button>
    )
  }

  return (
    <PanelFormulario abierto={abierto} onCerrar={onCerrar} titulo="Mover a" descripcion={oportunidad?.titulo}>
      <div className="space-y-2 pb-2">
        {siguiente && filaEtapa(siguiente, true)}
        {resto.map((e) => filaEtapa(e, false))}
        {etapas.length === 0 && <p className="px-1 text-sm text-muted-foreground">No hay etapas activas configuradas.</p>}

        <div className="grid grid-cols-2 gap-2 pt-3">
          <button
            type="button"
            onClick={() => {
              onCerrar()
              onGanar()
            }}
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-green-300 bg-green-50 text-base font-semibold text-green-800 hover:bg-green-100"
          >
            <Trophy className="size-5" aria-hidden />
            Ganada
          </button>
          <button
            type="button"
            onClick={() => {
              onCerrar()
              onPerder()
            }}
            className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 text-base font-semibold text-red-800 hover:bg-red-100"
          >
            <ThumbsDown className="size-5" aria-hidden />
            Perdida
          </button>
        </div>
      </div>
    </PanelFormulario>
  )
}

export default SheetMoverA
