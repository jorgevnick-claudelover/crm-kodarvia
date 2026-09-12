/**
 * Paginación de contactos para el módulo de contactos (carga incremental de 50 en 50).
 * Reutiliza aplicarFiltrosContactos para que la lista, la página siguiente y la
 * exportación (listarTodo) apliquen exactamente los mismos filtros (criterio 7).
 */
import { supabase } from "@/lib/supabase"
import type { ContactoConRelaciones } from "@/lib/types"
import { lanzarSi, resumenTareasPendientes } from "./comun"
import { type FiltrosContactos, SELECT_CONTACTO, aplicarFiltrosContactos, contextoFiltrosContactos } from "./contactos"

export const TAMANO_PAGINA_CONTACTOS = 50

export interface PaginaContactos {
  filas: ContactoConRelaciones[]
  /** Total de filas que cumplen los filtros (count exact). */
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
  const ctx = await contextoFiltrosContactos(filtros)
  const { data, error, count } = await aplicarFiltrosContactos(
    supabase.from("contactos").select(SELECT_CONTACTO, { count: "exact" }),
    filtros,
    ctx,
  )
    .range(desde, desde + limite - 1)
    .overrideTypes<ContactoConRelaciones[], { merge: false }>()
  lanzarSi(error, "No se pudieron cargar los contactos")
  return { filas: data ?? [], total: count ?? (data?.length ?? 0), desde }
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
