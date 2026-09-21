/**
 * Importaciones sobre el almacén local. Solo el administrador importa (antes RLS).
 * `deshacer` reproduce a mano las cascadas que hacía Postgres al borrar contactos.
 */
import { ahora, escribir, leer, nuevoId } from "@/lib/almacen"
import { ErrorRegla, exigirAdmin } from "@/lib/reglas"
import { usuarioActual } from "@/lib/sesion"
import type { Importacion, ImportacionInsert, ImportacionUpdate, Usuario } from "@/lib/types"

/** Copia la fila aplicando solo las claves definidas de `cambios` (undefined = no tocar). */
function fusionar<T extends object>(fila: T, cambios: Partial<T>): T {
  const salida = { ...fila }
  for (const clave of Object.keys(cambios) as (keyof T)[]) {
    const valor = cambios[clave]
    if (valor !== undefined) salida[clave] = valor as T[keyof T]
  }
  return salida
}

function exigirImportador(accion: string): Usuario {
  const usuario = usuarioActual()
  exigirAdmin(usuario, accion)
  if (!usuario) throw new ErrorRegla(`Solo el administrador puede ${accion}.`)
  return usuario
}

export async function crear(datos: ImportacionInsert): Promise<Importacion> {
  const actor = exigirImportador("importar contactos")
  const momento = ahora()
  const fila: Importacion = {
    id: datos.id ?? nuevoId(),
    archivo: datos.archivo,
    hoja: datos.hoja ?? null,
    mapeo: datos.mapeo ?? {},
    total_filas: datos.total_filas ?? 0,
    filas_no_vacias: datos.filas_no_vacias ?? 0,
    creadas: datos.creadas ?? 0,
    fusionadas: datos.fusionadas ?? 0,
    para_revisar: datos.para_revisar ?? 0,
    informe: datos.informe ?? [],
    usuario_id: datos.usuario_id ?? actor.id,
    created_at: datos.created_at ?? momento,
  }
  return escribir((db) => {
    db.importaciones.push(fila)
    return fila
  })
}

export async function actualizar(id: string, cambios: ImportacionUpdate): Promise<Importacion> {
  exigirImportador("cambiar una importación")
  return escribir((db) => {
    const indice = db.importaciones.findIndex((i) => i.id === id)
    if (indice === -1) throw new ErrorRegla("Esa importación ya no existe.")
    const siguiente = fusionar(db.importaciones[indice], cambios as Partial<Importacion>)
    siguiente.id = db.importaciones[indice].id
    db.importaciones[indice] = siguiente
    return siguiente
  })
}

export async function listar(): Promise<Importacion[]> {
  return [...leer().importaciones].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
}

export async function obtener(id: string): Promise<Importacion | null> {
  return leer().importaciones.find((i) => i.id === id) ?? null
}

/**
 * Deshace una importación: borra los contactos con ese `importacion_id` y, en
 * cascada, sus oportunidades (y el historial de estas), sus tareas y sus
 * actividades; las tareas y actividades de otros contactos que apuntaban a una
 * oportunidad borrada se quedan sin oportunidad (`on delete set null`).
 * Devuelve cuántos contactos se borraron.
 */
export async function deshacer(importacionId: string): Promise<number> {
  exigirImportador("deshacer una importación")
  return escribir((db) => {
    const contactos = new Set(db.contactos.filter((c) => c.importacion_id === importacionId).map((c) => c.id))
    if (contactos.size > 0) {
      const oportunidades = new Set(db.oportunidades.filter((o) => contactos.has(o.contacto_id)).map((o) => o.id))
      db.contactos = db.contactos.filter((c) => !contactos.has(c.id))
      db.oportunidades = db.oportunidades.filter((o) => !oportunidades.has(o.id))
      db.historial_etapas = db.historial_etapas.filter((h) => !oportunidades.has(h.oportunidad_id))
      db.tareas = db.tareas.filter((t) => t.contacto_id === null || !contactos.has(t.contacto_id))
      db.actividades = db.actividades.filter((a) => !contactos.has(a.contacto_id))
      db.tareas = db.tareas.map((t) =>
        t.oportunidad_id !== null && oportunidades.has(t.oportunidad_id) ? { ...t, oportunidad_id: null } : t,
      )
      db.actividades = db.actividades.map((a) =>
        a.oportunidad_id !== null && oportunidades.has(a.oportunidad_id) ? { ...a, oportunidad_id: null } : a,
      )
    }
    db.importaciones = db.importaciones.filter((i) => i.id !== importacionId)
    return contactos.size
  })
}
