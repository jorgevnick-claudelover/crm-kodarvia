/**
 * Reglas de negocio que antes vivían en Postgres (triggers y restricciones de
 * en migraciones SQL). Son funciones puras: la capa de datos
 * (`src/lib/api/*`) las llama dentro de `escribir()` antes de tocar el almacén.
 *
 * Ninguna regla se ha perdido por el camino:
 *  - perder exige motivo (criterio 3)          -> validarOportunidad
 *  - ganada_at / perdida_at y limpieza al reabrir -> prepararOportunidad*
 *  - historial de etapas y estados             -> historialAl*
 *  - última actividad del contacto             -> ultimaActividad
 *  - updated_at en cada modificación           -> marcarActualizado
 *  - permisos (antes RLS)                      -> puedeEditar / exigir*
 */
import { ahora } from "@/lib/almacen"
import type { Actividad, Etapa, HistorialEtapa, HistorialEtapaInsert, Oportunidad, Tarea, Usuario } from "@/lib/types"

/** Error de regla de negocio: siempre con mensaje en español listo para el toast. */
export class ErrorRegla extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = "ErrorRegla"
  }
}

// -----------------------------------------------------------------------------
// Permisos (antes RLS, docs/ARQUITECTURA.md sección 6)
// -----------------------------------------------------------------------------

/** Registro con dueño: `responsable_id` (contactos, oportunidades, tareas) o `usuario_id` (actividades). */
export interface RegistroConDueno {
  responsable_id?: string | null
  usuario_id?: string | null
}

export function esAdmin(usuario: Usuario | null | undefined): boolean {
  return !!usuario && usuario.rol === "admin" && usuario.activo
}

/** Todos leen todo; edita quien es el responsable del registro, o el administrador. */
export function puedeEditar(usuario: Usuario | null | undefined, registro: RegistroConDueno): boolean {
  if (!usuario || !usuario.activo) return false
  if (esAdmin(usuario)) return true
  const dueno = registro.responsable_id ?? registro.usuario_id ?? null
  return dueno !== null && dueno === usuario.id
}

export function exigirPuedeEditar(
  usuario: Usuario | null | undefined,
  registro: RegistroConDueno,
  que = "este registro",
): void {
  if (!puedeEditar(usuario, registro)) {
    throw new ErrorRegla(`No puedes editar ${que}: no eres su responsable. Pídeselo a quien lo lleva o al administrador.`)
  }
}

/** Solo el administrador importa, configura catálogos y gestiona usuarios. */
export function exigirAdmin(usuario: Usuario | null | undefined, accion = "hacer esto"): void {
  if (!esAdmin(usuario)) throw new ErrorRegla(`Solo el administrador puede ${accion}.`)
}

/** Antes: trigger `proteger_reasignacion`. Solo el administrador cambia el responsable. */
export function exigirReasignacion(
  usuario: Usuario | null | undefined,
  responsableAnterior: string,
  responsableNuevo: string,
): void {
  if (responsableAnterior === responsableNuevo) return
  if (!esAdmin(usuario)) throw new ErrorRegla("Solo el administrador puede reasignar el responsable.")
}

/**
 * Antes: trigger `proteger_usuario`. Un miembro solo cambia su nombre; rol, estado
 * y correo los cambia el administrador, y siempre debe quedar un administrador activo.
 */
export function validarCambioUsuario(
  actor: Usuario | null | undefined,
  anterior: Usuario,
  siguiente: Usuario,
  todos: readonly Usuario[],
): void {
  if (anterior.id !== siguiente.id) throw new ErrorRegla("No se puede cambiar el identificador de un usuario.")
  if (!esAdmin(actor)) {
    if (siguiente.rol !== anterior.rol || siguiente.activo !== anterior.activo || siguiente.email !== anterior.email) {
      throw new ErrorRegla("Solo el administrador puede cambiar el rol, el estado o el correo de un usuario.")
    }
    if (actor?.id !== anterior.id) throw new ErrorRegla("Solo puedes cambiar tus propios datos.")
  }
  const eraAdmin = anterior.rol === "admin" && anterior.activo
  const sigueAdmin = siguiente.rol === "admin" && siguiente.activo
  if (eraAdmin && !sigueAdmin) {
    const quedaOtro = todos.some((u) => u.id !== anterior.id && u.rol === "admin" && u.activo)
    if (!quedaOtro) throw new ErrorRegla("Debe quedar al menos un administrador activo.")
  }
}

// -----------------------------------------------------------------------------
// updated_at (antes: trigger set_updated_at en todas las tablas)
// -----------------------------------------------------------------------------

export function marcarActualizado<T extends { updated_at: string }>(fila: T, momento = ahora()): T {
  return { ...fila, updated_at: momento }
}

// -----------------------------------------------------------------------------
// Oportunidades: estado, fechas de cierre y motivo de pérdida
// -----------------------------------------------------------------------------

/**
 * Criterio 3 y restricciones `oportunidades_*` de la migración:
 * perdida ⇔ tiene motivo; ganada exige `ganada_at`; perdida exige `perdida_at`.
 */
export function validarOportunidad(
  fila: Pick<Oportunidad, "estado" | "motivo_perdida_id" | "ganada_at" | "perdida_at">,
): void {
  const tieneMotivo = fila.motivo_perdida_id != null
  if (fila.estado === "perdida" && !tieneMotivo) {
    throw new ErrorRegla("Para dar una oportunidad por perdida tienes que elegir el motivo.")
  }
  if (fila.estado !== "perdida" && tieneMotivo) {
    throw new ErrorRegla("Solo las oportunidades perdidas llevan motivo de pérdida.")
  }
  if (fila.estado === "ganada" && !fila.ganada_at) {
    throw new ErrorRegla("Una oportunidad ganada necesita la fecha en que se ganó.")
  }
  if (fila.estado === "perdida" && !fila.perdida_at) {
    throw new ErrorRegla("Una oportunidad perdida necesita la fecha en que se perdió.")
  }
}

/** Antes: `preparar_cambio_estado` en INSERT. Completa las fechas de cierre que falten. */
export function prepararOportunidadNueva(fila: Oportunidad, momento = ahora()): Oportunidad {
  const nueva = { ...fila }
  if (nueva.estado === "ganada") nueva.ganada_at = nueva.ganada_at ?? momento
  else if (nueva.estado === "perdida") nueva.perdida_at = nueva.perdida_at ?? momento
  return nueva
}

/**
 * Antes: `preparar_cambio_estado` en UPDATE. Al ganar o perder fija la fecha
 * correspondiente; al reabrir limpia motivo, detalle y ambas fechas. Además
 * mantiene `updated_at`.
 */
export function prepararOportunidadActualizada(
  anterior: Oportunidad,
  siguiente: Oportunidad,
  momento = ahora(),
): Oportunidad {
  const nueva = marcarActualizado(siguiente, momento)
  if (nueva.estado === anterior.estado) return nueva
  if (nueva.estado === "ganada") {
    nueva.ganada_at = nueva.ganada_at ?? momento
    nueva.perdida_at = null
    nueva.motivo_perdida_id = null
    nueva.detalle_perdida = null
  } else if (nueva.estado === "perdida") {
    nueva.perdida_at = nueva.perdida_at ?? momento
    nueva.ganada_at = null
  } else {
    nueva.motivo_perdida_id = null
    nueva.detalle_perdida = null
    nueva.ganada_at = null
    nueva.perdida_at = null
  }
  return nueva
}

/** Antes: `mover_oportunidad` comprobaba que la etapa existiera y estuviera activa. */
export function exigirEtapaActiva(etapas: readonly Etapa[], etapaId: string): Etapa {
  const etapa = etapas.find((e) => e.id === etapaId)
  if (!etapa || !etapa.activa) throw new ErrorRegla("La etapa no existe o está desactivada.")
  return etapa
}

// -----------------------------------------------------------------------------
// Historial de etapas (base del embudo del panel)
// -----------------------------------------------------------------------------

/** El id es autonumérico: la capa de datos pide el siguiente antes de insertar. */
export function siguienteIdHistorial(filas: readonly HistorialEtapa[]): number {
  let maximo = 0
  for (const fila of filas) if (fila.id > maximo) maximo = fila.id
  return maximo + 1
}

/** Fila inicial del historial al crear la oportunidad (antes: trigger AFTER INSERT). */
export function historialAlCrear(
  fila: Oportunidad,
  usuarioId: string | null,
  momento = ahora(),
): HistorialEtapaInsert {
  return {
    oportunidad_id: fila.id,
    de_etapa_id: null,
    a_etapa_id: fila.etapa_id,
    de_estado: null,
    a_estado: fila.estado,
    usuario_id: usuarioId,
    created_at: momento,
  }
}

/** Fila del historial cuando cambian etapa o estado (antes: trigger AFTER UPDATE). Null si no cambió nada. */
export function historialAlActualizar(
  anterior: Oportunidad,
  siguiente: Oportunidad,
  usuarioId: string | null,
  momento = ahora(),
): HistorialEtapaInsert | null {
  if (anterior.etapa_id === siguiente.etapa_id && anterior.estado === siguiente.estado) return null
  return {
    oportunidad_id: siguiente.id,
    de_etapa_id: anterior.etapa_id,
    a_etapa_id: siguiente.etapa_id,
    de_estado: anterior.estado,
    a_estado: siguiente.estado,
    usuario_id: usuarioId,
    created_at: momento,
  }
}

// -----------------------------------------------------------------------------
// Actividades y tareas
// -----------------------------------------------------------------------------

/**
 * Antes: trigger `actualizar_ultima_actividad`. Devuelve el `ultima_actividad_at`
 * que le toca al contacto: la actividad más reciente, o null si no le queda ninguna.
 */
export function ultimaActividad(actividades: readonly Actividad[], contactoId: string): string | null {
  let maximo: string | null = null
  for (const a of actividades) {
    if (a.contacto_id !== contactoId) continue
    if (maximo === null || a.ocurrio_at > maximo) maximo = a.ocurrio_at
  }
  return maximo
}

/**
 * Coherencia de la tarea al guardarla: al marcarla hecha se fija `hecha_at`, al
 * devolverla a pendiente se limpia. Con `anterior` null se trata como alta.
 * (En Postgres lo hacía la app; aquí queda escrito junto al resto de reglas.)
 */
export function prepararTarea(anterior: Tarea | null, siguiente: Tarea, momento = ahora()): Tarea {
  const nueva = anterior ? marcarActualizado(siguiente, momento) : { ...siguiente }
  if (nueva.estado === "hecha") nueva.hecha_at = nueva.hecha_at ?? momento
  else nueva.hecha_at = null
  return nueva
}
