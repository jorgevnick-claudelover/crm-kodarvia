import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChipsSeleccion } from "@/components/comunes/ChipsSeleccion"
import { Vacio } from "@/components/comunes/Vacio"
import { useSimboloMoneda } from "@/hooks/useMoneda"
import { formatearImporte, formatearNumero } from "@/lib/utils/moneda"
import type { MatrizEtapaResponsable } from "./calculos"

type Medida = "n" | "suma"

export interface GraficoPorEtapaProps {
  matriz: MatrizEtapaResponsable
}

interface FilaGrafico {
  etapa: string
  etapaId: string
  [serie: string]: string | number
}

interface EntradaTooltip {
  dataKey?: string | number
  name?: string | number
  value?: unknown
  color?: string
}

interface TooltipEtapaProps {
  active?: boolean
  label?: string | number
  payload?: ReadonlyArray<EntradaTooltip>
  matriz: MatrizEtapaResponsable
}

function TooltipEtapa({ active, label, payload, matriz }: TooltipEtapaProps) {
  const simbolo = useSimboloMoneda()
  if (!active || !payload || payload.length === 0) return null
  const fila = matriz.filas.find((f) => f.etapa === label)
  if (!fila) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      <p className="mb-1 font-medium">{fila.etapa}</p>
      <ul className="space-y-0.5">
        {payload.map((p) => {
          const id = String(p.dataKey ?? "")
          const celda = fila.celdas[id]
          if (!celda) return null
          return (
            <li key={id} className="flex items-center gap-2 tabular-nums">
              <span className="inline-block size-2.5 rounded-sm" style={{ background: p.color }} aria-hidden />
              <span className="flex-1">{p.name}</span>
              <span>{celda.n}</span>
              <span className="text-muted-foreground">{formatearImporte(celda.suma, simbolo)}</span>
            </li>
          )
        })}
      </ul>
      <p className="mt-1 border-t pt-1 text-xs text-muted-foreground tabular-nums">
        Total {fila.total.n} · {formatearImporte(fila.total.suma, simbolo)}
      </p>
    </div>
  )
}

/** Barras apiladas: oportunidades abiertas por etapa (una barra) y responsable (segmentos). Conmutador cantidad / dinero. */
export function GraficoPorEtapa({ matriz }: GraficoPorEtapaProps) {
  const [medida, setMedida] = useState<Medida>("n")
  const simbolo = useSimboloMoneda()
  const datos = useMemo<FilaGrafico[]>(
    () =>
      matriz.filas.map((f) => {
        const fila: FilaGrafico = { etapa: f.etapa, etapaId: f.etapaId }
        for (const s of matriz.series) fila[s.id] = f.celdas[s.id]?.[medida] ?? 0
        return fila
      }),
    [matriz, medida],
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <CardTitle>Abiertas por etapa y responsable</CardTitle>
        <ChipsSeleccion<Medida>
          etiqueta="Medida"
          tamano="sm"
          opciones={[
            { valor: "n", etiqueta: "Cantidad" },
            { valor: "suma", etiqueta: simbolo },
          ]}
          valor={medida}
          onCambiar={(v) => v && setMedida(v)}
        />
      </CardHeader>
      <CardContent>
        {matriz.total.n === 0 ? (
          <Vacio titulo="No hay oportunidades abiertas" descripcion="Con el filtro actual no hay nada abierto en el tablero." className="py-8" />
        ) : (
          <>
            <div className="h-72 w-full" role="img" aria-label="Gráfico de barras apiladas de oportunidades abiertas por etapa y responsable">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
                  <CartesianGrid vertical={false} stroke="currentColor" className="text-border" strokeOpacity={0.6} />
                  <XAxis dataKey="etapa" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} interval={0} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={medida === "suma" ? 64 : 32}
                    tick={{ fontSize: 12 }}
                    allowDecimals={false}
                    tickFormatter={(v: number) => (medida === "suma" ? formatearNumero(v, 0) : String(v))}
                  />
                  <Tooltip cursor={{ fill: "currentColor", fillOpacity: 0.06 }} content={<TooltipEtapa matriz={matriz} />} />
                  <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  {matriz.series.map((s, i) => (
                    <Bar
                      key={s.id}
                      dataKey={s.id}
                      name={s.nombre}
                      stackId="abiertas"
                      fill={s.color}
                      stroke="var(--card)"
                      strokeWidth={1}
                      radius={i === matriz.series.length - 1 ? [4, 4, 0, 0] : 0}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-muted-foreground select-none">Ver tabla</summary>
              <div className="mt-2 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Etapa</TableHead>
                      {matriz.series.map((s) => (
                        <TableHead key={s.id} className="text-right">
                          {s.nombre}
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matriz.filas.map((f) => (
                      <TableRow key={f.etapaId}>
                        <TableCell className="font-medium">{f.etapa}</TableCell>
                        {matriz.series.map((s) => {
                          const c = f.celdas[s.id]
                          return (
                            <TableCell key={s.id} className="text-right tabular-nums">
                              {c ? `${c.n} · ${formatearImporte(c.suma, simbolo)}` : "–"}
                            </TableCell>
                          )
                        })}
                        <TableCell className="text-right font-medium tabular-nums">
                          {f.total.n} · {formatearImporte(f.total.suma, simbolo)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </details>
          </>
        )}
      </CardContent>
    </Card>
  )
}
