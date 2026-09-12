import { supabase } from "@/lib/supabase"
import type { Usuario, UsuarioUpdate } from "@/lib/types"
import { lanzarSi, exigir } from "./comun"

export async function listar(soloActivos = false): Promise<Usuario[]> {
  let q = supabase.from("usuarios").select("*").order("nombre", { ascending: true })
  if (soloActivos) q = q.eq("activo", true)
  const { data, error } = await q
  lanzarSi(error, "No se pudieron cargar los usuarios")
  return data ?? []
}

export async function obtener(id: string): Promise<Usuario | null> {
  const { data, error } = await supabase.from("usuarios").select("*").eq("id", id).maybeSingle()
  lanzarSi(error, "No se pudo cargar el usuario")
  return data
}

/** Un miembro solo puede cambiar su nombre; el admin cambia rol y activo (RLS). */
export async function actualizar(id: string, cambios: UsuarioUpdate): Promise<Usuario> {
  const { data, error } = await supabase.from("usuarios").update(cambios).eq("id", id).select("*").single()
  lanzarSi(error, "No se pudo guardar el usuario")
  return exigir(data)
}
