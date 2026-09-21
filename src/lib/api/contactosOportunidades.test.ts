import { beforeEach, describe, expect, it } from "vitest"
import { leer, reiniciar } from "@/lib/almacen"
import { ID_USUARIOS } from "@/lib/semilla"
import { CLAVE_USUARIO, entrarComo } from "@/lib/sesion"
import { MONEDA_DEFAULT, fijarMoneda } from "@/lib/utils/moneda"
import * as contactos from "./contactos"
import * as oportunidades from "./oportunidades"
import * as tablero from "./oportunidadesTablero"
import { buscar } from "./buscar"
import { listarPagina } from "./contactosPagina"

describe("contactos y oportunidades sobre el almacén local", () => {
  beforeEach(() => {
    window.localStorage.removeItem(CLAVE_USUARIO)
    reiniciar()
    entrarComo(ID_USUARIOS.rosa)
  })

  it("crea, busca sin tildes y deduplica", async () => {
    await contactos.crear({ nombre: "José Ramírez", empresa: "Andina SAC", telefono: "954 123 456", doc_numero: "12345678" })
    expect((await contactos.listar({ texto: "jose ram" })).length).toBe(1)
    expect((await contactos.listar({ texto: "RAMIREZ" })).length).toBe(1)
    expect((await contactos.buscarRapido("123 456")).length).toBe(1)
    expect((await contactos.posiblesDuplicados({ nombre: "jose ramirez" })).length).toBe(1)
    const pag = await listarPagina({ texto: "jose" }, 0, 50)
    expect(pag.total).toBe(1)
    expect((await buscar("ramirez"))[0].tipo).toBe("contacto")
  })

  it("criterio 3: no se pierde sin motivo, ni por la puerta de atrás", async () => {
    const c = await contactos.crear({ nombre: "Ana Torres" })
    const etapa = leer().etapas[0]
    const o = await oportunidades.crear({ contacto_id: c.id, titulo: "Renta anual", etapa_id: etapa.id })
    await expect(oportunidades.perder(o.id, "")).rejects.toThrow(/motivo/i)
    await expect(oportunidades.actualizar(o.id, { estado: "perdida" })).rejects.toThrow(/motivo/i)
    const motivo = leer().motivos_perdida[0]
    const perdida = await oportunidades.perder(o.id, motivo.id, "  muy caro  ")
    expect(perdida.estado).toBe("perdida")
    expect(perdida.perdida_at).toBeTruthy()
    expect(perdida.detalle_perdida).toBe("muy caro")
    const reabierta = await oportunidades.reabrir(o.id)
    expect(reabierta.motivo_perdida_id).toBeNull()
    expect(reabierta.perdida_at).toBeNull()
  })

  it("la oportunidad nueva guarda la moneda elegida, no siempre soles", async () => {
    const c = await contactos.crear({ nombre: "Bruno Vera" })
    const etapa = leer().etapas[0]
    const enSoles = await oportunidades.crear({ contacto_id: c.id, titulo: "En soles", etapa_id: etapa.id })
    expect(enSoles.moneda).toBe("PEN")
    fijarMoneda("USD")
    try {
      const enDolares = await oportunidades.crear({ contacto_id: c.id, titulo: "En dólares", etapa_id: etapa.id })
      expect(enDolares.moneda).toBe("USD")
    } finally {
      fijarMoneda(MONEDA_DEFAULT)
    }
  })

  it("mover escribe historial, rechaza etapa inactiva y respeta permiso", async () => {
    const c = await contactos.crear({ nombre: "Luis Paz" })
    const etapas = leer().etapas
    const o = await oportunidades.crear({ contacto_id: c.id, titulo: "Constitución", etapa_id: etapas[0].id })
    expect((await oportunidades.historial(o.id)).length).toBe(1)
    await oportunidades.mover(o.id, etapas[1].id, 5)
    const h = await oportunidades.historial(o.id)
    expect(h.length).toBe(2)
    expect(h[1].de_etapa_id).toBe(etapas[0].id)
    expect(h[1].a_etapa_id).toBe(etapas[1].id)
    const mapa = await tablero.ultimoCambioEtapa([o.id])
    expect(mapa[o.id]).toBe(h[1].created_at)
    await expect(oportunidades.mover(o.id, "no-existe", 1)).rejects.toThrow(/etapa/i)
    entrarComo(ID_USUARIOS.carlos)
    await expect(oportunidades.mover(o.id, etapas[2].id, 1)).rejects.toThrow(/responsable/i)
  })

  it("ganar cuenta en el mes y listarTodo filtra igual que listar", async () => {
    const c = await contactos.crear({ nombre: "Mia Soto" })
    const etapa = leer().etapas[0]
    const o = await oportunidades.crear({ contacto_id: c.id, titulo: "Planilla", etapa_id: etapa.id })
    await oportunidades.ganar(o.id, 1500)
    const resumen = await tablero.cerradasEsteMes()
    expect(resumen.ganadas).toBe(1)
    expect(resumen.importeGanado).toBe(1500)
    const filtros = { texto: "planilla", estado: "todas" as const }
    expect((await oportunidades.listarTodo(filtros)).map((x) => x.id)).toEqual(
      (await oportunidades.listar(filtros)).map((x) => x.id),
    )
    expect((await oportunidades.listar(filtros))[0].contacto?.nombre).toBe("Mia Soto")
  })

  it("borrar contacto arrastra oportunidades e historial", async () => {
    const c = await contactos.crear({ nombre: "Borrable" })
    const etapa = leer().etapas[0]
    await oportunidades.crear({ contacto_id: c.id, titulo: "X", etapa_id: etapa.id })
    await contactos.eliminar(c.id)
    expect(leer().oportunidades.length).toBe(0)
    expect(leer().historial_etapas.length).toBe(0)
  })
})
