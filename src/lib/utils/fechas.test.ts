import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  aLima,
  desdeLima,
  diasEntre,
  esVencida,
  etiquetaRelativa,
  finDeDiaLima,
  formatearFecha,
  formatearFechaHora,
  formatearHora,
  hoyLima,
  inicioDeMesLima,
  mesDeLima,
  partesLima,
  sumarDias,
} from "./fechas"

describe("fechas en America/Lima", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // 2026-09-12 03:30 UTC = 2026-09-11 22:30 en Lima
    vi.setSystemTime(new Date("2026-09-12T03:30:00Z"))
  })
  afterEach(() => vi.useRealTimers())

  it("desdeLima construye el instante UTC correcto (Lima = UTC-5)", () => {
    expect(desdeLima("2026-09-15", "09:00")).toBe("2026-09-15T14:00:00.000Z")
    expect(desdeLima("2026-09-15")).toBe("2026-09-15T05:00:00.000Z")
    expect(desdeLima("2026-09-15", "23:59:59")).toBe("2026-09-16T04:59:59.000Z")
  })

  it("finDeDiaLima termina justo antes de medianoche en Lima", () => {
    expect(finDeDiaLima("2026-09-15")).toBe("2026-09-16T04:59:59.999Z")
  })

  it("aLima devuelve la hora de pared de Lima", () => {
    const d = aLima("2026-09-15T14:00:00Z")
    expect(d.getHours()).toBe(9)
    expect(d.getDate()).toBe(15)
  })

  it("formatea en Lima", () => {
    expect(formatearFecha("2026-09-15T14:00:00Z")).toBe("15/09/2026")
    expect(formatearFechaHora("2026-09-15T14:00:00Z")).toBe("15/09/2026 09:00")
    expect(formatearHora("2026-09-15T14:00:00Z")).toBe("09:00")
    expect(formatearFecha("2026-09-16T03:30:00Z")).toBe("15/09/2026")
    expect(formatearFecha(null)).toBe("")
  })

  it("hoyLima respeta el cambio de día de Lima", () => {
    expect(hoyLima()).toBe("2026-09-11")
  })

  it("inicioDeMesLima y mesDeLima", () => {
    expect(inicioDeMesLima()).toBe("2026-09-01")
    expect(inicioDeMesLima("2026-10-01T03:00:00Z")).toBe("2026-09-01")
    expect(mesDeLima("2026-10-01T03:00:00Z")).toBe("2026-09")
    expect(mesDeLima("2026-10-01T06:00:00Z")).toBe("2026-10")
  })

  it("sumarDias sobre 'yyyy-MM-dd'", () => {
    expect(sumarDias("2026-09-30", 1)).toBe("2026-10-01")
    expect(sumarDias("2026-09-11", 7)).toBe("2026-09-18")
  })

  it("diasEntre cuenta días de calendario en Lima", () => {
    expect(diasEntre("2026-09-11T14:00:00Z", "2026-09-13T14:00:00Z")).toBe(2)
    expect(diasEntre("2026-09-13T14:00:00Z", "2026-09-11T14:00:00Z")).toBe(-2)
    expect(diasEntre("2026-09-11T14:00:00Z")).toBe(0)
  })

  it("esVencida", () => {
    expect(esVencida("2026-09-12T03:00:00Z")).toBe(true)
    expect(esVencida("2026-09-12T04:00:00Z")).toBe(false)
    expect(esVencida(null)).toBe(false)
  })

  it("etiquetaRelativa", () => {
    expect(etiquetaRelativa("2026-09-11T20:00:00Z")).toBe("Hoy")
    expect(etiquetaRelativa("2026-09-12T20:00:00Z")).toBe("Mañana")
    expect(etiquetaRelativa("2026-09-10T20:00:00Z")).toBe("Ayer")
    expect(etiquetaRelativa("2026-09-20T20:00:00Z")).toBe("20/09")
  })

  it("partesLima descompone para formularios", () => {
    expect(partesLima("2026-09-15T14:30:00Z")).toEqual({ fecha: "2026-09-15", hora: "09:30" })
  })
})
