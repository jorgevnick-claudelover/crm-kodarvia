import { describe, expect, it } from "vitest"
import { enlaceWhatsApp, esCelularPE, formatearTelefono, normalizarTelefonoPE } from "./telefono"

describe("normalizarTelefonoPE", () => {
  it("celular de 9 dígitos que empieza por 9", () => {
    expect(normalizarTelefonoPE("987654321")).toBe("+51987654321")
    expect(normalizarTelefonoPE("987 654 321")).toBe("+51987654321")
    expect(normalizarTelefonoPE("987-654-321")).toBe("+51987654321")
  })
  it("con prefijo 51, +51 y 0051", () => {
    expect(normalizarTelefonoPE("51987654321")).toBe("+51987654321")
    expect(normalizarTelefonoPE("+51 987 654 321")).toBe("+51987654321")
    expect(normalizarTelefonoPE("0051987654321")).toBe("+51987654321")
    expect(normalizarTelefonoPE("+51 (054) 123456")).toBe("+5154123456")
  })
  it("fijos con código de área", () => {
    expect(normalizarTelefonoPE("054 123456")).toBe("+5154123456")
    expect(normalizarTelefonoPE("54123456")).toBe("+5154123456")
    expect(normalizarTelefonoPE("(054) 123-456")).toBe("+5154123456")
    expect(normalizarTelefonoPE("01 1234567")).toBe("+5111234567")
    expect(normalizarTelefonoPE("11234567")).toBe("+5111234567")
  })
  it("devuelve null si no se reconoce", () => {
    expect(normalizarTelefonoPE("")).toBeNull()
    expect(normalizarTelefonoPE(null)).toBeNull()
    expect(normalizarTelefonoPE("12345")).toBeNull()
    expect(normalizarTelefonoPE("123456")).toBeNull()
    expect(normalizarTelefonoPE("887654321")).toBeNull()
    expect(normalizarTelefonoPE("abc")).toBeNull()
    expect(normalizarTelefonoPE("+34 600 000 000")).toBeNull()
  })
})

describe("formatearTelefono", () => {
  it("celular en grupos de 3", () => {
    expect(formatearTelefono("+51987654321")).toBe("987 654 321")
  })
  it("fijos con paréntesis", () => {
    expect(formatearTelefono("+5154123456")).toBe("(054) 123 456")
    expect(formatearTelefono("+5111234567")).toBe("(01) 123 4567")
  })
  it("deja tal cual lo que no es peruano", () => {
    expect(formatearTelefono("+34600000000")).toBe("+34600000000")
    expect(formatearTelefono("")).toBe("")
  })
})

describe("enlaceWhatsApp", () => {
  it("usa wa.me sin el signo +", () => {
    expect(enlaceWhatsApp("+51987654321")).toBe("https://wa.me/51987654321")
    expect(enlaceWhatsApp("987 654 321")).toBe("https://wa.me/51987654321")
  })
  it("añade mensaje codificado", () => {
    expect(enlaceWhatsApp("+51987654321", "Hola Juan")).toBe("https://wa.me/51987654321?text=Hola%20Juan")
  })
  it("null sin teléfono", () => {
    expect(enlaceWhatsApp("")).toBeNull()
  })
})

describe("esCelularPE", () => {
  it("distingue celular de fijo", () => {
    expect(esCelularPE("+51987654321")).toBe(true)
    expect(esCelularPE("+5154123456")).toBe(false)
  })
})
