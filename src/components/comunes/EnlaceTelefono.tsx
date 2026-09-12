import { MessageCircle, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { enlaceLlamada, enlaceWhatsApp, esCelularPE, formatearTelefono } from "@/lib/utils/telefono"

export interface EnlaceTelefonoProps {
  telefono: string | null | undefined
  /** Muestra el número formateado junto a los botones. */
  mostrarNumero?: boolean
  /** Texto inicial del mensaje de WhatsApp. */
  mensajeWhatsApp?: string
  tamano?: "sm" | "md"
  className?: string
  /** Se llama al pulsar (para registrar la actividad, por ejemplo). */
  onLlamar?: () => void
  onWhatsApp?: () => void
}

/** Botones "tel:" y WhatsApp (wa.me) para un teléfono. No muestra nada si no hay teléfono. */
export function EnlaceTelefono({
  telefono,
  mostrarNumero = true,
  mensajeWhatsApp,
  tamano = "md",
  className,
  onLlamar,
  onWhatsApp,
}: EnlaceTelefonoProps) {
  if (!telefono) return null
  const tel = enlaceLlamada(telefono)
  const wa = enlaceWhatsApp(telefono, mensajeWhatsApp)
  const size = tamano === "sm" ? "sm" : "lg"
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-2", className)}>
      {mostrarNumero && <span className="tabular-nums">{formatearTelefono(telefono)}</span>}
      {tel && (
        <Button
          variant="outline"
          size={size}
          className="min-h-11 min-w-11 gap-1.5"
          nativeButton={false}
          render={<a href={tel} aria-label={`Llamar al ${formatearTelefono(telefono)}`} onClick={onLlamar} />}
        >
          <Phone />
          Llamar
        </Button>
      )}
      {wa && (esCelularPE(telefono) || !telefono.startsWith("+51")) && (
        <Button
          variant="outline"
          size={size}
          className="min-h-11 min-w-11 gap-1.5 text-emerald-700"
          nativeButton={false}
          render={<a href={wa} target="_blank" rel="noopener noreferrer" aria-label="Abrir WhatsApp" onClick={onWhatsApp} />}
        >
          <MessageCircle />
          WhatsApp
        </Button>
      )}
    </span>
  )
}
