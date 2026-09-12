import { supabase } from "@/lib/supabase"
import { fetchAll } from "@/lib/fetchAll"
import type {
  EstadoOportunidad,
  HistorialEtapa,
  Oportunidad,
  OportunidadConRelaciones,
  OportunidadInsert,
  OportunidadUpdate,
} from "@/lib/types"
import { filtroTextoContactos } from "./contactos"
import {
  type ConsultaFiltrable,
  escaparIlike,
  lanzarSi,
  listaIn,
  rangoLima,
  resumenTareasPendientes,
  exigir,
} from "./comun"

/** contactos!inner permite filtrar por contacto.origen_id; toda oportunidad tiene contacto. */
export const SELECT_OPORTUNIDAD =
  "*, contacto:contactos!inner(*), etapa:etapas(*), responsable:usuarios!responsable_id(*), motivo_perdida:motivos_perdida(*)"

export type OrdenOportunidades = "posicion" | "reciente" | "antiguo" | "importe" | "cierre"

export interface FiltrosOportunidades {
  /** Busca en el título y en nombre/empresa/teléfono/correo/documento del contacto. */
  texto?: string
  responsableId?: string
  /** origen del contacto */
  origenId?: string
  etapaId?: string
  /** '' o 'todas' = sin filtro. */
  estado?: EstadoOportunidad | "todas" | ""
  /** Contacto sin tarea pendiente (ni la oportunidad). */
  sinSeguimiento?: boolean
  /** Con alguna tarea pendiente vencida (del contacto o de la oportunidad). */
  conTareaVencida?: boolean
  /** 'yyyy-MM-dd' (Lima) sobre created_at. */
  desde?: string
  hasta?: string
  orden?: OrdenOportunidades
}

export const FILTROS_OPORTUNIDADES_DEFAULT: Required<FiltrosOportunidades> = {
  texto: "",
  responsableId: "",
  origenId: "",
  etapaId: "",
  estado: "abierta",
  sinSeguimiento: false,
  conTareaVencida: false,
  desde: "",
  hasta: "",
  orden: "posicion",
}

export interface ContextoFiltrosOportunidades {
  /** Ids de contactos que casan con el texto (además del título). */
  contactoIdsTexto: string[] | null
  /** Contactos con tarea pendiente (para sinSeguimiento). */
  contactosConPendiente: string[] | null
  oportunidadesConPendiente: string[] | null
  /** Con tarea vencida (para conTareaVencida). */
  contactosConVencida: string[] | null
  oportunidadesConVencida: string[] | null
}

const CONTEXTO_VACIO: ContextoFiltrosOportunidades = {
  contactoIdsTexto: null,
  contactosConPendiente: null,
  oportunidadesConPendiente: null,
  contactosConVencida: null,
  oportunidadesConVencida: null,
}

export async function contextoFiltrosOportunidades(filtros: FiltrosOportunidades): Promise<ContextoFiltrosOportunidades> {
  const ctx: ContextoFiltrosOportunidades = { ...CONTEXTO_VACIO }
  const texto = filtros.texto?.trim()
  if (texto) {
    const { data, error } = await supabase.from("contactos").select("id").or(filtroTextoContactos(texto)).limit(500)
    lanzarSi(error, "No se pudo buscar por contacto")
    ctx.contactoIdsTexto = (data ?? []).map((c) => c.id)
  }
  if (filtros.sinSeguimiento || filtros.conTareaVencida) {
    const r = await resumenTareasPendientes()
    ctx.contactosConPendiente = [...r.contactosConPendiente]
    ctx.oportunidadesConPendiente = [...r.oportunidadesConPendiente]
    ctx.contactosConVencida = [...r.contactosConVencida]
    ctx.oportunidadesConVencida = [...r.oportunidadesConVencida]
  }
  return ctx
}

/** Aplica los mismos filtros a la lista, el tablero y la exportación. */
export function aplicarFiltrosOportunidades<Q extends ConsultaFiltrable>(
  consulta: Q,
  filtros: FiltrosOportunidades,
  ctx: ContextoFiltrosOportunidades = CONTEXTO_VACIO,
): Q {
  let q = consulta
  const texto = filtros.texto?.trim()
  if (texto) {
    const partes = [`titulo.ilike.%${escaparIlike(texto)}%`]
    if (ctx.contactoIdsTexto && ctx.contactoIdsTexto.length > 0) partes.push(`contacto_id.in.${listaIn(ctx.contactoIdsTexto)}`)
    q = q.or(partes.join(","))
  }
  if (filtros.responsableId) q = q.eq("responsable_id", filtros.responsableId)
  if (filtros.origenId) q = q.eq("contacto.origen_id", filtros.origenId)
  if (filtros.etapaId) q = q.eq("etapa_id", filtros.etapaId)
  if (filtros.estado && filtros.estado !== "todas") q = q.eq("estado", filtros.estado)
  const { desdeIso, hastaIso } = rangoLima(filtros.desde, filtros.hasta)
  if (desdeIso) q = q.gte("created_at", desdeIso)
  if (hastaIso) q = q.lte("created_at", hastaIso)
  if (filtros.sinSeguimiento) {
    if (ctx.contactosConPendiente && ctx.contactosConPendiente.length > 0) q = q.not("contacto_id", "in", listaIn(ctx.contactosConPendiente))
    if (ctx.oportunidadesConPendiente && ctx.oportunidadesConPendiente.length > 0) q = q.not("id", "in", listaIn(ctx.oportunidadesConPendiente))
  }
  if (filtros.conTareaVencida) {
    const partes: string[] = []
    if (ctx.contactosConVencida && ctx.contactosConVencida.length > 0) partes.push(`contacto_id.in.${listaIn(ctx.contactosConVencida)}`)
    if (ctx.oportunidadesConVencida && ctx.oportunidadesConVencida.length > 0) partes.push(`id.in.${listaIn(ctx.oportunidadesConVencida)}`)
    // Sin ninguna tarea vencida no hay resultados: filtro imposible.
    q = partes.length > 0 ? q.or(partes.join(",")) : q.eq("id", "00000000-0000-0000-0000-000000000000")
  }
  switch (filtros.orden ?? "posicion") {
    case "reciente":
      q = q.order("created_at", { ascending: false })
      break
    case "antiguo":
      q = q.order("created_at", { ascending: true })
      break
    case "importe":
      q = q.order("importe", { ascending: false })
      break
    case "cierre":
      q = q.order("fecha_cierre_prevista", { ascending: true, nullsFirst: false })
      break
    default:
      q = q.order("posicion", { ascending: true }).order("created_at", { ascending: false })
  }
  return q
}

export async function listar(filtros: FiltrosOportunidades = {}): Promise<OportunidadConRelaciones[]> {
  const ctx = await contextoFiltrosOportunidades(filtros)
  const { data, error } = await aplicarFiltrosOportunidades(
    supabase.from("oportunidades").select(SELECT_OPORTUNIDAD),
    filtros,
    ctx,
  ).overrideTypes<OportunidadConRelaciones[], { merge: false }>()
  lanzarSi(error, "No se pudieron cargar las oportunidades")
  return data ?? []
}

export async function listarTodo(filtros: FiltrosOportunidades = {}): Promise<OportunidadConRelaciones[]> {
  const ctx = await contextoFiltrosOportunidades(filtros)
  return fetchAll<OportunidadConRelaciones>((desde, hasta) =>
    aplicarFiltrosOportunidades(supabase.from("oportunidades").select(SELECT_OPORTUNIDAD), filtros, ctx)
      .range(desde, hasta)
      .overrideTypes<OportunidadConRelaciones[], { merge: false }>(),
  )
}

export async function listarPorContacto(contactoId: string): Promise<OportunidadConRelaciones[]> {
  const { data, error } = await supabase
    .from("oportunidades")
    .select(SELECT_OPORTUNIDAD)
    .eq("contacto_id", contactoId)
    .order("created_at", { ascending: false })
    .overrideTypes<OportunidadConRelaciones[], { merge: false }>()
  lanzarSi(error, "No se pudieron cargar las oportunidades del contacto")
  return data ?? []
}

export async function obtener(id: string): Promise<OportunidadConRelaciones> {
  const { data, error } = await supabase
    .from("oportunidades")
    .select(SELECT_OPORTUNIDAD)
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<OportunidadConRelaciones, { merge: false }>()
  lanzarSi(error, "No se pudo cargar la oportunidad")
  if (!data) throw new Error("La oportunidad no existe o fue eliminada.")
  return exigir(data)
}

export async function crear(datos: OportunidadInsert): Promise<Oportunidad> {
  const { data, error } = await supabase
    .from("oportunidades")
    .insert({ ...datos, titulo: datos.titulo.trim() })
    .select("*")
    .single()
  lanzarSi(error, "No se pudo crear la oportunidad")
  return exigir(data)
}

export async function actualizar(id: string, cambios: OportunidadUpdate): Promise<Oportunidad> {
  const { data, error } = await supabase.from("oportunidades").update(cambios).eq("id", id).select("*").single()
  lanzarSi(error, "No se pudo guardar la oportunidad")
  return exigir(data)
}

export async function eliminar(id: string): Promise<void> {
  const { error } = await supabase.from("oportunidades").delete().eq("id", id)
  lanzarSi(error, "No se pudo eliminar la oportunidad")
}

/** Cambia de etapa y posición en una transacción (rpc mover_oportunidad). */
export async function mover(id: string, etapaId: string, posicion: number): Promise<void> {
  const { error } = await supabase.rpc("mover_oportunidad", { p_id: id, p_etapa_id: etapaId, p_posicion: posicion })
  lanzarSi(error, "No se pudo mover la oportunidad")
}

export async function ganar(id: string, importe: number): Promise<Oportunidad> {
  return actualizar(id, {
    estado: "ganada",
    importe,
    ganada_at: new Date().toISOString(),
    motivo_perdida_id: null,
    detalle_perdida: null,
    perdida_at: null,
  })
}

/** Perder exige motivo: la base de datos lo valida con un check. */
export async function perder(id: string, motivoId: string, detalle?: string | null): Promise<Oportunidad> {
  if (!motivoId) throw new Error("Elige un motivo de pérdida.")
  return actualizar(id, {
    estado: "perdida",
    motivo_perdida_id: motivoId,
    detalle_perdida: detalle?.trim() || null,
    perdida_at: new Date().toISOString(),
    ganada_at: null,
  })
}

export async function reabrir(id: string): Promise<Oportunidad> {
  return actualizar(id, {
    estado: "abierta",
    motivo_perdida_id: null,
    detalle_perdida: null,
    ganada_at: null,
    perdida_at: null,
  })
}

/** Historial de etapas de una oportunidad (para el detalle). */
export async function historial(oportunidadId: string): Promise<HistorialEtapa[]> {
  const { data, error } = await supabase
    .from("historial_etapas")
    .select("*")
    .eq("oportunidad_id", oportunidadId)
    .order("created_at", { ascending: true })
  lanzarSi(error, "No se pudo cargar el historial")
  return data ?? []
}

/** Historial de etapas de un rango de fechas (para el embudo del panel), con fetchAll. */
export async function historialEnRango(desdeIso: string, hastaIso: string): Promise<HistorialEtapa[]> {
  return fetchAll<HistorialEtapa>((desde, hasta) =>
    supabase
      .from("historial_etapas")
      .select("*")
      .gte("created_at", desdeIso)
      .lte("created_at", hastaIso)
      .order("created_at", { ascending: true })
      .range(desde, hasta),
  )
}

/** Cuenta oportunidades abiertas en una etapa (para impedir desactivarla). */
export async function contarAbiertasEnEtapa(etapaId: string): Promise<number> {
  const { count, error } = await supabase
    .from("oportunidades")
    .select("id", { count: "exact", head: true })
    .eq("etapa_id", etapaId)
    .eq("estado", "abierta")
  lanzarSi(error, "No se pudo contar las oportunidades")
  return count ?? 0
}
