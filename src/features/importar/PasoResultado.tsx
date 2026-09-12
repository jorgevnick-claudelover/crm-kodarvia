/**
 * Paso 4: importar de verdad (lotes de 200), informe descargable, deshacer
 * y lista de las importaciones anteriores.
 */
import { useState } from "react"
import { Link } from "react-router-dom"
import { CheckCircle2, Download, History, Loader2, Undo2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Cargando } from "@/components/comunes/Cargando"
import { Vacio } from "@/components/comunes/Vacio"
import { descargarCSV, generarCSV, nombreArchivoExportacion } from "@/lib/utils/csv"
import { formatearFechaHora } from "@/lib/utils/fechas"
import type { Importacion } from "@/lib/types"
import { COLUMNAS_INFORME_CSV } from "./mapeo"
import { type Importacion4Pasos, useDeshacerImportacion, useImportaciones } from "./useImportacion"

function BarraProgreso({ hecho, total }: { hecho: number; total: number }) {
  const porcentaje = total > 0 ? Math.min(100, Math.round((hecho / total) * 100)) : 0
  return (
    <div
      role="progressbar"
      aria-valuenow={porcentaje}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-3 w-full overflow-hidden rounded-full bg-muted"
    >
      <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${porcentaje}%` }} />
    </div>
  )
}

function BotonDeshacer({
  importacionId,
  onHecho,
  variante = "outline",
}: {
  importacionId: string
  onHecho?: () => void
  variante?: "outline" | "destructive"
}) {
  const [confirmando, setConfirmando] = useState(false)
  const deshacer = useDeshacerImportacion()

  if (!confirmando) {
    return (
      <Button
        type="button"
        variant={variante}
        size="lg"
        className="min-h-11 text-base"
        onClick={() => setConfirmando(true)}
        disabled={deshacer.isPending}
      >
        <Undo2 className="size-4" aria-hidden />
        Deshacer esta importación
      </Button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-destructive/10 p-2">
      <span className="text-sm">Se borrarán los contactos y oportunidades creados por esta importación. ¿Seguro?</span>
      <Button
        type="button"
        variant="destructive"
        size="lg"
        className="min-h-11"
        disabled={deshacer.isPending}
        onClick={() =>
          deshacer.mutate(importacionId, {
            onSuccess: () => {
              setConfirmando(false)
              onHecho?.()
            },
          })
        }
      >
        {deshacer.isPending && <Loader2 className="size-4 animate-spin" />}
        Sí, deshacer
      </Button>
      <Button type="button" variant="ghost" size="lg" className="min-h-11" onClick={() => setConfirmando(false)}>
        Cancelar
      </Button>
    </div>
  )
}

function FilaImportacion({ importacion }: { importacion: Importacion }) {
  return (
    <li className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">{importacion.archivo}</p>
        <span className="text-sm text-muted-foreground">{formatearFechaHora(importacion.created_at)}</span>
      </div>
      <p className="text-sm text-muted-foreground">
        {importacion.filas_no_vacias} filas no vacías · {importacion.creadas} creadas · {importacion.fusionadas} fusionadas ·{" "}
        {importacion.para_revisar} para revisar
        {importacion.hoja ? ` · pestaña «${importacion.hoja}»` : ""}
      </p>
      <BotonDeshacer importacionId={importacion.id} />
    </li>
  )
}

export function PasoResultado({ estado }: { estado: Importacion4Pasos }) {
  const anteriores = useImportaciones()
  const plan = estado.plan
  const resultado = estado.resultado

  const descargarInforme = async () => {
    if (!resultado) return
    try {
      const csv = generarCSV(resultado.informe, COLUMNAS_INFORME_CSV)
      await descargarCSV(nombreArchivoExportacion("informe_importacion"), csv)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo descargar el informe.")
    }
  }

  return (
    <div className="space-y-6">
      {!resultado && (
        <section className="space-y-4">
          {plan ? (
            <p className="text-base">
              Se van a importar <strong>{plan.recuento.noVacias}</strong> filas de{" "}
              <strong>{estado.nombreArchivo}</strong>: {plan.recuento.crear} nuevas, {plan.recuento.fusionar} fusionadas y{" "}
              {plan.recuento.revisar} marcadas para revisar. Ninguna se descarta.
            </p>
          ) : (
            <p className="text-base text-muted-foreground">Vuelve al paso 1 y elige un archivo.</p>
          )}

          {estado.importando && estado.progreso && (
            <div className="space-y-2">
              <BarraProgreso hecho={estado.progreso.hecho} total={estado.progreso.total} />
              <p className="text-sm text-muted-foreground">{estado.progreso.fase}…</p>
            </div>
          )}

          {estado.errorImportar && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {estado.errorImportar}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-h-11 text-base"
              onClick={estado.atras}
              disabled={estado.importando}
            >
              Atrás
            </Button>
            <Button
              type="button"
              size="lg"
              className="min-h-11 text-base"
              onClick={estado.importar}
              disabled={!plan || estado.importando || plan.recuento.noVacias === 0}
            >
              {estado.importando ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" aria-hidden />}
              {estado.importando ? "Importando…" : `Importar ${plan?.recuento.noVacias ?? 0} filas`}
            </Button>
          </div>
        </section>
      )}

      {resultado && (
        <section className="space-y-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/60 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-600" aria-hidden />
            <div>
              <h2 className="text-base font-semibold">Importación terminada</h2>
              <p className="text-sm text-muted-foreground">
                {resultado.recuento.noVacias} filas no vacías, 0 descartadas. {resultado.recuento.crear} contactos creados,{" "}
                {resultado.recuento.fusionar} fusionados y {resultado.recuento.revisar} marcados para revisar.
                {resultado.oportunidades > 0 && ` Se crearon ${resultado.oportunidades} oportunidades.`}
              </p>
              {(resultado.origenesCreados.length > 0 || resultado.etapasCreadas.length > 0) && (
                <p className="pt-1 text-sm text-muted-foreground">
                  Se crearon{" "}
                  {[
                    resultado.origenesCreados.length > 0 ? `los orígenes ${resultado.origenesCreados.join(", ")}` : "",
                    resultado.etapasCreadas.length > 0 ? `las etapas ${resultado.etapasCreadas.join(", ")}` : "",
                  ]
                    .filter(Boolean)
                    .join(" y ")}
                  .
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="lg" className="min-h-11 text-base" onClick={() => void descargarInforme()}>
              <Download className="size-4" aria-hidden />
              Descargar el informe (CSV)
            </Button>
            <Button
              render={<Link to="/contactos" />}
              nativeButton={false}
              variant="outline"
              size="lg"
              className="min-h-11 text-base"
            >
              Ver los contactos
            </Button>
            <Button type="button" variant="outline" size="lg" className="min-h-11 text-base" onClick={estado.reiniciar}>
              Importar otra hoja
            </Button>
          </div>

          <BotonDeshacer importacionId={resultado.importacionId} variante="destructive" onHecho={estado.reiniciar} />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <History className="size-4" aria-hidden />
          Importaciones anteriores
        </h2>
        {anteriores.isPending ? (
          <Cargando filas={2} />
        ) : (anteriores.data?.length ?? 0) === 0 ? (
          <Vacio
            icono={History}
            titulo="Todavía no hay importaciones"
            descripcion="Cuando importes una hoja aparecerá aquí, con su informe y su botón para deshacer."
          />
        ) : (
          <ul className="space-y-2">
            {(anteriores.data ?? []).map((i) => (
              <FilaImportacion key={i.id} importacion={i} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default PasoResultado
