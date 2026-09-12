import { describe, expect, it } from "vitest"
import { escaparCeldaCSV, generarCSV, nombreArchivoExportacion } from "./csv"

describe("generarCSV", () => {
  const columnas = [
    { clave: "nombre", titulo: "Nombre" },
    { clave: "importe", titulo: "Importe" },
  ]

  it("empieza con BOM y separa con CRLF", () => {
    const csv = generarCSV([{ nombre: "Juan", importe: 10 }], columnas)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toBe('﻿"Nombre","Importe"\r\n"Juan","10"\r\n')
  })

  it("dobla las comillas y entrecomilla todo", () => {
    const csv = generarCSV([{ nombre: 'Estudio "Los Andes"', importe: "1,250.00" }], columnas)
    expect(csv).toContain('"Estudio ""Los Andes""","1,250.00"')
  })

  it("protege celdas que parecen fórmulas", () => {
    expect(escaparCeldaCSV("=SUMA(A1)")).toBe("\"'=SUMA(A1)\"")
    expect(escaparCeldaCSV("+51987")).toBe("\"'+51987\"")
    expect(escaparCeldaCSV("-5")).toBe("\"'-5\"")
    expect(escaparCeldaCSV("@juan")).toBe("\"'@juan\"")
  })

  it("nulos y undefined como celda vacía; objetos como JSON", () => {
    const csv = generarCSV([{ nombre: null, importe: undefined }, { nombre: { a: 1 }, importe: true }], columnas)
    expect(csv).toContain('"",""')
    expect(csv).toContain('"{""a"":1}","true"')
  })

  it("conserva saltos de línea dentro de la celda", () => {
    const csv = generarCSV([{ nombre: "línea 1\nlínea 2", importe: 0 }], columnas)
    expect(csv).toContain('"línea 1\nlínea 2","0"')
  })
})

describe("nombreArchivoExportacion", () => {
  it("usa fecha y hora de Lima", () => {
    // 2026-09-12 20:30 UTC = 15:30 en Lima
    const ahora = new Date("2026-09-12T20:30:00Z")
    expect(nombreArchivoExportacion("oportunidades", undefined, ahora)).toBe("oportunidades_2026-09-12_1530.csv")
  })
  it("marca cuando hay filtros", () => {
    const ahora = new Date("2026-09-12T20:30:00Z")
    expect(nombreArchivoExportacion("contactos", { texto: "juan" }, ahora)).toBe("contactos_2026-09-12_1530_filtrado.csv")
    expect(nombreArchivoExportacion("contactos", { texto: "", sinSeguimiento: false }, ahora)).toBe("contactos_2026-09-12_1530.csv")
  })
})
