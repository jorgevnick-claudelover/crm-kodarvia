/**
 * CSV para Excel en Windows/Mac: UTF-8 con BOM, separador coma, CRLF, todo entre
 * comillas (comillas dobladas) y celdas que empiezan por = + - @ con apóstrofo delante.
 */
import { formatInTimeZone } from "date-fns-tz"
import { ZONA } from "./fechas"

export interface ColumnaCSV {
  clave: string
  titulo: string
}

export const BOM = "\uFEFF"

function aTexto(valor: unknown): string {
  if (valor == null) return ""
  if (typeof valor === "string") return valor
  if (typeof valor === "number" || typeof valor === "boolean" || typeof valor === "bigint") return String(valor)
  if (valor instanceof Date) return formatInTimeZone(valor, ZONA, "dd/MM/yyyy HH:mm")
  return JSON.stringify(valor)
}

/** Escapa una celda: apóstrofo anti-fórmula, comillas dobladas y todo entre comillas. */
export function escaparCeldaCSV(valor: unknown): string {
  let texto = aTexto(valor)
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`
  return `"${texto.replace(/"/g, '""')}"`
}

export function generarCSV(filas: Record<string, unknown>[], columnas: ColumnaCSV[]): string {
  const cabecera = columnas.map((c) => escaparCeldaCSV(c.titulo)).join(",")
  const lineas = filas.map((fila) => columnas.map((c) => escaparCeldaCSV(fila[c.clave])).join(","))
  return BOM + [cabecera, ...lineas].join("\r\n") + "\r\n"
}

function esMovilAhora(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia?.("(max-width: 767px)").matches || "ontouchstart" in window
}

/**
 * Descarga el CSV. En celular, si el navegador permite compartir archivos, abre la hoja
 * de compartir (WhatsApp, Drive, correo); si no, usa <a download>.
 */
export async function descargarCSV(nombre: string, contenido: string): Promise<void> {
  const nombreArchivo = nombre.endsWith(".csv") ? nombre : `${nombre}.csv`
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8" })

  if (esMovilAhora() && typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      const archivo = new File([blob], nombreArchivo, { type: "text/csv" })
      if (typeof navigator.canShare !== "function" || navigator.canShare({ files: [archivo] })) {
        await navigator.share({ files: [archivo], title: nombreArchivo })
        return
      }
    } catch (e) {
      // Si el usuario cancela, no descargamos; cualquier otro fallo cae al <a download>.
      if (e instanceof Error && e.name === "AbortError") return
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nombreArchivo
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function hayFiltros(filtros: Record<string, unknown> | undefined): boolean {
  if (!filtros) return false
  return Object.values(filtros).some((v) => v !== undefined && v !== null && v !== "" && v !== false)
}

/** 'oportunidades_2026-09-12_1530.csv' (hora de Lima); añade '_filtrado' si hay filtros activos. */
export function nombreArchivoExportacion(entidad: string, filtros?: Record<string, unknown>, ahora: Date = new Date()): string {
  const sello = formatInTimeZone(ahora, ZONA, "yyyy-MM-dd_HHmm")
  const sufijo = hayFiltros(filtros) ? "_filtrado" : ""
  return `${entidad}_${sello}${sufijo}.csv`
}
