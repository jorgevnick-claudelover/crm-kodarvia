/**
 * Oportunidades sobre el almacén local. Filtros, orden y "join" en JavaScript;
 * las reglas que hacía Postgres (criterio 3, historial de etapas, fechas de cierre,
 * permisos) vienen de `src/lib/reglas.ts`.
 */
import { type BaseDatos, ahora, escribir, leer, nuevoId } from "@/lib/almacen"
import {
  ErrorRegla,
  exigirEtapaActiva,
  exigirPuedeEditar,
  exigirReasignacion,
  historialAlActualizar,
  historialAlCrear,
  marcarActualizado,
  prepararOportunidadActualizada,
  prepararOportunidadNueva,
  siguienteIdHistorial,
  validarOportunidad,
} from "@/lib/reglas"
import { idUsuarioActual } from "@/lib/sesion"
import { monedaActual } from "@/lib/utils/moneda"
import type {
  EstadoOportunidad,
  HistorialEtapa,
  HistorialEtapaInsert,
  Oportunidad,
  OportunidadConRelaciones,
  OportunidadInsert,
  OportunidadUpdate,
  Usuario,
} from "@/lib/types"
import { filtroTextoContactos } from "./contactos"
import { rangoLima, resumenTareasPendientes } from "./comun"
import { sinTildes } from "@/lib/utils/texto"

export type OrdenOportunidades = "posicion" | "reciente" | "antiguo" | "importe" | "cierre"

export interface FiltrosOportunidades {
  /** Busca en el título y en nombre/empresa/teléfono/correo/documento del contacto. */
  texto?: string
  responsableId?: string
  /** origen del contacto */
  origenId?: string
  etapaId?: string
  /** '' o 'todas' = sin filtro. */
  estado?: EstadoOportunidad | "todas" | ""
  /** Contacto sin tarea pendiente (ni la oportunidad). */
  sinSeguimiento?: boolean
  /** Con alguna tarea pendiente vencida (del contacto o de la oportunidad). */
  conTareaVencida?: boolean
  /** 'yyyy-MM-dd' (Lima) sobre created_at. */
  desde?: string
  hasta?: string
  orden?: OrdenOportunidades
}

export const FILTROS_OPORTUNIDADES_DEFAULT: Required<FiltrosOportunidades> = {
  texto: "",
  responsableId: "",
  origenId: "",
  etapaId: "",
  estado: "abierta",
  sinSeguimiento: false,
  conTareaVencida: false,
  desde: "",
  hasta: "",
  orden: "posicion",
}

export interface ContextoFiltrosOportunidades {
  /** Ids de contactos que casan con el texto (además del título). */
  contactoIdsTexto: string[] | null
  /** Contactos con tarea pendiente (para sinSeguimiento). */
  contactosConPendiente: string[] | null
  oportunidadesConPendiente: string[] | null
  /** Con tarea vencida (para conTareaVencida). */
  contactosConVencida: string[] | null
  oportunidadesConVencida: string[] | null
}

const CONTEXTO_VACIO: ContextoFiltrosOportunidades = {
  contactoIdsTexto: null,
  contactosConPendiente: null,
  oportunidadesConPendiente: null,
  contactosConVencida: null,
  oportunidadesConVencida: null,
}

/** Tope heredado de la consulta: el texto nunca arrastra más de 500 contactos. */
const TOPE_CONTACTOS_TEXTO = 500

export async function contextoFiltrosOportunidades(filtros: FiltrosOportunidades): Promise<ContextoFiltrosOportunidades> {
  const ctx: ContextoFiltrosOportunidades = { ...CONTEXTO_VACIO }
  const texto = filtros.texto?.trim()
  if (texto) {
    const coincide = filtroTextoContactos(texto)
    ctx.contactoIdsTexto = leer()
      .contactos.filter(coincide)
      .slice(0, TOPE_CONTACTOS_TEXTO)
      .map((c) => c.id)
  }
  if (filtros.sinSeguimiento || filtros.conTareaVencida) {
    const r = await resumenTareasPendientes()
    ctx.contactosConPendiente = [...r.contactosConPendiente]
    ctx.oportunidadesConPendiente = [...r.oportunidadesConPendiente]
    ctx.contactosConVencida = [...r.contactosConVencida]
    ctx.oportunidadesConVencida = [...r.oportunidadesConVencida]
  }
  return ctx
}

// -----------------------------------------------------------------------------
// Orden y comparaciones (antes: .order() de PostgREST)
// -----------------------------------------------------------------------------

function porTexto(a: string | null | undefined, b: string | null | undefined): number {
  return (a ?? "").localeCompare(b ?? "", "es")
}

function porFechaDesc(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a < b ? 1 : -1
}

/** Ascendente dejando los nulos al final (equivale a `nullsFirst: false`). */
function porFechaAsc(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a < b ? -1 : 1
}

function enRango(iso: string, desdeIso?: string, hastaIso?: string): boolean {
  if (desdeIso && iso < desdeIso) return false
  if (hastaIso && iso > hastaIso) return false
  return true
}

/** Aplica los mismos filtros a la lista, el tablero y la exportación (criterio 7). */
export function aplicarFiltrosOportunidades<T extends OportunidadConRelaciones>(
  filas: readonly T[],
  filtros: FiltrosOportunidades,
  ctx: ContextoFiltrosOportunidades = CONTEXTO_VACIO,
): T[] {
  const texto = filtros.texto?.trim()
  const aguja = texto ? sinTildes(texto).toLowerCase() : ""
  const contactosTexto = texto && ctx.contactoIdsTexto ? new Set(ctx.contactoIdsTexto) : null
  const { desdeIso, hastaIso } = rangoLima(filtros.desde, filtros.hasta)

  const contactosPend = new Set(ctx.contactosConPendiente ?? [])
  const oportunidadesPend = new Set(ctx.oportunidadesConPendiente ?? [])
  const contactosVenc = new Set(ctx.contactosConVencida ?? [])
  const oportunidadesVenc = new Set(ctx.oportunidadesConVencida ?? [])

  const salida = filas.filter((o) => {
    if (texto) {
      const porTitulo = sinTildes(o.titulo).toLowerCase().includes(aguja)
      const porContacto = contactosTexto?.has(o.contacto_id) ?? false
      if (!porTitulo && !porContacto) return false
    }
    if (filtros.responsableId && o.responsable_id !== filtros.responsableId) return false
    // `contactos!inner`: toda oportunidad tiene contacto; sin él queda fuera.
    if (filtros.origenId && (o.contacto?.origen_id ?? null) !== filtros.origenId) return false
    if (filtros.etapaId && o.etapa_id !== filtros.etapaId) return false
    if (filtros.estado && filtros.estado !== "todas" && o.estado !== filtros.estado) return false
    if (!enRango(o.created_at, desdeIso, hastaIso)) return false
    if (filtros.sinSeguimiento && (contactosPend.has(o.contacto_id) || oportunidadesPend.has(o.id))) return false
    if (filtros.conTareaVencida && !contactosVenc.has(o.contacto_id) && !oportunidadesVenc.has(o.id)) return false
    return true
  })

  // Desempate por id: el mismo que tenía la consulta, para que el orden sea estable.
  switch (filtros.orden ?? "posicion") {
    case "reciente":
      salida.sort((a, b) => porFechaDesc(a.created_at, b.created_at) || porTexto(a.id, b.id))
      break
    case "antiguo":
      salida.sort((a, b) => porFechaAsc(a.created_at, b.created_at) || porTexto(a.id, b.id))
      break
    case "importe":
      salida.sort((a, b) => Number(b.importe) - Number(a.importe) || porTexto(a.id, b.id))
      break
    case "cierre":
      salida.sort(
        (a, b) => porFechaAsc(a.fecha_cierre_prevista, b.fecha_cierre_prevista) || porTexto(a.id, b.id),
      )
      break
    default:
      salida.sort(
        (a, b) => a.posicion - b.posicion || porFechaDesc(a.created_at, b.created_at) || porTexto(a.id, b.id),
      )
  }
  return salida
}

// -----------------------------------------------------------------------------
// "Join": contacto, etapa, responsable y motivo de pérdida
// -----------------------------------------------------------------------------

/** Antes era el select con `contactos!inner`, `etapas`, `usuarios` y `motivos_perdida`. */
export function conRelacionesOportunidad(db: BaseDatos, fila: Oportunidad): OportunidadConRelaciones {
  return {
    ...fila,
    contacto: db.contactos.find((c) => c.id === fila.contacto_id) ?? null,
    etapa: db.etapas.find((e) => e.id === fila.etapa_id) ?? null,
    responsable: db.usuarios.find((u) => u.id === fila.responsable_id) ?? null,
    motivo_perdida: fila.motivo_perdida_id
      ? (db.motivos_perdida.find((m) => m.id === fila.motivo_perdida_id) ?? null)
      : null,
  }
}

function todasConRelaciones(db: BaseDatos): OportunidadConRelaciones[] {
  // `contactos!inner`: la consulta descartaba las oportunidades sin contacto.
  return db.oportunidades.filter((o) => db.contactos.some((c) => c.id === o.contacto_id)).map((o) => conRelacionesOportunidad(db, o))
}

// -----------------------------------------------------------------------------
// Consultas
// -----------------------------------------------------------------------------

export async function listar(filtros: FiltrosOportunidades = {}): Promise<OportunidadConRelaciones[]> {
  const ctx = await contextoFiltrosOportunidades(filtros)
  return aplicarFiltrosOportunidades(todasConRelaciones(leer()), filtros, ctx)
}

export async function listarTodo(filtros: FiltrosOportunidades = {}): Promise<OportunidadConRelaciones[]> {
  // Sin paginación: los mismos filtros que `listar` sobre todas las filas (criterio 7).
  return listar(filtros)
}

export async function listarPorContacto(contactoId: string): Promise<OportunidadConRelaciones[]> {
  const db = leer()
  const filas = todasConRelaciones(db)
    .filter((o) => o.contacto_id === contactoId)
    .sort((a, b) => porFechaDesc(a.created_at, b.created_at) || porTexto(a.id, b.id))
  return Promise.resolve(filas)
}

export async function obtener(id: string): Promise<OportunidadConRelaciones> {
  const db = leer()
  const fila = db.oportunidades.find((o) => o.id === id)
  if (!fila) throw new Error("La oportunidad no existe o fue eliminada.")
  return Promise.resolve(conRelacionesOportunidad(db, fila))
}

// -----------------------------------------------------------------------------
// Escrituras
// -----------------------------------------------------------------------------

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

/** Antes: trigger `registrar_historial_etapas`. El id era `generated always as identity`. */
function insertarHistorial(db: BaseDatos, fila: HistorialEtapaInsert): void {
  db.historial_etapas.push({
    id: siguienteIdHistorial(db.historial_etapas),
    oportunidad_id: fila.oportunidad_id,
    de_etapa_id: fila.de_etapa_id ?? null,
    a_etapa_id: fila.a_etapa_id ?? null,
    de_estado: fila.de_estado ?? null,
    a_estado: fila.a_estado,
    usuario_id: fila.usuario_id ?? null,
    created_at: fila.created_at ?? ahora(),
  })
}

/** Posición por defecto: negativa y monótona, así lo más reciente queda arriba. */
function posicionPorDefecto(): number {
  return -(Date.now() / 1000)
}

export async function crear(datos: OportunidadInsert): Promise<Oportunidad> {
  const momento = ahora()
  return Promise.resolve(
    escribir((db) => {
      const usuario = actor(db)
      const responsable = datos.responsable_id ?? usuario?.id ?? null
      if (!responsable) throw new ErrorRegla("Elige con qué usuario trabajas antes de guardar.")
      if (usuario) exigirReasignacion(usuario, usuario.id, responsable)
      if (!db.usuarios.some((u) => u.id === responsable)) {
        throw new ErrorRegla("El responsable elegido ya no existe.")
      }
      if (!db.contactos.some((c) => c.id === datos.contacto_id)) {
        throw new ErrorRegla("El contacto no existe o fue eliminado.")
      }
      if (!db.etapas.some((e) => e.id === datos.etapa_id)) {
        throw new ErrorRegla("La etapa no existe o está desactivada.")
      }

      const fila: Oportunidad = prepararOportunidadNueva(
        {
          id: datos.id ?? nuevoId(),
          contacto_id: datos.contacto_id,
          titulo: datos.titulo.trim(),
          importe: datos.importe ?? 0,
          moneda: datos.moneda ?? monedaActual(),
          etapa_id: datos.etapa_id,
          estado: datos.estado ?? "abierta",
          posicion: datos.posicion ?? posicionPorDefecto(),
          responsable_id: responsable,
          motivo_perdida_id: datos.motivo_perdida_id ?? null,
          detalle_perdida: datos.detalle_perdida ?? null,
          fecha_cierre_prevista: datos.fecha_cierre_prevista ?? null,
          ganada_at: datos.ganada_at ?? null,
          perdida_at: datos.perdida_at ?? null,
          created_by: datos.created_by ?? usuario?.id ?? null,
          created_at: datos.created_at ?? momento,
          updated_at: datos.updated_at ?? momento,
        },
        momento,
      )
      validarOportunidad(fila)

      db.oportunidades.push(fila)
      insertarHistorial(db, historialAlCrear(fila, usuario?.id ?? null, momento))
      return fila
    }),
  )
}

export async function actualizar(id: string, cambios: OportunidadUpdate): Promise<Oportunidad> {
  const momento = ahora()
  return Promise.resolve(
    escribir((db) => {
      const indice = db.oportunidades.findIndex((o) => o.id === id)
      if (indice < 0) throw new ErrorRegla("La oportunidad no existe o fue eliminada.")
      const anterior = db.oportunidades[indice]
      const usuario = actor(db)
      exigirPuedeEditar(usuario, anterior, "esta oportunidad")

      const fusionada = fusionar(anterior, cambios)
      fusionada.id = anterior.id
      fusionada.titulo = fusionada.titulo.trim()
      exigirReasignacion(usuario, anterior.responsable_id, fusionada.responsable_id)
      if (fusionada.etapa_id !== anterior.etapa_id) exigirEtapaActiva(db.etapas, fusionada.etapa_id)

      // Fechas de cierre, limpieza al reabrir y updated_at; después, el criterio 3.
      const siguiente = prepararOportunidadActualizada(anterior, fusionada, momento)
      validarOportunidad(siguiente)
      if (siguiente.motivo_perdida_id && !db.motivos_perdida.some((m) => m.id === siguiente.motivo_perdida_id)) {
        throw new ErrorRegla("El motivo de pérdida elegido ya no existe.")
      }

      db.oportunidades[indice] = siguiente
      const fila = historialAlActualizar(anterior, siguiente, usuario?.id ?? null, momento)
      if (fila) insertarHistorial(db, fila)
      return siguiente
    }),
  )
}

export async function eliminar(id: string): Promise<void> {
  const momento = ahora()
  escribir((db) => {
    const fila = db.oportunidades.find((o) => o.id === id)
    if (!fila) return
    exigirPuedeEditar(actor(db), fila, "esta oportunidad")

    // Antes lo hacían los `on delete cascade` / `on delete set null` de la migración.
    db.oportunidades = db.oportunidades.filter((o) => o.id !== id)
    db.historial_etapas = db.historial_etapas.filter((h) => h.oportunidad_id !== id)
    for (const t of db.tareas) {
      if (t.oportunidad_id === id) {
        t.oportunidad_id = null
        t.updated_at = momento
      }
    }
    for (const a of db.actividades) {
      if (a.oportunidad_id === id) a.oportunidad_id = null
    }
  })
  return Promise.resolve()
}

/**
 * Cambia de etapa y posición. Antes era la función `mover_oportunidad`: comprueba
 * que la etapa esté activa, respeta el permiso y deja la fila en el historial.
 */
export async function mover(id: string, etapaId: string, posicion: number): Promise<void> {
  const momento = ahora()
  escribir((db) => {
    exigirEtapaActiva(db.etapas, etapaId)
    const indice = db.oportunidades.findIndex((o) => o.id === id)
    if (indice < 0) throw new ErrorRegla("No puedes mover esta oportunidad: ya no existe.")
    const anterior = db.oportunidades[indice]
    exigirPuedeEditar(actor(db), anterior, "esta oportunidad")

    const siguiente = marcarActualizado(
      { ...anterior, etapa_id: etapaId, posicion: Number.isFinite(posicion) ? posicion : 0 },
      momento,
    )
    db.oportunidades[indice] = siguiente
    const fila = historialAlActualizar(anterior, siguiente, idUsuarioActual(), momento)
    if (fila) insertarHistorial(db, fila)
  })
  return Promise.resolve()
}

export async function ganar(id: string, importe: number): Promise<Oportunidad> {
  return actualizar(id, {
    estado: "ganada",
    importe,
    ganada_at: new Date().toISOString(),
    motivo_perdida_id: null,
    detalle_perdida: null,
    perdida_at: null,
  })
}

/** Perder exige motivo (criterio 3): lo comprueba `validarOportunidad` dentro de `actualizar`. */
export async function perder(id: string, motivoId: string, detalle?: string | null): Promise<Oportunidad> {
  if (!motivoId) throw new ErrorRegla("Elige un motivo de pérdida.")
  return actualizar(id, {
    estado: "perdida",
    motivo_perdida_id: motivoId,
    detalle_perdida: detalle?.trim() || null,
    perdida_at: new Date().toISOString(),
    ganada_at: null,
  })
}

export async function reabrir(id: string): Promise<Oportunidad> {
  const cambios: OportunidadUpdate = {
    estado: "abierta",
    motivo_perdida_id: null,
    detalle_perdida: null,
    ganada_at: null,
    perdida_at: null,
  }
  // Si su etapa fue desactivada mientras estaba cerrada, volvería invisible en el tablero: la reubicamos en la primera activa.
  const db = leer()
  const actual = db.oportunidades.find((o) => o.id === id) ?? null
  const etapasActivas = db.etapas.filter((e) => e.activa).sort((a, b) => a.orden - b.orden)
  const primeraActiva = etapasActivas[0]
  if (actual && primeraActiva && !etapasActivas.some((e) => e.id === actual.etapa_id)) {
    cambios.etapa_id = primeraActiva.id
  }
  return actualizar(id, cambios)
}

// -----------------------------------------------------------------------------
// Historial y recuentos
// -----------------------------------------------------------------------------

/** Historial de etapas de una oportunidad (para el detalle). */
export async function historial(oportunidadId: string): Promise<HistorialEtapa[]> {
  const filas = leer()
    .historial_etapas.filter((h) => h.oportunidad_id === oportunidadId)
    .sort((a, b) => porFechaAsc(a.created_at, b.created_at) || a.id - b.id)
  return Promise.resolve(filas)
}

/** Historial de etapas de un rango de fechas (para el embudo del panel). */
export async function historialEnRango(desdeIso: string, hastaIso: string): Promise<HistorialEtapa[]> {
  const filas = leer()
    .historial_etapas.filter((h) => h.created_at >= desdeIso && h.created_at <= hastaIso)
    .sort((a, b) => porFechaAsc(a.created_at, b.created_at) || a.id - b.id)
  return Promise.resolve(filas)
}

/** Cuenta oportunidades abiertas en una etapa (para impedir desactivarla). */
export async function contarAbiertasEnEtapa(etapaId: string): Promise<number> {
  const total = leer().oportunidades.filter((o) => o.etapa_id === etapaId && o.estado === "abierta").length
  return Promise.resolve(total)
}
