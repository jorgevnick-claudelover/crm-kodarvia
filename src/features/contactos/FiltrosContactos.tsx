import { ChipsSeleccion } from "@/components/comunes/ChipsSeleccion"
import type { Origen } from "@/lib/types"
import { cn } from "@/lib/utils"
import { type FiltrosURLContactos, type QuienContactos, verSoloMios } from "./logica"

export interface FiltrosContactosProps {
  filtros: FiltrosURLContactos
  setFiltros: (parcial: Partial<FiltrosURLContactos>) => void
  esAdmin: boolean
  origenes: Origen[]
  className?: string
}

/** Chips de filtro: Míos / Todos · origen · Sin seguimiento. Todo queda en la URL (criterio 7). */
export function FiltrosContactos({ filtros, setFiltros, esAdmin, origenes, className }: FiltrosContactosProps) {
  const quienEfectivo: QuienContactos = verSoloMios(filtros.quien, esAdmin) ? "mios" : "todos"
  const base =
    "inline-flex min-h-9 items-center justify-center rounded-full border px-3 text-sm font-medium transition-colors select-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <ChipsSeleccion<QuienContactos>
        etiqueta="Responsable"
        tamano="sm"
        valor={quienEfectivo}
        onCambiar={(v) => {
          if (!v) return
          // Si coincide con el valor por defecto del rol, sale de la URL.
          const porDefecto = verSoloMios("", esAdmin) ? "mios" : "todos"
          setFiltros({ quien: v === porDefecto ? "" : v })
        }}
        opciones={[
          { valor: "mios", etiqueta: "Míos" },
          { valor: "todos", etiqueta: "Todos" },
        ]}
      />
      {origenes.length > 0 && (
        <>
          <span className="hidden h-6 w-px bg-border sm:inline-block" aria-hidden />
          <ChipsSeleccion
            etiqueta="Origen"
            tamano="sm"
            valor={filtros.origenId}
            permitirVacio
            onCambiar={(v) => setFiltros({ origenId: v ?? "" })}
            opciones={origenes.map((o) => ({ valor: o.id, etiqueta: o.nombre }))}
          />
        </>
      )}
      <button
        type="button"
        aria-pressed={filtros.sinSeguimiento}
        onClick={() => setFiltros({ sinSeguimiento: !filtros.sinSeguimiento })}
        className={cn(
          base,
          filtros.sinSeguimiento ? "border-amber-500 bg-amber-500 text-white" : "border-border bg-background text-foreground hover:bg-muted",
        )}
      >
        Sin seguimiento
      </button>
    </div>
  )
}

export default FiltrosContactos
