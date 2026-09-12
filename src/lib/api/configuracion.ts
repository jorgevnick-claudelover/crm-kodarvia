import { supabase } from "@/lib/supabase"
import type { ClaveConfiguracion, Json, ValoresConfiguracion } from "@/lib/types"
import { lanzarSi } from "./comun"

export const CONFIGURACION_DEFAULT: ValoresConfiguracion = {
  timezone: "America/Lima",
  moneda: "PEN",
  hora_recordatorio: "09:00",
  importe_default: 0,
  nombre_empresa: "Estudio contable",
  titulo_oportunidad_default: "Facturación electrónica",
  url_app: typeof window !== "undefined" ? window.location.origin : "",
}

function leer<K extends ClaveConfiguracion>(clave: K, valor: Json | undefined): ValoresConfiguracion[K] {
  const porDefecto = CONFIGURACION_DEFAULT[clave]
  if (valor === undefined || valor === null) return porDefecto
  if (typeof porDefecto === "number") {
    const n = typeof valor === "number" ? valor : Number(valor)
    return (Number.isFinite(n) ? n : porDefecto) as ValoresConfiguracion[K]
  }
  if (typeof valor === "string") return valor as ValoresConfiguracion[K]
  return String(valor) as ValoresConfiguracion[K]
}

/** Devuelve todas las claves conocidas, con valores por defecto si faltan. */
export async function obtenerTodo(): Promise<ValoresConfiguracion> {
  const { data, error } = await supabase.from("configuracion").select("*")
  lanzarSi(error, "No se pudo cargar la configuración")
  const mapa = new Map<string, Json>((data ?? []).map((f) => [f.clave, f.valor]))
  return {
    timezone: leer("timezone", mapa.get("timezone")),
    moneda: leer("moneda", mapa.get("moneda")),
    hora_recordatorio: leer("hora_recordatorio", mapa.get("hora_recordatorio")),
    importe_default: leer("importe_default", mapa.get("importe_default")),
    nombre_empresa: leer("nombre_empresa", mapa.get("nombre_empresa")),
    titulo_oportunidad_default: leer("titulo_oportunidad_default", mapa.get("titulo_oportunidad_default")),
    url_app: leer("url_app", mapa.get("url_app")),
  }
}

/** Guarda (upsert) una clave. Solo admin (RLS). */
export async function guardar<K extends ClaveConfiguracion>(clave: K, valor: ValoresConfiguracion[K]): Promise<void> {
  const { error } = await supabase.from("configuracion").upsert({ clave, valor }, { onConflict: "clave" })
  lanzarSi(error, "No se pudo guardar la configuración")
}

/** Guarda varias claves a la vez. */
export async function guardarVarias(valores: Partial<ValoresConfiguracion>): Promise<void> {
  const filas = (Object.keys(valores) as ClaveConfiguracion[])
    .filter((k) => valores[k] !== undefined)
    .map((k) => ({ clave: k, valor: valores[k] as Json }))
  if (filas.length === 0) return
  const { error } = await supabase.from("configuracion").upsert(filas, { onConflict: "clave" })
  lanzarSi(error, "No se pudo guardar la configuración")
}
