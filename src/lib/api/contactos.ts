import { supabase } from "@/lib/supabase"
import { fetchAll } from "@/lib/fetchAll"
import type { Contacto, ContactoConRelaciones, ContactoInsert, ContactoUpdate } from "@/lib/types"
import { normalizarTelefonoPE } from "@/lib/utils/telefono"
import {
  type ConsultaFiltrable,
  escaparIlike,
  lanzarSi,
  listaIn,
  rangoLima,
  resumenTareasPendientes,
  exigir,
} from "./comun"

export const SELECT_CONTACTO = "*, origen:origenes(*), responsable:usuarios!responsable_id(*)"

export type OrdenContactos = "nombre" | "reciente" | "ultima_actividad"

export interface FiltrosContactos {
  /** Busca en nombre, empresa, teléfono, correo y documento. */
  texto?: string
  responsableId?: string
  origenId?: string
  /** Solo contactos sin tarea pendiente. */
  sinSeguimiento?: boolean
  /** 'yyyy-MM-dd' (Lima) sobre created_at. */
  desde?: string
  hasta?: string
  orden?: OrdenContactos
}

export const FILTROS_CONTACTOS_DEFAULT: Required<FiltrosContactos> = {
  texto: "",
  responsableId: "",
  origenId: "",
  sinSeguimiento: false,
  desde: "",
  hasta: "",
  orden: "nombre",
}

/** Datos derivados que hacen falta para aplicar los filtros (una consulta previa). */
export interface ContextoFiltrosContactos {
  /** Ids de contactos con tarea pendiente; null si no se necesita. */
  idsConTareaPendiente: string[] | null
}

export async function contextoFiltrosContactos(filtros: FiltrosContactos): Promise<ContextoFiltrosContactos> {
  if (!filtros.sinSeguimiento) return { idsConTareaPendiente: null }
  const resumen = await resumenTareasPendientes()
  return { idsConTareaPendiente: [...resumen.contactosConPendiente] }
}

export function filtroTextoContactos(texto: string): string {
  const q = escaparIlike(texto)
  const digitos = q.replace(/\D+/g, "")
  const partes = [`nombre.ilike.%${q}%`, `empresa.ilike.%${q}%`, `email.ilike.%${q}%`, `doc_numero.ilike.%${q}%`]
  if (digitos.length >= 3) partes.push(`telefono.ilike.%${digitos}%`, `telefono_raw.ilike.%${digitos}%`)
  else partes.push(`telefono.ilike.%${q}%`)
  return partes.join(",")
}

/** Aplica los mismos filtros a la lista y a la exportación. */
export function aplicarFiltrosContactos<Q extends ConsultaFiltrable>(
  consulta: Q,
  filtros: FiltrosContactos,
  ctx: ContextoFiltrosContactos = { idsConTareaPendiente: null },
): Q {
  let q = consulta
  const texto = filtros.texto?.trim()
  if (texto) q = q.or(filtroTextoContactos(texto))
  if (filtros.responsableId) q = q.eq("responsable_id", filtros.responsableId)
  if (filtros.origenId) q = q.eq("origen_id", filtros.origenId)
  const { desdeIso, hastaIso } = rangoLima(filtros.desde, filtros.hasta)
  if (desdeIso) q = q.gte("created_at", desdeIso)
  if (hastaIso) q = q.lte("created_at", hastaIso)
  if (filtros.sinSeguimiento && ctx.idsConTareaPendiente && ctx.idsConTareaPendiente.length > 0) {
    q = q.not("id", "in", listaIn(ctx.idsConTareaPendiente))
  }
  switch (filtros.orden ?? "nombre") {
    case "reciente":
      q = q.order("created_at", { ascending: false })
      break
    case "ultima_actividad":
      q = q.order("ultima_actividad_at", { ascending: false, nullsFirst: false }).order("nombre")
      break
    default:
      q = q.order("nombre", { ascending: true })
  }
  return q
}

export async function listar(filtros: FiltrosContactos = {}): Promise<ContactoConRelaciones[]> {
  const ctx = await contextoFiltrosContactos(filtros)
  const { data, error } = await aplicarFiltrosContactos(
    supabase.from("contactos").select(SELECT_CONTACTO),
    filtros,
    ctx,
  ).overrideTypes<ContactoConRelaciones[], { merge: false }>()
  lanzarSi(error, "No se pudieron cargar los contactos")
  return data ?? []
}

/** Todas las filas con los mismos filtros (para exportar y el panel). */
export async function listarTodo(filtros: FiltrosContactos = {}): Promise<ContactoConRelaciones[]> {
  const ctx = await contextoFiltrosContactos(filtros)
  return fetchAll<ContactoConRelaciones>((desde, hasta) =>
    aplicarFiltrosContactos(supabase.from("contactos").select(SELECT_CONTACTO), filtros, ctx)
      .range(desde, hasta)
      .overrideTypes<ContactoConRelaciones[], { merge: false }>(),
  )
}

export async function obtener(id: string): Promise<ContactoConRelaciones> {
  const { data, error } = await supabase
    .from("contactos")
    .select(SELECT_CONTACTO)
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<ContactoConRelaciones, { merge: false }>()
  lanzarSi(error, "No se pudo cargar el contacto")
  if (!data) throw new Error("El contacto no existe o fue eliminado.")
  return exigir(data)
}

/** Guarda telefono normalizado (+51...) y conserva telefono_raw tal como llegó. */
function prepararTelefono<T extends { telefono?: string | null; telefono_raw?: string | null }>(datos: T): T {
  if (datos.telefono === undefined) return datos
  const raw = datos.telefono?.trim() || null
  const normalizado = raw ? normalizarTelefonoPE(raw) : null
  return { ...datos, telefono: normalizado ?? raw, telefono_raw: datos.telefono_raw ?? raw }
}

export async function crear(datos: ContactoInsert): Promise<Contacto> {
  const { data, error } = await supabase
    .from("contactos")
    .insert(prepararTelefono({ ...datos, nombre: datos.nombre.trim() }))
    .select("*")
    .single()
  lanzarSi(error, "No se pudo crear el contacto")
  return exigir(data)
}

export async function actualizar(id: string, cambios: ContactoUpdate): Promise<Contacto> {
  const { data, error } = await supabase
    .from("contactos")
    .update(prepararTelefono(cambios))
    .eq("id", id)
    .select("*")
    .single()
  lanzarSi(error, "No se pudo guardar el contacto")
  return exigir(data)
}

export async function eliminar(id: string): Promise<void> {
  const { error } = await supabase.from("contactos").delete().eq("id", id)
  lanzarSi(error, "No se pudo eliminar el contacto")
}

/** Autocompletado del SelectorContacto: nombre, teléfono, empresa o documento por ilike. */
export async function buscarRapido(q: string, limite = 8): Promise<Contacto[]> {
  const texto = q.trim()
  if (texto.length < 2) return []
  const { data, error } = await supabase
    .from("contactos")
    .select("*")
    .or(filtroTextoContactos(texto))
    .order("nombre")
    .limit(limite)
  lanzarSi(error, "No se pudo buscar contactos")
  return data ?? []
}

export interface DatosDuplicado {
  nombre?: string | null
  telefono?: string | null
  email?: string | null
  doc_numero?: string | null
  /** Id a excluir (al editar el propio contacto). */
  excluirId?: string | null
}

/** Posibles duplicados por documento, teléfono normalizado, correo o nombre parecido. */
export async function posiblesDuplicados(datos: DatosDuplicado, limite = 5): Promise<Contacto[]> {
  const condiciones: string[] = []
  const doc = datos.doc_numero?.trim()
  if (doc) condiciones.push(`doc_numero.eq.${escaparIlike(doc)}`)
  const tel = datos.telefono?.trim()
  if (tel) {
    const norm = normalizarTelefonoPE(tel)
    if (norm) condiciones.push(`telefono.eq.${norm}`)
    const digitos = tel.replace(/\D+/g, "")
    if (digitos.length >= 6) condiciones.push(`telefono_raw.ilike.%${digitos}%`)
  }
  const email = datos.email?.trim()
  if (email) condiciones.push(`email.ilike.${escaparIlike(email)}`)
  const nombre = datos.nombre?.trim()
  if (nombre && nombre.length >= 3) condiciones.push(`nombre.ilike.%${escaparIlike(nombre)}%`)
  if (condiciones.length === 0) return []

  let q = supabase.from("contactos").select("*").or(condiciones.join(",")).limit(limite)
  if (datos.excluirId) q = q.neq("id", datos.excluirId)
  const { data, error } = await q
  lanzarSi(error, "No se pudieron comprobar duplicados")
  return data ?? []
}
