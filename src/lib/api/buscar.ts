/**
 * Búsqueda global. Antes era la función SQL `buscar(q)`; ahora une en JavaScript
 * contactos, oportunidades, tareas y actividades del almacén local. Sin tildes,
 * sin distinguir mayúsculas, máximo 50 resultados, los más recientes primero.
 */
import { leer } from "@/lib/almacen"
import type { ResultadoBusqueda } from "@/lib/types"
import { sinTildes } from "@/lib/utils/texto"

export const LIMITE_BUSQUEDA = 50

function normalizar(texto: string | null | undefined): string {
  return sinTildes(texto).toLowerCase()
}

/** Equivalente de `concat_ws(' · ', ...)`: junta lo que hay y se salta lo vacío. */
function unir(...partes: Array<string | null | undefined>): string {
  return partes.map((p) => p?.trim() ?? "").filter((p) => p !== "").join(" · ")
}

/** Búsqueda global: contactos, oportunidades, tareas y actividades. Máximo 50. */
export async function buscar(q: string): Promise<ResultadoBusqueda[]> {
  const texto = q.trim()
  if (texto.length < 2) return []
  const aguja = normalizar(texto)
  const db = leer()
  const contactosPorId = new Map(db.contactos.map((c) => [c.id, c]))
  const filas: ResultadoBusqueda[] = []

  for (const c of db.contactos) {
    const textos = normalizar(`${c.nombre} ${c.empresa ?? ""}`)
    const datos = normalizar(unir(c.telefono, c.telefono_raw, c.email, c.doc_numero))
    if (!textos.includes(aguja) && !datos.includes(aguja)) continue
    filas.push({
      tipo: "contacto",
      id: c.id,
      titulo: c.nombre,
      subtitulo: unir(c.empresa, c.telefono, c.email, c.doc_numero),
      contacto_id: c.id,
      fecha: c.updated_at,
    })
  }

  for (const o of db.oportunidades) {
    // `join contactos`: sin contacto la oportunidad no aparecía.
    const contacto = contactosPorId.get(o.contacto_id)
    if (!contacto) continue
    if (!normalizar(o.titulo).includes(aguja)) continue
    filas.push({
      tipo: "oportunidad",
      id: o.id,
      titulo: o.titulo,
      subtitulo: unir(contacto.nombre, o.estado),
      contacto_id: o.contacto_id,
      fecha: o.updated_at,
    })
  }

  for (const t of db.tareas) {
    if (!normalizar(t.titulo).includes(aguja)) continue
    const contacto = t.contacto_id ? contactosPorId.get(t.contacto_id) : undefined
    filas.push({
      tipo: "tarea",
      id: t.id,
      titulo: t.titulo,
      subtitulo: unir(contacto?.nombre, t.estado),
      contacto_id: t.contacto_id,
      fecha: t.vence_at,
    })
  }

  for (const a of db.actividades) {
    if (!a.nota) continue
    const contacto = contactosPorId.get(a.contacto_id)
    if (!contacto) continue
    if (!normalizar(a.nota).includes(aguja)) continue
    filas.push({
      tipo: "actividad",
      id: a.id,
      titulo: a.nota.slice(0, 120),
      subtitulo: unir(contacto.nombre, a.tipo),
      contacto_id: a.contacto_id,
      fecha: a.ocurrio_at,
    })
  }

  // Más recientes primero, los sin fecha al final (era `order by fecha desc nulls last`).
  filas.sort((x, y) => {
    if (x.fecha === y.fecha) return 0
    if (x.fecha === null) return 1
    if (y.fecha === null) return -1
    return x.fecha < y.fecha ? 1 : -1
  })
  return Promise.resolve(filas.slice(0, LIMITE_BUSQUEDA))
}
