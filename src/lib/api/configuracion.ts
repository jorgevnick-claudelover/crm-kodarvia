/**
 * Configuración del estudio (pares clave/valor) sobre el almacén local.
 * Todos la leen; solo el administrador la cambia (antes RLS, ahora `exigirAdmin`).
 */
import { escribir, leer } from "@/lib/almacen"
import { fijarMoneda } from "@/lib/utils/moneda"
import { exigirAdmin } from "@/lib/reglas"
import { usuarioActual } from "@/lib/sesion"
import type { ClaveConfiguracion, Json, ValoresConfiguracion } from "@/lib/types"

export const CONFIGURACION_DEFAULT: ValoresConfiguracion = {
  timezone: "America/Lima",
  moneda: "PEN",
  hora_recordatorio: "09:00",
  importe_default: 0,
  nombre_empresa: "Estudio contable",
  titulo_oportunidad_default: "Facturación electrónica",
  url_app: typeof window !== "undefined" ? window.location.origin : "",
}

/** Valor guardado para una clave, o el valor por defecto si falta o no sirve. */
function valorDe<K extends ClaveConfiguracion>(clave: K, valor: unknown): ValoresConfiguracion[K] {
  const porDefecto = CONFIGURACION_DEFAULT[clave]
  if (valor === undefined || valor === null) return porDefecto
  if (typeof porDefecto === "number") {
    const n = typeof valor === "number" ? valor : Number(valor)
    return (Number.isFinite(n) ? n : porDefecto) as ValoresConfiguracion[K]
  }
  if (typeof valor === "string") return valor as ValoresConfiguracion[K]
  return String(valor) as ValoresConfiguracion[K]
}

/**
 * Lee la configuración del almacén sin promesas y deja fijada la moneda activa.
 * Es el único sitio donde se aplica: así no hay dos fuentes de verdad ni carrera entre
 * la primera pintada y la lectura (el almacén es localStorage, se lee al instante).
 */
export function obtenerTodoSync(): ValoresConfiguracion {
  const guardada = leer().configuracion
  const valores: ValoresConfiguracion = {
    timezone: valorDe("timezone", guardada.timezone),
    moneda: valorDe("moneda", guardada.moneda),
    hora_recordatorio: valorDe("hora_recordatorio", guardada.hora_recordatorio),
    importe_default: valorDe("importe_default", guardada.importe_default),
    nombre_empresa: valorDe("nombre_empresa", guardada.nombre_empresa),
    titulo_oportunidad_default: valorDe("titulo_oportunidad_default", guardada.titulo_oportunidad_default),
    url_app: valorDe("url_app", guardada.url_app),
  }
  fijarMoneda(valores.moneda)
  return valores
}

/** Devuelve todas las claves conocidas, con valores por defecto si faltan. */
export async function obtenerTodo(): Promise<ValoresConfiguracion> {
  return obtenerTodoSync()
}

/**
 * Deja fijada la moneda guardada antes de la primera pintada (la llama `main.tsx`).
 * Sin esto se vería un instante el símbolo por defecto y luego el bueno.
 */
export function aplicarMonedaGuardada(): void {
  obtenerTodoSync()
}

/** Guarda una clave. Solo administrador. */
export async function guardar<K extends ClaveConfiguracion>(clave: K, valor: ValoresConfiguracion[K]): Promise<void> {
  await guardarVarias({ [clave]: valor } as Partial<ValoresConfiguracion>)
}

/** Guarda varias claves a la vez. Solo administrador. */
export async function guardarVarias(valores: Partial<ValoresConfiguracion>): Promise<void> {
  const claves = (Object.keys(valores) as ClaveConfiguracion[]).filter((k) => valores[k] !== undefined)
  if (claves.length === 0) return
  exigirAdmin(usuarioActual(), "cambiar la configuración")
  escribir((db) => {
    for (const clave of claves) db.configuracion[clave] = valores[clave] as Json
  })
  if (valores.moneda !== undefined) fijarMoneda(valores.moneda)
}
