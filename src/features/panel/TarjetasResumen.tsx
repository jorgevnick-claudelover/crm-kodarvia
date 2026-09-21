import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { AlertTriangle, Briefcase, Trophy, UserX, XCircle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { useSimboloMoneda } from "@/hooks/useMoneda"
import { formatearImporte } from "@/lib/utils/moneda"
import { cn } from "@/lib/utils"
import type { Resumen } from "./calculos"

export interface TarjetasResumenProps {
  resumen: Resumen
  responsableId?: string
}

/** Cinco tarjetas: 2 columnas en celular, 5 en computadora. */
export function TarjetasResumen({ resumen, responsableId }: TarjetasResumenProps) {
  const simbolo = useSimboloMoneda()
  const sufijoResponsable = responsableId ? `&responsableId=${encodeURIComponent(responsableId)}` : ""
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <Tarjeta
        titulo="Abiertas"
        icono={<Briefcase className="size-4" aria-hidden />}
        valor={String(resumen.abiertas.n)}
        detalle={formatearImporte(resumen.abiertas.suma, simbolo)}
        a={`/oportunidades?estado=abierta${sufijoResponsable}`}
      />
      <Tarjeta
        titulo="Ganado este mes"
        icono={<Trophy className="size-4 text-emerald-600" aria-hidden />}
        valor={formatearImporte(resumen.ganadoEsteMes.suma, simbolo)}
        detalle={`${resumen.ganadoEsteMes.n} ${resumen.ganadoEsteMes.n === 1 ? "oportunidad" : "oportunidades"}`}
        compacto
        a={`/oportunidades?estado=ganada${sufijoResponsable}`}
      />
      <Tarjeta
        titulo="Perdidas este mes"
        icono={<XCircle className="size-4 text-rose-600" aria-hidden />}
        valor={String(resumen.perdidasEsteMes)}
        detalle="oportunidades"
        a={`/oportunidades?estado=perdida${sufijoResponsable}`}
      />
      <Tarjeta
        titulo="Tareas vencidas"
        icono={<AlertTriangle className={cn("size-4", resumen.tareasVencidas > 0 ? "text-amber-600" : "text-muted-foreground")} aria-hidden />}
        valor={String(resumen.tareasVencidas)}
        detalle="pendientes"
        a={`/tareas?estado=pendiente${sufijoResponsable}`}
        alerta={resumen.tareasVencidas > 0}
      />
      <Tarjeta
        titulo="Sin seguimiento"
        icono={<UserX className={cn("size-4", resumen.sinSeguimiento > 0 ? "text-amber-600" : "text-muted-foreground")} aria-hidden />}
        valor={String(resumen.sinSeguimiento)}
        detalle="contactos"
        a={`/contactos?sinSeguimiento=1${sufijoResponsable}`}
        alerta={resumen.sinSeguimiento > 0}
      />
    </div>
  )
}

function Tarjeta({
  titulo,
  icono,
  valor,
  detalle,
  a,
  compacto = false,
  alerta = false,
}: {
  titulo: string
  icono: ReactNode
  valor: string
  detalle: string
  a: string
  compacto?: boolean
  alerta?: boolean
}) {
  return (
    <Card size="sm" className={cn("min-h-24 justify-between", alerta && "ring-amber-300")}>
      <Link to={a} className="flex h-full flex-col justify-between gap-1 px-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">{titulo}</span>
          {icono}
        </div>
        <div className={cn("font-semibold tabular-nums", compacto ? "text-lg leading-tight" : "text-2xl leading-tight")}>{valor}</div>
        <div className="truncate text-xs text-muted-foreground">{detalle}</div>
      </Link>
    </Card>
  )
}
