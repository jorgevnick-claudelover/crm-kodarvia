import { useEffect, useState } from "react"

/** Devuelve el valor con retraso (por defecto 250 ms) para búsquedas mientras se escribe. */
export function useDebounce<T>(valor: T, retrasoMs = 250): T {
  const [retrasado, setRetrasado] = useState(valor)
  useEffect(() => {
    const t = setTimeout(() => setRetrasado(valor), retrasoMs)
    return () => clearTimeout(t)
  }, [valor, retrasoMs])
  return retrasado
}
