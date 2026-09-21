/**
 * Reglas de negocio que antes garantizaba Postgres (restricciones, triggers y RLS)
 * y que ahora son código nuestro. Todo lo de aquí es puro: sin almacén, sin React.
 * Las mismas reglas vistas desde la capa de datos se prueban en src/lib/api/*.test.ts.
 */
import { describe, expect, it } from "vitest"
import {
  ErrorRegla,
  esAdmin,
  exigirAdmin,
  exigirEtapaActiva,
  exigirPuedeEditar,
  exigirReasignacion,
  historialAlActualizar,
  historialAlCrear,
  marcarActualizado,
  prepararOportunidadActualizada,
  prepararOportunidadNueva,
  prepararTarea,
  puedeEditar,
  siguienteIdHistorial,
  ultimaActividad,
  validarCambioUsuario,
  validarOportunidad,
} from "@/lib/reglas"
import type { Actividad, Etapa, HistorialEtapa, Oportunidad, Tarea, Usuario } from "@/lib/types"

const MOMENTO = "2026-09-20T15:00:00.000Z"
const ANTES = "2026-09-01T15:00:00.000Z"

function usuario(cambios: Partial<Usuario> = {}): Usuario {
  return {
    id: "u1",
    nombre: "Carlos Mamani Huanca",
    email: "carlos@estudiocontable.pe",
    rol: "miembro",
    activo: true,
    created_at: ANTES,
    updated_at: ANTES,
    ...cambios,
  }
}

const miembro = usuario()
const otroMiembro = usuario({ id: "u2", nombre: "Lucía Vargas Salazar", email: "lucia@estudiocontable.pe" })
const admin = usuario({ id: "u9", nombre: "Rosa Quispe Ccahuana", email: "rosa@estudiocontable.pe", rol: "admin" })

function oportunidad(cambios: Partial<Oportunidad> = {}): Oportunidad {
  return {
    id: "o1",
    contacto_id: "c1",
    titulo: "Facturación electrónica",
    importe: 1200,
    moneda: "PEN",
    etapa_id: "e1",
    estado: "abierta",
    posicion: -1,
    responsable_id: "u1",
    motivo_perdida_id: null,
    detalle_perdida: null,
    fecha_cierre_prevista: null,
    ganada_at: null,
    perdida_at: null,
    created_by: "u1",
    created_at: ANTES,
    updated_at: ANTES,
    ...cambios,
  }
}

function etapa(id: string, activa = true): Etapa {
  return { id, nombre: `Etapa ${id}`, orden: 1, color: "slate", activa, created_at: ANTES, updated_at: ANTES }
}

function tarea(cambios: Partial<Tarea> = {}): Tarea {
  return {
    id: "t1",
    contacto_id: "c1",
    oportunidad_id: null,
    titulo: "Llamar al cliente",
    vence_at: MOMENTO,
    recordatorio_at: null,
    responsable_id: "u1",
    estado: "pendiente",
    hecha_at: null,
    recordatorio_visto_at: null,
    created_by: "u1",
    created_at: ANTES,
    updated_at: ANTES,
    ...cambios,
  }
}

function actividad(cambios: Partial<Actividad> = {}): Actividad {
  return {
    id: "a1",
    contacto_id: "c1",
    oportunidad_id: null,
    tipo: "llamada",
    resultado: null,
    nota: null,
    ocurrio_at: ANTES,
    usuario_id: "u1",
    created_at: ANTES,
    ...cambios,
  }
}

// -----------------------------------------------------------------------------

describe("permisos (antes RLS)", () => {
  it("un miembro edita lo suyo y un administrador edita lo de cualquiera", () => {
    expect(puedeEditar(miembro, { responsable_id: "u1" })).toBe(true)
    expect(puedeEditar(miembro, { responsable_id: "u2" })).toBe(false)
    expect(puedeEditar(admin, { responsable_id: "u2" })).toBe(true)
    // Las actividades llevan autor en vez de responsable.
    expect(puedeEditar(miembro, { usuario_id: "u1" })).toBe(true)
    expect(puedeEditar(miembro, { usuario_id: "u2" })).toBe(false)
  })

  it("nadie edita sin sesión y un usuario desactivado tampoco", () => {
    expect(puedeEditar(null, { responsable_id: "u1" })).toBe(false)
    expect(puedeEditar(undefined, { responsable_id: "u1" })).toBe(false)
    expect(puedeEditar(usuario({ activo: false }), { responsable_id: "u1" })).toBe(false)
    expect(esAdmin(usuario({ rol: "admin", activo: false }))).toBe(false)
    // Un registro sin dueño no lo edita ningún miembro.
    expect(puedeEditar(miembro, { responsable_id: null })).toBe(false)
  })

  it("exigirPuedeEditar avisa en español de quién es el registro", () => {
    expect(() => exigirPuedeEditar(miembro, { responsable_id: "u2" }, "esta oportunidad")).toThrow(ErrorRegla)
    expect(() => exigirPuedeEditar(miembro, { responsable_id: "u2" }, "esta oportunidad")).toThrow(
      /No puedes editar esta oportunidad/i,
    )
    expect(() => exigirPuedeEditar(admin, { responsable_id: "u2" })).not.toThrow()
    expect(() => exigirPuedeEditar(miembro, { responsable_id: "u1" })).not.toThrow()
  })

  it("solo el administrador importa, configura y reasigna", () => {
    expect(() => exigirAdmin(miembro, "importar contactos")).toThrow(/Solo el administrador puede importar contactos/i)
    expect(() => exigirAdmin(admin, "importar contactos")).not.toThrow()
    expect(() => exigirReasignacion(miembro, "u1", "u2")).toThrow(/reasignar el responsable/i)
    expect(() => exigirReasignacion(admin, "u1", "u2")).not.toThrow()
    // Si el responsable no cambia, no hace falta ser administrador.
    expect(() => exigirReasignacion(miembro, "u1", "u1")).not.toThrow()
  })

  it("protege al usuario: identificador, rol, correo y que quede un administrador", () => {
    const todos = [admin, miembro, otroMiembro]
    expect(() => validarCambioUsuario(admin, miembro, { ...miembro, id: "u3" }, todos)).toThrow(/identificador/i)
    expect(() => validarCambioUsuario(miembro, miembro, { ...miembro, rol: "admin" }, todos)).toThrow(
      /Solo el administrador puede cambiar el rol/i,
    )
    expect(() => validarCambioUsuario(miembro, otroMiembro, { ...otroMiembro, nombre: "Otro" }, todos)).toThrow(
      /tus propios datos/i,
    )
    expect(() => validarCambioUsuario(miembro, miembro, { ...miembro, nombre: "Carlos M." }, todos)).not.toThrow()
    // El único administrador activo no puede degradarse ni desactivarse.
    expect(() => validarCambioUsuario(admin, admin, { ...admin, rol: "miembro" }, todos)).toThrow(
      /al menos un administrador activo/i,
    )
    expect(() => validarCambioUsuario(admin, admin, { ...admin, activo: false }, todos)).toThrow(
      /al menos un administrador activo/i,
    )
    const conDosAdmins = [admin, { ...miembro, rol: "admin" as const }]
    expect(() => validarCambioUsuario(admin, admin, { ...admin, rol: "miembro" }, conDosAdmins)).not.toThrow()
  })
})

describe("updated_at (antes trigger set_updated_at)", () => {
  it("sella la fila sin tocar lo demás", () => {
    const fila = tarea()
    const sellada = marcarActualizado(fila, MOMENTO)
    expect(sellada.updated_at).toBe(MOMENTO)
    expect(sellada.titulo).toBe(fila.titulo)
    expect(fila.updated_at).toBe(ANTES) // no muta el original
  })
})

describe("criterio 3: perder exige motivo", () => {
  it("no deja perder sin motivo por ninguna vía", () => {
    expect(() => validarOportunidad(oportunidad({ estado: "perdida", perdida_at: MOMENTO }))).toThrow(ErrorRegla)
    expect(() => validarOportunidad(oportunidad({ estado: "perdida", perdida_at: MOMENTO }))).toThrow(
      /tienes que elegir el motivo/i,
    )
    // Tampoco valiendo la fecha: primero falta el motivo.
    expect(() => validarOportunidad(oportunidad({ estado: "perdida" }))).toThrow(/elegir el motivo/i)
  })

  it("la equivalencia va en los dos sentidos: motivo solo si está perdida", () => {
    expect(() => validarOportunidad(oportunidad({ motivo_perdida_id: "m1" }))).toThrow(
      /Solo las oportunidades perdidas/i,
    )
    expect(() =>
      validarOportunidad(oportunidad({ estado: "ganada", ganada_at: MOMENTO, motivo_perdida_id: "m1" })),
    ).toThrow(/Solo las oportunidades perdidas/i)
  })

  it("ganada y perdida necesitan su fecha de cierre", () => {
    expect(() => validarOportunidad(oportunidad({ estado: "ganada" }))).toThrow(/fecha en que se ganó/i)
    expect(() =>
      validarOportunidad(oportunidad({ estado: "perdida", motivo_perdida_id: "m1" })),
    ).toThrow(/fecha en que se perdió/i)
    expect(() => validarOportunidad(oportunidad())).not.toThrow()
    expect(() => validarOportunidad(oportunidad({ estado: "ganada", ganada_at: MOMENTO }))).not.toThrow()
    expect(() =>
      validarOportunidad(oportunidad({ estado: "perdida", perdida_at: MOMENTO, motivo_perdida_id: "m1" })),
    ).not.toThrow()
  })
})

describe("cambios de estado (antes trigger preparar_cambio_estado)", () => {
  it("al crear completa la fecha de cierre que falte y respeta la que venga", () => {
    expect(prepararOportunidadNueva(oportunidad({ estado: "ganada" }), MOMENTO).ganada_at).toBe(MOMENTO)
    expect(
      prepararOportunidadNueva(oportunidad({ estado: "perdida", motivo_perdida_id: "m1" }), MOMENTO).perdida_at,
    ).toBe(MOMENTO)
    // Importar una oportunidad ya cerrada conserva su fecha original.
    expect(prepararOportunidadNueva(oportunidad({ estado: "ganada", ganada_at: ANTES }), MOMENTO).ganada_at).toBe(ANTES)
    expect(prepararOportunidadNueva(oportunidad(), MOMENTO).ganada_at).toBeNull()
  })

  it("al ganar fija ganada_at y al perder, perdida_at", () => {
    const abierta = oportunidad()
    const ganada = prepararOportunidadActualizada(abierta, { ...abierta, estado: "ganada" }, MOMENTO)
    expect(ganada.ganada_at).toBe(MOMENTO)
    expect(ganada.perdida_at).toBeNull()
    expect(ganada.updated_at).toBe(MOMENTO)

    const perdida = prepararOportunidadActualizada(
      abierta,
      { ...abierta, estado: "perdida", motivo_perdida_id: "m1", detalle_perdida: "Precio" },
      MOMENTO,
    )
    expect(perdida.perdida_at).toBe(MOMENTO)
    expect(perdida.motivo_perdida_id).toBe("m1")
    expect(() => validarOportunidad(perdida)).not.toThrow()
  })

  it("al reabrir limpia motivo, detalle y las dos fechas de cierre", () => {
    const perdida = oportunidad({
      estado: "perdida",
      motivo_perdida_id: "m1",
      detalle_perdida: "Se fue con el contador de al lado",
      perdida_at: ANTES,
    })
    const reabierta = prepararOportunidadActualizada(perdida, { ...perdida, estado: "abierta" }, MOMENTO)
    expect(reabierta.estado).toBe("abierta")
    expect(reabierta.motivo_perdida_id).toBeNull()
    expect(reabierta.detalle_perdida).toBeNull()
    expect(reabierta.perdida_at).toBeNull()
    expect(reabierta.ganada_at).toBeNull()
    // Y queda coherente: ya no arrastra el motivo de cuando estaba perdida.
    expect(() => validarOportunidad(reabierta)).not.toThrow()

    const ganada = oportunidad({ estado: "ganada", ganada_at: ANTES })
    const deGanadaAPerdida = prepararOportunidadActualizada(
      ganada,
      { ...ganada, estado: "perdida", motivo_perdida_id: "m2" },
      MOMENTO,
    )
    expect(deGanadaAPerdida.ganada_at).toBeNull()
    expect(deGanadaAPerdida.perdida_at).toBe(MOMENTO)
  })

  it("si el estado no cambia solo sella updated_at", () => {
    const ganada = oportunidad({ estado: "ganada", ganada_at: ANTES })
    const editada = prepararOportunidadActualizada(ganada, { ...ganada, titulo: "Otro título" }, MOMENTO)
    expect(editada.ganada_at).toBe(ANTES)
    expect(editada.titulo).toBe("Otro título")
    expect(editada.updated_at).toBe(MOMENTO)
  })
})

describe("etapas (antes función mover_oportunidad)", () => {
  it("rechaza la etapa que no existe o está desactivada", () => {
    const etapas = [etapa("e1"), etapa("e2", false)]
    expect(exigirEtapaActiva(etapas, "e1").id).toBe("e1")
    expect(() => exigirEtapaActiva(etapas, "e2")).toThrow(/no existe o está desactivada/i)
    expect(() => exigirEtapaActiva(etapas, "e9")).toThrow(ErrorRegla)
  })
})

describe("historial de etapas (antes trigger registrar_historial_etapas)", () => {
  it("numera como el identity de Postgres", () => {
    expect(siguienteIdHistorial([])).toBe(1)
    const filas: HistorialEtapa[] = [
      { id: 3, oportunidad_id: "o1", de_etapa_id: null, a_etapa_id: "e1", de_estado: null, a_estado: "abierta", usuario_id: "u1", created_at: ANTES },
      { id: 7, oportunidad_id: "o1", de_etapa_id: "e1", a_etapa_id: "e2", de_estado: "abierta", a_estado: "abierta", usuario_id: "u1", created_at: MOMENTO },
    ]
    expect(siguienteIdHistorial(filas)).toBe(8)
  })

  it("al crear la oportunidad escribe la fila inicial", () => {
    const fila = historialAlCrear(oportunidad({ etapa_id: "e1" }), "u1", MOMENTO)
    expect(fila).toEqual({
      oportunidad_id: "o1",
      de_etapa_id: null,
      a_etapa_id: "e1",
      de_estado: null,
      a_estado: "abierta",
      usuario_id: "u1",
      created_at: MOMENTO,
    })
  })

  it("cada cambio de etapa escribe su fila, y lo demás no", () => {
    const antes = oportunidad({ etapa_id: "e1" })
    expect(historialAlActualizar(antes, { ...antes, titulo: "Otro" }, "u1", MOMENTO)).toBeNull()
    expect(historialAlActualizar(antes, { ...antes, importe: 9000 }, "u1", MOMENTO)).toBeNull()

    const movida = { ...antes, etapa_id: "e2" }
    expect(historialAlActualizar(antes, movida, "u1", MOMENTO)).toEqual({
      oportunidad_id: "o1",
      de_etapa_id: "e1",
      a_etapa_id: "e2",
      de_estado: "abierta",
      a_estado: "abierta",
      usuario_id: "u1",
      created_at: MOMENTO,
    })

    // Y una etapa más: el embudo necesita una fila por cada salto.
    const tercera = { ...movida, etapa_id: "e3" }
    expect(historialAlActualizar(movida, tercera, "u1", MOMENTO)?.de_etapa_id).toBe("e2")
  })

  it("ganar o perder también deja rastro aunque no cambie la etapa", () => {
    const antes = oportunidad({ etapa_id: "e1" })
    const ganada = { ...antes, estado: "ganada" as const, ganada_at: MOMENTO }
    expect(historialAlActualizar(antes, ganada, "u1", MOMENTO)).toMatchObject({
      de_estado: "abierta",
      a_estado: "ganada",
      de_etapa_id: "e1",
      a_etapa_id: "e1",
    })
  })
})

describe("última actividad del contacto (antes trigger actualizar_ultima_actividad)", () => {
  it("se queda con la más reciente del contacto y con null si no le queda ninguna", () => {
    const actividades = [
      actividad({ id: "a1", ocurrio_at: "2026-09-10T15:00:00.000Z" }),
      actividad({ id: "a2", ocurrio_at: "2026-09-12T15:00:00.000Z" }),
      actividad({ id: "a3", contacto_id: "c2", ocurrio_at: "2026-09-20T15:00:00.000Z" }),
    ]
    expect(ultimaActividad(actividades, "c1")).toBe("2026-09-12T15:00:00.000Z")
    expect(ultimaActividad(actividades, "c2")).toBe("2026-09-20T15:00:00.000Z")
    expect(ultimaActividad(actividades, "c9")).toBeNull()
    expect(ultimaActividad([], "c1")).toBeNull()
    // Al borrar la última, el contacto vuelve a la anterior.
    expect(ultimaActividad(actividades.filter((a) => a.id !== "a2"), "c1")).toBe("2026-09-10T15:00:00.000Z")
  })
})

describe("tareas", () => {
  it("marcar hecha fija hecha_at y devolverla a pendiente lo limpia", () => {
    const pendiente = tarea()
    const hecha = prepararTarea(pendiente, { ...pendiente, estado: "hecha" }, MOMENTO)
    expect(hecha.hecha_at).toBe(MOMENTO)
    expect(hecha.updated_at).toBe(MOMENTO)

    const otraVez = prepararTarea(hecha, { ...hecha, estado: "pendiente" }, MOMENTO)
    expect(otraVez.hecha_at).toBeNull()

    // Alta: sin fila anterior no se sella updated_at, pero la coherencia se mantiene.
    const nueva = prepararTarea(null, tarea({ estado: "hecha" }), MOMENTO)
    expect(nueva.hecha_at).toBe(MOMENTO)
    expect(nueva.updated_at).toBe(ANTES)
  })
})
