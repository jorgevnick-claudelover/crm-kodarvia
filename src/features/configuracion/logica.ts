/** Lógica pura de la configuración: orden de catálogos, duplicados y validación de valores. */
import { normalizarTexto } from "@/lib/utils/texto"

export interface ElementoCatalogo {
  id: string
  nombre: string
  orden: number
  activo: boolean
  /** Solo etapas. */
  color?: string
}

/** Devuelve la lista con el elemento del índice movido una posición (-1 arriba, 1 abajo). */
export function moverEnLista<T>(lista: readonly T[], indice: number, direccion: -1 | 1): T[] {
  const destino = indice + direccion
  if (indice < 0 || indice >= lista.length || destino < 0 || destino >= lista.length) return [...lista]
  const copia = [...lista]
  const [elemento] = copia.splice(indice, 1)
  copia.splice(destino, 0, elemento)
  return copia
}

/** true si ya existe otro elemento con ese nombre (sin tildes ni mayúsculas). */
export function nombreRepetido(nombre: string, existentes: readonly ElementoCatalogo[], excluirId?: string): boolean {
  const buscado = normalizarTexto(nombre)
  if (!buscado) return false
  return existentes.some((e) => e.id !== excluirId && normalizarTexto(e.nombre) === buscado)
}

/** Explicación de por qué no se puede desactivar una etapa con oportunidades abiertas. */
export function mensajeEtapaConAbiertas(n: number): string {
  const cuantas = n === 1 ? "1 oportunidad abierta" : `${n} oportunidades abiertas`
  return `No se puede desactivar: tiene ${cuantas}. Muévelas a otra etapa (o márcalas como ganadas o perdidas) y vuelve a intentarlo.`
}

export interface ValoresFormulario {
  nombre_empresa: string
  hora_recordatorio: string
  importe_default: string
  titulo_oportunidad_default: string
  url_app: string
}

/** Devuelve el primer error de los valores o null si todo está bien. */
export function validarValores(v: ValoresFormulario): string | null {
  if (!v.nombre_empresa.trim()) return "Escribe el nombre de la empresa."
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v.hora_recordatorio)) return "La hora del recordatorio debe tener el formato HH:MM (por ejemplo 09:00)."
  const importe = Number(String(v.importe_default).replace(/,/g, "").trim())
  if (!Number.isFinite(importe) || importe < 0) return "El importe por defecto debe ser un número mayor o igual que cero."
  if (!v.titulo_oportunidad_default.trim()) return "Escribe el título de oportunidad por defecto."
  if (v.url_app.trim() && !/^https?:\/\/.+/.test(v.url_app.trim())) return "La URL de la app debe empezar por http:// o https://."
  return null
}

/** Normaliza el importe escrito a número (acepta comas de miles). */
export function importeDesdeTexto(texto: string): number {
  const n = Number(String(texto).replace(/,/g, "").trim())
  return Number.isFinite(n) && n >= 0 ? n : 0
}
