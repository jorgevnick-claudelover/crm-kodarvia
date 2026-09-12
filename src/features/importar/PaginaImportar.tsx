/**
 * Asistente de importación en 4 pasos (criterio 6: ninguna fila no vacía se pierde).
 * Solo para el administrador. La ruta ya va dentro de RequiereAdmin, pero la página
 * lo comprueba también por si se monta desde otro sitio.
 */
import { Link } from "react-router-dom"
import { Check, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Cargando } from "@/components/comunes/Cargando"
import { Vacio } from "@/components/comunes/Vacio"
import { useUsuarioActual } from "@/hooks/useUsuarioActual"
import { cn } from "@/lib/utils"
import { PasoArchivo } from "./PasoArchivo"
import { PasoMapeo } from "./PasoMapeo"
import { PasoPrevisualizacion } from "./PasoPrevisualizacion"
import { PasoResultado } from "./PasoResultado"
import { PASOS, useImportacion, type PasoImportacion } from "./useImportacion"

function Indicador({
  paso,
  hayArchivo,
  irAPaso,
}: {
  paso: PasoImportacion
  hayArchivo: boolean
  irAPaso: (paso: PasoImportacion) => void
}) {
  return (
    <ol className="flex items-center gap-1 sm:gap-2" aria-label="Pasos de la importación">
      {PASOS.map((p, i) => {
        const hecho = p.numero < paso
        const actual = p.numero === paso
        const accesible = p.numero === 1 || hayArchivo
        return (
          <li key={p.numero} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => accesible && irAPaso(p.numero)}
              disabled={!accesible}
              aria-current={actual ? "step" : undefined}
              className={cn(
                "flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left transition-colors",
                accesible ? "hover:bg-muted" : "opacity-50",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                  actual && "bg-primary text-primary-foreground",
                  hecho && "bg-emerald-600 text-white",
                  !actual && !hecho && "bg-muted text-muted-foreground",
                )}
              >
                {hecho ? <Check className="size-4" aria-hidden /> : p.numero}
              </span>
              <span className={cn("truncate text-sm", actual ? "font-semibold" : "text-muted-foreground")}>{p.titulo}</span>
            </button>
            {i < PASOS.length - 1 && <span className="h-px w-2 shrink-0 bg-border sm:w-4" aria-hidden />}
          </li>
        )
      })}
    </ol>
  )
}

export function PaginaImportar() {
  const { esAdmin, cargando } = useUsuarioActual()
  const estado = useImportacion()

  if (cargando) return <Cargando tipo="pantalla" />

  if (!esAdmin) {
    return (
      <Vacio
        icono={ShieldAlert}
        titulo="Solo para el administrador"
        descripcion="La importación de hojas la hace el administrador del estudio. Si tienes una lista que subir, pídesela a él."
        accion={
          <Button render={<Link to="/" />} nativeButton={false}>
            Volver a Hoy
          </Button>
        }
      />
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Importar</h1>
        <p className="text-sm text-muted-foreground">
          Sube la hoja del cliente y revisa qué pasará con cada fila. No se pierde ninguna fila con datos: las dudosas entran
          marcadas para revisar.
        </p>
      </header>

      <Indicador paso={estado.paso} hayArchivo={estado.hojas.length > 0} irAPaso={estado.irAPaso} />

      {!estado.catalogosListos && estado.paso > 1 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Cargando las etapas y los orígenes del CRM… Si no aparecen, revisa Configuración antes de importar.
        </p>
      )}

      {estado.paso === 1 && <PasoArchivo estado={estado} />}
      {estado.paso === 2 && <PasoMapeo estado={estado} />}
      {estado.paso === 3 && <PasoPrevisualizacion estado={estado} />}
      {estado.paso === 4 && <PasoResultado estado={estado} />}
    </div>
  )
}

export default PaginaImportar
