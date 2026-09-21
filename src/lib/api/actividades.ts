/**
 * Actividades sobre el almacén local. Además de guardar la fila, mantiene
 * `contactos.ultima_actividad_at` (antes lo hacía el trigger
 * `actualizar_ultima_actividad`; ahora la regla vive en `src/lib/reglas.ts`).
 */
import { ahora, escribir, leer, nuevoId, type BaseDatos } from "@/lib/almacen"
import { ErrorRegla, exigirPuedeEditar, marcarActualizado, ultimaActividad } from "@/lib/reglas"
import { usuarioActual } from "@/lib/sesion"
import type { Actividad, ActividadConRelaciones, ActividadInsert, ActividadUpdate, Usuario } from "@/lib/types"

/** Comparador de cadenas (fechas ISO e ids) para un orden estable. */
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

function sesionActual(): Usuario {
  const usuario = usuarioActual()
  if (!usuario) throw new ErrorRegla("No hay nadie trabajando en este navegador. Vuelve a entrar y elige tu usuario.")
  return usuario
}

/** Sustituye al "join" `*, usuario:usuarios!usuario_id(*)`. */
function conRelaciones(filas: readonly Actividad[]): ActividadConRelaciones[] {
  const usuarios = new Map<string, Usuario>(leer().usuarios.map((u) => [u.id, u]))
  return filas.map((a) => ({ ...a, usuario: usuarios.get(a.usuario_id) ?? null }))
}

/** Más recientes primero y, a igualdad de instante, por id: el orden de la consulta anterior. */
function masRecientesPrimero(filas: readonly Actividad[], limite: number): Actividad[] {
  return [...filas].sort((a, b) => comparar(b.ocurrio_at, a.ocurrio_at) || comparar(a.id, b.id)).slice(0, limite)
}

/**
 * Recalcula `ultima_actividad_at` de los contactos indicados (y su `updated_at` si
 * cambia), igual que hacía el trigger al insertar, mover o borrar una actividad.
 */
function refrescarUltimaActividad(db: BaseDatos, contactoIds: readonly string[], momento: string): void {
  for (const contactoId of new Set(contactoIds)) {
    const indice = db.contactos.findIndex((c) => c.id === contactoId)
    if (indice === -1) continue
    const valor = ultimaActividad(db.actividades, contactoId)
    if (db.contactos[indice].ultima_actividad_at === valor) continue
    db.contactos[indice] = marcarActualizado({ ...db.contactos[indice], ultima_actividad_at: valor }, momento)
  }
}

// -----------------------------------------------------------------------------
// Lectura
// -----------------------------------------------------------------------------

export async function listarPorContacto(contactoId: string, limite = 200): Promise<ActividadConRelaciones[]> {
  const filas = leer().actividades.filter((a) => a.contacto_id === contactoId)
  return conRelaciones(masRecientesPrimero(filas, limite))
}

export async function listarPorOportunidad(oportunidadId: string, limite = 200): Promise<ActividadConRelaciones[]> {
  const filas = leer().actividades.filter((a) => a.oportunidad_id === oportunidadId)
  return conRelaciones(masRecientesPrimero(filas, limite))
}

// -----------------------------------------------------------------------------
// Escritura
// -----------------------------------------------------------------------------

/** Cualquiera puede registrar actividad, también sobre contactos ajenos (cubre vacaciones). */
export async function crear(datos: ActividadInsert): Promise<Actividad> {
  const actor = sesionActual()
  const momento = ahora()
  const nueva: Actividad = {
    id: datos.id ?? nuevoId(),
    contacto_id: datos.contacto_id,
    oportunidad_id: datos.oportunidad_id ?? null,
    tipo: datos.tipo,
    resultado: datos.resultado ?? null,
    nota: datos.nota?.trim() || null,
    ocurrio_at: datos.ocurrio_at ?? momento,
    usuario_id: datos.usuario_id ?? actor.id,
    created_at: datos.created_at ?? momento,
  }
  return escribir((db) => {
    if (!db.contactos.some((c) => c.id === nueva.contacto_id)) {
      throw new ErrorRegla("No se pudo registrar la actividad: el contacto ya no existe.")
    }
    db.actividades.push(nueva)
    refrescarUltimaActividad(db, [nueva.contacto_id], momento)
    return nueva
  })
}

export async function actualizar(id: string, cambios: ActividadUpdate): Promise<Actividad> {
  const actor = usuarioActual()
  const momento = ahora()
  return escribir((db) => {
    const indice = db.actividades.findIndex((a) => a.id === id)
    if (indice === -1) throw new Error("La actividad no existe o fue eliminada.")
    const anterior = db.actividades[indice]
    exigirPuedeEditar(actor, anterior, "esta actividad")
    const siguiente = fusionar(anterior, cambios as Partial<Actividad>)
    siguiente.id = anterior.id
    if (cambios.nota !== undefined) siguiente.nota = cambios.nota?.trim() || null
    db.actividades[indice] = siguiente
    refrescarUltimaActividad(db, [anterior.contacto_id, siguiente.contacto_id], momento)
    return siguiente
  })
}

export async function eliminar(id: string): Promise<void> {
  const actor = usuarioActual()
  const momento = ahora()
  escribir((db) => {
    const indice = db.actividades.findIndex((a) => a.id === id)
    if (indice === -1) return
    const anterior = db.actividades[indice]
    exigirPuedeEditar(actor, anterior, "esta actividad")
    db.actividades.splice(indice, 1)
    refrescarUltimaActividad(db, [anterior.contacto_id], momento)
  })
}
