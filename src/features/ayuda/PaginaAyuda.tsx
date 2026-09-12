/**
 * Guía de uso de una página, dentro de la app. Mismo contenido que `docs/GUIA.md`.
 * Secciones cortas con icono, pasos numerados, legible en el celular y en dos columnas
 * al imprimir (cabe en una hoja A4).
 */
import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SECCIONES, type SeccionAyuda } from "./contenido"

function Seccion({ seccion }: { seccion: SeccionAyuda }) {
  const Icono = seccion.icono
  return (
    <section
      aria-labelledby={`ayuda-${seccion.id}`}
      className="mb-3 inline-block w-full break-inside-avoid rounded-xl border bg-card p-4 print:mb-2 print:rounded-none print:border-0 print:border-b print:p-2"
    >
      <h2 id={`ayuda-${seccion.id}`} className="flex items-start gap-2 text-base font-semibold print:text-[10pt]">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary print:hidden">
          <Icono className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 pt-1.5 print:pt-0">{seccion.titulo}</span>
      </h2>

      <p className="mt-2 text-base text-muted-foreground print:mt-1 print:text-[9pt]">{seccion.texto}</p>

      {seccion.pasos && (
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-base print:mt-1 print:space-y-0 print:text-[9pt]">
          {seccion.pasos.map((paso) => (
            <li key={paso}>{paso}</li>
          ))}
        </ol>
      )}

      {seccion.bloques?.map((bloque) => (
        <div key={bloque.titulo} className="mt-3 print:mt-1">
          <h3 className="text-sm font-semibold print:text-[9pt]">{bloque.titulo}</h3>
          <ol className="mt-1.5 list-decimal space-y-1.5 pl-5 text-base print:mt-0 print:space-y-0 print:text-[9pt]">
            {bloque.pasos.map((paso) => (
              <li key={paso}>{paso}</li>
            ))}
          </ol>
        </div>
      ))}

      {seccion.definiciones && (
        <dl className="mt-3 space-y-1.5 text-base print:mt-1 print:space-y-0 print:text-[9pt]">
          {seccion.definiciones.map((d) => (
            <div key={d.termino}>
              <dt className="inline font-semibold">{d.termino}:</dt> <dd className="inline text-muted-foreground">{d.texto}</dd>
            </div>
          ))}
        </dl>
      )}

      {seccion.nota && (
        <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-sm print:mt-1 print:bg-transparent print:px-0 print:py-0 print:text-[8.5pt] print:italic">
          {seccion.nota}
        </p>
      )}
    </section>
  )
}

export function PaginaAyuda() {
  return (
    <div className="mx-auto w-full max-w-5xl p-4 print:max-w-none print:p-0">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3 print:mb-2">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold print:text-[12pt]">Guía rápida del CRM</h1>
          <p className="text-base text-muted-foreground print:text-[9pt]">
            Lo que hay que saber para usarlo, en dos minutos. Cabe en una hoja: imprímala y déjela sobre el escritorio.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-h-11 gap-1.5 print:hidden"
          onClick={() => window.print()}
        >
          <Printer />
          Imprimir
        </Button>
      </header>

      <div className="columns-1 md:columns-2 xl:columns-3 print:columns-2 print:gap-4">
        {SECCIONES.map((s) => (
          <Seccion key={s.id} seccion={s} />
        ))}
      </div>

      <footer className="mt-2 text-sm text-muted-foreground print:text-[8pt]">
        ¿Algo no cuadra o falta? Anótelo y avísele al administrador del estudio.
      </footer>
    </div>
  )
}

export default PaginaAyuda
