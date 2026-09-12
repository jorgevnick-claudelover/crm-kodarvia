/**
 * Acceso a datos propio del asistente de importación: inserciones en LOTES de 200.
 *
 * `src/lib/api/*` inserta contactos y oportunidades de uno en uno, que es lo correcto
 * para los formularios pero inviable para una hoja de cientos de filas. Aquí van las
 * dos únicas operaciones que faltan, con las mismas reglas que el resto de la api:
 * tipado estricto, sin `any` y errores en español.
 */
import { supabase } from "@/lib/supabase"
import { lanzarSi } from "@/lib/api/comun"
import type { ContactoInsert, OportunidadInsert } from "@/lib/types"

/** Filas por inserción (docs/ARQUITECTURA.md §9: "importar en lotes de 200"). */
export const TAMANO_LOTE = 200

export function enLotes<T>(filas: readonly T[], tamano = TAMANO_LOTE): T[][] {
  const lotes: T[][] = []
  for (let i = 0; i < filas.length; i += tamano) lotes.push(filas.slice(i, i + tamano))
  return lotes
}

/** Inserta los contactos en lotes; avisa del total insertado tras cada lote. */
export async function insertarContactosEnLotes(
  filas: readonly ContactoInsert[],
  alAvanzar?: (insertados: number) => void,
): Promise<void> {
  let hechos = 0
  for (const lote of enLotes(filas)) {
    const { error } = await supabase.from("contactos").insert(lote)
    lanzarSi(error, "No se pudieron crear los contactos de la importación")
    hechos += lote.length
    alAvanzar?.(hechos)
  }
}

/** Inserta las oportunidades en lotes; avisa del total insertado tras cada lote. */
export async function insertarOportunidadesEnLotes(
  filas: readonly OportunidadInsert[],
  alAvanzar?: (insertados: number) => void,
): Promise<void> {
  let hechos = 0
  for (const lote of enLotes(filas)) {
    const { error } = await supabase.from("oportunidades").insert(lote)
    lanzarSi(error, "No se pudieron crear las oportunidades de la importación")
    hechos += lote.length
    alAvanzar?.(hechos)
  }
}

/** Identificador para las filas nuevas (así la oportunidad conoce el id de su contacto). */
export function nuevoId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID()
  // Respaldo para navegadores viejos sin crypto.randomUUID.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16)
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
