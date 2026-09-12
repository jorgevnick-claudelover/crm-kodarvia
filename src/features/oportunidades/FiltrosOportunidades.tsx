import { useEffect, useState } from "react"
import { Search, SlidersHorizontal, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChipsSeleccion } from "@/components/comunes/ChipsSeleccion"
import { PanelFormulario } from "@/components/comunes/PanelFormulario"
import { useCatalogos } from "@/hooks/useCatalogos"
import { useDebounce } from "@/hooks/useDebounce"
import { useEsMovil } from "@/hooks/useEsMovil"
import { FILTROS_OPORTUNIDADES_DEFAULT, type FiltrosOportunidades } from "@/lib/api/oportunidades"
import { cn } from "@/lib/utils"

export type FiltrosURLOportunidades = Required<FiltrosOportunidades>

export interface FiltrosOportunidadesProps {
  filtros: FiltrosURLOportunidades
  setFiltros: (parcial: Partial<FiltrosURLOportunidades>) => void
  limpiar: () => void
  className?: string
}

type Marca = "sinSeguimiento" | "conTareaVencida"

/** Cuenta los filtros activos que no sean el texto ni la etapa/estado (que se ven en pantalla). */
function contarActivos(f: FiltrosURLOportunidades): number {
  let n = 0
  if (f.responsableId) n++
  if (f.origenId) n++
  if (f.sinSeguimiento) n++
  if (f.conTareaVencida) n++
  return n
}

/** Filtros compartidos por lista, tablero y exportación: responsable, origen, texto, sin seguimiento, con tarea vencida. */
export function FiltrosOportunidades({ filtros, setFiltros, limpiar, className }: FiltrosOportunidadesProps) {
  const esMovil = useEsMovil()
  const { usuarios, origenes } = useCatalogos()
  const [texto, setTexto] = useState(filtros.texto)
  const [panelAbierto, setPanelAbierto] = useState(false)
  const textoRetrasado = useDebounce(texto.trim(), 300)

  // Escribe el texto en la URL con retraso; si la URL cambia desde fuera (limpiar), sincroniza.
  useEffect(() => {
    if (textoRetrasado !== filtros.texto) setFiltros({ texto: textoRetrasado })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textoRetrasado])
  useEffect(() => {
    if (filtros.texto !== texto.trim()) setTexto(filtros.texto)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.texto])

  const marcas: Marca[] = []
  if (filtros.sinSeguimiento) marcas.push("sinSeguimiento")
  if (filtros.conTareaVencida) marcas.push("conTareaVencida")
  const activos = contarActivos(filtros)
  const hayAlgo = activos > 0 || !!filtros.texto

  const chips = (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-sm text-muted-foreground">Responsable</Label>
        <ChipsSeleccion
          tamano="sm"
          etiqueta="Responsable"
          permitirVacio
          valor={filtros.responsableId}
          onCambiar={(v) => setFiltros({ responsableId: v ?? "" })}
          opciones={usuarios.map((u) => ({ valor: u.id, etiqueta: u.nombre }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm text-muted-foreground">Origen del contacto</Label>
        <ChipsSeleccion
          tamano="sm"
          etiqueta="Origen"
          permitirVacio
          valor={filtros.origenId}
          onCambiar={(v) => setFiltros({ origenId: v ?? "" })}
          opciones={origenes.map((o) => ({ valor: o.id, etiqueta: o.nombre }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm text-muted-foreground">Seguimiento</Label>
        <ChipsSeleccion<Marca>
          multiple
          tamano="sm"
          etiqueta="Seguimiento"
          valor={marcas}
          onCambiar={(v) => setFiltros({ sinSeguimiento: v.includes("sinSeguimiento"), conTareaVencida: v.includes("conTareaVencida") })}
          opciones={[
            { valor: "sinSeguimiento", etiqueta: "Sin seguimiento", color: "amber" },
            { valor: "conTareaVencida", etiqueta: "Con tarea vencida", color: "red" },
          ]}
        />
      </div>
    </div>
  )

  const campoTexto = (
    <div className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        aria-label="Buscar oportunidad o contacto"
        placeholder="Buscar por contacto o título"
        className="h-11 pl-9"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
    </div>
  )

  if (esMovil) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {campoTexto}
        <Button
          type="button"
          variant={activos > 0 ? "default" : "outline"}
          size="lg"
          className="min-h-11 gap-1.5"
          onClick={() => setPanelAbierto(true)}
          aria-label="Filtros"
        >
          <SlidersHorizontal />
          {activos > 0 ? activos : "Filtros"}
        </Button>
        <PanelFormulario
          abierto={panelAbierto}
          onCerrar={() => setPanelAbierto(false)}
          titulo="Filtros"
          pie={
            <div className="flex w-full gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="min-h-11 flex-1"
                onClick={() => {
                  limpiar()
                  setTexto("")
                }}
                disabled={!hayAlgo}
              >
                Quitar filtros
              </Button>
              <Button type="button" size="lg" className="min-h-11 flex-1" onClick={() => setPanelAbierto(false)}>
                Ver resultados
              </Button>
            </div>
          }
        >
          {chips}
        </PanelFormulario>
      </div>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <div className="max-w-md flex-1">{campoTexto}</div>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="min-h-11 gap-1.5"
          aria-expanded={panelAbierto}
          onClick={() => setPanelAbierto((v) => !v)}
        >
          <SlidersHorizontal />
          Filtros{activos > 0 && <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">{activos}</span>}
        </Button>
        {hayAlgo && (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="min-h-11 gap-1.5 text-muted-foreground"
            onClick={() => {
              limpiar()
              setTexto("")
            }}
          >
            <X />
            Quitar filtros
          </Button>
        )}
      </div>
      {(panelAbierto || activos > 0) && <div className="rounded-xl border bg-muted/30 p-3">{chips}</div>}
    </div>
  )
}

export { FILTROS_OPORTUNIDADES_DEFAULT }
export default FiltrosOportunidades
