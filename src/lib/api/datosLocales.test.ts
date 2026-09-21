/**
 * Contrato de la capa de datos sobre el almacén local: tareas (filtros, orden,
 * recordatorios y permisos), actividades (última actividad del contacto),
 * catálogos, usuarios, configuración e importaciones (deshacer en cascada).
 * Fija las reglas que antes hacía Postgres con triggers y RLS.
 */
import { beforeEach, describe, expect, it } from "vitest"
import { escribir, leer, nuevoId, reiniciar } from "@/lib/almacen"
import { ID_USUARIOS } from "@/lib/semilla"
import { entrarComo } from "@/lib/sesion"
import type { Contacto, Oportunidad } from "@/lib/types"
import * as apiActividades from "./actividades"
import * as apiCatalogos from "./catalogos"
import * as apiConfiguracion from "./configuracion"
import * as apiImportaciones from "./importaciones"
import * as apiTareas from "./tareas"
import * as apiUsuarios from "./usuarios"

const MOMENTO = "2026-09-20T15:00:00.000Z"

function contactoDePrueba(id: string, importacionId: string | null = null): Contacto {
  return {
    id,
    nombre: "Juan Pérez",
    empresa: null,
    doc_tipo: null,
    doc_numero: null,
    telefono: null,
    telefono_raw: null,
    email: null,
    direccion: null,
    origen_id: null,
    responsable_id: ID_USUARIOS.rosa,
    notas: null,
    extra: {},
    importacion_id: importacionId,
    fila_origen: null,
    requiere_revision: false,
    ultima_actividad_at: null,
    created_by: ID_USUARIOS.rosa,
    created_at: MOMENTO,
    updated_at: MOMENTO,
  }
}

beforeEach(() => {
  reiniciar()
  entrarComo(ID_USUARIOS.rosa)
})

describe("catalogos", () => {
  it("siembra, crea, renombra y reordena", async () => {
    expect((await apiCatalogos.listarEtapas()).map((e) => e.nombre)[0]).toBe("Nuevo contacto")
    expect(await apiCatalogos.listarMotivos()).toHaveLength(6)
    expect(await apiCatalogos.listarOrigenes()).toHaveLength(7)

    const nueva = await apiCatalogos.crearEtapa({ nombre: "  Cierre  " })
    expect(nueva.nombre).toBe("Cierre")
    expect(nueva.orden).toBe(6)
    expect(nueva.color).toBe("slate")

    const ids = (await apiCatalogos.listarEtapas()).map((e) => e.id).reverse()
    await apiCatalogos.reordenarEtapas(ids)
    expect((await apiCatalogos.listarEtapas()).map((e) => e.id)).toEqual(ids)

    await apiCatalogos.actualizarEtapa(nueva.id, { activa: false })
    expect((await apiCatalogos.listarEtapas()).some((e) => e.id === nueva.id)).toBe(false)
    expect((await apiCatalogos.listarEtapas(true)).some((e) => e.id === nueva.id)).toBe(true)
  })

  it("solo el administrador escribe", async () => {
    entrarComo(ID_USUARIOS.carlos)
    await expect(apiCatalogos.crearEtapa({ nombre: "Prueba" })).rejects.toThrow("Solo el administrador puede crear etapas.")
  })
})

describe("configuracion", () => {
  it("devuelve valores por defecto y guarda", async () => {
    escribir((db) => {
      delete db.configuracion.nombre_empresa
    })
    expect((await apiConfiguracion.obtenerTodo()).nombre_empresa).toBe("Estudio contable")
    await apiConfiguracion.guardarVarias({ nombre_empresa: "Estudio Quispe", importe_default: 250 })
    const valores = await apiConfiguracion.obtenerTodo()
    expect(valores.nombre_empresa).toBe("Estudio Quispe")
    expect(valores.importe_default).toBe(250)
    entrarComo(ID_USUARIOS.carlos)
    await expect(apiConfiguracion.guardarVarias({ moneda: "USD" })).rejects.toThrow("Solo el administrador")
  })
})

describe("usuarios", () => {
  it("ordena por nombre y protege al administrador", async () => {
    const nombres = (await apiUsuarios.listar()).map((u) => u.nombre)
    expect(nombres[0]).toBe("Aldo Ticona Apaza")
    await apiUsuarios.actualizar(ID_USUARIOS.carlos, { rol: "admin" })
    expect((await apiUsuarios.obtener(ID_USUARIOS.carlos))?.rol).toBe("admin")
    await expect(apiUsuarios.actualizar(ID_USUARIOS.rosa, { rol: "miembro" })).rejects.toThrow(
      "No puedes quitarte a ti mismo el rol de administrador.",
    )
    entrarComo(ID_USUARIOS.lucia)
    await expect(apiUsuarios.actualizar(ID_USUARIOS.aldo, { nombre: "Otro" })).rejects.toThrow("Solo puedes cambiar tus propios datos.")
  })
})

describe("tareas", () => {
  it("crea, filtra, ordena y completa", async () => {
    const contactoId = nuevoId()
    escribir((db) => {
      db.contactos.push(contactoDePrueba(contactoId))
    })
    const a = await apiTareas.crear({ titulo: "  Llamar a Juan  ", vence_at: "2026-09-22T14:00:00.000Z", contacto_id: contactoId })
    const b = await apiTareas.crear({ titulo: "Enviar cotización", vence_at: "2026-09-21T14:00:00.000Z" })
    expect(a.titulo).toBe("Llamar a Juan")
    expect(a.responsable_id).toBe(ID_USUARIOS.rosa)

    const lista = await apiTareas.listar({ estado: "pendiente" })
    expect(lista.map((t) => t.id)).toEqual([b.id, a.id])
    expect(lista[1].contacto?.nombre).toBe("Juan Pérez")
    expect(lista[0].responsable?.nombre).toBe("Rosa Quispe Ccahuana")

    // Busca ignorando tildes y mayúsculas.
    expect((await apiTareas.listar({ texto: "COTIZACION" })).map((t) => t.id)).toEqual([b.id])
    expect((await apiTareas.listar({ contactoId })).map((t) => t.id)).toEqual([a.id])
    expect(await apiTareas.tienePendiente(contactoId)).toBe(true)

    const hecha = await apiTareas.completar(a.id)
    expect(hecha.estado).toBe("hecha")
    expect(hecha.hecha_at).not.toBeNull()
    expect((await apiTareas.listar({ estado: "pendiente" })).map((t) => t.id)).toEqual([b.id])
    expect((await apiTareas.reabrir(a.id)).hecha_at).toBeNull()
    expect(await apiTareas.tienePendiente(contactoId)).toBe(true)

    await apiTareas.eliminar(b.id)
    expect(await apiTareas.listarTodo({ estado: "todas" })).toHaveLength(1)
  })

  it("lista los recordatorios vencidos y no vistos del usuario", async () => {
    const vencido = await apiTareas.crear({
      titulo: "Recordar",
      vence_at: "2026-09-21T14:00:00.000Z",
      recordatorio_at: "2020-01-01T09:00:00.000Z",
    })
    await apiTareas.crear({ titulo: "Futuro", vence_at: "2030-01-01T14:00:00.000Z", recordatorio_at: "2030-01-01T09:00:00.000Z" })
    await apiTareas.crear({ titulo: "Sin recordatorio", vence_at: "2020-01-01T14:00:00.000Z" })
    expect((await apiTareas.listarRecordatoriosPendientes()).map((t) => t.id)).toEqual([vencido.id])
    await apiTareas.marcarRecordatorioVisto(vencido.id)
    expect(await apiTareas.listarRecordatoriosPendientes()).toHaveLength(0)
    entrarComo(ID_USUARIOS.carlos)
    expect(await apiTareas.listarRecordatoriosPendientes()).toHaveLength(0)
  })

  it("solo el administrador reasigna", async () => {
    const tarea = await apiTareas.crear({ titulo: "Mía", vence_at: "2026-09-21T14:00:00.000Z", responsable_id: ID_USUARIOS.carlos })
    entrarComo(ID_USUARIOS.carlos)
    await expect(apiTareas.actualizar(tarea.id, { responsable_id: ID_USUARIOS.lucia })).rejects.toThrow(
      "Solo el administrador puede reasignar el responsable.",
    )
    entrarComo(ID_USUARIOS.lucia)
    await expect(apiTareas.actualizar(tarea.id, { titulo: "Ajena" })).rejects.toThrow("No puedes editar esta tarea")
  })
})

describe("actividades", () => {
  it("mantiene ultima_actividad_at del contacto", async () => {
    const contactoId = nuevoId()
    escribir((db) => {
      db.contactos.push(contactoDePrueba(contactoId))
    })
    const vieja = await apiActividades.crear({ contacto_id: contactoId, tipo: "llamada", ocurrio_at: "2026-09-01T10:00:00.000Z" })
    const nueva = await apiActividades.crear({
      contacto_id: contactoId,
      tipo: "nota",
      nota: "  apunte  ",
      ocurrio_at: "2026-09-10T10:00:00.000Z",
    })
    expect(nueva.nota).toBe("apunte")
    const contacto = () => leer().contactos.find((c) => c.id === contactoId)
    expect(contacto()?.ultima_actividad_at).toBe("2026-09-10T10:00:00.000Z")

    const lista = await apiActividades.listarPorContacto(contactoId)
    expect(lista.map((a) => a.id)).toEqual([nueva.id, vieja.id])
    expect(lista[0].usuario?.nombre).toBe("Rosa Quispe Ccahuana")

    await apiActividades.eliminar(nueva.id)
    expect(contacto()?.ultima_actividad_at).toBe("2026-09-01T10:00:00.000Z")
    await apiActividades.eliminar(vieja.id)
    expect(contacto()?.ultima_actividad_at).toBeNull()
  })

  it("cualquiera registra actividad sobre contactos ajenos, pero solo el autor la edita", async () => {
    const contactoId = nuevoId()
    escribir((db) => {
      db.contactos.push(contactoDePrueba(contactoId))
    })
    entrarComo(ID_USUARIOS.carlos)
    const actividad = await apiActividades.crear({ contacto_id: contactoId, tipo: "whatsapp" })
    expect(actividad.usuario_id).toBe(ID_USUARIOS.carlos)
    entrarComo(ID_USUARIOS.lucia)
    await expect(apiActividades.actualizar(actividad.id, { nota: "no" })).rejects.toThrow("No puedes editar esta actividad")
  })
})

describe("importaciones", () => {
  it("deshace borrando contactos, oportunidades e historial", async () => {
    const importacion = await apiImportaciones.crear({ archivo: "clientes.xlsx", total_filas: 3 })
    expect(importacion.usuario_id).toBe(ID_USUARIOS.rosa)
    const contactoId = nuevoId()
    const oportunidadId = nuevoId()
    const etapaId = leer().etapas[0].id
    escribir((db) => {
      db.contactos.push(contactoDePrueba(contactoId, importacion.id))
      db.contactos.push(contactoDePrueba(nuevoId()))
      const oportunidad: Oportunidad = {
        id: oportunidadId,
        contacto_id: contactoId,
        titulo: "Facturación",
        importe: 100,
        moneda: "PEN",
        etapa_id: etapaId,
        estado: "abierta",
        posicion: 1,
        responsable_id: ID_USUARIOS.rosa,
        motivo_perdida_id: null,
        detalle_perdida: null,
        fecha_cierre_prevista: null,
        ganada_at: null,
        perdida_at: null,
        created_by: ID_USUARIOS.rosa,
        created_at: MOMENTO,
        updated_at: MOMENTO,
      }
      db.oportunidades.push(oportunidad)
      db.historial_etapas.push({
        id: 1,
        oportunidad_id: oportunidadId,
        de_etapa_id: null,
        a_etapa_id: etapaId,
        de_estado: null,
        a_estado: "abierta",
        usuario_id: ID_USUARIOS.rosa,
        created_at: MOMENTO,
      })
      db.actividades.push({
        id: nuevoId(),
        contacto_id: contactoId,
        oportunidad_id: oportunidadId,
        tipo: "llamada",
        resultado: null,
        nota: null,
        ocurrio_at: MOMENTO,
        usuario_id: ID_USUARIOS.rosa,
        created_at: MOMENTO,
      })
      db.tareas.push({
        id: nuevoId(),
        contacto_id: null,
        oportunidad_id: oportunidadId,
        titulo: "Tarea suelta",
        vence_at: MOMENTO,
        recordatorio_at: null,
        responsable_id: ID_USUARIOS.rosa,
        estado: "pendiente",
        hecha_at: null,
        recordatorio_visto_at: null,
        created_by: ID_USUARIOS.rosa,
        created_at: MOMENTO,
        updated_at: MOMENTO,
      })
    })

    expect(await apiImportaciones.listar()).toHaveLength(1)
    expect(await apiImportaciones.deshacer(importacion.id)).toBe(1)
    const db = leer()
    expect(db.contactos).toHaveLength(1)
    expect(db.oportunidades).toHaveLength(0)
    expect(db.historial_etapas).toHaveLength(0)
    expect(db.actividades).toHaveLength(0)
    expect(db.tareas).toHaveLength(1)
    expect(db.tareas[0].oportunidad_id).toBeNull()
    expect(await apiImportaciones.listar()).toHaveLength(0)
  })
})
