import { useEffect, useState } from "react"
import { CalendarDays } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { hoyLima, sumarDias } from "@/lib/utils/fechas"

export interface ChipsFechaProps {
  /** 'yyyy-MM-dd' o '' (sin fecha). */
  valor: string
  onCambiar: (fecha: string) => void
  className?: string
  /** Permite quitar la fecha tocando el chip activo. */
  permitirVacio?: boolean
  /** Fecha mínima del selector nativo ('yyyy-MM-dd'). */
  min?: string
  etiqueta?: string
}

/** Hoy · Mañana · En 3 días · Próx. semana · Elegir (input type=date nativo). Devuelve 'yyyy-MM-dd'. */
export function ChipsFecha({ valor, onCambiar, className, permitirVacio = false, min, etiqueta = "Fecha" }: ChipsFechaProps) {
  const hoy = hoyLima()
  const rapidas = [
    { etiqueta: "Hoy", fecha: hoy },
    { etiqueta: "Mañana", fecha: sumarDias(hoy, 1) },
    { etiqueta: "En 3 días", fecha: sumarDias(hoy, 3) },
    { etiqueta: "Próx. semana", fecha: sumarDias(hoy, 7) },
  ]
  const esRapida = rapidas.some((r) => r.fecha === valor)
  const [eligiendo, setEligiendo] = useState<boolean>(!!valor && !esRapida)

  useEffect(() => {
    if (valor && !rapidas.some((r) => r.fecha === valor)) setEligiendo(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor])

  const base =
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-4 text-base font-medium transition-colors select-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
  const activo = "bg-primary border-primary text-primary-foreground"
  const inactivo = "border-border bg-background text-foreground hover:bg-muted"

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div role="group" aria-label={etiqueta} className="flex flex-wrap gap-2">
        {rapidas.map((r) => {
          const esActivo = valor === r.fecha && !eligiendo
          return (
            <button
              key={r.etiqueta}
              type="button"
              aria-pressed={esActivo}
              className={cn(base, esActivo ? activo : inactivo)}
              onClick={() => {
                setEligiendo(false)
                if (esActivo && permitirVacio) onCambiar("")
                else onCambiar(r.fecha)
              }}
            >
              {r.etiqueta}
            </button>
          )
        })}
        <button
          type="button"
          aria-pressed={eligiendo}
          className={cn(base, eligiendo ? activo : inactivo)}
          onClick={() => setEligiendo((e) => !e)}
        >
          <CalendarDays className="size-4" aria-hidden />
          Elegir
        </button>
      </div>
      {eligiendo && (
        <Input
          type="date"
          aria-label={`${etiqueta}: elegir día`}
          value={valor}
          min={min}
          className="h-11 max-w-xs"
          onChange={(e) => onCambiar(e.target.value)}
        />
      )}
    </div>
  )
}
