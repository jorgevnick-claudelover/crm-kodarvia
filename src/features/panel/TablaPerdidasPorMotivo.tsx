import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Vacio } from "@/components/comunes/Vacio"
import { formatearImporte } from "@/lib/utils/moneda"
import type { FilaMotivo } from "./calculos"

export interface TablaPerdidasPorMotivoProps {
  filas: FilaMotivo[]
}

/** Perdidas del rango agrupadas por motivo, ordenadas por cantidad. */
export function TablaPerdidasPorMotivo({ filas }: TablaPerdidasPorMotivoProps) {
  const totalN = filas.reduce((s, f) => s + f.n, 0)
  const totalSuma = filas.reduce((s, f) => s + f.suma, 0)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Perdidas por motivo</CardTitle>
        <CardDescription className="tabular-nums">
          {totalN} {totalN === 1 ? "perdida" : "perdidas"} en el periodo · {formatearImporte(totalSuma)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {filas.length === 0 ? (
          <Vacio titulo="Ninguna perdida en el periodo" className="py-6" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((f) => (
                  <TableRow key={f.motivoId ?? "sin-motivo"}>
                    <TableCell className="font-medium">{f.motivo}</TableCell>
                    <TableCell className="text-right tabular-nums">{f.n}</TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">{totalN > 0 ? Math.round((f.n / totalN) * 100) : 0}%</TableCell>
                    <TableCell className="text-right tabular-nums">{formatearImporte(f.suma)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
