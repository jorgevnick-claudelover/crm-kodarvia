/**
 * Escritura en bloque de la importación. Antes esto lo garantizaba Postgres:
 * la transacción del lote, el trigger del historial y la restricción del criterio 3.
 * Ahora es código nuestro, así que se prueba aquí.
 */
import { beforeEach, describe, expect, it } from "vitest"
import { leer, reiniciar, suscribirse } from "@/lib/almacen"
import { ID_USUARIOS } from "@/lib/semilla"
import { CLAVE_USUARIO, entrarComo } from "@/lib/sesion"
import type { ContactoInsert, OportunidadInsert } from "@/lib/types"
import { insertarImportacion, nuevoId } from "./apiImportar"

const FECHA_HOJA = "2026-03-15T14:00:00.000Z"

function contacto(nombre: string, cambios: Partial<ContactoInsert> = {}): ContactoInsert {
  return {
    id: nuevoId(),
    nombre,
    responsable_id: ID_USUARIOS.rosa,
    importacion_id: "imp1",
    created_at: FECHA_HOJA,
    ...cambios,
  }
}

function oportunidad(contactoId: string, cambios: Partial<OportunidadInsert> = {}): OportunidadInsert {
  return {
    contacto_id: contactoId,
    titulo: "Facturación electrónica",
    etapa_id: leer().etapas[0].id,
    responsable_id: ID_USUARIOS.rosa,
    created_at: FECHA_HOJA,
    ...cambios,
  }
}

describe("insertarImportacion", () => {
  beforeEach(() => {
    window.localStorage.removeItem(CLAVE_USUARIO)
    reiniciar()
    entrarComo(ID_USUARIOS.rosa)
  })

  it("mete toda la hoja de una vez y avisa una sola vez", () => {
    const avisos: string[][] = []
    const cancelar = suscribirse((tablas) => avisos.push(tablas))
    const c1 = contacto("José Ramírez")
    const c2 = contacto("Ana Torres", { empresa: "Andina SAC" })
    const resumen = insertarImportacion([c1, c2], [oportunidad(c1.id ?? "")])
    cancelar()

    expect(resumen).toEqual({ contactos: 2, oportunidades: 1 })
    const db = leer()
    expect(db.contactos.map((c) => c.nombre)).toEqual(["José Ramírez", "Ana Torres"])
    expect(db.oportunidades).toHaveLength(1)
    // Una sola escritura: un solo aviso, con las tres tablas tocadas.
    expect(avisos).toHaveLength(1)
    expect(avisos[0].sort()).toEqual(["contactos", "historial_etapas", "oportunidades"])
  })

  it("la oportunidad ve al contacto creado en la misma llamada", () => {
    const c = contacto("Empresa Nueva SAC")
    insertarImportacion([c], [oportunidad(c.id ?? "", { importe: 2500 })])
    const db = leer()
    expect(db.oportunidades[0].contacto_id).toBe(db.contactos[0].id)
    expect(db.oportunidades[0].importe).toBe(2500)
  })

  it("cada oportunidad importada estrena su fila de historial", () => {
    const c1 = contacto("Uno")
    const c2 = contacto("Dos")
    insertarImportacion([c1, c2], [oportunidad(c1.id ?? ""), oportunidad(c2.id ?? "")])
    const db = leer()
    expect(db.historial_etapas).toHaveLength(2)
    for (const fila of db.historial_etapas) {
      expect(fila.de_etapa_id).toBeNull()
      expect(fila.de_estado).toBeNull()
      expect(fila.a_etapa_id).toBe(db.etapas[0].id)
      expect(fila.a_estado).toBe("abierta")
      expect(fila.usuario_id).toBe(ID_USUARIOS.rosa)
    }
    // Ids distintos y correlativos, como el identity de Postgres.
    expect(db.historial_etapas.map((h) => h.id)).toEqual([1, 2])
  })

  it("toda fila lleva fecha: la de la hoja si venía, la de ahora si no", () => {
    const conFecha = contacto("Con fecha")
    const sinFecha = contacto("Sin fecha", { created_at: undefined })
    insertarImportacion([conFecha, sinFecha], [])
    const db = leer()
    expect(db.contactos[0].created_at).toBe(FECHA_HOJA)
    expect(db.contactos[1].created_at).toBeTruthy()
    expect(new Date(db.contactos[1].created_at).getTime()).toBeGreaterThan(0)
    for (const c of db.contactos) expect(c.updated_at).toBeTruthy()
  })

  it("criterio 3: tampoco se importa una oportunidad perdida sin motivo", () => {
    const c = contacto("Perdido SAC")
    expect(() => insertarImportacion([c], [oportunidad(c.id ?? "", { estado: "perdida" })])).toThrow(
      /tienes que elegir el motivo/i,
    )
    // Y no queda nada a medias: la escritura era una sola.
    expect(leer().contactos).toEqual([])
    expect(leer().oportunidades).toEqual([])

    const motivo = leer().motivos_perdida[0]
    insertarImportacion([c], [oportunidad(c.id ?? "", { estado: "perdida", motivo_perdida_id: motivo.id })])
    const importada = leer().oportunidades[0]
    expect(importada.estado).toBe("perdida")
    expect(importada.perdida_at).toBeTruthy()
  })

  it("una oportunidad ya ganada conserva la fecha de la hoja", () => {
    const c = contacto("Ganado SAC")
    insertarImportacion([c], [oportunidad(c.id ?? "", { estado: "ganada", ganada_at: FECHA_HOJA })])
    expect(leer().oportunidades[0].ganada_at).toBe(FECHA_HOJA)
  })

  it("rechaza en español la etapa, el contacto o el responsable que no existen", () => {
    const c = contacto("Sin etapa")
    expect(() => insertarImportacion([c], [oportunidad(c.id ?? "", { etapa_id: "no-existe" })])).toThrow(
      /etapa que no existe/i,
    )
    expect(() => insertarImportacion([], [oportunidad("no-existe")])).toThrow(/contacto que no existe/i)
    expect(() => insertarImportacion([contacto("Huérfano", { responsable_id: "no-existe" })], [])).toThrow(
      /responsable de la importación ya no existe/i,
    )
    expect(leer().contactos).toEqual([])
  })

  it("las posiciones son distintas para que el tablero no las amontone", () => {
    const c = contacto("Varias")
    insertarImportacion(
      [c],
      [oportunidad(c.id ?? "", { titulo: "Una" }), oportunidad(c.id ?? "", { titulo: "Otra" })],
    )
    const [primera, segunda] = leer().oportunidades
    expect(primera.posicion).not.toBe(segunda.posicion)
    // La última importada queda por encima (posición más negativa), como en el tablero.
    expect(segunda.posicion).toBeLessThan(primera.posicion)
  })

  it("no escribe ni avisa cuando no hay nada que importar", () => {
    const avisos: string[][] = []
    const cancelar = suscribirse((tablas) => avisos.push(tablas))
    expect(insertarImportacion([], [])).toEqual({ contactos: 0, oportunidades: 0 })
    cancelar()
    expect(avisos).toEqual([])
  })
})
