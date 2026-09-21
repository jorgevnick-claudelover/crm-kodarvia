/**
 * Paginación de contactos para el módulo de contactos (carga incremental de 50 en 50).
 * Se apoya en `listarTodo` para que la lista, la página siguiente y la exportación
 * apliquen exactamente los mismos filtros y el mismo orden (criterio 7).
 */
import type { ContactoConRelaciones } from "@/lib/types"
import { resumenTareasPendientes } from "./comun"
import { type FiltrosContactos, listarTodo } from "./contactos"

export const TAMANO_PAGINA_CONTACTOS = 50

export interface PaginaContactos {
  filas: ContactoConRelaciones[]
  /** Total de filas que cumplen los filtros. */
  total: number
  /** Índice de la primera fila de esta página. */
  desde: number
}

/** Una página de contactos con los filtros dados: filas [desde, desde+limite). */
export async function listarPagina(
  filtros: FiltrosContactos,
  desde = 0,
  limite = TAMANO_PAGINA_CONTACTOS,
): Promise<PaginaContactos> {
  const todas = await listarTodo(filtros)
  return { filas: todas.slice(desde, desde + limite), total: todas.length, desde }
}

/** Ids (como arrays, serializables en la caché) de contactos con tarea pendiente o vencida. */
export interface ResumenSeguimientoContactos {
  conPendiente: string[]
  conVencida: string[]
}

export async function resumenSeguimientoContactos(): Promise<ResumenSeguimientoContactos> {
  const r = await resumenTareasPendientes()
  return { conPendiente: [...r.contactosConPendiente], conVencida: [...r.contactosConVencida] }
}
