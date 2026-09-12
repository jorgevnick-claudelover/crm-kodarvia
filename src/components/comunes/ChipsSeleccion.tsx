import { cn } from "@/lib/utils"

export interface OpcionChip<T extends string = string> {
  valor: T
  etiqueta: string
  /** Nombre de color de Tailwind (slate, teal, rose...) o clase completa. */
  color?: string
  deshabilitada?: boolean
}

interface PropsBase<T extends string> {
  opciones: OpcionChip<T>[]
  className?: string
  tamano?: "sm" | "md"
  /** aria-label del grupo. */
  etiqueta?: string
  /** Permite deseleccionar tocando el chip activo (solo selección simple). */
  permitirVacio?: boolean
}

export interface ChipsSeleccionSimpleProps<T extends string> extends PropsBase<T> {
  multiple?: false
  valor: T | null | ""
  onCambiar: (valor: T | null) => void
}

export interface ChipsSeleccionMultipleProps<T extends string> extends PropsBase<T> {
  multiple: true
  valor: T[]
  onCambiar: (valor: T[]) => void
}

export type ChipsSeleccionProps<T extends string> = ChipsSeleccionSimpleProps<T> | ChipsSeleccionMultipleProps<T>

const COLORES: Record<string, string> = {
  slate: "bg-slate-600 border-slate-600 text-white",
  sky: "bg-sky-600 border-sky-600 text-white",
  teal: "bg-teal-600 border-teal-600 text-white",
  emerald: "bg-emerald-600 border-emerald-600 text-white",
  amber: "bg-amber-500 border-amber-500 text-white",
  orange: "bg-orange-600 border-orange-600 text-white",
  rose: "bg-rose-600 border-rose-600 text-white",
  violet: "bg-violet-600 border-violet-600 text-white",
  red: "bg-red-600 border-red-600 text-white",
  green: "bg-green-600 border-green-600 text-white",
}

function claseActiva(color?: string): string {
  if (!color) return "bg-primary border-primary text-primary-foreground"
  return COLORES[color] ?? color
}

/** Chips en vez de selectores: selección simple o múltiple, objetivos táctiles de 44 px. */
export function ChipsSeleccion<T extends string>(props: ChipsSeleccionProps<T>) {
  const { opciones, className, tamano = "md", etiqueta } = props
  const seleccionados = new Set<string>(props.multiple ? props.valor : props.valor ? [props.valor] : [])

  const alternar = (opcion: OpcionChip<T>) => {
    if (opcion.deshabilitada) return
    if (props.multiple) {
      const actual = props.valor
      props.onCambiar(actual.includes(opcion.valor) ? actual.filter((v) => v !== opcion.valor) : [...actual, opcion.valor])
    } else if (props.valor === opcion.valor) {
      if (props.permitirVacio) props.onCambiar(null)
    } else {
      props.onCambiar(opcion.valor)
    }
  }

  return (
    <div role="group" aria-label={etiqueta} className={cn("flex flex-wrap gap-2", className)}>
      {opciones.map((o) => {
        const activo = seleccionados.has(o.valor)
        return (
          <button
            key={o.valor}
            type="button"
            aria-pressed={activo}
            disabled={o.deshabilitada}
            onClick={() => alternar(o)}
            className={cn(
              "inline-flex items-center justify-center rounded-full border font-medium transition-colors select-none",
              "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50",
              tamano === "sm" ? "min-h-9 px-3 text-sm" : "min-h-11 px-4 text-base",
              activo ? claseActiva(o.color) : "border-border bg-background text-foreground hover:bg-muted",
            )}
          >
            {o.etiqueta}
          </button>
        )
      })}
    </div>
  )
}
