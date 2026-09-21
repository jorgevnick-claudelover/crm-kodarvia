/**
 * Tipos TypeScript de todas las tablas y enums del almacén local (src/lib/almacen.ts).
 * Los nombres de columnas son EXACTAMENTE los de docs/ARQUITECTURA.md sección 4.
 */

export type Json = string | number | boolean | null | { [clave: string]: Json | undefined } | Json[]

// ---------- Enums ----------
export type RolUsuario = "admin" | "miembro"
export type EstadoOportunidad = "abierta" | "ganada" | "perdida"
export type EstadoTarea = "pendiente" | "hecha"
export type TipoActividad = "llamada" | "whatsapp" | "correo" | "reunion" | "nota"
export type ResultadoActividad = "contesto" | "no_contesto" | "volver_a_llamar" | "interesado" | "no_interesado"
export type DocTipo = "DNI" | "RUC" | "CE"
export type ResultadoImportacion = "creado" | "fusionado" | "revisar"

export const TIPOS_ACTIVIDAD: readonly TipoActividad[] = ["llamada", "whatsapp", "correo", "reunion", "nota"]
export const RESULTADOS_ACTIVIDAD: readonly ResultadoActividad[] = [
  "contesto",
  "no_contesto",
  "volver_a_llamar",
  "interesado",
  "no_interesado",
]
export const ETIQUETA_TIPO_ACTIVIDAD: Record<TipoActividad, string> = {
  llamada: "Llamada",
  whatsapp: "WhatsApp",
  correo: "Correo",
  reunion: "Reunión",
  nota: "Nota",
}
export const ETIQUETA_RESULTADO_ACTIVIDAD: Record<ResultadoActividad, string> = {
  contesto: "Contestó",
  no_contesto: "No contestó",
  volver_a_llamar: "Volver a llamar",
  interesado: "Interesado",
  no_interesado: "No interesado",
}
export const ETIQUETA_ESTADO_OPORTUNIDAD: Record<EstadoOportunidad, string> = {
  abierta: "Abierta",
  ganada: "Ganada",
  perdida: "Perdida",
}

// ---------- usuarios ----------
export type Usuario = {
  id: string
  nombre: string
  email: string
  rol: RolUsuario
  activo: boolean
  created_at: string
  updated_at: string
}
export type UsuarioInsert = {
  id: string
  nombre: string
  email: string
  rol?: RolUsuario
  activo?: boolean
  created_at?: string
  updated_at?: string
}
export type UsuarioUpdate = Partial<UsuarioInsert>

// ---------- etapas ----------
export type Etapa = {
  id: string
  nombre: string
  orden: number
  color: string
  activa: boolean
  created_at: string
  updated_at: string
}
export type EtapaInsert = {
  id?: string
  nombre: string
  orden: number
  color?: string
  activa?: boolean
  created_at?: string
  updated_at?: string
}
export type EtapaUpdate = Partial<EtapaInsert>

// ---------- motivos_perdida ----------
export type MotivoPerdida = {
  id: string
  nombre: string
  orden: number
  activo: boolean
  created_at: string
  updated_at: string
}
export type MotivoPerdidaInsert = {
  id?: string
  nombre: string
  orden: number
  activo?: boolean
  created_at?: string
  updated_at?: string
}
export type MotivoPerdidaUpdate = Partial<MotivoPerdidaInsert>

// ---------- origenes ----------
export type Origen = {
  id: string
  nombre: string
  orden: number
  activo: boolean
  created_at: string
  updated_at: string
}
export type OrigenInsert = {
  id?: string
  nombre: string
  orden: number
  activo?: boolean
  created_at?: string
  updated_at?: string
}
export type OrigenUpdate = Partial<OrigenInsert>

// ---------- contactos ----------
export type Contacto = {
  id: string
  nombre: string
  empresa: string | null
  doc_tipo: DocTipo | null
  doc_numero: string | null
  telefono: string | null
  telefono_raw: string | null
  email: string | null
  direccion: string | null
  origen_id: string | null
  responsable_id: string
  notas: string | null
  extra: Json
  importacion_id: string | null
  fila_origen: number | null
  requiere_revision: boolean
  ultima_actividad_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}
export type ContactoInsert = {
  id?: string
  nombre: string
  empresa?: string | null
  doc_tipo?: DocTipo | null
  doc_numero?: string | null
  telefono?: string | null
  telefono_raw?: string | null
  email?: string | null
  direccion?: string | null
  origen_id?: string | null
  responsable_id?: string
  notas?: string | null
  extra?: Json
  importacion_id?: string | null
  fila_origen?: number | null
  requiere_revision?: boolean
  ultima_actividad_at?: string | null
  created_by?: string | null
  created_at?: string
  updated_at?: string
}
export type ContactoUpdate = Partial<ContactoInsert>

// ---------- oportunidades ----------
export type Oportunidad = {
  id: string
  contacto_id: string
  titulo: string
  importe: number
  moneda: string
  etapa_id: string
  estado: EstadoOportunidad
  posicion: number
  responsable_id: string
  motivo_perdida_id: string | null
  detalle_perdida: string | null
  fecha_cierre_prevista: string | null
  ganada_at: string | null
  perdida_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}
export type OportunidadInsert = {
  id?: string
  contacto_id: string
  titulo: string
  importe?: number
  moneda?: string
  etapa_id: string
  estado?: EstadoOportunidad
  posicion?: number
  responsable_id?: string
  motivo_perdida_id?: string | null
  detalle_perdida?: string | null
  fecha_cierre_prevista?: string | null
  ganada_at?: string | null
  perdida_at?: string | null
  created_by?: string | null
  created_at?: string
  updated_at?: string
}
export type OportunidadUpdate = Partial<OportunidadInsert>

// ---------- historial_etapas ----------
export type HistorialEtapa = {
  id: number
  oportunidad_id: string
  de_etapa_id: string | null
  a_etapa_id: string | null
  de_estado: string | null
  a_estado: string
  usuario_id: string | null
  created_at: string
}
export type HistorialEtapaInsert = {
  oportunidad_id: string
  de_etapa_id?: string | null
  a_etapa_id?: string | null
  de_estado?: string | null
  a_estado: string
  usuario_id?: string | null
  created_at?: string
}
export type HistorialEtapaUpdate = Partial<HistorialEtapaInsert>

// ---------- tareas ----------
export type Tarea = {
  id: string
  contacto_id: string | null
  oportunidad_id: string | null
  titulo: string
  vence_at: string
  recordatorio_at: string | null
  responsable_id: string
  estado: EstadoTarea
  hecha_at: string | null
  recordatorio_visto_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}
export type TareaInsert = {
  id?: string
  contacto_id?: string | null
  oportunidad_id?: string | null
  titulo: string
  vence_at: string
  recordatorio_at?: string | null
  responsable_id?: string
  estado?: EstadoTarea
  hecha_at?: string | null
  recordatorio_visto_at?: string | null
  created_by?: string | null
  created_at?: string
  updated_at?: string
}
export type TareaUpdate = Partial<TareaInsert>

// ---------- actividades ----------
export type Actividad = {
  id: string
  contacto_id: string
  oportunidad_id: string | null
  tipo: TipoActividad
  resultado: ResultadoActividad | null
  nota: string | null
  ocurrio_at: string
  usuario_id: string
  created_at: string
}
export type ActividadInsert = {
  id?: string
  contacto_id: string
  oportunidad_id?: string | null
  tipo: TipoActividad
  resultado?: ResultadoActividad | null
  nota?: string | null
  ocurrio_at?: string
  usuario_id?: string
  created_at?: string
}
export type ActividadUpdate = Partial<ActividadInsert>

// ---------- importaciones ----------
export type FilaInformeImportacion = {
  fila: number
  resultado: ResultadoImportacion
  motivo?: string
  contacto_id?: string
}
export type Importacion = {
  id: string
  archivo: string
  hoja: string | null
  mapeo: Json
  total_filas: number
  filas_no_vacias: number
  creadas: number
  fusionadas: number
  para_revisar: number
  informe: Json
  usuario_id: string
  created_at: string
}
export type ImportacionInsert = {
  id?: string
  archivo: string
  hoja?: string | null
  mapeo?: Json
  total_filas?: number
  filas_no_vacias?: number
  creadas?: number
  fusionadas?: number
  para_revisar?: number
  informe?: Json
  usuario_id?: string
  created_at?: string
}
export type ImportacionUpdate = Partial<ImportacionInsert>

// ---------- configuracion ----------
export type Configuracion = {
  clave: string
  valor: Json
  updated_at: string
}
export type ConfiguracionInsert = {
  clave: string
  valor: Json
  updated_at?: string
}
export type ConfiguracionUpdate = Partial<ConfiguracionInsert>

/** Claves conocidas de la tabla configuracion con su tipo. */
export type ValoresConfiguracion = {
  timezone: string
  moneda: string
  hora_recordatorio: string
  importe_default: number
  nombre_empresa: string
  titulo_oportunidad_default: string
  url_app: string
}
export type ClaveConfiguracion = keyof ValoresConfiguracion

// ---------- Tipos con relaciones (consultas con join) ----------
export type ContactoConRelaciones = Contacto & {
  origen: Origen | null
  responsable: Usuario | null
}
export type OportunidadConRelaciones = Oportunidad & {
  contacto: Contacto | null
  etapa: Etapa | null
  responsable: Usuario | null
  motivo_perdida: MotivoPerdida | null
}
export type TareaConRelaciones = Tarea & {
  contacto: Contacto | null
  oportunidad: Oportunidad | null
  responsable: Usuario | null
}
export type ActividadConRelaciones = Actividad & {
  usuario: Usuario | null
}

/** Fila que devuelve la búsqueda global (src/lib/api/buscar.ts). */
export type ResultadoBusqueda = {
  tipo: "contacto" | "oportunidad" | "tarea" | "actividad"
  id: string
  titulo: string
  subtitulo: string | null
  contacto_id: string | null
  fecha: string | null
}

// ---------- Nombres de tabla ----------

/**
 * Nombres de tabla usados como primer elemento de las claves de TanStack Query
 * y como tablas del almacén local (src/lib/almacen.ts, constante TABLAS).
 */
export type NombreTabla =
  | "usuarios"
  | "etapas"
  | "motivos_perdida"
  | "origenes"
  | "contactos"
  | "oportunidades"
  | "historial_etapas"
  | "tareas"
  | "actividades"
  | "importaciones"
  | "configuracion"
