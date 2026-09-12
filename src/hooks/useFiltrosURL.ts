import { useCallback, useMemo } from "react"
import { useSearchParams } from "react-router-dom"

export type ValorFiltro = string | number | boolean
export type FiltrosBase = Record<string, ValorFiltro>

export interface ResultadoFiltrosURL<T extends FiltrosBase> {
  /** Filtros actuales (defaults + lo que hay en la URL). */
  filtros: T
  /** Cambia uno o varios filtros; los que vuelven al valor por defecto salen de la URL. */
  setFiltros: (parcial: Partial<T>) => void
  /** Vuelve a los valores por defecto. */
  limpiar: () => void
  /** true si algún filtro difiere del valor por defecto. */
  hayFiltros: boolean
}

function parsear<T extends FiltrosBase>(defaults: T, params: URLSearchParams): T {
  const resultado: Record<string, ValorFiltro> = { ...defaults }
  for (const clave of Object.keys(defaults)) {
    const crudo = params.get(clave)
    if (crudo === null) continue
    const porDefecto = defaults[clave]
    if (typeof porDefecto === "boolean") resultado[clave] = crudo === "1" || crudo === "true"
    else if (typeof porDefecto === "number") {
      const n = Number(crudo)
      resultado[clave] = Number.isFinite(n) ? n : porDefecto
    } else resultado[clave] = crudo
  }
  return resultado as T
}

function serializar(valor: ValorFiltro): string {
  if (typeof valor === "boolean") return valor ? "1" : ""
  return String(valor)
}

/**
 * Lee y escribe filtros tipados en los search params de la URL, así la lista y
 * la exportación comparten exactamente el mismo objeto (criterio 7).
 * Solo se escriben en la URL los valores distintos del default.
 */
export function useFiltrosURL<T extends FiltrosBase>(defaults: T): ResultadoFiltrosURL<T> {
  const [params, setParams] = useSearchParams()

  const filtros = useMemo(() => parsear(defaults, params), [defaults, params])

  const setFiltros = useCallback(
    (parcial: Partial<T>) => {
      setParams(
        (previos) => {
          const siguientes = new URLSearchParams(previos)
          for (const [clave, valor] of Object.entries(parcial)) {
            if (!(clave in defaults)) continue
            const porDefecto = defaults[clave]
            if (valor === undefined || valor === porDefecto || (valor === "" && porDefecto === "")) siguientes.delete(clave)
            else siguientes.set(clave, serializar(valor as ValorFiltro))
          }
          return siguientes
        },
        { replace: true },
      )
    },
    [defaults, setParams],
  )

  const limpiar = useCallback(() => {
    setParams(
      (previos) => {
        const siguientes = new URLSearchParams(previos)
        for (const clave of Object.keys(defaults)) siguientes.delete(clave)
        return siguientes
      },
      { replace: true },
    )
  }, [defaults, setParams])

  const hayFiltros = useMemo(() => Object.keys(defaults).some((k) => filtros[k] !== defaults[k]), [defaults, filtros])

  return { filtros, setFiltros, limpiar, hayFiltros }
}
