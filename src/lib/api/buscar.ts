import { supabase } from "@/lib/supabase"
import type { ResultadoBusqueda } from "@/lib/types"
import { lanzarSi } from "./comun"

/** Búsqueda global (función SQL buscar): contactos, oportunidades, tareas y actividades. Máximo 50. */
export async function buscar(q: string): Promise<ResultadoBusqueda[]> {
  const texto = q.trim()
  if (texto.length < 2) return []
  const { data, error } = await supabase.rpc("buscar", { q: texto })
  lanzarSi(error, "No se pudo buscar")
  return data ?? []
}
