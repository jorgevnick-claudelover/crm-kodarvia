/**
 * Lee .xlsx, .xls y .csv en el navegador (SheetJS para Excel, papaparse para CSV)
 * y devuelve las hojas como matrices de celdas para mapeo.ts.
 */
import * as XLSX from "xlsx"
import Papa from "papaparse"
import type { Celda, FilaHoja, HojaLeida } from "./mapeo"

export const EXTENSIONES_ACEPTADAS = ".xlsx,.xls,.csv"
export const TAMANO_MAXIMO_BYTES = 15 * 1024 * 1024

function esCelda(v: unknown): v is Celda {
  return v == null || typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v instanceof Date
}

function aFila(fila: unknown[]): FilaHoja {
  return fila.map((c) => (esCelda(c) ? c : String(c)))
}

/** Hojas de un libro de SheetJS ya leído (también sirve en Node para los tests). */
export function hojasDesdeLibro(libro: XLSX.WorkBook): HojaLeida[] {
  return libro.SheetNames.map((nombre) => {
    const hoja = libro.Sheets[nombre]
    const filas = hoja ? (XLSX.utils.sheet_to_json(hoja, { header: 1, raw: true, defval: null, blankrows: true }) as unknown[][]) : []
    return { nombre, filas: filas.map(aFila) }
  })
}

/** Hojas a partir de texto CSV (una sola hoja llamada como el archivo). */
export function hojasDesdeCSV(texto: string, nombreHoja = "CSV"): HojaLeida[] {
  const resultado = Papa.parse<string[]>(texto, { skipEmptyLines: false, dynamicTyping: false })
  const filas = resultado.data.map((fila) => fila.map((c) => (typeof c === "string" ? c : c == null ? null : String(c))))
  // papaparse añade una última fila vacía si el archivo termina en salto de línea.
  while (filas.length > 0 && filas[filas.length - 1].every((c) => !c)) filas.pop()
  return [{ nombre: nombreHoja, filas }]
}

export function extensionDe(nombre: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(nombre)
  return m ? m[1].toLowerCase() : ""
}

/** Lee el archivo elegido por el usuario. Lanza Error con mensaje en español. */
export async function leerArchivo(archivo: File): Promise<HojaLeida[]> {
  const ext = extensionDe(archivo.name)
  if (!["xlsx", "xls", "csv"].includes(ext)) throw new Error("Solo se aceptan archivos .xlsx, .xls o .csv.")
  if (archivo.size > TAMANO_MAXIMO_BYTES) throw new Error("El archivo es muy grande (máximo 15 MB).")
  if (ext === "csv") {
    const texto = await archivo.text()
    return hojasDesdeCSV(texto.replace(/^﻿/, ""), archivo.name.replace(/\.csv$/i, ""))
  }
  const buffer = await archivo.arrayBuffer()
  let libro: XLSX.WorkBook
  try {
    libro = XLSX.read(buffer, { type: "array", cellDates: false })
  } catch {
    throw new Error("No se pudo leer el archivo de Excel. Guárdalo de nuevo como .xlsx e inténtalo otra vez.")
  }
  const hojas = hojasDesdeLibro(libro)
  if (hojas.length === 0) throw new Error("El archivo no tiene hojas.")
  return hojas
}
