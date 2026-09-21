/**
 * Datos iniciales del CRM cuando el navegador no tiene nada guardado.
 * Equivale a lo que sembraba la base de datos más cinco usuarios de ejemplo
 * (no hay autenticación: se entra eligiendo con quién trabajar).
 */
import type { BaseDatos } from "@/lib/almacen"
import type { Etapa, MotivoPerdida, Origen, Usuario } from "@/lib/types"

/** Versión del formato de `crm.datos`. Subir solo si cambia la forma de los datos. */
export const VERSION_DATOS = 1

/** Ids fijos: así la semilla es estable entre recargas y se puede referenciar en pruebas. */
export const ID_USUARIOS = {
  rosa: "8e1f6b2a-1000-4000-8000-000000000001",
  carlos: "8e1f6b2a-1000-4000-8000-000000000002",
  lucia: "8e1f6b2a-1000-4000-8000-000000000003",
  aldo: "8e1f6b2a-1000-4000-8000-000000000004",
  milagros: "8e1f6b2a-1000-4000-8000-000000000005",
} as const

function fechaSemilla(): string {
  return new Date().toISOString()
}

function usuario(id: string, nombre: string, email: string, rol: Usuario["rol"], creado: string): Usuario {
  return { id, nombre, email, rol, activo: true, created_at: creado, updated_at: creado }
}

/** Cinco usuarios de ejemplo del estudio contable: una administradora y cuatro miembros. */
export function usuariosSemilla(creado = fechaSemilla()): Usuario[] {
  return [
    usuario(ID_USUARIOS.rosa, "Rosa Quispe Ccahuana", "rosa.quispe@estudiocontable.pe", "admin", creado),
    usuario(ID_USUARIOS.carlos, "Carlos Mamani Huanca", "carlos.mamani@estudiocontable.pe", "miembro", creado),
    usuario(ID_USUARIOS.lucia, "Lucía Vargas Salazar", "lucia.vargas@estudiocontable.pe", "miembro", creado),
    usuario(ID_USUARIOS.aldo, "Aldo Ticona Apaza", "aldo.ticona@estudiocontable.pe", "miembro", creado),
    usuario(ID_USUARIOS.milagros, "Milagros Choque Ramos", "milagros.choque@estudiocontable.pe", "miembro", creado),
  ]
}

/** Etapas abiertas del embudo (ganada y perdida son estado, no etapa). */
export function etapasSemilla(creado = fechaSemilla()): Etapa[] {
  const filas: Array<[string, string, string]> = [
    ["1", "Nuevo contacto", "sky"],
    ["2", "Contactado", "indigo"],
    ["3", "Reunión", "violet"],
    ["4", "Propuesta enviada", "amber"],
    ["5", "Negociación", "orange"],
  ]
  return filas.map(([sufijo, nombre, color], i) => ({
    id: `3c9d4f18-2000-4000-8000-00000000000${sufijo}`,
    nombre,
    orden: i + 1,
    color,
    activa: true,
    created_at: creado,
    updated_at: creado,
  }))
}

export function motivosPerdidaSemilla(creado = fechaSemilla()): MotivoPerdida[] {
  const nombres = ["Precio", "Sin respuesta", "Eligió otro proveedor", "No lo necesita ahora", "Fuera de zona", "Otro"]
  return nombres.map((nombre, i) => ({
    id: `5b7e2a91-3000-4000-8000-00000000000${i + 1}`,
    nombre,
    orden: i + 1,
    activo: true,
    created_at: creado,
    updated_at: creado,
  }))
}

export function origenesSemilla(creado = fechaSemilla()): Origen[] {
  const nombres = ["Referido", "WhatsApp", "Redes sociales", "Web", "Llamada entrante", "Evento", "Otro"]
  return nombres.map((nombre, i) => ({
    id: `2d6c8f43-4000-4000-8000-00000000000${i + 1}`,
    nombre,
    orden: i + 1,
    activo: true,
    created_at: creado,
    updated_at: creado,
  }))
}

/** Configuración por defecto (mismas claves que `docs/ARQUITECTURA.md` sección 4). */
export function configuracionSemilla(): Record<string, unknown> {
  const url = typeof window === "undefined" ? "" : window.location.origin
  return {
    timezone: "America/Lima",
    moneda: "PEN",
    hora_recordatorio: "09:00",
    importe_default: 0,
    nombre_empresa: "Estudio contable",
    titulo_oportunidad_default: "Facturación electrónica",
    url_app: url,
  }
}

/** Base de datos recién sembrada: catálogos, configuración y usuarios de ejemplo; sin contactos. */
export function crearSemilla(): BaseDatos {
  const creado = fechaSemilla()
  return {
    version: VERSION_DATOS,
    usuarios: usuariosSemilla(creado),
    etapas: etapasSemilla(creado),
    motivos_perdida: motivosPerdidaSemilla(creado),
    origenes: origenesSemilla(creado),
    contactos: [],
    oportunidades: [],
    historial_etapas: [],
    tareas: [],
    actividades: [],
    importaciones: [],
    configuracion: configuracionSemilla(),
  }
}
