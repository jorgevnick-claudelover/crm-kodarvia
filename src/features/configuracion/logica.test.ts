import { describe, expect, it } from "vitest"
import { importeDesdeTexto, mensajeEtapaConAbiertas, moverEnLista, nombreRepetido, validarValores, type ElementoCatalogo } from "./logica"

const elementos: ElementoCatalogo[] = [
  { id: "a", nombre: "Nuevo", orden: 1, activo: true },
  { id: "b", nombre: "Propuesta", orden: 2, activo: true },
  { id: "c", nombre: "Negociación", orden: 3, activo: false },
]

describe("moverEnLista", () => {
  it("sube un elemento una posición", () => {
    expect(moverEnLista(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"])
  })

  it("baja un elemento una posición", () => {
    expect(moverEnLista(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"])
  })

  it("no cambia nada en los extremos", () => {
    expect(moverEnLista(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"])
    expect(moverEnLista(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"])
  })
})

describe("nombreRepetido", () => {
  it("detecta repetidos sin tildes ni mayúsculas", () => {
    expect(nombreRepetido("negociacion", elementos)).toBe(true)
    expect(nombreRepetido("  NUEVO ", elementos)).toBe(true)
  })

  it("no cuenta el propio elemento al renombrar", () => {
    expect(nombreRepetido("Nuevo", elementos, "a")).toBe(false)
  })

  it("acepta nombres distintos", () => {
    expect(nombreRepetido("Cerrando", elementos)).toBe(false)
  })
})

describe("mensajeEtapaConAbiertas", () => {
  it("explica por qué no se puede desactivar, en singular y en plural", () => {
    expect(mensajeEtapaConAbiertas(1)).toContain("1 oportunidad abierta")
    expect(mensajeEtapaConAbiertas(4)).toContain("4 oportunidades abiertas")
  })
})

describe("validarValores", () => {
  const base = {
    nombre_empresa: "Estudio Quispe",
    moneda: "PEN",
    hora_recordatorio: "09:00",
    importe_default: "150.50",
    titulo_oportunidad_default: "Facturación electrónica",
    url_app: "https://crm.estudio.pe",
  }

  it("acepta valores correctos", () => {
    expect(validarValores(base)).toBeNull()
    expect(validarValores({ ...base, url_app: "" })).toBeNull()
  })

  it("acepta cualquier moneda de la lista y rechaza las de fuera", () => {
    expect(validarValores({ ...base, moneda: "USD" })).toBeNull()
    expect(validarValores({ ...base, moneda: "BOB" })).toBeNull()
    expect(validarValores({ ...base, moneda: "" })).toContain("moneda")
    expect(validarValores({ ...base, moneda: "XYZ" })).toContain("moneda")
  })

  it("exige nombre de empresa", () => {
    expect(validarValores({ ...base, nombre_empresa: "  " })).toContain("nombre de la empresa")
  })

  it("exige hora válida", () => {
    expect(validarValores({ ...base, hora_recordatorio: "25:00" })).toContain("HH:MM")
    expect(validarValores({ ...base, hora_recordatorio: "9:00" })).toContain("HH:MM")
  })

  it("rechaza importes negativos o no numéricos", () => {
    expect(validarValores({ ...base, importe_default: "-5" })).toContain("importe")
    expect(validarValores({ ...base, importe_default: "abc" })).toContain("importe")
  })

  it("exige que la URL empiece por http", () => {
    expect(validarValores({ ...base, url_app: "crm.estudio.pe" })).toContain("http")
  })
})

describe("importeDesdeTexto", () => {
  it("acepta separador de miles y descarta lo inválido", () => {
    expect(importeDesdeTexto("1,250.00")).toBe(1250)
    expect(importeDesdeTexto("abc")).toBe(0)
    expect(importeDesdeTexto("-3")).toBe(0)
  })
})
