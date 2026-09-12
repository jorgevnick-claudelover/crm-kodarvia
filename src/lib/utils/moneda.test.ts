import { describe, expect, it } from "vitest"
import { formatearImporte, formatearNumero, importeParaCSV, parsearImporte } from "./moneda"

describe("moneda", () => {
  it("formatea con S/ y miles con coma", () => {
    expect(formatearImporte(1250)).toBe("S/ 1,250.00")
    expect(formatearImporte(0)).toBe("S/ 0.00")
    expect(formatearImporte(1234567.891)).toBe("S/ 1,234,567.89")
    expect(formatearImporte(-50)).toBe("S/ -50.00")
    expect(formatearImporte(null)).toBe("S/ 0.00")
  })
  it("formatearNumero sin decimales", () => {
    expect(formatearNumero(12345, 0)).toBe("12,345")
  })
  it("importeParaCSV sin símbolo con punto decimal", () => {
    expect(importeParaCSV(1250)).toBe("1250.00")
    expect(importeParaCSV(undefined)).toBe("0.00")
  })
  it("parsearImporte acepta lo que escribe la gente", () => {
    expect(parsearImporte("S/ 1,250.00")).toBe(1250)
    expect(parsearImporte("1250")).toBe(1250)
    expect(parsearImporte("1.250,50")).toBe(1250.5)
    expect(parsearImporte("12.5")).toBe(12.5)
    expect(parsearImporte("")).toBe(0)
    expect(parsearImporte("abc")).toBe(0)
    expect(parsearImporte(99.999)).toBe(99.999)
  })
})
