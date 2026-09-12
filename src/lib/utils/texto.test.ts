import { describe, expect, it } from "vitest"
import { iniciales, similitud, sinTildes } from "./texto"

describe("texto", () => {
  it("sinTildes", () => {
    expect(sinTildes("Facturación electrónica ñ")).toBe("Facturacion electronica n")
  })
  it("iniciales", () => {
    expect(iniciales("Juan Pérez")).toBe("JP")
    expect(iniciales("Ana")).toBe("A")
    expect(iniciales("María del Carmen López")).toBe("ML")
    expect(iniciales("")).toBe("?")
  })
  it("similitud para mapear columnas", () => {
    expect(similitud("Teléfono", "telefono")).toBe(1)
    expect(similitud("Telefono celular", "telefono")).toBeGreaterThanOrEqual(0.8)
    expect(similitud("Nombre", "Nombres")).toBeGreaterThan(0.8)
    expect(similitud("Empresa", "Correo")).toBeLessThan(0.5)
    expect(similitud("", "x")).toBe(0)
  })
})
