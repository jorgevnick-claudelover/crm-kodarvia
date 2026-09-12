/** Filtros de la lista de tareas (viven en la URL: la exportación usa el mismo objeto). */
import { useEffect, useState } from "react"
import { Search, SlidersHorizontal, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChipsSeleccion } from "@/components/comunes/ChipsSeleccion"
import { useCatalogos } from "@/hooks/useCatalogos"
import { useDebounce } from "@/hooks/useDebounce"
import type { FiltrosTareas as Filtros } from "@/lib/api/tareas"
import { cn } from "@/lib/utils"

type EstadoFiltro = "pendiente" | "hecha" | "todas"

export interface FiltrosTareasProps {
  filtros: Required<Filtros>
  setFiltros: (parcial: Partial<Required<Filtros>>) => void
  limpiar: () => void
  hayFiltros: boolean
  className?: string
}

const OPCIONES_ESTADO: { valor: EstadoFiltro; etiqueta: string }[] = [
  { valor: "pendiente", etiqueta: "Pendientes" },
  { valor: "hecha", etiqueta: "Hechas" },
  { valor: "todas", etiqueta: "Todas" },
]

export function FiltrosTareas({ filtros, setFiltros, limpiar, hayFiltros, className }: FiltrosTareasProps) {
  const { usuarios } = useCatalogos()
  const [texto, setTexto] = useState(filtros.texto)
  const textoRetrasado = useDebounce(texto.trim(), 300)
  const hayAvanzados = !!(filtros.responsableId || filtros.desde || filtros.hasta)
  const [masAbierto, setMasAbierto] = useState(hayAvanzados)

  useEffect(() => {
    if (textoRetrasado !== filtros.texto) setFiltros({ texto: textoRetrasado })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textoRetrasado])

  useEffect(() => {
    if (filtros.texto !== texto.trim()) setTexto(filtros.texto)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.texto])

  const estado: EstadoFiltro = filtros.estado === "hecha" || filtros.estado === "todas" ? filtros.estado : "pendiente"

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            aria-label="Buscar en el título"
            placeholder="Buscar tarea…"
            enterKeyHint="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="h-11 pl-9"
          />
        </div>
        <Button
          type="button"
          variant={masAbierto || hayAvanzados ? "secondary" : "outline"}
          size="lg"
          className="min-h-11"
          aria-expanded={masAbierto}
          onClick={() => setMasAbierto((v) => !v)}
        >
          <SlidersHorizontal />
          <span className="hidden sm:inline">Filtros</span>
        </Button>
      </div>

      <ChipsSeleccion<EstadoFiltro>
        etiqueta="Estado"
        tamano="sm"
        valor={estado}
        onCambiar={(v) => setFiltros({ estado: v ?? "pendiente" })}
        opciones={OPCIONES_ESTADO}
      />

      {masAbierto && (
        <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-3">
          {usuarios.length > 0 && (
            <div className="space-y-1.5">
              <Label>Responsable</Label>
              <ChipsSeleccion
                etiqueta="Responsable"
                tamano="sm"
                valor={filtros.responsableId}
                onCambiar={(v) => setFiltros({ responsableId: v ?? "" })}
                opciones={[{ valor: "", etiqueta: "Todos" }, ...usuarios.map((u) => ({ valor: u.id, etiqueta: u.nombre }))]}
              />
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tareas-desde">Desde</Label>
              <Input id="tareas-desde" type="date" value={filtros.desde} onChange={(e) => setFiltros({ desde: e.target.value })} className="h-11 w-40" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tareas-hasta">Hasta</Label>
              <Input id="tareas-hasta" type="date" value={filtros.hasta} onChange={(e) => setFiltros({ hasta: e.target.value })} className="h-11 w-40" />
            </div>
          </div>
          {hayFiltros && (
            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-9"
                onClick={() => {
                  setTexto("")
                  limpiar()
                }}
              >
                <X />
                Quitar filtros
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default FiltrosTareas
