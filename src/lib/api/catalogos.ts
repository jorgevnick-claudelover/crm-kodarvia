/**
 * Catálogos: etapas, motivos de pérdida y orígenes, sobre el almacén local.
 * Todos leen; solo el administrador escribe (antes lo imponía RLS, ahora
 * `exigirAdmin` de `src/lib/reglas.ts`).
 */
import { ahora, escribir, leer, nuevoId } from "@/lib/almacen"
import { ErrorRegla, exigirAdmin, marcarActualizado } from "@/lib/reglas"
import { usuarioActual } from "@/lib/sesion"
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

/** Colores disponibles para las etapas (nombres de Tailwind). */
export const COLORES_ETAPA = ["slate", "sky", "teal", "emerald", "amber", "orange", "rose", "violet"] as const
export type ColorEtapa = (typeof COLORES_ETAPA)[number]

// ---------- etapas ----------
export async function listarEtapas(incluirInactivas = false): Promise<Etapa[]> {
  return porOrden(leer().etapas.filter((e) => incluirInactivas || e.activa))
}

export async function crearEtapa(datos: Omit<EtapaInsert, "orden"> & { orden?: number }): Promise<Etapa> {
  exigirAdmin(usuarioActual(), "crear etapas")
  const momento = ahora()
  return escribir((db) => {
    const fila: Etapa = {
      id: datos.id ?? nuevoId(),
      nombre: datos.nombre.trim(),
      orden: datos.orden ?? siguienteOrden(db.etapas),
      color: datos.color ?? "slate",
      activa: datos.activa ?? true,
      created_at: datos.created_at ?? momento,
      updated_at: datos.updated_at ?? momento,
    }
    db.etapas.push(fila)
    return fila
  })
}

export async function actualizarEtapa(id: string, cambios: EtapaUpdate): Promise<Etapa> {
  exigirAdmin(usuarioActual(), "cambiar las etapas")
  const momento = ahora()
  return escribir((db) => {
    const indice = db.etapas.findIndex((e) => e.id === id)
    if (indice === -1) throw new ErrorRegla("Esa etapa ya no existe.")
    const siguiente = marcarActualizado(fusionar(db.etapas[indice], cambios as Partial<Etapa>), momento)
    siguiente.id = db.etapas[indice].id
    if (cambios.nombre !== undefined) siguiente.nombre = cambios.nombre.trim()
    db.etapas[indice] = siguiente
    return siguiente
  })
}

/** Reordena: el índice en el array pasa a ser el campo orden (empezando en 1). */
export async function reordenarEtapas(ids: string[]): Promise<void> {
  exigirAdmin(usuarioActual(), "cambiar el orden de las etapas")
  const momento = ahora()
  escribir((db) => {
    reordenar(db.etapas, ids, momento)
  })
}

// ---------- motivos_perdida ----------
export async function listarMotivos(incluirInactivos = false): Promise<MotivoPerdida[]> {
  return porOrden(leer().motivos_perdida.filter((m) => incluirInactivos || m.activo))
}

export async function crearMotivo(datos: Omit<MotivoPerdidaInsert, "orden"> & { orden?: number }): Promise<MotivoPerdida> {
  exigirAdmin(usuarioActual(), "crear motivos de pérdida")
  const momento = ahora()
  return escribir((db) => {
    const fila: MotivoPerdida = {
      id: datos.id ?? nuevoId(),
      nombre: datos.nombre.trim(),
      orden: datos.orden ?? siguienteOrden(db.motivos_perdida),
      activo: datos.activo ?? true,
      created_at: datos.created_at ?? momento,
      updated_at: datos.updated_at ?? momento,
    }
    db.motivos_perdida.push(fila)
    return fila
  })
}

export async function actualizarMotivo(id: string, cambios: MotivoPerdidaUpdate): Promise<MotivoPerdida> {
  exigirAdmin(usuarioActual(), "cambiar los motivos de pérdida")
  const momento = ahora()
  return escribir((db) => {
    const indice = db.motivos_perdida.findIndex((m) => m.id === id)
    if (indice === -1) throw new ErrorRegla("Ese motivo de pérdida ya no existe.")
    const siguiente = marcarActualizado(fusionar(db.motivos_perdida[indice], cambios as Partial<MotivoPerdida>), momento)
    siguiente.id = db.motivos_perdida[indice].id
    if (cambios.nombre !== undefined) siguiente.nombre = cambios.nombre.trim()
    db.motivos_perdida[indice] = siguiente
    return siguiente
  })
}

export async function reordenarMotivos(ids: string[]): Promise<void> {
  exigirAdmin(usuarioActual(), "cambiar el orden de los motivos de pérdida")
  const momento = ahora()
  escribir((db) => {
    reordenar(db.motivos_perdida, ids, momento)
  })
}

// ---------- origenes ----------
export async function listarOrigenes(incluirInactivos = false): Promise<Origen[]> {
  return porOrden(leer().origenes.filter((o) => incluirInactivos || o.activo))
}

export async function crearOrigen(datos: Omit<OrigenInsert, "orden"> & { orden?: number }): Promise<Origen> {
  exigirAdmin(usuarioActual(), "crear orígenes")
  const momento = ahora()
  return escribir((db) => {
    const fila: Origen = {
      id: datos.id ?? nuevoId(),
      nombre: datos.nombre.trim(),
      orden: datos.orden ?? siguienteOrden(db.origenes),
      activo: datos.activo ?? true,
      created_at: datos.created_at ?? momento,
      updated_at: datos.updated_at ?? momento,
    }
    db.origenes.push(fila)
    return fila
  })
}

export async function actualizarOrigen(id: string, cambios: OrigenUpdate): Promise<Origen> {
  exigirAdmin(usuarioActual(), "cambiar los orígenes")
  const momento = ahora()
  return escribir((db) => {
    const indice = db.origenes.findIndex((o) => o.id === id)
    if (indice === -1) throw new ErrorRegla("Ese origen ya no existe.")
    const siguiente = marcarActualizado(fusionar(db.origenes[indice], cambios as Partial<Origen>), momento)
    siguiente.id = db.origenes[indice].id
    if (cambios.nombre !== undefined) siguiente.nombre = cambios.nombre.trim()
    db.origenes[indice] = siguiente
    return siguiente
  })
}

export async function reordenarOrigenes(ids: string[]): Promise<void> {
  exigirAdmin(usuarioActual(), "cambiar el orden de los orígenes")
  const momento = ahora()
  escribir((db) => {
    reordenar(db.origenes, ids, momento)
  })
}

// ---------- internos ----------
/** Forma común de las tres tablas de catálogo. */
interface FilaCatalogo {
  id: string
  nombre: string
  orden: number
  updated_at: string
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

/** Antes: `order('orden')`. Desempate por nombre para que el orden sea estable. */
function porOrden<T extends FilaCatalogo>(filas: T[]): T[] {
  return filas.sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"))
}

function siguienteOrden(filas: readonly FilaCatalogo[]): number {
  let maximo = 0
  for (const fila of filas) if (fila.orden > maximo) maximo = fila.orden
  return maximo + 1
}

/** El índice en `ids` pasa a ser el campo `orden` (empezando en 1). */
function reordenar<T extends FilaCatalogo>(filas: T[], ids: readonly string[], momento: string): void {
  ids.forEach((id, indice) => {
    const posicion = filas.findIndex((f) => f.id === id)
    if (posicion === -1) return
    if (filas[posicion].orden === indice + 1) return
    filas[posicion] = { ...filas[posicion], orden: indice + 1, updated_at: momento }
  })
}
