import { useSyncExternalStore } from "react"
import { simboloActual, suscribirMoneda } from "@/lib/utils/moneda"

/**
 * Símbolo de la moneda activa, suscrito a sus cambios: el componente que lo usa se
 * vuelve a pintar en cuanto el administrador cambia la moneda, sin recargar la app.
 */
export function useSimboloMoneda(): string {
  return useSyncExternalStore(suscribirMoneda, simboloActual, simboloActual)
}
