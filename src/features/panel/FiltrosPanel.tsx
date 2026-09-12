import { useState } from "react"
import { SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ChipsSeleccion } from "@/components/comunes/ChipsSeleccion"
import { useEsMovil } from "@/hooks/useEsMovil"
import type { Usuario } from "@/lib/types"
import { diaLegible, ETIQUETA_PRESET, PRESETS_RANGO, type PresetRango, type Rango } from "./calculos"

export interface FiltrosPanelValores {
  preset: PresetRango
  desde: string
  hasta: string
  responsableId: string
}

export interface FiltrosPanelProps {
  valores: FiltrosPanelValores
  rango: Rango
  usuarios: Usuario[]
  onCambiar: (parcial: Partial<FiltrosPanelValores>) => void
  onLimpiar: () => void
  hayFiltros: boolean
}

function esPreset(v: string | null): v is PresetRango {
  return v !== null && (PRESETS_RANGO as readonly string[]).includes(v)
}

/** Rango de fechas (presets + personalizado) y responsable. En celular va dentro de un sheet. */
export function FiltrosPanel(props: FiltrosPanelProps) {
  const esMovil = useEsMovil()
  const [abierto, setAbierto] = useState(false)
  const { valores, rango, usuarios } = props
  const responsable = usuarios.find((u) => u.id === valores.responsableId)
  const resumen = `${diaLegible(rango.desde)} – ${diaLegible(rango.hasta)}${responsable ? ` · ${responsable.nombre}` : ""}`

  if (!esMovil) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <CamposFiltros {...props} />
        <p className="text-xs text-muted-foreground">{resumen}</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="lg" className="h-11 flex-1 justify-start px-3 text-base" onClick={() => setAbierto(true)}>
          <SlidersHorizontal data-icon="inline-start" className="size-4" />
          <span className="truncate">{ETIQUETA_PRESET[valores.preset]}</span>
          {responsable && <span className="truncate text-muted-foreground">· {responsable.nombre}</span>}
        </Button>
        {props.hayFiltros && (
          <Button variant="ghost" size="lg" className="h-11" onClick={props.onLimpiar}>
            Quitar
          </Button>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{resumen}</p>
      <Sheet open={abierto} onOpenChange={(open) => setAbierto(open)}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          <SheetHeader>
            <SheetTitle>Filtros del panel</SheetTitle>
            <SheetDescription>Periodo y responsable que se aplican a todo el panel.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4">
            <CamposFiltros {...props} />
            <Button size="lg" className="h-12 text-base" onClick={() => setAbierto(false)}>
              Listo
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function CamposFiltros({ valores, usuarios, onCambiar, onLimpiar, hayFiltros }: FiltrosPanelProps) {
  const opcionesPreset = PRESETS_RANGO.map((p) => ({ valor: p, etiqueta: ETIQUETA_PRESET[p] }))
  const opcionesUsuarios = [{ valor: "todos", etiqueta: "Todos" }, ...usuarios.map((u) => ({ valor: u.id, etiqueta: u.nombre }))]
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Periodo</span>
        <ChipsSeleccion
          etiqueta="Periodo"
          tamano="sm"
          opciones={opcionesPreset}
          valor={valores.preset}
          onCambiar={(v) => {
            if (esPreset(v)) onCambiar({ preset: v })
          }}
        />
        {valores.preset === "personalizado" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="panel-desde">Desde</Label>
              <Input
                id="panel-desde"
                type="date"
                className="h-11 text-base"
                value={valores.desde}
                max={valores.hasta || undefined}
                onChange={(e) => onCambiar({ desde: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="panel-hasta">Hasta</Label>
              <Input
                id="panel-hasta"
                type="date"
                className="h-11 text-base"
                value={valores.hasta}
                min={valores.desde || undefined}
                onChange={(e) => onCambiar({ hasta: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Responsable</span>
        <ChipsSeleccion
          etiqueta="Responsable"
          tamano="sm"
          opciones={opcionesUsuarios}
          valor={valores.responsableId || "todos"}
          onCambiar={(v) => onCambiar({ responsableId: !v || v === "todos" ? "" : v })}
        />
      </div>
      {hayFiltros && (
        <div>
          <Button variant="ghost" size="sm" onClick={onLimpiar}>
            Volver a los últimos 6 meses
          </Button>
        </div>
      )}
    </div>
  )
}
