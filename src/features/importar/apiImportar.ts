/**
 * Escritura en bloque del asistente de importación.
 *
 * Antes esto eran dos funciones que troceaban las filas en lotes de 200 porque cada
 * lote era una petición a PostgREST. Con el almacén local no hay peticiones: toda la
 * hoja entra en una sola escritura, que además es atómica (si algo falla no queda
 * media importación guardada) y deja las oportunidades viendo ya a sus contactos.
 *
 * Aquí se aplican a mano las mismas reglas que `src/lib/api/oportunidades.ts` aplica
 * fila a fila: fechas de cierre, criterio 3 (perder exige motivo) y la fila inicial
 * del historial de etapas, de la que vive el embudo del panel.
 */
import { type BaseDatos, ahora, escribir, nuevoId } from "@/lib/almacen"
import {
  ErrorRegla,
  historialAlCrear,
  prepararOportunidadNueva,
  siguienteIdHistorial,
  validarOportunidad,
} from "@/lib/reglas"
import { idUsuarioActual } from "@/lib/sesion"
import type { Contacto, ContactoInsert, Oportunidad, OportunidadInsert } from "@/lib/types"

export { nuevoId }

/** Cuántas filas entraron de verdad en el almacén. */
export interface ResumenInsercion {
  contactos: number
  oportunidades: number
}

function exigirResponsable(db: BaseDatos, responsableId: string | undefined, usuarioId: string | null): string {
  const responsable = responsableId ?? usuarioId
  if (!responsable) throw new ErrorRegla("Elige con qué usuario trabajas antes de importar.")
  if (!db.usuarios.some((u) => u.id === responsable)) {
    throw new ErrorRegla("El responsable de la importación ya no existe.")
  }
  return responsable
}

function filaContacto(datos: ContactoInsert, responsable: string, usuarioId: string | null, momento: string): Contacto {
  return {
    id: datos.id ?? nuevoId(),
    nombre: datos.nombre,
    empresa: datos.empresa ?? null,
    doc_tipo: datos.doc_tipo ?? null,
    doc_numero: datos.doc_numero ?? null,
    telefono: datos.telefono ?? null,
    telefono_raw: datos.telefono_raw ?? null,
    email: datos.email ?? null,
    direccion: datos.direccion ?? null,
    origen_id: datos.origen_id ?? null,
    responsable_id: responsable,
    notas: datos.notas ?? null,
    extra: datos.extra ?? {},
    importacion_id: datos.importacion_id ?? null,
    fila_origen: datos.fila_origen ?? null,
    requiere_revision: datos.requiere_revision ?? false,
    ultima_actividad_at: datos.ultima_actividad_at ?? null,
    created_by: datos.created_by ?? usuarioId,
    // Toda fila necesita fecha: el almacén no pone valores por defecto.
    created_at: datos.created_at ?? momento,
    updated_at: datos.updated_at ?? momento,
  }
}

function filaOportunidad(
  datos: OportunidadInsert,
  responsable: string,
  usuarioId: string | null,
  momento: string,
  posicion: number,
): Oportunidad {
  return prepararOportunidadNueva(
    {
      id: datos.id ?? nuevoId(),
      contacto_id: datos.contacto_id,
      titulo: datos.titulo.trim(),
      importe: datos.importe ?? 0,
      moneda: datos.moneda ?? "PEN",
      etapa_id: datos.etapa_id,
      estado: datos.estado ?? "abierta",
      posicion: datos.posicion ?? posicion,
      responsable_id: responsable,
      motivo_perdida_id: datos.motivo_perdida_id ?? null,
      detalle_perdida: datos.detalle_perdida ?? null,
      fecha_cierre_prevista: datos.fecha_cierre_prevista ?? null,
      ganada_at: datos.ganada_at ?? null,
      perdida_at: datos.perdida_at ?? null,
      created_by: datos.created_by ?? usuarioId,
      created_at: datos.created_at ?? momento,
      updated_at: datos.updated_at ?? momento,
    },
    momento,
  )
}

/**
 * Mete de golpe los contactos y las oportunidades de una importación. Las
 * oportunidades pueden apuntar a contactos de esta misma llamada.
 * Lanza `ErrorRegla` con mensaje en español si alguna fila no cumple las reglas.
 */
export function insertarImportacion(
  contactos: readonly ContactoInsert[],
  oportunidades: readonly OportunidadInsert[],
): ResumenInsercion {
  if (contactos.length === 0 && oportunidades.length === 0) return { contactos: 0, oportunidades: 0 }
  const momento = ahora()
  const usuarioId = idUsuarioActual()

  return escribir((db) => {
    for (const datos of contactos) {
      const responsable = exigirResponsable(db, datos.responsable_id, usuarioId)
      db.contactos.push(filaContacto(datos, responsable, usuarioId, momento))
    }

    // Posiciones negativas y decrecientes, como el default `-extract(epoch ...)` de
    // Postgres: cada fila queda por encima de la anterior en el tablero.
    const base = -(Date.now() / 1000)
    let idHistorial = siguienteIdHistorial(db.historial_etapas)

    for (const [indice, datos] of oportunidades.entries()) {
      const responsable = exigirResponsable(db, datos.responsable_id, usuarioId)
      if (!db.contactos.some((c) => c.id === datos.contacto_id)) {
        throw new ErrorRegla("Una oportunidad de la importación apunta a un contacto que no existe.")
      }
      if (!db.etapas.some((e) => e.id === datos.etapa_id)) {
        throw new ErrorRegla("Una oportunidad de la importación apunta a una etapa que no existe.")
      }
      const fila = filaOportunidad(datos, responsable, usuarioId, momento, base - indice / 1000)
      validarOportunidad(fila)
      db.oportunidades.push(fila)
      // Igual que el trigger `registrar_historial_etapas`: sin esta fila el embudo no ve la importación.
      const inicial = historialAlCrear(fila, usuarioId, momento)
      db.historial_etapas.push({
        id: idHistorial++,
        oportunidad_id: inicial.oportunidad_id,
        de_etapa_id: inicial.de_etapa_id ?? null,
        a_etapa_id: inicial.a_etapa_id ?? null,
        de_estado: inicial.de_estado ?? null,
        a_estado: inicial.a_estado,
        usuario_id: inicial.usuario_id ?? null,
        created_at: inicial.created_at ?? momento,
      })
    }

    return { contactos: contactos.length, oportunidades: oportunidades.length }
  })
}
