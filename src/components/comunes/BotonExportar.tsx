import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { type ColumnaCSV, descargarCSV, generarCSV, nombreArchivoExportacion } from "@/lib/utils/csv"

export interface BotonExportarProps {
  /** Devuelve TODAS las filas a exportar con los filtros actuales (usar listarTodo + fetchAll). */
  obtenerFilas: () => Promise<Record<string, unknown>[]>
  columnas: ColumnaCSV[]
  /** Prefijo del archivo: 'contactos', 'oportunidades', 'tareas'. */
  nombreBase: string
  /** El mismo objeto de filtros de la lista (marca el archivo como _filtrado). */
  filtros?: Record<string, unknown>
  className?: string
  variant?: "outline" | "ghost" | "default" | "secondary"
  size?: "sm" | "default" | "lg"
  /** Texto del botón; por defecto "Exportar". */
  texto?: string
}

/** Exporta a CSV lo que muestra la lista (criterio 7). Muestra cuántas filas exportó. */
export function BotonExportar({
  obtenerFilas,
  columnas,
  nombreBase,
  filtros,
  className,
  variant = "outline",
  size = "default",
  texto = "Exportar",
}: BotonExportarProps) {
  const [cargando, setCargando] = useState(false)
  const [ultimo, setUltimo] = useState<number | null>(null)

  const exportar = async () => {
    setCargando(true)
    try {
      const filas = await obtenerFilas()
      setUltimo(filas.length)
      if (filas.length === 0) {
        toast.info("No hay filas que exportar con estos filtros.")
        return
      }
      const csv = generarCSV(filas, columnas)
      await descargarCSV(nombreArchivoExportacion(nombreBase, filtros), csv)
      toast.success(`Exportadas ${filas.length} ${filas.length === 1 ? "fila" : "filas"} a CSV.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo exportar.")
    } finally {
      setCargando(false)
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn("min-h-11 gap-1.5", className)}
      disabled={cargando}
      onClick={() => void exportar()}
      aria-label={texto}
    >
      {cargando ? <Loader2 className="animate-spin" /> : <Download />}
      {texto}
      {ultimo !== null && !cargando && <span className="text-muted-foreground">({ultimo})</span>}
    </Button>
  )
}
