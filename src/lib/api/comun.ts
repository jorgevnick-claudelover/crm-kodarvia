/** Helpers compartidos por src/lib/api/*. Nada de supabase-js fuera de src/lib/api. */
import { supabase } from "@/lib/supabase"
import { desdeLima, finDeDiaLima } from "@/lib/utils/fechas"

export interface ErrorSupabase {
  message: string
  code?: string
  details?: string | null
  hint?: string | null
}

const MENSAJES_POR_CODIGO: Record<string, string> = {
  "23505": "Ya existe un registro con esos datos.",
  "23503": "No se puede guardar: hace referencia a un registro que no existe.",
  "23514": "Los datos no cumplen una regla de la base de datos.",
  "42501": "No tienes permiso para hacer esto.",
  PGRST301: "Tu sesión caducó. Vuelve a iniciar sesión.",
  PGRST116: "No se encontró el registro.",
}

/** Lanza Error con mensaje en español si supabase devolvió error. */
export function lanzarSi(error: ErrorSupabase | null | undefined, contexto: string): void {
  if (!error) return
  const mensaje = error.message ?? ""
  if (/Solo el administrador puede reasignar/i.test(mensaje)) {
    throw new Error("Solo el administrador puede reasignar el responsable.")
  }
  if (/Failed to fetch|NetworkError|Load failed/i.test(mensaje)) {
    throw new Error(`${contexto}: sin conexión. Revisa tu internet e inténtalo de nuevo.`)
  }
  if (/JWT|not authenticated|Auth session missing/i.test(mensaje)) {
    throw new Error(`${contexto}: tu sesión caducó. Vuelve a iniciar sesión.`)
  }
  const traducido = error.code ? MENSAJES_POR_CODIGO[error.code] : undefined
  throw new Error(`${contexto}: ${traducido ?? mensaje}`)
}

/** Devuelve data o lanza si supabase no devolvió fila (tras .single()). */
export function exigir<T>(data: T | null | undefined, contexto = "No se recibió respuesta del servidor"): T {
  if (data == null) throw new Error(contexto)
  return data
}

/** Limpia el texto del usuario para usarlo dentro de filtros .or()/.ilike() de PostgREST. */
export function escaparIlike(texto: string): string {
  return texto.replace(/[,()"\\%_]/g, " ").replace(/\s+/g, " ").trim()
}

/** Lista de ids en la sintaxis de PostgREST para .in dentro de .or(): (id1,id2). */
export function listaIn(ids: readonly string[]): string {
  return `(${ids.join(",")})`
}

/** Rango de un filtro de fechas 'yyyy-MM-dd' (Lima) como instantes UTC. */
export function rangoLima(desde?: string, hasta?: string): { desdeIso?: string; hastaIso?: string } {
  return {
    desdeIso: desde ? desdeLima(desde, "00:00") : undefined,
    hastaIso: hasta ? finDeDiaLima(hasta) : undefined,
  }
}

/** uid de la sesión actual o null. */
export async function uidActual(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

/** Ids de contactos con alguna tarea pendiente (para "sin seguimiento" y "tarea vencida"). */
export interface ResumenTareasPendientes {
  contactosConPendiente: Set<string>
  contactosConVencida: Set<string>
  oportunidadesConPendiente: Set<string>
  oportunidadesConVencida: Set<string>
}

export async function resumenTareasPendientes(): Promise<ResumenTareasPendientes> {
  const { data, error } = await supabase
    .from("tareas")
    .select("contacto_id, oportunidad_id, vence_at")
    .eq("estado", "pendiente")
    .limit(5000)
  lanzarSi(error, "No se pudieron consultar las tareas pendientes")
  const ahora = Date.now()
  const r: ResumenTareasPendientes = {
    contactosConPendiente: new Set(),
    contactosConVencida: new Set(),
    oportunidadesConPendiente: new Set(),
    oportunidadesConVencida: new Set(),
  }
  for (const t of data ?? []) {
    const vencida = new Date(t.vence_at).getTime() < ahora
    if (t.contacto_id) {
      r.contactosConPendiente.add(t.contacto_id)
      if (vencida) r.contactosConVencida.add(t.contacto_id)
    }
    if (t.oportunidad_id) {
      r.oportunidadesConPendiente.add(t.oportunidad_id)
      if (vencida) r.oportunidadesConVencida.add(t.oportunidad_id)
    }
  }
  return r
}

/**
 * Interfaz mínima del builder de PostgREST que usan las funciones aplicarFiltros*.
 * Todos los métodos devuelven `this`, así el tipo del resultado se conserva.
 */
export interface ConsultaFiltrable {
  eq(columna: string, valor: unknown): this
  neq(columna: string, valor: unknown): this
  gte(columna: string, valor: unknown): this
  lte(columna: string, valor: unknown): this
  lt(columna: string, valor: unknown): this
  in(columna: string, valores: readonly unknown[]): this
  not(columna: string, operador: string, valor: unknown): this
  or(filtros: string, opciones?: { referencedTable?: string }): this
  ilike(columna: string, patron: string): this
  is(columna: string, valor: null | boolean): this
  order(columna: string, opciones?: { ascending?: boolean; nullsFirst?: boolean; referencedTable?: string }): this
  limit(cantidad: number): this
}
