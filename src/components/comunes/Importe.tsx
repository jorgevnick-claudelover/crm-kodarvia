import { cn } from "@/lib/utils"
import { useSimboloMoneda } from "@/hooks/useMoneda"
import { formatearImporte } from "@/lib/utils/moneda"

export interface ImporteProps {
  valor: number | null | undefined
  className?: string
  /** Símbolo a mostrar; por defecto el de la moneda elegida en Configuración. */
  simbolo?: string
}

/** Muestra un importe con la moneda del estudio: S/ 1,250.00, $ 1,250.00… */
export function Importe({ valor, className, simbolo }: ImporteProps) {
  const activo = useSimboloMoneda()
  return <span className={cn("tabular-nums", className)}>{formatearImporte(valor, simbolo ?? activo)}</span>
}
