import { ArrowDown, ChevronLeft, ChevronRight, Trophy, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Vacio } from "@/components/comunes/Vacio"
import { cn } from "@/lib/utils"
import { etiquetaMesLarga, porcentaje, sumarMeses, type ResultadoEmbudo } from "./calculos"

export interface EmbudoProps {
  resultado: ResultadoEmbudo
  mes: string
  mesMaximo: string
  onCambiarMes: (mes: string) => void
  cargando?: boolean
}

/** Embudo mensual: cohorte creada en el mes, cuántas alcanzaron cada etapa y conversión entre pasos. */
export function Embudo({ resultado, mes, mesMaximo, onCambiarMes, cargando = false }: EmbudoProps) {
  const puedeAvanzar = mes < mesMaximo
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="min-w-0">
          <CardTitle>Embudo del mes</CardTitle>
          <CardDescription>
            Oportunidades creadas en {etiquetaMesLarga(mes)}: {resultado.total}
          </CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="outline" size="icon-lg" className="size-11" aria-label="Mes anterior" onClick={() => onCambiarMes(sumarMeses(mes, -1))}>
            <ChevronLeft className="size-5" />
          </Button>
          <Button
            variant="outline"
            size="icon-lg"
            className="size-11"
            aria-label="Mes siguiente"
            disabled={!puedeAvanzar}
            onClick={() => onCambiarMes(sumarMeses(mes, 1))}
          >
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className={cn(cargando && "opacity-60")} aria-busy={cargando}>
        {resultado.total === 0 ? (
          <Vacio titulo="Sin oportunidades ese mes" descripcion="No se creó ninguna oportunidad con el filtro actual. Prueba otro mes." className="py-6" />
        ) : (
          <ol className="flex flex-col gap-1" aria-label="Etapas del embudo">
            {resultado.pasos.map((p, i) => (
              <li key={p.etapaId} className="flex flex-col gap-1">
                {i > 0 && (
                  <div className="flex items-center gap-1 pl-1 text-xs text-muted-foreground tabular-nums">
                    <ArrowDown className="size-3" aria-hidden />
                    <span>
                      {p.conversion === null ? "–" : porcentaje(p.conversion)} de la etapa anterior
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-sm sm:w-36" title={p.nombre}>
                    {p.nombre}
                  </span>
                  <div className="relative h-8 flex-1 overflow-hidden rounded-md bg-muted">
                    <div
                      className="h-full rounded-md bg-primary transition-[width]"
                      style={{ width: `${Math.max(p.proporcion * 100, p.alcanzaron > 0 ? 2 : 0)}%` }}
                      aria-hidden
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right text-sm tabular-nums">
                    <span className="font-medium">{p.alcanzaron}</span>
                    <span className="text-muted-foreground"> · {porcentaje(p.proporcion)}</span>
                  </span>
                </div>
              </li>
            ))}
            <li className="mt-3 grid grid-cols-2 gap-3 border-t pt-3">
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">
                <Trophy className="size-4 shrink-0" aria-hidden />
                <div className="min-w-0">
                  <div className="text-xs">Ganadas</div>
                  <div className="text-base font-semibold tabular-nums">
                    {resultado.ganadas} <span className="text-xs font-normal">· {porcentaje(resultado.porcentajeGanadas)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-rose-800">
                <XCircle className="size-4 shrink-0" aria-hidden />
                <div className="min-w-0">
                  <div className="text-xs">Perdidas</div>
                  <div className="text-base font-semibold tabular-nums">
                    {resultado.perdidas} <span className="text-xs font-normal">· {porcentaje(resultado.porcentajePerdidas)}</span>
                  </div>
                </div>
              </div>
              <p className="col-span-2 text-xs text-muted-foreground tabular-nums">Siguen abiertas: {resultado.abiertas}</p>
            </li>
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
