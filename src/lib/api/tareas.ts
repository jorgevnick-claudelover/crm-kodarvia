import { supabase } from "@/lib/supabase"
import { fetchAll } from "@/lib/fetchAll"
import type { EstadoTarea, Tarea, TareaConRelaciones, TareaInsert, TareaUpdate } from "@/lib/types"
import { type ConsultaFiltrable, escaparIlike, lanzarSi, rangoLima, uidActual, exigir } from "./comun"

export const SELECT_TAREA = "*, contacto:contactos(*), oportunidad:oportunidades(*), responsable:usuarios!responsable_id(*)"

export type OrdenTareas = "vence" | "reciente"

export interface FiltrosTareas {
  /** Busca en el título. */
  texto?: string
  responsableId?: string
  /** '' o 'todas' = sin filtro. */
  estado?: EstadoTarea | "todas" | ""
  /** 'yyyy-MM-dd' (Lima) sobre vence_at. */
  desde?: string
  hasta?: string
  /** Solo las del usuario actual (responsable). */
  soloMias?: boolean
  /** Opcionales para fichas: tareas de un contacto o de una oportunidad. */
  contactoId?: string
  oportunidadId?: string
  orden?: OrdenTareas
}

export const FILTROS_TAREAS_DEFAULT: Required<FiltrosTareas> = {
  texto: "",
  responsableId: "",
  estado: "pendiente",
  desde: "",
  hasta: "",
  soloMias: false,
  contactoId: "",
  oportunidadId: "",
  orden: "vence",
}

export interface ContextoFiltrosTareas {
  uid: string | null
}

export async function contextoFiltrosTareas(filtros: FiltrosTareas): Promise<ContextoFiltrosTareas> {
  return { uid: filtros.soloMias ? await uidActual() : null }
}

/** Aplica los mismos filtros a la lista y a la exportación. */
export function aplicarFiltrosTareas<Q extends ConsultaFiltrable>(
  consulta: Q,
  filtros: FiltrosTareas,
  ctx: ContextoFiltrosTareas = { uid: null },
): Q {
  let q = consulta
  const texto = filtros.texto?.trim()
  if (texto) q = q.ilike("titulo", `%${escaparIlike(texto)}%`)
  if (filtros.responsableId) q = q.eq("responsable_id", filtros.responsableId)
  if (filtros.soloMias && ctx.uid) q = q.eq("responsable_id", ctx.uid)
  if (filtros.estado && filtros.estado !== "todas") q = q.eq("estado", filtros.estado)
  if (filtros.contactoId) q = q.eq("contacto_id", filtros.contactoId)
  if (filtros.oportunidadId) q = q.eq("oportunidad_id", filtros.oportunidadId)
  const { desdeIso, hastaIso } = rangoLima(filtros.desde, filtros.hasta)
  if (desdeIso) q = q.gte("vence_at", desdeIso)
  if (hastaIso) q = q.lte("vence_at", hastaIso)
  if ((filtros.orden ?? "vence") === "reciente") q = q.order("created_at", { ascending: false })
  else q = q.order("vence_at", { ascending: true })
  return q
}

export async function listar(filtros: FiltrosTareas = {}): Promise<TareaConRelaciones[]> {
  const ctx = await contextoFiltrosTareas(filtros)
  const { data, error } = await aplicarFiltrosTareas(supabase.from("tareas").select(SELECT_TAREA), filtros, ctx).overrideTypes<
    TareaConRelaciones[],
    { merge: false }
  >()
  lanzarSi(error, "No se pudieron cargar las tareas")
  return data ?? []
}

export async function listarTodo(filtros: FiltrosTareas = {}): Promise<TareaConRelaciones[]> {
  const ctx = await contextoFiltrosTareas(filtros)
  return fetchAll<TareaConRelaciones>((desde, hasta) =>
    aplicarFiltrosTareas(supabase.from("tareas").select(SELECT_TAREA), filtros, ctx)
      .range(desde, hasta)
      .overrideTypes<TareaConRelaciones[], { merge: false }>(),
  )
}

export async function obtener(id: string): Promise<TareaConRelaciones> {
  const { data, error } = await supabase
    .from("tareas")
    .select(SELECT_TAREA)
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<TareaConRelaciones, { merge: false }>()
  lanzarSi(error, "No se pudo cargar la tarea")
  if (!data) throw new Error("La tarea no existe o fue eliminada.")
  return exigir(data)
}

export async function crear(datos: TareaInsert): Promise<Tarea> {
  const { data, error } = await supabase
    .from("tareas")
    .insert({ ...datos, titulo: datos.titulo.trim() })
    .select("*")
    .single()
  lanzarSi(error, "No se pudo crear la tarea")
  return exigir(data)
}

export async function actualizar(id: string, cambios: TareaUpdate): Promise<Tarea> {
  const { data, error } = await supabase.from("tareas").update(cambios).eq("id", id).select("*").single()
  lanzarSi(error, "No se pudo guardar la tarea")
  return exigir(data)
}

export async function eliminar(id: string): Promise<void> {
  const { error } = await supabase.from("tareas").delete().eq("id", id)
  lanzarSi(error, "No se pudo eliminar la tarea")
}

export async function completar(id: string): Promise<Tarea> {
  return actualizar(id, { estado: "hecha", hecha_at: new Date().toISOString() })
}

export async function reabrir(id: string): Promise<Tarea> {
  return actualizar(id, { estado: "pendiente", hecha_at: null })
}

export async function marcarRecordatorioVisto(id: string): Promise<Tarea> {
  return actualizar(id, { recordatorio_visto_at: new Date().toISOString() })
}

/** Tareas pendientes del usuario con recordatorio vencido y no visto (rpc recordatorios_pendientes_usuario). */
export async function listarRecordatoriosPendientes(): Promise<Tarea[]> {
  const { data, error } = await supabase.rpc("recordatorios_pendientes_usuario")
  lanzarSi(error, "No se pudieron cargar los recordatorios")
  return data ?? []
}

/** true si el contacto tiene alguna tarea pendiente (para el aviso "sin seguimiento"). */
export async function tienePendiente(contactoId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("tareas")
    .select("id", { count: "exact", head: true })
    .eq("contacto_id", contactoId)
    .eq("estado", "pendiente")
  lanzarSi(error, "No se pudo comprobar el seguimiento")
  return (count ?? 0) > 0
}
