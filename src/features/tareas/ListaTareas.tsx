/** Lista de tareas agrupada por día (Lima) con FilaTarea. */
import type { ReactNode } from "react"
import { CalendarCheck } from "lucide-react"
import { Vacio } from "@/components/comunes/Vacio"
import type { TareaConRelaciones } from "@/lib/types"
import { cn } from "@/lib/utils"
import { etiquetaRelativa, formatearFechaLarga } from "@/lib/utils/fechas"
import { FilaTarea } from "./FilaTarea"
import { agruparPorDia } from "./logica"

export interface ListaTareasProps {
  tareas: readonly TareaConRelaciones[]
  onEditar?: (tarea: TareaConRelaciones) => void
  /** Agrupa por día con cabecera; si no, lista plana con fecha relativa en cada fila. */
  agruparPorDia?: boolean
  vacio?: { titulo: string; descripcion?: string; accion?: ReactNode }
  className?: string
}

export function etiquetaDia(dia: string): string {
  const iso = `${dia}T12:00:00-05:00`
  const relativa = etiquetaRelativa(iso)
  const larga = formatearFechaLarga(iso)
  return relativa === "Hoy" || relativa === "Mañana" || relativa === "Ayer" ? `${relativa} · ${larga}` : larga
}

export function ListaTareas({ tareas, onEditar, agruparPorDia: agrupar = true, vacio, className }: ListaTareasProps) {
  if (tareas.length === 0) {
    return <Vacio icono={CalendarCheck} titulo={vacio?.titulo ?? "Sin tareas"} descripcion={vacio?.descripcion} accion={vacio?.accion} />
  }
  if (!agrupar) {
    return (
      <ul className={cn("divide-y", className)}>
        {tareas.map((t) => (
          <FilaTarea key={t.id} tarea={t} onEditar={onEditar} formatoFecha="relativa" />
        ))}
      </ul>
    )
  }
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {agruparPorDia(tareas).map((grupo) => (
        <section key={grupo.dia} aria-label={etiquetaDia(grupo.dia)}>
          <h3 className="sticky top-14 z-10 bg-background/95 py-1.5 text-sm font-semibold capitalize text-muted-foreground backdrop-blur">
            {etiquetaDia(grupo.dia)}
          </h3>
          <ul className="divide-y">
            {grupo.tareas.map((t) => (
              <FilaTarea key={t.id} tarea={t} onEditar={onEditar} formatoFecha="hora" />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export default ListaTareas
