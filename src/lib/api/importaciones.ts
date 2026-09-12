import { supabase } from "@/lib/supabase"
import type { Importacion, ImportacionInsert, ImportacionUpdate } from "@/lib/types"
import { lanzarSi, exigir } from "./comun"

export async function crear(datos: ImportacionInsert): Promise<Importacion> {
  const { data, error } = await supabase.from("importaciones").insert(datos).select("*").single()
  lanzarSi(error, "No se pudo registrar la importación")
  return exigir(data)
}

export async function actualizar(id: string, cambios: ImportacionUpdate): Promise<Importacion> {
  const { data, error } = await supabase.from("importaciones").update(cambios).eq("id", id).select("*").single()
  lanzarSi(error, "No se pudo actualizar la importación")
  return exigir(data)
}

export async function listar(): Promise<Importacion[]> {
  const { data, error } = await supabase.from("importaciones").select("*").order("created_at", { ascending: false })
  lanzarSi(error, "No se pudieron cargar las importaciones")
  return data ?? []
}

export async function obtener(id: string): Promise<Importacion | null> {
  const { data, error } = await supabase.from("importaciones").select("*").eq("id", id).maybeSingle()
  lanzarSi(error, "No se pudo cargar la importación")
  return data
}

/**
 * Deshace una importación: borra los contactos con ese importacion_id (sus oportunidades,
 * tareas y actividades caen en cascada) y luego la propia fila de importaciones.
 * Devuelve cuántos contactos se borraron.
 */
export async function deshacer(importacionId: string): Promise<number> {
  const { count, error } = await supabase
    .from("contactos")
    .delete({ count: "exact" })
    .eq("importacion_id", importacionId)
  lanzarSi(error, "No se pudieron borrar los contactos importados")
  const { error: errorImportacion } = await supabase.from("importaciones").delete().eq("id", importacionId)
  lanzarSi(errorImportacion, "No se pudo borrar el registro de la importación")
  return count ?? 0
}
