/**
 * Pagina una consulta de supabase-js con .range() de 1000 en 1000 hasta agotar
 * las filas. Se usa para exportar y para el panel, donde hace falta todo.
 */

export interface RespuestaPagina<T> {
  data: T[] | null
  error: { message: string } | null
}

export type ConsultaPaginada<T> = (desde: number, hasta: number) => PromiseLike<RespuestaPagina<T>>

export const TAMANO_PAGINA = 1000

export async function fetchAll<T>(consulta: ConsultaPaginada<T>, tamanoPagina = TAMANO_PAGINA): Promise<T[]> {
  const filas: T[] = []
  let desde = 0
  for (;;) {
    const hasta = desde + tamanoPagina - 1
    const { data, error } = await consulta(desde, hasta)
    if (error) throw new Error(`No se pudieron cargar todas las filas: ${error.message}`)
    const pagina = data ?? []
    filas.push(...pagina)
    if (pagina.length < tamanoPagina) break
    desde += tamanoPagina
  }
  return filas
}
