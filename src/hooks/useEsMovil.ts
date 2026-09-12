import { useEffect, useState } from "react"

export const CONSULTA_MOVIL = "(max-width: 767px)"

function leer(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
  return window.matchMedia(CONSULTA_MOVIL).matches
}

/** true por debajo de 768 px (barra inferior, sheets); false en escritorio (barra lateral, diálogos). */
export function useEsMovil(): boolean {
  const [esMovil, setEsMovil] = useState<boolean>(leer)
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return
    const mq = window.matchMedia(CONSULTA_MOVIL)
    const alCambiar = (e: MediaQueryListEvent) => setEsMovil(e.matches)
    mq.addEventListener("change", alCambiar)
    setEsMovil(mq.matches)
    return () => mq.removeEventListener("change", alCambiar)
  }, [])
  return esMovil
}
