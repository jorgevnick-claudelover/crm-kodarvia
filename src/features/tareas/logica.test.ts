import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Tarea } from "@/lib/types"
import {
  agruparParaHoy,
  agruparPorDia,
  calcularRecordatorioAt,
  calcularVenceAt,
  contarVencidas,
  fechaPorDefecto,
  filaExportacionTarea,
  proximosAvisos,
  tituloPorDefecto,
} from "./logica"

function tarea(parcial: Partial<Tarea> & { id: string; vence_at: string }): Tarea {
  return {
    contacto_id: null,
    oportunidad_id: null,
    titulo: `Tarea ${parcial.id}`,
    recordatorio_at: parcial.vence_at,
    responsable_id: "u1",
    estado: "pendiente",
    hecha_at: null,
    recordatorio_visto_at: null,
    created_by: "u1",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...parcial,
  }
}

describe("título por defecto", () => {
  it("usa el nombre del contacto", () => {
    expect(tituloPorDefecto("Juan Pérez")).toBe("Llamar a Juan Pérez")
    expect(tituloPorDefecto("  Ana  ")).toBe("Llamar a Ana")
  })
  it("queda vacío sin contacto", () => {
    expect(tituloPorDefecto(null)).toBe("")
    expect(tituloPorDefecto(undefined)).toBe("")
    expect(tituloPorDefecto("   ")).toBe("")
  })
})

describe("recordatorio: fecha + hora de Lima a UTC", () => {
  it("convierte 09:00 de Lima a 14:00 UTC", () => {
    expect(calcularVenceAt("2026-09-15", "09:00")).toBe("2026-09-15T14:00:00.000Z")
  })
  it("cruza la medianoche UTC", () => {
    expect(calcularVenceAt("2026-09-15", "20:30")).toBe("2026-09-16T01:30:00.000Z")
  })
  it("sin hora usa medianoche de Lima", () => {
    expect(calcularVenceAt("2026-09-15", "")).toBe("2026-09-15T05:00:00.000Z")
  })
  it("recordatorio_at = vence_at si avisa; null si no", () => {
    const vence = calcularVenceAt("2026-09-15", "09:00")
    expect(calcularRecordatorioAt(vence, true)).toBe(vence)
    expect(calcularRecordatorioAt(vence, false)).toBeNull()
  })
  it("fecha por defecto: hoy si la hora no pasó, mañana si ya pasó", () => {
    expect(fechaPorDefecto("09:00", "2026-09-15", "08:30")).toBe("2026-09-15")
    expect(fechaPorDefecto("09:00", "2026-09-15", "09:00")).toBe("2026-09-16")
    expect(fechaPorDefecto("09:00", "2026-09-15", "17:45")).toBe("2026-09-16")
  })
})

describe("agrupación Vencidas / Hoy / Próximos 7 días", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // 2026-09-15 15:00 UTC = 10:00 en Lima
    vi.setSystemTime(new Date("2026-09-15T15:00:00Z"))
  })
  afterEach(() => vi.useRealTimers())

  it("reparte en vencidas (hora pasada), hoy y próximos 7 días, ordenando por hora", () => {
    const lista = [
      tarea({ id: "hoy-tarde", vence_at: "2026-09-15T21:00:00Z" }), // hoy 16:00 Lima
      tarea({ id: "ayer", vence_at: "2026-09-15T03:00:00Z" }), // 14/09 22:00 Lima
      tarea({ id: "hoy-manana", vence_at: "2026-09-15T13:00:00Z" }), // hoy 08:00 Lima (ya pasó)
      tarea({ id: "en-7", vence_at: "2026-09-22T14:00:00Z" }), // 22/09
      tarea({ id: "en-8", vence_at: "2026-09-23T14:00:00Z" }), // fuera del horizonte
      tarea({ id: "manana", vence_at: "2026-09-16T14:00:00Z" }),
      tarea({ id: "hecha", vence_at: "2026-09-10T14:00:00Z", estado: "hecha" }),
    ]
    const g = agruparParaHoy(lista)
    expect(g.vencidas.map((t) => t.id)).toEqual(["ayer", "hoy-manana"])
    expect(g.hoy.map((t) => t.id)).toEqual(["hoy-tarde"])
    expect(g.proximos.map((t) => t.id)).toEqual(["manana", "en-7"])
  })

  it("respeta el cambio de día de Lima (23:30 de hoy sigue siendo hoy)", () => {
    const g = agruparParaHoy([tarea({ id: "noche", vence_at: "2026-09-16T04:30:00Z" })])
    expect(g.hoy.map((t) => t.id)).toEqual(["noche"])
    expect(g.proximos).toEqual([])
  })

  it("cuenta como vencidas las pendientes cuya hora ya pasó", () => {
    const lista = [
      tarea({ id: "a", vence_at: "2026-09-15T13:00:00Z" }),
      tarea({ id: "b", vence_at: "2026-09-15T21:00:00Z" }),
      tarea({ id: "c", vence_at: "2026-09-10T13:00:00Z", estado: "hecha" }),
    ]
    expect(contarVencidas(lista)).toBe(1)
  })

  it("agrupa por día conservando el orden", () => {
    const lista = [
      tarea({ id: "1", vence_at: "2026-09-15T13:00:00Z" }),
      tarea({ id: "2", vence_at: "2026-09-15T21:00:00Z" }),
      tarea({ id: "3", vence_at: "2026-09-16T04:30:00Z" }), // 15/09 23:30 Lima
      tarea({ id: "4", vence_at: "2026-09-16T14:00:00Z" }),
    ]
    const grupos = agruparPorDia(lista)
    expect(grupos.map((g) => g.dia)).toEqual(["2026-09-15", "2026-09-16"])
    expect(grupos[0].tareas.map((t) => t.id)).toEqual(["1", "2", "3"])
    expect(grupos[1].tareas.map((t) => t.id)).toEqual(["4"])
  })
})

describe("avisos locales", () => {
  it("programa solo los recordatorios futuros no vistos dentro del horizonte", () => {
    const ahora = new Date("2026-09-15T15:00:00Z").getTime()
    const lista = [
      tarea({ id: "en-20s", vence_at: "2026-09-15T15:00:20Z" }),
      tarea({ id: "pasado", vence_at: "2026-09-15T14:59:00Z" }),
      tarea({ id: "visto", vence_at: "2026-09-15T15:00:10Z", recordatorio_visto_at: "2026-09-15T14:00:00Z" }),
      tarea({ id: "sin-aviso", vence_at: "2026-09-15T15:00:10Z", recordatorio_at: null }),
      tarea({ id: "en-5s", vence_at: "2026-09-15T15:00:05Z" }),
      tarea({ id: "lejos", vence_at: "2026-09-16T15:00:00Z" }),
      tarea({ id: "hecha", vence_at: "2026-09-15T15:00:05Z", estado: "hecha" }),
    ]
    expect(proximosAvisos(lista, ahora, 30_000)).toEqual([
      { id: "en-5s", retrasoMs: 5_000 },
      { id: "en-20s", retrasoMs: 20_000 },
    ])
  })
})

describe("exportación", () => {
  it("genera nombres legibles y fechas en Lima", () => {
    const fila = filaExportacionTarea({
      ...tarea({ id: "x", vence_at: "2026-09-15T14:00:00Z", estado: "hecha", hecha_at: "2026-09-15T16:05:00Z" }),
      contacto: null,
      oportunidad: null,
      responsable: { id: "u1", nombre: "Rosa", email: "r@x.pe", rol: "miembro", activo: true, created_at: "", updated_at: "" },
    })
    expect(fila).toEqual({
      titulo: "Tarea x",
      contacto: "",
      oportunidad: "",
      vence: "15/09/2026 09:00",
      recordatorio: "15/09/2026 09:00",
      responsable: "Rosa",
      estado: "Hecha",
      hecha_el: "15/09/2026 11:05",
    })
  })
})
