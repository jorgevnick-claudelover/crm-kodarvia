/** Lógica pura de la búsqueda global: agrupar resultados, rutas y términos recientes. */
import type { ResultadoBusqueda } from "@/lib/types"

export const TIPOS_ORDENADOS = ["contacto", "oportunidad", "tarea", "actividad"] as const
export type TipoResultado = (typeof TIPOS_ORDENADOS)[number]

export const ETIQUETA_GRUPO: Record<TipoResultado, string> = {
  contacto: "Contactos",
  oportunidad: "Oportunidades",
  tarea: "Tareas",
  actividad: "Actividades",
}

export interface GrupoResultados {
  tipo: TipoResultado
  etiqueta: string
  resultados: ResultadoBusqueda[]
}

/** Agrupa por tipo en el orden Contactos · Oportunidades · Tareas · Actividades; omite grupos vacíos. */
export function agruparResultados(resultados: readonly ResultadoBusqueda[]): GrupoResultados[] {
  return TIPOS_ORDENADOS.map((tipo) => ({
    tipo,
    etiqueta: ETIQUETA_GRUPO[tipo],
    resultados: resultados.filter((r) => r.tipo === tipo),
  })).filter((g) => g.resultados.length > 0)
}

/** Ruta de cada resultado; las actividades llevan a la ficha del contacto. */
export function rutaResultado(r: Pick<ResultadoBusqueda, "tipo" | "id" | "contacto_id">): string {
  switch (r.tipo) {
    case "contacto":
      return `/contactos/${r.id}`
    case "oportunidad":
      return `/oportunidades/${r.id}`
    case "tarea":
      return `/tareas/${r.id}`
    case "actividad":
    default:
      return r.contacto_id ? `/contactos/${r.contacto_id}` : "/contactos"
  }
}

/** Mínimo de letras para lanzar la búsqueda (igual que la función SQL / api). */
export const MINIMO_LETRAS = 2

export const CLAVE_RECIENTES = "crm.buscar.recientes"
export const MAXIMO_RECIENTES = 5

/** Inserta un término al principio sin duplicados (sin distinguir mayúsculas) y recorta a 5. */
export function agregarReciente(lista: readonly string[], termino: string, maximo = MAXIMO_RECIENTES): string[] {
  const t = termino.trim()
  if (t.length < MINIMO_LETRAS) return [...lista]
  const clave = t.toLocaleLowerCase()
  return [t, ...lista.filter((x) => x.toLocaleLowerCase() !== clave)].slice(0, maximo)
}

export function leerRecientes(): string[] {
  try {
    const crudo = localStorage.getItem(CLAVE_RECIENTES)
    if (!crudo) return []
    const datos: unknown = JSON.parse(crudo)
    if (!Array.isArray(datos)) return []
    return datos.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, MAXIMO_RECIENTES)
  } catch {
    return []
  }
}

export function guardarReciente(termino: string): string[] {
  const lista = agregarReciente(leerRecientes(), termino)
  try {
    localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(lista))
  } catch {
    // Sin localStorage (modo privado): no pasa nada.
  }
  return lista
}

export function borrarRecientes(): void {
  try {
    localStorage.removeItem(CLAVE_RECIENTES)
  } catch {
    // ignorar
  }
}
