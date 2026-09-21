/**
 * Contactos sobre el almacén local. Los filtros, el orden y los "join" que antes
 * hacía PostgREST se resuelven aquí en JavaScript sobre los arrays de `leer()`.
 * Las reglas que hacía Postgres (permisos, updated_at) viven en `src/lib/reglas.ts`.
 */
import { type BaseDatos, ahora, escribir, leer, nuevoId } from "@/lib/almacen"
import { ErrorRegla, exigirPuedeEditar, exigirReasignacion, marcarActualizado } from "@/lib/reglas"
import { idUsuarioActual } from "@/lib/sesion"
import type { Contacto, ContactoConRelaciones, ContactoInsert, ContactoUpdate, Usuario } from "@/lib/types"
import { normalizarTelefonoPE } from "@/lib/utils/telefono"
import { sinTildes } from "@/lib/utils/texto"
import { rangoLima, resumenTareasPendientes } from "./comun"

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

// -----------------------------------------------------------------------------
// Comparación de texto: sin tildes y sin distinguir mayúsculas (antes lo hacía ilike)
// -----------------------------------------------------------------------------

function normalizar(texto: string | null | undefined): string {
  return sinTildes(texto).toLowerCase()
}

function contiene(campo: string | null | undefined, aguja: string): boolean {
  return normalizar(campo).includes(aguja)
}

function digitos(texto: string | null | undefined): string {
  return (texto ?? "").replace(/\D+/g, "")
}

/**
 * Predicado de búsqueda por texto sobre un contacto: nombre, empresa, correo,
 * documento y teléfono. Antes construía el `.or()` de PostgREST; ahora filtra el array.
 */
export function filtroTextoContactos(texto: string): (contacto: Contacto) => boolean {
  const q = normalizar(texto.trim())
  if (!q) return () => true
  const numeros = digitos(q)
  return (c) => {
    if (contiene(c.nombre, q) || contiene(c.empresa, q) || contiene(c.email, q) || contiene(c.doc_numero, q)) return true
    if (numeros.length >= 3) {
      return digitos(c.telefono).includes(numeros) || digitos(c.telefono_raw).includes(numeros)
    }
    return contiene(c.telefono, q)
  }
}

// -----------------------------------------------------------------------------
// Orden (antes: .order() de PostgREST)
// -----------------------------------------------------------------------------

function porTexto(a: string | null | undefined, b: string | null | undefined): number {
  return (a ?? "").localeCompare(b ?? "", "es")
}

/** Descendente dejando los nulos al final (equivale a `nullsFirst: false`). */
function porFechaDesc(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a < b ? 1 : -1
}

function enRango(iso: string, desdeIso?: string, hastaIso?: string): boolean {
  if (desdeIso && iso < desdeIso) return false
  if (hastaIso && iso > hastaIso) return false
  return true
}

/**
 * Aplica los mismos filtros y el mismo orden a la lista, la paginación y la
 * exportación (criterio 7). Antes recibía el builder de PostgREST; ahora, las filas.
 */
export function aplicarFiltrosContactos<T extends Contacto>(
  filas: readonly T[],
  filtros: FiltrosContactos,
  ctx: ContextoFiltrosContactos = { idsConTareaPendiente: null },
): T[] {
  const texto = filtros.texto?.trim()
  const coincide = texto ? filtroTextoContactos(texto) : null
  const { desdeIso, hastaIso } = rangoLima(filtros.desde, filtros.hasta)
  const conPendiente =
    filtros.sinSeguimiento && ctx.idsConTareaPendiente ? new Set(ctx.idsConTareaPendiente) : null

  const salida = filas.filter((c) => {
    if (coincide && !coincide(c)) return false
    if (filtros.responsableId && c.responsable_id !== filtros.responsableId) return false
    if (filtros.origenId && c.origen_id !== filtros.origenId) return false
    if (!enRango(c.created_at, desdeIso, hastaIso)) return false
    if (conPendiente && conPendiente.has(c.id)) return false
    return true
  })

  // Desempate por id: el mismo que tenía la consulta, para que la paginación sea estable.
  switch (filtros.orden ?? "nombre") {
    case "reciente":
      salida.sort((a, b) => porFechaDesc(a.created_at, b.created_at) || porTexto(a.id, b.id))
      break
    case "ultima_actividad":
      salida.sort(
        (a, b) =>
          porFechaDesc(a.ultima_actividad_at, b.ultima_actividad_at) ||
          porTexto(a.nombre, b.nombre) ||
          porTexto(a.id, b.id),
      )
      break
    default:
      salida.sort((a, b) => porTexto(a.nombre, b.nombre) || porTexto(a.id, b.id))
  }
  return salida
}

// -----------------------------------------------------------------------------
// "Join": origen y responsable a partir de los arrays del almacén
// -----------------------------------------------------------------------------

/** Antes era el select `*, origen:origenes(*), responsable:usuarios!responsable_id(*)`. */
export function conRelacionesContacto(db: BaseDatos, contacto: Contacto): ContactoConRelaciones {
  return {
    ...contacto,
    origen: db.origenes.find((o) => o.id === contacto.origen_id) ?? null,
    responsable: db.usuarios.find((u) => u.id === contacto.responsable_id) ?? null,
  }
}

function todosConRelaciones(db: BaseDatos): ContactoConRelaciones[] {
  return db.contactos.map((c) => conRelacionesContacto(db, c))
}

// -----------------------------------------------------------------------------
// Consultas
// -----------------------------------------------------------------------------

export async function listar(filtros: FiltrosContactos = {}): Promise<ContactoConRelaciones[]> {
  const ctx = await contextoFiltrosContactos(filtros)
  return aplicarFiltrosContactos(todosConRelaciones(leer()), filtros, ctx)
}

/** Todas las filas con los mismos filtros (para exportar y el panel). */
export async function listarTodo(filtros: FiltrosContactos = {}): Promise<ContactoConRelaciones[]> {
  // Sin paginación: los mismos filtros que `listar` sobre todas las filas (criterio 7).
  return listar(filtros)
}

export async function obtener(id: string): Promise<ContactoConRelaciones> {
  const db = leer()
  const contacto = db.contactos.find((c) => c.id === id)
  if (!contacto) throw new Error("El contacto no existe o fue eliminado.")
  return Promise.resolve(conRelacionesContacto(db, contacto))
}

// -----------------------------------------------------------------------------
// Escrituras
// -----------------------------------------------------------------------------

/** Guarda telefono normalizado (+51...) y conserva telefono_raw tal como llegó. */
function prepararTelefono<T extends { telefono?: string | null; telefono_raw?: string | null }>(datos: T): T {
  if (datos.telefono === undefined) return datos
  const raw = datos.telefono?.trim() || null
  const normalizado = raw ? normalizarTelefonoPE(raw) : null
  return { ...datos, telefono: normalizado ?? raw, telefono_raw: datos.telefono_raw ?? raw }
}

/** Usuario con el que se está trabajando, tomado de la copia que recibe el mutador. */
function actor(db: BaseDatos): Usuario | null {
  const id = idUsuarioActual()
  if (!id) return null
  return db.usuarios.find((u) => u.id === id) ?? null
}

/** Mezcla los cambios ignorando las claves con `undefined` (como hacía el UPDATE parcial). */
function fusionar<T extends object>(base: T, cambios: Partial<Record<keyof T, unknown>>): T {
  const salida = { ...base } as Record<string, unknown>
  for (const [clave, valor] of Object.entries(cambios)) {
    if (valor !== undefined) salida[clave] = valor
  }
  return salida as T
}

export async function crear(datos: ContactoInsert): Promise<Contacto> {
  const momento = ahora()
  return Promise.resolve(
    escribir((db) => {
      const usuario = actor(db)
      const responsable = datos.responsable_id ?? usuario?.id ?? null
      if (!responsable) throw new ErrorRegla("Elige con qué usuario trabajas antes de guardar.")
      // Antes lo imponía la RLS: el responsable eres tú, salvo que seas administrador.
      if (usuario) exigirReasignacion(usuario, usuario.id, responsable)
      if (!db.usuarios.some((u) => u.id === responsable)) {
        throw new ErrorRegla("El responsable elegido ya no existe.")
      }

      const preparado = prepararTelefono({ ...datos, nombre: datos.nombre.trim() })
      const fila: Contacto = {
        id: preparado.id ?? nuevoId(),
        nombre: preparado.nombre,
        empresa: preparado.empresa ?? null,
        doc_tipo: preparado.doc_tipo ?? null,
        doc_numero: preparado.doc_numero ?? null,
        telefono: preparado.telefono ?? null,
        telefono_raw: preparado.telefono_raw ?? null,
        email: preparado.email ?? null,
        direccion: preparado.direccion ?? null,
        origen_id: preparado.origen_id ?? null,
        responsable_id: responsable,
        notas: preparado.notas ?? null,
        extra: preparado.extra ?? {},
        importacion_id: preparado.importacion_id ?? null,
        fila_origen: preparado.fila_origen ?? null,
        requiere_revision: preparado.requiere_revision ?? false,
        ultima_actividad_at: preparado.ultima_actividad_at ?? null,
        created_by: preparado.created_by ?? usuario?.id ?? null,
        created_at: preparado.created_at ?? momento,
        updated_at: preparado.updated_at ?? momento,
      }
      db.contactos.push(fila)
      return fila
    }),
  )
}

export async function actualizar(id: string, cambios: ContactoUpdate): Promise<Contacto> {
  const momento = ahora()
  return Promise.resolve(
    escribir((db) => {
      const indice = db.contactos.findIndex((c) => c.id === id)
      if (indice < 0) throw new ErrorRegla("El contacto no existe o fue eliminado.")
      const anterior = db.contactos[indice]
      const usuario = actor(db)
      exigirPuedeEditar(usuario, anterior, "este contacto")

      const siguiente = fusionar(anterior, prepararTelefono(cambios))
      siguiente.id = anterior.id
      siguiente.nombre = siguiente.nombre.trim()
      exigirReasignacion(usuario, anterior.responsable_id, siguiente.responsable_id)

      const fila = marcarActualizado(siguiente, momento)
      db.contactos[indice] = fila
      return fila
    }),
  )
}

export async function eliminar(id: string): Promise<void> {
  const momento = ahora()
  escribir((db) => {
    const contacto = db.contactos.find((c) => c.id === id)
    if (!contacto) return
    exigirPuedeEditar(actor(db), contacto, "este contacto")

    // Antes lo hacían los `on delete cascade` / `on delete set null` de la migración.
    const oportunidades = new Set(db.oportunidades.filter((o) => o.contacto_id === id).map((o) => o.id))
    db.contactos = db.contactos.filter((c) => c.id !== id)
    db.oportunidades = db.oportunidades.filter((o) => o.contacto_id !== id)
    db.historial_etapas = db.historial_etapas.filter((h) => !oportunidades.has(h.oportunidad_id))
    db.tareas = db.tareas.filter((t) => t.contacto_id !== id)
    db.actividades = db.actividades.filter((a) => a.contacto_id !== id)
    for (const t of db.tareas) {
      if (t.oportunidad_id && oportunidades.has(t.oportunidad_id)) {
        t.oportunidad_id = null
        t.updated_at = momento
      }
    }
    for (const a of db.actividades) {
      if (a.oportunidad_id && oportunidades.has(a.oportunidad_id)) a.oportunidad_id = null
    }
  })
  return Promise.resolve()
}

// -----------------------------------------------------------------------------
// Autocompletado y duplicados
// -----------------------------------------------------------------------------

/** Autocompletado del SelectorContacto: nombre, teléfono, empresa o documento. */
export async function buscarRapido(q: string, limite = 8): Promise<Contacto[]> {
  const texto = q.trim()
  if (texto.length < 2) return []
  const coincide = filtroTextoContactos(texto)
  const filas = leer()
    .contactos.filter(coincide)
    .sort((a, b) => porTexto(a.nombre, b.nombre) || porTexto(a.id, b.id))
    .slice(0, limite)
  return Promise.resolve(filas)
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
  const condiciones: Array<(c: Contacto) => boolean> = []

  const doc = normalizar(datos.doc_numero?.trim())
  if (doc) condiciones.push((c) => normalizar(c.doc_numero) === doc)

  const tel = datos.telefono?.trim()
  if (tel) {
    const norm = normalizarTelefonoPE(tel)
    if (norm) condiciones.push((c) => c.telefono === norm)
    const numeros = digitos(tel)
    if (numeros.length >= 6) condiciones.push((c) => digitos(c.telefono_raw).includes(numeros))
  }

  const email = normalizar(datos.email?.trim())
  if (email) condiciones.push((c) => normalizar(c.email) === email)

  const nombre = normalizar(datos.nombre?.trim())
  if (nombre && nombre.length >= 3) condiciones.push((c) => contiene(c.nombre, nombre))

  if (condiciones.length === 0) return []

  const filas = leer()
    .contactos.filter((c) => c.id !== datos.excluirId && condiciones.some((cumple) => cumple(c)))
    .slice(0, limite)
  return Promise.resolve(filas)
}
