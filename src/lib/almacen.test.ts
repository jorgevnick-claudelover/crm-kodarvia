/**
 * Contrato del almacén local: semilla, escritura, detección de tablas tocadas,
 * avisos a los suscriptores, copia de seguridad y datos dañados.
 * Las reglas de negocio puras se prueban en src/lib/reglas.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  CLAVE_DATOS,
  TABLAS,
  escribir,
  exportarTodo,
  importarTodo,
  leer,
  nuevoId,
  reiniciar,
  suscribirse,
  tamanoAproximado,
} from "@/lib/almacen"

describe("almacén local", () => {
  beforeEach(() => {
    reiniciar()
  })

  it("siembra catálogos, configuración y cinco usuarios cuando no hay nada guardado", () => {
    const db = leer()
    expect(db.usuarios).toHaveLength(5)
    expect(db.usuarios.filter((u) => u.rol === "admin")).toHaveLength(1)
    expect(db.etapas.map((e) => e.nombre)).toEqual([
      "Nuevo contacto",
      "Contactado",
      "Reunión",
      "Propuesta enviada",
      "Negociación",
    ])
    expect(db.motivos_perdida).toHaveLength(6)
    expect(db.origenes).toHaveLength(7)
    expect(db.configuracion.timezone).toBe("America/Lima")
    expect(db.contactos).toEqual([])
    expect(localStorage.getItem(CLAVE_DATOS)).toBeTruthy()
  })

  it("escribe, devuelve lo que devuelve el mutador y avisa solo de las tablas tocadas", () => {
    const avisos: string[][] = []
    const cancelar = suscribirse((tablas) => avisos.push(tablas))
    const id = escribir((db) => {
      const nuevo = { ...db.etapas[0], id: nuevoId(), nombre: "Seguimiento", orden: 9 }
      db.etapas = [...db.etapas, nuevo]
      return nuevo.id
    })
    cancelar()
    expect(leer().etapas.find((e) => e.id === id)?.nombre).toBe("Seguimiento")
    expect(avisos).toEqual([["etapas"]])
  })

  it("detecta también los cambios hechos fila a fila", () => {
    const avisos: string[][] = []
    const cancelar = suscribirse((tablas) => avisos.push(tablas))
    escribir((db) => {
      db.usuarios[0].nombre = "Rosa Quispe C."
    })
    cancelar()
    expect(avisos).toEqual([["usuarios"]])
    expect(leer().usuarios[0].nombre).toBe("Rosa Quispe C.")
  })

  it("no avisa cuando el mutador no cambia nada", () => {
    const avisos: string[][] = []
    const cancelar = suscribirse((tablas) => avisos.push(tablas))
    escribir((db) => db.usuarios.length)
    cancelar()
    expect(avisos).toEqual([])
  })

  it("exporta e importa una copia de seguridad completa", () => {
    escribir((db) => {
      db.configuracion = { ...db.configuracion, nombre_empresa: "Gestoría Arequipa" }
    })
    const copia = exportarTodo()
    reiniciar()
    expect(leer().configuracion.nombre_empresa).toBe("Estudio contable")
    importarTodo(copia)
    expect(leer().configuracion.nombre_empresa).toBe("Gestoría Arequipa")
    for (const tabla of TABLAS) expect(leer()[tabla]).toBeDefined()
  })

  it("rechaza una copia de seguridad ilegible con mensaje en español", () => {
    expect(() => importarTodo("esto no es json")).toThrow(/copia de seguridad/i)
  })

  it("vuelve a sembrar si el JSON guardado está dañado", () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => undefined)
    localStorage.setItem(CLAVE_DATOS, "{roto")
    // La caché en memoria sigue viva; se fuerza una relectura desde localStorage.
    window.dispatchEvent(new StorageEvent("storage", { key: CLAVE_DATOS, newValue: "{roto" }))
    expect(leer().usuarios).toHaveLength(5)
    expect(consola).toHaveBeenCalled()
    consola.mockRestore()
  })

  it("informa del espacio ocupado", () => {
    const { bytes, porcentaje } = tamanoAproximado()
    expect(bytes).toBeGreaterThan(0)
    expect(porcentaje).toBeGreaterThanOrEqual(0)
    expect(porcentaje).toBeLessThan(80)
  })

  it("deja de avisar a quien cancela la suscripción", () => {
    const avisos: string[][] = []
    const cancelar = suscribirse((tablas) => avisos.push(tablas))
    escribir((db) => {
      db.configuracion = { ...db.configuracion, nombre_empresa: "Gestoría Arequipa" }
    })
    cancelar()
    escribir((db) => {
      db.configuracion = { ...db.configuracion, nombre_empresa: "Otra" }
    })
    expect(avisos).toEqual([["configuracion"]])
  })

  it("si el mutador lanza no se guarda nada ni se avisa", () => {
    const antes = exportarTodo()
    const avisos: string[][] = []
    const cancelar = suscribirse((tablas) => avisos.push(tablas))
    expect(() =>
      escribir((db) => {
        db.configuracion = { ...db.configuracion, nombre_empresa: "A medias" }
        throw new Error("algo salió mal a mitad de la escritura")
      }),
    ).toThrow(/a mitad de la escritura/)
    cancelar()
    expect(leer().configuracion.nombre_empresa).toBe("Estudio contable")
    expect(exportarTodo()).toBe(antes)
    expect(avisos).toEqual([])
  })

  it("recoge lo que guardó otra pestaña y avisa solo de esa tabla", () => {
    const avisos: string[][] = []
    const cancelar = suscribirse((tablas) => avisos.push(tablas))
    const copia = JSON.parse(exportarTodo()) as Record<string, unknown>
    copia.origenes = []
    window.dispatchEvent(new StorageEvent("storage", { key: CLAVE_DATOS, newValue: JSON.stringify(copia) }))
    cancelar()
    expect(avisos).toEqual([["origenes"]])
    expect(leer().origenes).toEqual([])
    expect(leer().etapas).toHaveLength(5)
  })

  it("reiniciar borra los datos de ejemplo y avisa de todas las tablas", () => {
    escribir((db) => {
      db.configuracion = { ...db.configuracion, nombre_empresa: "Gestoría Arequipa" }
    })
    const avisos: string[][] = []
    const cancelar = suscribirse((tablas) => avisos.push(tablas))
    reiniciar()
    cancelar()
    expect(avisos).toEqual([[...TABLAS]])
    expect(leer().configuracion.nombre_empresa).toBe("Estudio contable")
  })

  it("al arrancar con un JSON dañado avisa por consola y siembra de nuevo", async () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => undefined)
    localStorage.setItem(CLAVE_DATOS, "{esto no es json")
    // Módulo recién cargado: es la situación real, abrir la app con los datos rotos.
    vi.resetModules()
    const almacenNuevo = await import("@/lib/almacen")
    expect(almacenNuevo.leer().usuarios).toHaveLength(5)
    expect(almacenNuevo.leer().etapas).toHaveLength(5)
    expect(consola).toHaveBeenCalled()
    // Y lo sembrado queda guardado, no solo en memoria.
    expect(JSON.parse(localStorage.getItem(CLAVE_DATOS) ?? "{}").usuarios).toHaveLength(5)
    consola.mockRestore()
  })
})
