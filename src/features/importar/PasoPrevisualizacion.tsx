/**
 * Paso 3: qué va a pasar con cada fila antes de tocar la base de datos.
 * Arriba el recuento grande (descartadas siempre 0, criterio 6) y debajo la tabla.
 */
import { useState } from "react"
import { CheckCircle2, GitMerge, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Cargando } from "@/components/comunes/Cargando"
import { useEsMovil } from "@/hooks/useEsMovil"
import { cn } from "@/lib/utils"
import { formatearImporte } from "@/lib/utils/moneda"
import { formatearTelefono } from "@/lib/utils/telefono"
import { type PlanFila, describirResultado } from "./mapeo"
import type { Importacion4Pasos } from "./useImportacion"

const MAXIMO_VISIBLE = 200

function Tarjeta({
  etiqueta,
  valor,
  className,
  destacada = false,
}: {
  etiqueta: string
  valor: number
  className?: string
  destacada?: boolean
}) {
  return (
    <div className={cn("rounded-xl border p-3 text-center", destacada && "border-2", className)}>
      <p className="text-2xl font-bold tabular-nums sm:text-3xl">{valor}</p>
      <p className="text-xs text-muted-foreground sm:text-sm">{etiqueta}</p>
    </div>
  )
}

function Resultado({ p }: { p: PlanFila }) {
  if (p.resultado === "fusionado") {
    return (
      <span className="inline-flex items-start gap-1.5 text-sky-700">
        <GitMerge className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{describirResultado(p)}</span>
      </span>
    )
  }
  if (p.resultado === "revisar") {
    return (
      <span className="inline-flex items-start gap-1.5 text-amber-700">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{describirResultado(p)}</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-start gap-1.5 text-emerald-700">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>Crear</span>
    </span>
  )
}

export function PasoPrevisualizacion({ estado }: { estado: Importacion4Pasos }) {
  const esMovil = useEsMovil()
  const [todas, setTodas] = useState(false)
  const plan = estado.plan

  if (estado.cargandoExistentes || !plan) {
    return <Cargando tipo="pantalla" />
  }

  const { recuento } = plan
  const visibles = todas ? plan.filas : plan.filas.slice(0, MAXIMO_VISIBLE)

  return (
    <div className="space-y-5">
      {estado.errorExistentes && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          No se pudieron leer los contactos que ya están en el CRM: {estado.errorExistentes.message}. Se importará igual, pero puede
          que algún duplicado no se detecte.
        </p>
      )}

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Tarjeta etiqueta="Filas del archivo" valor={recuento.total} />
        <Tarjeta etiqueta="No vacías" valor={recuento.noVacias} destacada className="border-primary/40" />
        <Tarjeta etiqueta="Se crearán" valor={recuento.crear} className="bg-emerald-50 text-emerald-900" />
        <Tarjeta etiqueta="Se fusionarán" valor={recuento.fusionar} className="bg-sky-50 text-sky-900" />
        <Tarjeta etiqueta="Para revisar" valor={recuento.revisar} className="bg-amber-50 text-amber-900" />
        <Tarjeta etiqueta="Descartadas" valor={0} className="bg-muted/50" />
      </div>

      <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
        {recuento.crear} + {recuento.fusionar} + {recuento.revisar} = {recuento.crear + recuento.fusionar + recuento.revisar} de{" "}
        {recuento.noVacias} filas no vacías. Ninguna fila se descarta: las dudosas entran marcadas para revisar.
        {plan.creaOportunidades && " Además se crearán oportunidades con la etapa y el importe de la hoja."}
      </p>

      {esMovil ? (
        <ul className="space-y-2">
          {visibles.map((p) => (
            <li key={p.fila} className="rounded-lg border p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-medium">{p.contacto?.nombre ?? p.datos.nombre ?? "(sin nombre)"}</p>
                <span className="text-xs text-muted-foreground">Fila {p.fila}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {[p.datos.empresa, formatearTelefono(p.datos.telefono), p.datos.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}
              </p>
              {p.oportunidad && (
                <p className="text-sm text-muted-foreground">
                  {p.datos.etapa ?? "Primera etapa"} · {formatearImporte(p.oportunidad.importe)}
                </p>
              )}
              <p className="pt-1 text-sm">
                <Resultado p={p} />
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b text-left">
                <th className="px-3 py-2 font-medium">Fila</th>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Empresa</th>
                <th className="px-3 py-2 font-medium">Celular</th>
                <th className="px-3 py-2 font-medium">Correo</th>
                <th className="px-3 py-2 font-medium">Etapa</th>
                <th className="px-3 py-2 text-right font-medium">Importe</th>
                <th className="px-3 py-2 font-medium">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => (
                <tr key={p.fila} className="border-b last:border-b-0 align-top">
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{p.fila}</td>
                  <td className="px-3 py-2 font-medium">{p.contacto?.nombre ?? p.datos.nombre ?? "(sin nombre)"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.datos.empresa ?? ""}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatearTelefono(p.datos.telefono)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.datos.email ?? ""}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.datos.etapa ?? ""}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {p.oportunidad ? formatearImporte(p.oportunidad.importe) : ""}
                  </td>
                  <td className="px-3 py-2">
                    <Resultado p={p} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {plan.filas.length > MAXIMO_VISIBLE && (
        <Button type="button" variant="outline" size="lg" className="min-h-11 w-full text-base" onClick={() => setTodas((t) => !t)}>
          {todas ? `Mostrar solo las primeras ${MAXIMO_VISIBLE}` : `Ver las ${plan.filas.length} filas`}
        </Button>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" size="lg" className="min-h-11 text-base" onClick={estado.atras}>
          Atrás
        </Button>
        <Button type="button" size="lg" className="min-h-11 text-base" onClick={estado.siguiente}>
          Continuar
        </Button>
      </div>
    </div>
  )
}

export default PasoPrevisualizacion
