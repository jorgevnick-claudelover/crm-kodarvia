import { cn } from "@/lib/utils"
import { formatearImporte } from "@/lib/utils/moneda"

export interface ImporteProps {
  valor: number | null | undefined
  className?: string
  /** Símbolo a mostrar; por defecto S/. */
  simbolo?: string
}

/** Muestra un importe en soles: S/ 1,250.00. */
export function Importe({ valor, className, simbolo }: ImporteProps) {
  return <span className={cn("tabular-nums", className)}>{formatearImporte(valor, simbolo)}</span>
}
