/**
 * Paso 4 del asistente: lleva a la base de datos el plan calculado en mapeo.ts.
 *
 * Orden: crear los orígenes y etapas que faltan → registrar la fila de `importaciones`
 * → insertar los contactos en lotes de 200 (con importacion_id, fila_origen y extra)
 * → actualizar los contactos fusionados → crear las oportunidades → guardar recuentos
 * e informe. Ninguna fila no vacía se queda fuera (criterio 6).
 */
import * as apiCatalogos from "@/lib/api/catalogos"
import * as apiContactos from "@/lib/api/contactos"
import * as apiImportaciones from "@/lib/api/importaciones"
import type {
  Contacto,
  ContactoInsert,
  FilaInformeImportacion,
  Json,
  OportunidadInsert,
} from "@/lib/types"
import { insertarContactosEnLotes, insertarOportunidadesEnLotes, nuevoId } from "./apiImportar"
import {
  type CatalogosImportacion,
  type ColumnaHoja,
  type Equivalencia,
  type Equivalencias,
  type FilaInformeCSV,
  type Mapeo,
  type PlanImportacion,
  type RecuentoImportacion,
  type TipoCatalogo,
  type ValorCatalogo,
  ETIQUETA_RESULTADO,
  calcularFusion,
  claveValor,
  mapeoParaGuardar,
} from "./mapeo"

export interface ProgresoImportacion {
  /** Qué se está haciendo ahora mismo, en español. */
  fase: string
  hecho: number
  total: number
}

export interface OpcionesEjecucion {
  archivo: string
  hoja: string
  columnas: ColumnaHoja[]
  mapeo: Mapeo
  plan: PlanImportacion
  equivalencias: Equivalencias
  valores: Record<TipoCatalogo, ValorCatalogo[]>
  catalogos: CatalogosImportacion
  /** Contactos que ya estaban en el CRM (para rellenar huecos al fusionar). */
  existentes: readonly Contacto[]
  onProgreso?: (progreso: ProgresoImportacion) => void
}

export interface ResultadoEjecucion {
  importacionId: string
  archivo: string
  recuento: RecuentoImportacion
  /** Una fila por cada fila no vacía de la hoja, para el CSV descargable. */
  informe: FilaInformeCSV[]
  /** Oportunidades creadas. */
  oportunidades: number
  /** Orígenes y etapas creados sobre la marcha. */
  origenesCreados: string[]
  etapasCreadas: string[]
}

function textoPorClave(valores: ValorCatalogo[]): Map<string, string> {
  return new Map(valores.map((v) => [v.clave, v.texto]))
}

/** Ejecuta la importación completa. Lanza Error con mensaje en español si algo falla. */
export async function ejecutarImportacion(opciones: OpcionesEjecucion): Promise<ResultadoEjecucion> {
  const { plan, catalogos, equivalencias, valores, existentes } = opciones
  const conContacto = plan.filas.filter((p) => p.contacto !== null)
  const fusiones = plan.filas.filter((p) => p.resultado === "fusionado" && p.fusionarCon)
  const conOportunidad = plan.filas.filter((p) => p.oportunidad !== null)
  const totalPasos = conContacto.length + fusiones.length + conOportunidad.length + 3
  let hechos = 0
  const avisar = (fase: string, hecho = hechos) => opciones.onProgreso?.({ fase, hecho, total: totalPasos })

  avisar("Preparando la importación", 0)

  // 1. Orígenes y etapas que el usuario decidió crear.
  const idOrigen = new Map<string, string>()
  const idEtapa = new Map<string, string>()
  const origenesCreados: string[] = []
  const etapasCreadas: string[] = []

  const textosOrigen = textoPorClave(valores.origenes)
  for (const [clave, eq] of Object.entries(equivalencias.origenes)) {
    if (eq.tipo === "existente") idOrigen.set(clave, eq.id)
    else if (eq.tipo === "crear") {
      const nombre = textosOrigen.get(clave) ?? clave
      avisar(`Creando el origen «${nombre}»`)
      const creado = await apiCatalogos.crearOrigen({ nombre })
      idOrigen.set(clave, creado.id)
      origenesCreados.push(creado.nombre)
    }
  }

  const textosEtapa = textoPorClave(valores.etapas)
  for (const [clave, eq] of Object.entries(equivalencias.etapas)) {
    if (eq.tipo === "existente") idEtapa.set(clave, eq.id)
    else if (eq.tipo === "crear") {
      const nombre = textosEtapa.get(clave) ?? clave
      avisar(`Creando la etapa «${nombre}»`)
      const creada = await apiCatalogos.crearEtapa({ nombre })
      idEtapa.set(clave, creada.id)
      etapasCreadas.push(creada.nombre)
    }
  }
  hechos += 1
  avisar("Registrando la importación")

  // 2. Fila de importaciones (los contactos nacen ya con su importacion_id).
  const importacion = await apiImportaciones.crear({
    archivo: opciones.archivo,
    hoja: opciones.hoja,
    mapeo: mapeoParaGuardar(opciones.columnas, opciones.mapeo) as unknown as Json,
    total_filas: plan.recuento.total,
    filas_no_vacias: plan.recuento.noVacias,
    usuario_id: catalogos.adminId,
  })
  hechos += 1

  const resolverOrigen = (eq: Equivalencia | null, texto: string | null): string | null => {
    if (!eq) return null
    if (eq.tipo === "existente") return eq.id
    if (eq.tipo === "crear") return idOrigen.get(claveValor(texto)) ?? null
    return null
  }
  const resolverResponsable = (eq: Equivalencia | null): string => {
    if (eq?.tipo === "existente") return eq.id
    return catalogos.adminId
  }

  // 3. Contactos en lotes de 200.
  const idPorFila = new Map<number, string>()
  const inserts: ContactoInsert[] = []
  for (const p of conContacto) {
    const c = p.contacto
    if (!c) continue
    const id = nuevoId()
    idPorFila.set(p.fila, id)
    inserts.push({
      id,
      nombre: c.nombre,
      empresa: c.empresa,
      doc_tipo: c.doc_tipo,
      doc_numero: c.doc_numero,
      telefono: c.telefono,
      telefono_raw: c.telefono_raw,
      email: c.email,
      direccion: c.direccion,
      origen_id: resolverOrigen(c.origen, p.datos.origen),
      responsable_id: resolverResponsable(c.responsable),
      notas: c.notas,
      extra: c.extra as Json,
      importacion_id: importacion.id,
      fila_origen: p.fila,
      requiere_revision: c.requiere_revision,
      ...(c.created_at ? { created_at: c.created_at } : {}),
    })
  }
  avisar(`Creando ${inserts.length} contactos`)
  const baseContactos = hechos
  await insertarContactosEnLotes(inserts, (insertados) => {
    hechos = baseContactos + insertados
    avisar(`Creando contactos (${insertados} de ${inserts.length})`)
  })
  hechos = baseContactos + inserts.length

  // 4. Fusiones: rellenar huecos de los contactos que ya estaban en el CRM.
  const porId = new Map(existentes.map((c) => [c.id, c]))
  const idFusion = new Map<number, string>()
  for (const p of fusiones) {
    const destino = p.fusionarCon
    if (!destino) continue
    if (destino.origen === "archivo") {
      const id = idPorFila.get(destino.fila)
      if (id) idFusion.set(p.fila, id)
      hechos += 1
      continue
    }
    idFusion.set(p.fila, destino.id)
    const existente = porId.get(destino.id)
    if (existente) {
      const cambios = calcularFusion(existente, p.datos)
      if (Object.keys(cambios).length > 0) await apiContactos.actualizar(destino.id, cambios)
    }
    hechos += 1
    avisar(`Actualizando duplicados (fila ${p.fila})`)
  }

  // 5. Oportunidades (solo si se mapeó etapa, importe, estado o título).
  const primeraEtapa = catalogos.etapas[0]?.id ?? null
  const oportunidades: OportunidadInsert[] = []
  for (const p of conOportunidad) {
    const o = p.oportunidad
    const contactoId = idPorFila.get(p.fila)
    if (!o || !contactoId) continue
    let etapaId: string | null = null
    if (o.etapa?.tipo === "existente") etapaId = o.etapa.id
    else if (o.etapa?.tipo === "crear") etapaId = idEtapa.get(claveValor(p.datos.etapa)) ?? null
    etapaId = etapaId ?? primeraEtapa
    if (!etapaId) continue // Sin etapas configuradas no hay oportunidad que crear.
    const cierre = o.created_at ?? new Date().toISOString()
    oportunidades.push({
      contacto_id: contactoId,
      titulo: o.titulo,
      importe: o.importe,
      etapa_id: etapaId,
      estado: o.estado,
      responsable_id: resolverResponsable(p.contacto?.responsable ?? null),
      motivo_perdida_id: o.motivoPerdidaId,
      detalle_perdida: o.estado === "perdida" ? "Importado sin motivo" : null,
      ganada_at: o.estado === "ganada" ? cierre : null,
      perdida_at: o.estado === "perdida" ? cierre : null,
      ...(o.created_at ? { created_at: o.created_at } : {}),
    })
  }
  if (oportunidades.length > 0) {
    avisar(`Creando ${oportunidades.length} oportunidades`)
    const baseOportunidades = hechos
    await insertarOportunidadesEnLotes(oportunidades, (insertados) => {
      hechos = baseOportunidades + insertados
      avisar(`Creando oportunidades (${insertados} de ${oportunidades.length})`)
    })
    hechos = baseOportunidades + oportunidades.length
  }

  // 6. Informe fila a fila y recuentos definitivos.
  const informe: FilaInformeCSV[] = plan.filas.map((p) => ({
    fila: p.fila,
    resultado: ETIQUETA_RESULTADO[p.resultado],
    motivo: p.motivos.join("; "),
    nombre: p.contacto?.nombre ?? p.datos.nombre ?? "",
    contacto: (p.resultado === "fusionado" ? idFusion.get(p.fila) : idPorFila.get(p.fila)) ?? "",
  }))
  const informeGuardado: FilaInformeImportacion[] = plan.filas.map((p) => ({
    fila: p.fila,
    resultado: p.resultado,
    motivo: p.motivos.join("; "),
    contacto_id: (p.resultado === "fusionado" ? idFusion.get(p.fila) : idPorFila.get(p.fila)) ?? undefined,
  }))

  avisar("Guardando el informe")
  await apiImportaciones.actualizar(importacion.id, {
    creadas: plan.recuento.crear,
    fusionadas: plan.recuento.fusionar,
    para_revisar: plan.recuento.revisar,
    informe: informeGuardado as unknown as Json,
  })
  hechos += 1
  avisar("Listo", totalPasos)

  return {
    importacionId: importacion.id,
    archivo: opciones.archivo,
    recuento: plan.recuento,
    informe,
    oportunidades: oportunidades.length,
    origenesCreados,
    etapasCreadas,
  }
}
