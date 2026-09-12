import { describe, expect, it } from "vitest"
import type { Etapa } from "@/lib/types"
import {
  agruparPorEtapa,
  calcularPosicionDestino,
  ordenarTarjetas,
  posicionAlFinal,
  posicionEntre,
  siguienteEtapa,
  sumaImportes,
  tituloPorDefecto,
  validarPerdida,
} from "./logica"

const etapa = (id: string, orden: number): Etapa => ({
  id,
  nombre: `Etapa ${id}`,
  orden,
  color: "slate",
  activa: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
})

describe("posición fraccionaria", () => {
  it("entre dos vecinas es la media", () => {
    expect(posicionEntre(1, 2)).toBe(1.5)
    expect(posicionEntre(0, 10)).toBe(5)
  })
  it("sin vecina siguiente va después de la anterior", () => {
    expect(posicionEntre(3, null)).toBe(4)
  })
  it("sin vecina anterior va antes de la siguiente", () => {
    expect(posicionEntre(null, 3)).toBe(2)
  })
  it("en una columna vacía es 1", () => {
    expect(posicionEntre(null, null)).toBe(1)
    expect(posicionAlFinal([])).toBe(1)
  })
  it("al final es el máximo + 1, ignorando la propia tarjeta", () => {
    const col = [
      { id: "a", posicion: 1 },
      { id: "b", posicion: 5 },
    ]
    expect(posicionAlFinal(col)).toBe(6)
    expect(posicionAlFinal(col, "b")).toBe(2)
  })
})

describe("calcularPosicionDestino", () => {
  const columna = [
    { id: "a", posicion: 1 },
    { id: "b", posicion: 2 },
    { id: "c", posicion: 3 },
  ]
  it("desde otra columna, soltar sobre b la coloca entre a y b", () => {
    expect(calcularPosicionDestino(columna, "x", "b")).toBe(1.5)
  })
  it("desde otra columna, soltar sobre la primera la coloca antes", () => {
    expect(calcularPosicionDestino(columna, "x", "a")).toBe(0)
  })
  it("sin tarjeta debajo va al final", () => {
    expect(calcularPosicionDestino(columna, "x", null)).toBe(4)
  })
  it("misma columna: bajar a de arriba sobre c la coloca después de c", () => {
    expect(calcularPosicionDestino(columna, "a", "c")).toBe(4)
  })
  it("misma columna: subir c sobre a la coloca antes de a", () => {
    expect(calcularPosicionDestino(columna, "c", "a")).toBe(0)
  })
  it("misma columna: mover b sobre c queda entre c y el final", () => {
    expect(calcularPosicionDestino(columna, "b", "c")).toBe(4)
  })
  it("soltar sobre sí misma no cambia de sitio (al final de las demás)", () => {
    expect(calcularPosicionDestino(columna, "c", "c")).toBe(3)
  })
})

describe("suma y agrupación por columna", () => {
  it("suma importes con dos decimales e ignora valores raros", () => {
    expect(sumaImportes([{ importe: 100.1 }, { importe: 200.2 }, { importe: null }, { importe: Number.NaN }])).toBe(300.3)
    expect(sumaImportes([])).toBe(0)
  })
  it("agrupa por etapa en el orden de las etapas y ordena cada columna", () => {
    const etapas = [etapa("e1", 1), etapa("e2", 2)]
    const ops = [
      { id: "a", etapa_id: "e2", posicion: 2, created_at: "2026-01-02T00:00:00Z" },
      { id: "b", etapa_id: "e1", posicion: 5, created_at: "2026-01-02T00:00:00Z" },
      { id: "c", etapa_id: "e1", posicion: 1, created_at: "2026-01-02T00:00:00Z" },
      { id: "d", etapa_id: "inactiva", posicion: 1, created_at: "2026-01-02T00:00:00Z" },
    ]
    const mapa = agruparPorEtapa(ops, etapas)
    expect([...mapa.keys()]).toEqual(["e1", "e2"])
    expect(mapa.get("e1")?.map((o) => o.id)).toEqual(["c", "b"])
    expect(mapa.get("e2")?.map((o) => o.id)).toEqual(["a"])
  })
  it("a igual posición, la más reciente primero", () => {
    const lista = ordenarTarjetas([
      { id: "vieja", posicion: 0, created_at: "2026-01-01T00:00:00Z" },
      { id: "nueva", posicion: 0, created_at: "2026-02-01T00:00:00Z" },
    ])
    expect(lista.map((o) => o.id)).toEqual(["nueva", "vieja"])
  })
})

describe("otras reglas", () => {
  it("siguienteEtapa devuelve la siguiente o null en la última", () => {
    const etapas = [etapa("e1", 1), etapa("e2", 2)]
    expect(siguienteEtapa(etapas, "e1")?.id).toBe("e2")
    expect(siguienteEtapa(etapas, "e2")).toBeNull()
    expect(siguienteEtapa(etapas, "zzz")).toBeNull()
  })
  it("título por defecto une contacto y título configurado", () => {
    expect(tituloPorDefecto("Juan Pérez", "Facturación electrónica")).toBe("Juan Pérez – Facturación electrónica")
    expect(tituloPorDefecto("", "Facturación electrónica")).toBe("Facturación electrónica")
  })
  it("perder exige motivo", () => {
    expect(validarPerdida("")).toEqual({ ok: false, error: "Elige un motivo de pérdida." })
    expect(validarPerdida(null).ok).toBe(false)
    expect(validarPerdida("motivo-1").ok).toBe(true)
  })
})
