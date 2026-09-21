/**
 * Tareas sobre el almacén local (`src/lib/almacen.ts`). Antes esto eran consultas a
 * PostgREST; ahora los filtros, el orden y los "join" se hacen en JavaScript sobre
 * los arrays. Las reglas que hacía Postgres viven en `src/lib/reglas.ts`.
 *
 * Recordatorios: Kodarvia pidió por escrito que NO haya cola ni mecanismo de
 * servidor. El recordatorio queda programado en la propia tarea (`recordatorio_at`)
 * y visible para su responsable con `listarRecordatoriosPendientes()`.
 */
import { ahora, escribir, leer, nuevoId } from "@/lib/almacen"
import { ErrorRegla, esAdmin, exigirPuedeEditar, exigirReasignacion, prepararTarea } from "@/lib/reglas"
import { usuarioActual } from "@/lib/sesion"
import type { Contacto, EstadoTarea, Oportunidad, Tarea, TareaConRelaciones, TareaInsert, TareaUpdate, Usuario } from "@/lib/types"
import { sinTildes } from "@/lib/utils/texto"
import { rangoLima, uidActual } from "./comun"

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

// -----------------------------------------------------------------------------
// Internos
// -----------------------------------------------------------------------------

/** Texto comparable: sin tildes y en minúsculas (la búsqueda ignora ambas cosas). */
function normalizar(texto: string | null | undefined): string {
  return sinTildes(texto).toLowerCase().trim()
}

/** Comparador de cadenas (fechas ISO e ids) para ordenar de forma estable. */
function comparar(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Copia la fila aplicando solo las claves definidas de `cambios` (undefined = no tocar). */
function fusionar<T extends object>(fila: T, cambios: Partial<T>): T {
  const salida = { ...fila }
  for (const clave of Object.keys(cambios) as (keyof T)[]) {
    const valor = cambios[clave]
    if (valor !== undefined) salida[clave] = valor as T[keyof T]
  }
  return salida
}

/** Usuario con el que se está trabajando; lanza si no hay ninguno. */
function sesionActual(): Usuario {
  const usuario = usuarioActual()
  if (!usuario) throw new ErrorRegla("No hay nadie trabajando en este navegador. Vuelve a entrar y elige tu usuario.")
  return usuario
}

/** Sustituye al "join" `*, contacto:contactos(*), oportunidad:oportunidades(*), responsable:usuarios(*)`. */
function conRelaciones(filas: readonly Tarea[]): TareaConRelaciones[] {
  const db = leer()
  const contactos = new Map<string, Contacto>(db.contactos.map((c) => [c.id, c]))
  const oportunidades = new Map<string, Oportunidad>(db.oportunidades.map((o) => [o.id, o]))
  const usuarios = new Map<string, Usuario>(db.usuarios.map((u) => [u.id, u]))
  return filas.map((t) => ({
    ...t,
    contacto: t.contacto_id === null ? null : contactos.get(t.contacto_id) ?? null,
    oportunidad: t.oportunidad_id === null ? null : oportunidades.get(t.oportunidad_id) ?? null,
    responsable: usuarios.get(t.responsable_id) ?? null,
  }))
}

// -----------------------------------------------------------------------------
// Lectura
// -----------------------------------------------------------------------------

/** Aplica los mismos filtros (y el mismo orden) a la lista y a la exportación. */
export function aplicarFiltrosTareas<T extends Tarea>(
  filas: readonly T[],
  filtros: FiltrosTareas,
  ctx: ContextoFiltrosTareas = { uid: null },
): T[] {
  const texto = normalizar(filtros.texto)
  const { desdeIso, hastaIso } = rangoLima(filtros.desde, filtros.hasta)
  const seleccion = filas.filter((t) => {
    if (texto && !normalizar(t.titulo).includes(texto)) return false
    if (filtros.responsableId && t.responsable_id !== filtros.responsableId) return false
    if (filtros.soloMias && ctx.uid && t.responsable_id !== ctx.uid) return false
    if (filtros.estado && filtros.estado !== "todas" && t.estado !== filtros.estado) return false
    if (filtros.contactoId && t.contacto_id !== filtros.contactoId) return false
    if (filtros.oportunidadId && t.oportunidad_id !== filtros.oportunidadId) return false
    if (desdeIso && t.vence_at < desdeIso) return false
    if (hastaIso && t.vence_at > hastaIso) return false
    return true
  })
  const porFechaReciente = (filtros.orden ?? "vence") === "reciente"
  // Desempate por id: el mismo que tenía la consulta, para que el orden sea estable.
  return seleccion.sort((a, b) => {
    const principal = porFechaReciente ? comparar(b.created_at, a.created_at) : comparar(a.vence_at, b.vence_at)
    return principal !== 0 ? principal : comparar(a.id, b.id)
  })
}

export async function listar(filtros: FiltrosTareas = {}): Promise<TareaConRelaciones[]> {
  const ctx = await contextoFiltrosTareas(filtros)
  return conRelaciones(aplicarFiltrosTareas(leer().tareas, filtros, ctx))
}

/** Exportación (criterio 7): exactamente los mismos filtros que `listar`, sin paginar. */
export async function listarTodo(filtros: FiltrosTareas = {}): Promise<TareaConRelaciones[]> {
  const ctx = await contextoFiltrosTareas(filtros)
  return conRelaciones(aplicarFiltrosTareas(leer().tareas, filtros, ctx))
}

export async function obtener(id: string): Promise<TareaConRelaciones> {
  const tarea = leer().tareas.find((t) => t.id === id)
  if (!tarea) throw new Error("La tarea no existe o fue eliminada.")
  return conRelaciones([tarea])[0]
}

// -----------------------------------------------------------------------------
// Escritura
// -----------------------------------------------------------------------------

export async function crear(datos: TareaInsert): Promise<Tarea> {
  const actor = sesionActual()
  const momento = ahora()
  const responsableId = datos.responsable_id ?? actor.id
  if (responsableId !== actor.id && !esAdmin(actor)) {
    throw new ErrorRegla("Solo el administrador puede crear una tarea a nombre de otra persona.")
  }
  const nueva = prepararTarea(
    null,
    {
      id: datos.id ?? nuevoId(),
      contacto_id: datos.contacto_id ?? null,
      oportunidad_id: datos.oportunidad_id ?? null,
      titulo: datos.titulo.trim(),
      vence_at: datos.vence_at,
      recordatorio_at: datos.recordatorio_at ?? null,
      responsable_id: responsableId,
      estado: datos.estado ?? "pendiente",
      hecha_at: datos.hecha_at ?? null,
      recordatorio_visto_at: datos.recordatorio_visto_at ?? null,
      created_by: datos.created_by ?? actor.id,
      created_at: datos.created_at ?? momento,
      updated_at: datos.updated_at ?? momento,
    },
    momento,
  )
  return escribir((db) => {
    db.tareas.push(nueva)
    return nueva
  })
}

export async function actualizar(id: string, cambios: TareaUpdate): Promise<Tarea> {
  const actor = usuarioActual()
  const momento = ahora()
  return escribir((db) => {
    const indice = db.tareas.findIndex((t) => t.id === id)
    if (indice === -1) {
      throw new Error("No puedes guardar esto: no eres su responsable, o el registro ya no existe. Pídeselo al administrador.")
    }
    const anterior = db.tareas[indice]
    exigirPuedeEditar(actor, anterior, "esta tarea")
    const siguiente = fusionar(anterior, cambios as Partial<Tarea>)
    siguiente.id = anterior.id
    if (cambios.titulo !== undefined) siguiente.titulo = cambios.titulo.trim()
    exigirReasignacion(actor, anterior.responsable_id, siguiente.responsable_id)
    const tarea = prepararTarea(anterior, siguiente, momento)
    db.tareas[indice] = tarea
    return tarea
  })
}

export async function eliminar(id: string): Promise<void> {
  const actor = usuarioActual()
  escribir((db) => {
    const indice = db.tareas.findIndex((t) => t.id === id)
    if (indice === -1) return
    exigirPuedeEditar(actor, db.tareas[indice], "esta tarea")
    db.tareas.splice(indice, 1)
  })
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

/**
 * Tareas pendientes del usuario actual con el recordatorio ya vencido y sin marcar
 * como visto, de la más antigua a la más reciente (antes: rpc
 * `recordatorios_pendientes_usuario`). No hay cola ni servidor: el recordatorio
 * está programado en la tarea y se ve aquí.
 */
export async function listarRecordatoriosPendientes(): Promise<Tarea[]> {
  const uid = await uidActual()
  if (!uid) return []
  const momento = ahora()
  return leer()
    .tareas.filter(
      (t) =>
        t.responsable_id === uid &&
        t.estado === "pendiente" &&
        t.recordatorio_at !== null &&
        t.recordatorio_at <= momento &&
        t.recordatorio_visto_at === null,
    )
    .sort((a, b) => comparar(a.recordatorio_at ?? "", b.recordatorio_at ?? "") || comparar(a.id, b.id))
}

/** true si el contacto tiene alguna tarea pendiente (para el aviso "sin seguimiento"). */
export async function tienePendiente(contactoId: string): Promise<boolean> {
  return leer().tareas.some((t) => t.contacto_id === contactoId && t.estado === "pendiente")
}
