import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useSimboloMoneda } from "@/hooks/useMoneda"
import { formatearImporte, formatearNumero } from "@/lib/utils/moneda"
import type { PuntoMes } from "./calculos"

export interface GraficoGanadoPorMesProps {
  puntos: PuntoMes[]
}

interface TooltipMesProps {
  active?: boolean
  label?: string | number
  puntos: PuntoMes[]
}

function TooltipMes({ active, label, puntos }: TooltipMesProps) {
  const simbolo = useSimboloMoneda()
  if (!active) return null
  const p = puntos.find((x) => x.etiqueta === label)
  if (!p) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md tabular-nums">
      <p className="font-medium">{p.etiqueta}</p>
      <p>{formatearImporte(p.suma, simbolo)}</p>
      <p className="text-xs text-muted-foreground">
        {p.n} {p.n === 1 ? "ganada" : "ganadas"}
      </p>
    </div>
  )
}

/** Barras: suma de importe de oportunidades ganadas por mes (ganada_at en Lima). */
export function GraficoGanadoPorMes({ puntos }: GraficoGanadoPorMesProps) {
  const simbolo = useSimboloMoneda()
  const total = puntos.reduce((s, p) => s + p.suma, 0)
  const n = puntos.reduce((s, p) => s + p.n, 0)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ganado por mes</CardTitle>
        <CardDescription className="tabular-nums">
          {formatearImporte(total, simbolo)} en {puntos.length} meses · {n} {n === 1 ? "ganada" : "ganadas"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full" role="img" aria-label="Gráfico de barras del importe ganado por mes">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={puntos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={puntos.length > 6 ? "20%" : "35%"}>
              <CartesianGrid vertical={false} stroke="currentColor" className="text-border" strokeOpacity={0.6} />
              <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} interval={puntos.length > 6 ? 1 : 0} />
              <YAxis tickLine={false} axisLine={false} width={64} tick={{ fontSize: 12 }} tickFormatter={(v: number) => formatearNumero(v, 0)} />
              <Tooltip cursor={{ fill: "currentColor", fillOpacity: 0.06 }} content={<TooltipMes puntos={puntos} />} />
              <Bar dataKey="suma" name="Ganado" fill="var(--primary)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {total === 0 && <p className="mt-2 text-center text-sm text-muted-foreground">Nada ganado en estos meses.</p>}
      </CardContent>
    </Card>
  )
}
