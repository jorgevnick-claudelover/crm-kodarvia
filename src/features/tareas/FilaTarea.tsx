/**
 * Fila de tarea reutilizada en Hoy y en Tareas: Hecha (con Deshacer), título, contacto con
 * enlace, hora en Lima, avatar del responsable y botones Llamar / WhatsApp si hay teléfono.
 */
import { Check, Circle, RotateCcw } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { AvatarUsuario } from "@/components/comunes/AvatarUsuario"
import { EnlaceTelefono } from "@/components/comunes/EnlaceTelefono"
import type { TareaConRelaciones } from "@/lib/types"
import { cn } from "@/lib/utils"
import { etiquetaRelativaConHora, formatearHora } from "@/lib/utils/fechas"
import { estaVencida } from "./logica"
import { useMutacionesTareas } from "./useTareas"

export interface FilaTareaProps {
  tarea: TareaConRelaciones
  /** Al tocar el título (abrir el formulario de edición). */
  onEditar?: (tarea: TareaConRelaciones) => void
  /** 'hora' (dentro de un bloque de un día) o 'relativa' ("Hoy 09:00", "15/09 14:30"). */
  formatoFecha?: "hora" | "relativa"
  className?: string
}

export function FilaTarea({ tarea, onEditar, formatoFecha = "relativa", className }: FilaTareaProps) {
  const { completar, reabrir } = useMutacionesTareas()
  const hecha = tarea.estado === "hecha"
  const vencida = estaVencida(tarea)
  const ocupada = completar.isPending || reabrir.isPending
  const etiquetaHora = formatoFecha === "hora" ? formatearHora(tarea.vence_at) : etiquetaRelativaConHora(tarea.vence_at)

  return (
    <li className={cn("flex items-start gap-3 py-3", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label={hecha ? "Reabrir tarea" : "Marcar como hecha"}
        aria-pressed={hecha}
        disabled={ocupada}
        className={cn("size-11 shrink-0 rounded-full", hecha ? "text-emerald-600" : "text-muted-foreground hover:text-primary")}
        onClick={() => (hecha ? reabrir.mutate(tarea.id) : completar.mutate(tarea.id))}
      >
        {hecha ? <Check className="size-6" /> : <Circle className="size-6" />}
      </Button>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onEditar?.(tarea)}
          className={cn("block w-full text-left text-base font-medium leading-tight", hecha && "text-muted-foreground line-through")}
        >
          {tarea.titulo}
        </button>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
          <span className={cn("tabular-nums", vencida && "font-semibold text-destructive")}>{etiquetaHora}</span>
          {tarea.contacto && (
            <>
              <span aria-hidden>·</span>
              <Link to={`/contactos/${tarea.contacto.id}`} className="truncate text-foreground underline-offset-4 hover:underline">
                {tarea.contacto.nombre}
              </Link>
            </>
          )}
          {tarea.oportunidad && (
            <>
              <span aria-hidden>·</span>
              <Link to={`/oportunidades/${tarea.oportunidad.id}`} className="truncate underline-offset-4 hover:underline">
                {tarea.oportunidad.titulo}
              </Link>
            </>
          )}
        </div>
        {tarea.contacto?.telefono && !hecha && (
          <EnlaceTelefono telefono={tarea.contacto.telefono} mostrarNumero={false} tamano="sm" className="mt-2" />
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        <AvatarUsuario nombre={tarea.responsable?.nombre} id={tarea.responsable_id} tamano="sm" />
        {hecha && (
          <Button type="button" variant="ghost" size="sm" className="min-h-9" disabled={ocupada} onClick={() => reabrir.mutate(tarea.id)}>
            <RotateCcw />
            Deshacer
          </Button>
        )}
      </div>
    </li>
  )
}

export default FilaTarea
