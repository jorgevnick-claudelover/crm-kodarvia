import { beforeEach, describe, expect, it } from "vitest"
import type { ResultadoBusqueda } from "@/lib/types"
import { agregarReciente, agruparResultados, guardarReciente, leerRecientes, rutaResultado } from "./busqueda"

function r(tipo: ResultadoBusqueda["tipo"], id: string, contacto_id: string | null = null): ResultadoBusqueda {
  return { tipo, id, titulo: id, subtitulo: null, contacto_id, fecha: null }
}

describe("agruparResultados", () => {
  it("agrupa en orden fijo y omite grupos vacíos", () => {
    const grupos = agruparResultados([r("actividad", "a1", "c9"), r("contacto", "c1"), r("contacto", "c2"), r("tarea", "t1")])
    expect(grupos.map((g) => g.etiqueta)).toEqual(["Contactos", "Tareas", "Actividades"])
    expect(grupos[0].resultados.map((x) => x.id)).toEqual(["c1", "c2"])
  })
})

describe("rutaResultado", () => {
  it("cada tipo va a su página; las actividades a la ficha del contacto", () => {
    expect(rutaResultado(r("contacto", "c1"))).toBe("/contactos/c1")
    expect(rutaResultado(r("oportunidad", "o1"))).toBe("/oportunidades/o1")
    expect(rutaResultado(r("tarea", "t1"))).toBe("/tareas/t1")
    expect(rutaResultado(r("actividad", "a1", "c7"))).toBe("/contactos/c7")
    expect(rutaResultado(r("actividad", "a1", null))).toBe("/contactos")
  })
})

describe("recientes", () => {
  beforeEach(() => localStorage.clear())

  it("agregarReciente pone el término delante, sin duplicados y máximo 5", () => {
    let lista: string[] = []
    for (const t of ["ana", "beto", "carla", "dina", "elsa", "fer"]) lista = agregarReciente(lista, t)
    expect(lista).toEqual(["fer", "elsa", "dina", "carla", "beto"])
    expect(agregarReciente(lista, "Dina")).toEqual(["Dina", "fer", "elsa", "carla", "beto"])
    expect(agregarReciente(lista, "a")).toEqual(lista)
  })

  it("guardarReciente persiste en localStorage y leerRecientes lo recupera", () => {
    guardarReciente("juan")
    guardarReciente("  pérez  ")
    expect(leerRecientes()).toEqual(["pérez", "juan"])
  })

  it("leerRecientes tolera basura", () => {
    localStorage.setItem("crm.buscar.recientes", "{no es lista}")
    expect(leerRecientes()).toEqual([])
    localStorage.setItem("crm.buscar.recientes", JSON.stringify([1, "", "ok"]))
    expect(leerRecientes()).toEqual(["ok"])
  })
})
