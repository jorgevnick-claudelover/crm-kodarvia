import { Link } from "react-router-dom"
import { Building2, Phone } from "lucide-react"
import { AvatarUsuario } from "@/components/comunes/AvatarUsuario"
import type { ContactoConRelaciones } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatearTelefono } from "@/lib/utils/telefono"
import { estaSinSeguimiento } from "./logica"

export interface TarjetaContactoProps {
  contacto: ContactoConRelaciones
  /** true/false si se sabe; undefined si no se dispone del dato. */
  tienePendiente?: boolean
  tieneVencida?: boolean
  className?: string
}

/** Fila de la lista: nombre, empresa, chip de celular, avatar del responsable e indicadores de seguimiento. */
export function TarjetaContacto({ contacto, tienePendiente, tieneVencida, className }: TarjetaContactoProps) {
  const sinSeguimiento = estaSinSeguimiento({ ultimaActividadAt: contacto.ultima_actividad_at, tienePendiente })
  const telefono = contacto.telefono ? formatearTelefono(contacto.telefono) : contacto.telefono_raw
  return (
    <Link
      to={`/contactos/${contacto.id}`}
      className={cn(
        "flex min-h-16 items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-card-foreground transition-colors hover:bg-muted/60 active:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
      aria-label={`Abrir contacto ${contacto.nombre}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {tieneVencida && <span className="size-2.5 shrink-0 rounded-full bg-red-500" title="Tiene una tarea vencida" aria-label="Tarea vencida" />}
          <span className="truncate text-base font-medium">{contacto.nombre}</span>
          {contacto.requiere_revision && (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">Revisar</span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {contacto.empresa && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <Building2 className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{contacto.empresa}</span>
            </span>
          )}
          {telefono && (
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs tabular-nums">
              <Phone className="size-3" aria-hidden />
              {telefono}
            </span>
          )}
          {sinSeguimiento && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
              Sin seguimiento
            </span>
          )}
        </div>
      </div>
      <AvatarUsuario nombre={contacto.responsable?.nombre} id={contacto.responsable_id} tamano="md" />
    </Link>
  )
}

export default TarjetaContacto
