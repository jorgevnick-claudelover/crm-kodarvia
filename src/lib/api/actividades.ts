import { supabase } from "@/lib/supabase"
import type { Actividad, ActividadConRelaciones, ActividadInsert, ActividadUpdate } from "@/lib/types"
import { lanzarSi, exigir } from "./comun"

export const SELECT_ACTIVIDAD = "*, usuario:usuarios!usuario_id(*)"

export async function listarPorContacto(contactoId: string, limite = 200): Promise<ActividadConRelaciones[]> {
  const { data, error } = await supabase
    .from("actividades")
    .select(SELECT_ACTIVIDAD)
    .eq("contacto_id", contactoId)
    .order("ocurrio_at", { ascending: false })
    .limit(limite)
    .overrideTypes<ActividadConRelaciones[], { merge: false }>()
  lanzarSi(error, "No se pudo cargar la actividad del contacto")
  return data ?? []
}

export async function listarPorOportunidad(oportunidadId: string, limite = 200): Promise<ActividadConRelaciones[]> {
  const { data, error } = await supabase
    .from("actividades")
    .select(SELECT_ACTIVIDAD)
    .eq("oportunidad_id", oportunidadId)
    .order("ocurrio_at", { ascending: false })
    .limit(limite)
    .overrideTypes<ActividadConRelaciones[], { merge: false }>()
  lanzarSi(error, "No se pudo cargar la actividad de la oportunidad")
  return data ?? []
}

export async function crear(datos: ActividadInsert): Promise<Actividad> {
  const { data, error } = await supabase
    .from("actividades")
    .insert({ ...datos, nota: datos.nota?.trim() || null })
    .select("*")
    .single()
  lanzarSi(error, "No se pudo registrar la actividad")
  return exigir(data)
}

export async function actualizar(id: string, cambios: ActividadUpdate): Promise<Actividad> {
  const { data, error } = await supabase.from("actividades").update(cambios).eq("id", id).select("*").single()
  lanzarSi(error, "No se pudo guardar la actividad")
  return exigir(data)
}

export async function eliminar(id: string): Promise<void> {
  const { error } = await supabase.from("actividades").delete().eq("id", id)
  lanzarSi(error, "No se pudo eliminar la actividad")
}
