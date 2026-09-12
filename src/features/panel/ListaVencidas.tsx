import { Link } from "react-router-dom"
import { ChevronRight } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AvatarUsuario } from "@/components/comunes/AvatarUsuario"
import { Vacio } from "@/components/comunes/Vacio"
import { diasEntre, hoyLima } from "@/lib/utils/fechas"
import type { FilaVencidas } from "./calculos"

export interface ListaVencidasProps {
  filas: FilaVencidas[]
}

/** Tareas pendientes vencidas agrupadas por responsable, con enlace a la lista filtrada. */
export function ListaVencidas({ filas }: ListaVencidasProps) {
  const total = filas.reduce((s, f) => s + f.n, 0)
  const hoy = hoyLima()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tareas vencidas por responsable</CardTitle>
        <CardDescription className="tabular-nums">{total} {total === 1 ? "tarea vencida" : "tareas vencidas"}</CardDescription>
      </CardHeader>
      <CardContent>
        {filas.length === 0 ? (
          <Vacio titulo="Nadie tiene tareas vencidas" descripcion="Todo al día." className="py-6" />
        ) : (
          <ul className="divide-y">
            {filas.map((f) => {
              const dias = Math.max(0, -diasEntre(hoy, f.masAntigua))
              return (
                <li key={f.responsableId}>
                  <Link
                    to={`/tareas?estado=pendiente&responsableId=${encodeURIComponent(f.responsableId)}&hasta=${hoy}`}
                    className="flex min-h-14 items-center gap-3 py-2 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  >
                    <AvatarUsuario nombre={f.nombre} id={f.responsableId} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-medium">{f.nombre}</span>
                      <span className="block text-xs text-muted-foreground">
                        {dias === 0 ? "La más antigua vence hoy" : `La más antigua lleva ${dias} ${dias === 1 ? "día" : "días"}`}
                      </span>
                    </span>
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-semibold text-amber-800 tabular-nums">{f.n}</span>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
