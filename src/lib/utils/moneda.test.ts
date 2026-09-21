import { afterEach, describe, expect, it } from "vitest"
import {
  MONEDAS,
  MONEDA_DEFAULT,
  etiquetaMoneda,
  fijarMoneda,
  formatearImporte,
  formatearNumero,
  importeParaCSV,
  monedaActual,
  parsearImporte,
  simboloActual,
  simboloDe,
  suscribirMoneda,
} from "./moneda"

afterEach(() => {
  fijarMoneda(MONEDA_DEFAULT)
})

describe("moneda", () => {
  it("formatea con el símbolo de la moneda activa (soles por defecto) y miles con coma", () => {
    expect(simboloActual()).toBe("S/")
    expect(formatearImporte(1250)).toBe("S/ 1,250.00")
    expect(formatearImporte(0)).toBe("S/ 0.00")
    expect(formatearImporte(1234567.891)).toBe("S/ 1,234,567.89")
    expect(formatearImporte(-50)).toBe("S/ -50.00")
    expect(formatearImporte(null)).toBe("S/ 0.00")
  })
  it("formatearNumero sin decimales", () => {
    expect(formatearNumero(12345, 0)).toBe("12,345")
  })
  it("importeParaCSV sin símbolo con punto decimal, cambie la moneda o no", () => {
    expect(importeParaCSV(1250)).toBe("1250.00")
    expect(importeParaCSV(undefined)).toBe("0.00")
    fijarMoneda("USD")
    expect(importeParaCSV(1250)).toBe("1250.00")
    expect(importeParaCSV(0.5)).toBe("0.50")
  })
  it("parsearImporte acepta lo que escribe la gente, con cualquier símbolo", () => {
    expect(parsearImporte("S/ 1,250.00")).toBe(1250)
    expect(parsearImporte("$ 1,250.00")).toBe(1250)
    expect(parsearImporte("€ 12,5")).toBe(12.5)
    expect(parsearImporte("Bs 300")).toBe(300)
    expect(parsearImporte("1250")).toBe(1250)
    expect(parsearImporte("1.250,50")).toBe(1250.5)
    expect(parsearImporte("12.5")).toBe(12.5)
    expect(parsearImporte("")).toBe(0)
    expect(parsearImporte("abc")).toBe(0)
    expect(parsearImporte(99.999)).toBe(99.999)
  })
})

describe("elegir moneda", () => {
  it("la lista trae las ocho monedas con código, símbolo y nombre", () => {
    const codigos = MONEDAS.map((m) => m.codigo)
    expect(codigos).toContain("PEN")
    expect(codigos).toContain("USD")
    expect(codigos).toContain("EUR")
    expect(codigos).toContain("BOB")
    for (const m of MONEDAS) {
      expect(m.simbolo.length).toBeGreaterThan(0)
      expect(m.nombre.length).toBeGreaterThan(0)
    }
  })
  it("cambiar de moneda cambia el formato de los importes", () => {
    fijarMoneda("USD")
    expect(monedaActual()).toBe("USD")
    expect(formatearImporte(1250)).toBe("$ 1,250.00")
    fijarMoneda("EUR")
    expect(formatearImporte(1250)).toBe("€ 1,250.00")
    fijarMoneda("BOB")
    expect(formatearImporte(1250)).toBe("Bs 1,250.00")
  })
  it("un símbolo pasado a mano gana sobre la moneda activa", () => {
    fijarMoneda("USD")
    expect(formatearImporte(10, "S/")).toBe("S/ 10.00")
  })
  it("un código desconocido no rompe: se usa el propio código como símbolo", () => {
    fijarMoneda("XYZ")
    expect(monedaActual()).toBe("XYZ")
    expect(simboloActual()).toBe("XYZ")
    expect(formatearImporte(1250)).toBe("XYZ 1,250.00")
    expect(simboloDe("QQQ")).toBe("QQQ")
    expect(etiquetaMoneda("QQQ")).toBe("QQQ")
  })
  it("sin código vuelve a la moneda por defecto", () => {
    fijarMoneda("USD")
    fijarMoneda("")
    expect(monedaActual()).toBe(MONEDA_DEFAULT)
    expect(formatearImporte(1250)).toBe("S/ 1,250.00")
  })
  it("etiquetaMoneda se lee como en Configuración", () => {
    expect(etiquetaMoneda("PEN")).toBe("PEN — soles (S/)")
    expect(etiquetaMoneda("usd")).toBe("USD — dólares ($)")
  })
  it("avisa a quien se suscribe y deja de avisar al soltarse", () => {
    let avisos = 0
    const soltar = suscribirMoneda(() => {
      avisos += 1
    })
    fijarMoneda("USD")
    expect(avisos).toBe(1)
    fijarMoneda("USD")
    expect(avisos).toBe(1)
    soltar()
    fijarMoneda("EUR")
    expect(avisos).toBe(1)
  })
})
