/** Catálogos: etapas, motivos de pérdida y orígenes. Solo el admin escribe (RLS). */
import { supabase } from "@/lib/supabase"
import type {
  Etapa,
  EtapaInsert,
  EtapaUpdate,
  MotivoPerdida,
  MotivoPerdidaInsert,
  MotivoPerdidaUpdate,
  Origen,
  OrigenInsert,
  OrigenUpdate,
} from "@/lib/types"
import { lanzarSi, exigir } from "./comun"

/** Colores disponibles para las etapas (nombres de Tailwind). */
export const COLORES_ETAPA = ["slate", "sky", "teal", "emerald", "amber", "orange", "rose", "violet"] as const
export type ColorEtapa = (typeof COLORES_ETAPA)[number]

// ---------- etapas ----------
export async function listarEtapas(incluirInactivas = false): Promise<Etapa[]> {
  let q = supabase.from("etapas").select("*").order("orden", { ascending: true })
  if (!incluirInactivas) q = q.eq("activa", true)
  const { data, error } = await q
  lanzarSi(error, "No se pudieron cargar las etapas")
  return data ?? []
}

export async function crearEtapa(datos: Omit<EtapaInsert, "orden"> & { orden?: number }): Promise<Etapa> {
  const orden = datos.orden ?? (await siguienteOrden("etapas"))
  const { data, error } = await supabase
    .from("etapas")
    .insert({ ...datos, nombre: datos.nombre.trim(), orden })
    .select("*")
    .single()
  lanzarSi(error, "No se pudo crear la etapa")
  return exigir(data)
}

export async function actualizarEtapa(id: string, cambios: EtapaUpdate): Promise<Etapa> {
  const { data, error } = await supabase.from("etapas").update(cambios).eq("id", id).select("*").single()
  lanzarSi(error, "No se pudo guardar la etapa")
  return exigir(data)
}

/** Reordena: el índice en el array pasa a ser el campo orden (empezando en 1). */
export async function reordenarEtapas(ids: string[]): Promise<void> {
  await reordenar("etapas", ids)
}

// ---------- motivos_perdida ----------
export async function listarMotivos(incluirInactivos = false): Promise<MotivoPerdida[]> {
  let q = supabase.from("motivos_perdida").select("*").order("orden", { ascending: true })
  if (!incluirInactivos) q = q.eq("activo", true)
  const { data, error } = await q
  lanzarSi(error, "No se pudieron cargar los motivos de pérdida")
  return data ?? []
}

export async function crearMotivo(datos: Omit<MotivoPerdidaInsert, "orden"> & { orden?: number }): Promise<MotivoPerdida> {
  const orden = datos.orden ?? (await siguienteOrden("motivos_perdida"))
  const { data, error } = await supabase
    .from("motivos_perdida")
    .insert({ ...datos, nombre: datos.nombre.trim(), orden })
    .select("*")
    .single()
  lanzarSi(error, "No se pudo crear el motivo")
  return exigir(data)
}

export async function actualizarMotivo(id: string, cambios: MotivoPerdidaUpdate): Promise<MotivoPerdida> {
  const { data, error } = await supabase.from("motivos_perdida").update(cambios).eq("id", id).select("*").single()
  lanzarSi(error, "No se pudo guardar el motivo")
  return exigir(data)
}

export async function reordenarMotivos(ids: string[]): Promise<void> {
  await reordenar("motivos_perdida", ids)
}

// ---------- origenes ----------
export async function listarOrigenes(incluirInactivos = false): Promise<Origen[]> {
  let q = supabase.from("origenes").select("*").order("orden", { ascending: true })
  if (!incluirInactivos) q = q.eq("activo", true)
  const { data, error } = await q
  lanzarSi(error, "No se pudieron cargar los orígenes")
  return data ?? []
}

export async function crearOrigen(datos: Omit<OrigenInsert, "orden"> & { orden?: number }): Promise<Origen> {
  const orden = datos.orden ?? (await siguienteOrden("origenes"))
  const { data, error } = await supabase
    .from("origenes")
    .insert({ ...datos, nombre: datos.nombre.trim(), orden })
    .select("*")
    .single()
  lanzarSi(error, "No se pudo crear el origen")
  return exigir(data)
}

export async function actualizarOrigen(id: string, cambios: OrigenUpdate): Promise<Origen> {
  const { data, error } = await supabase.from("origenes").update(cambios).eq("id", id).select("*").single()
  lanzarSi(error, "No se pudo guardar el origen")
  return exigir(data)
}

export async function reordenarOrigenes(ids: string[]): Promise<void> {
  await reordenar("origenes", ids)
}

// ---------- internos ----------
type TablaCatalogo = "etapas" | "motivos_perdida" | "origenes"

async function siguienteOrden(tabla: TablaCatalogo): Promise<number> {
  const { data, error } = await supabase.from(tabla).select("orden").order("orden", { ascending: false }).limit(1)
  lanzarSi(error, "No se pudo calcular el orden")
  const max = data?.[0]?.orden ?? 0
  return max + 1
}

async function reordenar(tabla: TablaCatalogo, ids: string[]): Promise<void> {
  // Actualizaciones en paralelo; son pocas filas (catálogos de menos de 20 elementos).
  const resultados = await Promise.all(
    ids.map((id, indice) => supabase.from(tabla).update({ orden: indice + 1 }).eq("id", id)),
  )
  for (const r of resultados) lanzarSi(r.error, "No se pudo reordenar")
}
