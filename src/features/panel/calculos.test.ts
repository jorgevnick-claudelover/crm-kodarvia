import { describe, expect, it } from "vitest"
import type { Contacto, Etapa, HistorialEtapa, MotivoPerdida, OportunidadConRelaciones, TareaConRelaciones, Usuario } from "@/lib/types"
import {
  calcularResumen,
  colorResponsable,
  contactosSinSeguimiento,
  diaLegible,
  embudo,
  etiquetaMes,
  ganadoPorMes,
  mesesDelGrafico,
  mesesEntre,
  perdidasPorMotivo,
  porEtapaYResponsable,
  rangoDePreset,
  sumarMeses,
  vencidasPorResponsable,
} from "./calculos"

// ---------- Fixtures ----------

const T = "2026-01-01T00:00:00.000Z"

function usuario(id: string, nombre: string): Usuario {
  return { id, nombre, email: `${id}@x.pe`, rol: "miembro", activo: true, created_at: T, updated_at: T }
}

function etapa(id: string, orden: number, activa = true): Etapa {
  return { id, nombre: `Etapa ${orden}`, orden, color: "slate", activa, created_at: T, updated_at: T }
}

function motivo(id: string, nombre: string): MotivoPerdida {
  return { id, nombre, orden: 1, activo: true, created_at: T, updated_at: T }
}

let seq = 0
function op(parcial: Partial<OportunidadConRelaciones> & { etapa_id: string }): OportunidadConRelaciones {
  seq++
  return {
    id: `op${seq}`,
    contacto_id: "c1",
    titulo: "Facturación",
    importe: 100,
    moneda: "PEN",
    estado: "abierta",
    posicion: 0,
    responsable_id: "u1",
    motivo_perdida_id: null,
    detalle_perdida: null,
    fecha_cierre_prevista: null,
    ganada_at: null,
    perdida_at: null,
    created_by: null,
    created_at: "2026-04-10T15:00:00.000Z",
    updated_at: T,
    contacto: null,
    etapa: null,
    responsable: null,
    motivo_perdida: null,
    ...parcial,
  }
}

function hist(oportunidad_id: string, a_etapa_id: string | null, created_at = T): HistorialEtapa {
  seq++
  return { id: seq, oportunidad_id, de_etapa_id: null, a_etapa_id, de_estado: null, a_estado: "abierta", usuario_id: null, created_at }
}

function tarea(parcial: Partial<TareaConRelaciones>): TareaConRelaciones {
  seq++
  return {
    id: `t${seq}`,
    contacto_id: null,
    oportunidad_id: null,
    titulo: "Llamar",
    vence_at: "2026-09-10T14:00:00.000Z",
    recordatorio_at: null,
    responsable_id: "u1",
    estado: "pendiente",
    hecha_at: null,
    recordatorio_visto_at: null,
    created_by: null,
    created_at: T,
    updated_at: T,
    contacto: null,
    oportunidad: null,
    responsable: null,
    ...parcial,
  }
}

function contacto(id: string, ultima_actividad_at: string | null): Pick<Contacto, "id" | "ultima_actividad_at"> {
  return { id, ultima_actividad_at }
}

const USUARIOS = [usuario("u1", "Ana"), usuario("u2", "Beto")]
const ETAPAS = [etapa("e1", 1), etapa("e2", 2), etapa("e3", 3)]
// 2026-09-12 15:00 UTC = 10:00 en Lima
const AHORA = new Date("2026-09-12T15:00:00.000Z")

// ---------- Meses y rangos ----------

describe("meses y rangos", () => {
  it("sumarMeses cruza el año en ambos sentidos", () => {
    expect(sumarMeses("2026-01", -1)).toBe("2025-12")
    expect(sumarMeses("2026-11", 3)).toBe("2027-02")
    expect(sumarMeses("2026-09", -5)).toBe("2026-04")
  })

  it("mesesEntre lista meses inclusivos", () => {
    expect(mesesEntre("2026-04-01", "2026-06-30")).toEqual(["2026-04", "2026-05", "2026-06"])
  })

  it("diaLegible no pasa por Date", () => {
    expect(diaLegible("2026-04-01")).toBe("01/04/2026")
  })

  it("etiquetaMes en español de Perú", () => {
    expect(etiquetaMes("2026-04")).toBe("Abr 2026")
    expect(etiquetaMes("2026-09")).toBe("Set 2026")
  })

  it("rangoDePreset: 6 meses de calendario incluido el actual", () => {
    expect(rangoDePreset("6m", "2026-09-12")).toEqual({ desde: "2026-04-01", hasta: "2026-09-12" })
    expect(rangoDePreset("3m", "2026-01-15")).toEqual({ desde: "2025-11-01", hasta: "2026-01-15" })
    expect(rangoDePreset("mes", "2026-09-12")).toEqual({ desde: "2026-09-01", hasta: "2026-09-12" })
    expect(rangoDePreset("anio", "2026-09-12")).toEqual({ desde: "2026-01-01", hasta: "2026-09-12" })
  })

  it("rangoDePreset personalizado ordena las fechas y cae en 6 meses si faltan", () => {
    expect(rangoDePreset("personalizado", "2026-09-12", "2026-08-01", "2026-05-01")).toEqual({ desde: "2026-05-01", hasta: "2026-08-01" })
    expect(rangoDePreset("personalizado", "2026-09-12")).toEqual(rangoDePreset("6m", "2026-09-12"))
  })

  it("mesesDelGrafico: 6 meses si el rango no pasa de 6, 12 si pasa", () => {
    expect(mesesDelGrafico({ desde: "2026-09-01", hasta: "2026-09-12" })).toHaveLength(6)
    expect(mesesDelGrafico({ desde: "2026-09-01", hasta: "2026-09-12" }).at(-1)).toBe("2026-09")
    const doce = mesesDelGrafico({ desde: "2026-01-01", hasta: "2026-09-12" })
    expect(doce).toHaveLength(12)
    expect(doce[0]).toBe("2025-10")
  })
})

// ---------- Ganado por mes ----------

describe("ganadoPorMes", () => {
  it("una ganada_at a las 03:00 UTC del día 1 pertenece al mes anterior en Lima", () => {
    const ops = [
      op({ etapa_id: "e1", estado: "ganada", importe: 500, ganada_at: "2026-05-01T03:00:00.000Z" }),
      op({ etapa_id: "e1", estado: "ganada", importe: 200, ganada_at: "2026-05-01T05:00:00.000Z" }),
      op({ etapa_id: "e1", estado: "abierta", importe: 999 }),
    ]
    const puntos = ganadoPorMes(ops, ["2026-04", "2026-05", "2026-06"])
    expect(puntos.map((p) => p.suma)).toEqual([500, 200, 0])
    expect(puntos.map((p) => p.n)).toEqual([1, 1, 0])
    expect(puntos[0].etiqueta).toBe("Abr 2026")
  })

  it("ignora ganadas fuera de los meses pedidos", () => {
    const ops = [op({ etapa_id: "e1", estado: "ganada", importe: 50, ganada_at: "2025-01-15T12:00:00.000Z" })]
    expect(ganadoPorMes(ops, ["2026-05"])[0].suma).toBe(0)
  })
})

// ---------- Resumen y sin seguimiento ----------

describe("resumen", () => {
  it("cuenta abiertas, ganado y perdidas del mes actual de Lima, vencidas y sin seguimiento", () => {
    const ops = [
      op({ etapa_id: "e1", importe: 100 }),
      op({ etapa_id: "e2", importe: 250.5 }),
      op({ etapa_id: "e1", estado: "ganada", importe: 1000, ganada_at: "2026-09-02T12:00:00.000Z" }),
      // 2026-09-01 03:00 UTC = 31 de agosto en Lima: no cuenta como este mes
      op({ etapa_id: "e1", estado: "ganada", importe: 5000, ganada_at: "2026-09-01T03:00:00.000Z" }),
      op({ etapa_id: "e1", estado: "perdida", motivo_perdida_id: "m1", perdida_at: "2026-09-05T12:00:00.000Z" }),
      op({ etapa_id: "e1", estado: "perdida", motivo_perdida_id: "m1", perdida_at: "2026-08-05T12:00:00.000Z" }),
    ]
    const tareas = [
      tarea({ vence_at: "2026-09-10T14:00:00.000Z", contacto_id: "c1" }),
      tarea({ vence_at: "2026-09-20T14:00:00.000Z", contacto_id: "c2" }),
    ]
    const contactos = [
      contacto("c1", null), // tiene tarea pendiente: con seguimiento
      contacto("c2", null),
      contacto("c3", "2026-09-10T12:00:00.000Z"), // actividad reciente
      contacto("c4", "2026-08-01T12:00:00.000Z"), // sin actividad en 14 días y sin tarea
      contacto("c5", null),
    ]
    const r = calcularResumen(ops, tareas, contactos, AHORA)
    expect(r.abiertas).toEqual({ n: 2, suma: 350.5 })
    expect(r.ganadoEsteMes).toEqual({ n: 1, suma: 1000 })
    expect(r.perdidasEsteMes).toBe(1)
    expect(r.tareasVencidas).toBe(1)
    expect(r.sinSeguimiento).toBe(2)
  })

  it("contactosSinSeguimiento: el límite de 14 días es exacto", () => {
    const hace14 = new Date(AHORA.getTime() - 14 * 24 * 60 * 60 * 1000 - 1000).toISOString()
    const hace13 = new Date(AHORA.getTime() - 13 * 24 * 60 * 60 * 1000).toISOString()
    expect(contactosSinSeguimiento([contacto("a", hace14), contacto("b", hace13)], [], AHORA)).toEqual(["a"])
  })
})

// ---------- Por etapa y responsable ----------

describe("porEtapaYResponsable", () => {
  it("arma la matriz etapa x responsable solo con abiertas y series en el orden de usuarios", () => {
    const ops = [
      op({ etapa_id: "e1", responsable_id: "u2", importe: 10 }),
      op({ etapa_id: "e1", responsable_id: "u1", importe: 20 }),
      op({ etapa_id: "e2", responsable_id: "u1", importe: 30 }),
      op({ etapa_id: "e2", responsable_id: "u1", estado: "ganada", importe: 999, ganada_at: T }),
    ]
    const m = porEtapaYResponsable(ops, ETAPAS, USUARIOS)
    expect(m.filas.map((f) => f.etapa)).toEqual(["Etapa 1", "Etapa 2", "Etapa 3"])
    expect(m.filas[0].celdas).toEqual({ u2: { n: 1, suma: 10 }, u1: { n: 1, suma: 20 } })
    expect(m.filas[0].total).toEqual({ n: 2, suma: 30 })
    expect(m.filas[1].celdas.u1).toEqual({ n: 1, suma: 30 })
    expect(m.filas[2].total).toEqual({ n: 0, suma: 0 })
    expect(m.series.map((s) => s.id)).toEqual(["u1", "u2"])
    expect(m.series[0].color).toBe(colorResponsable("u1", USUARIOS))
    expect(m.total).toEqual({ n: 3, suma: 60 })
  })

  it("el color de cada responsable no cambia al quitar a otro de la lista de series", () => {
    const soloU2 = porEtapaYResponsable([op({ etapa_id: "e1", responsable_id: "u2" })], ETAPAS, USUARIOS)
    expect(soloU2.series[0].color).toBe(colorResponsable("u2", USUARIOS))
    expect(colorResponsable("u2", USUARIOS)).not.toBe(colorResponsable("u1", USUARIOS))
  })
})

// ---------- Embudo ----------

describe("embudo", () => {
  it("cohorte del mes con alcance implícito y conversión etapa a etapa", () => {
    const ops = [
      // creada en abril (Lima), hoy en e3: alcanza e1, e2 y e3 aunque el historial solo tenga e1
      op({ id: "a", etapa_id: "e3", created_at: "2026-04-10T15:00:00.000Z" }),
      // creada en abril, sigue en e1
      op({ id: "b", etapa_id: "e1", created_at: "2026-04-20T15:00:00.000Z" }),
      // creada en abril, volvió a e1 pero pasó por e2 según el historial
      op({ id: "c", etapa_id: "e1", created_at: "2026-04-25T15:00:00.000Z" }),
      // ganada en la cohorte, se quedó en e2
      op({ id: "d", etapa_id: "e2", estado: "ganada", ganada_at: T, created_at: "2026-04-02T15:00:00.000Z" }),
      // 1 de mayo 03:00 UTC = 30 de abril en Lima: pertenece a la cohorte
      op({ id: "e", etapa_id: "e1", estado: "perdida", motivo_perdida_id: "m1", perdida_at: T, created_at: "2026-05-01T03:00:00.000Z" }),
      // creada en mayo (Lima): fuera de la cohorte
      op({ id: "f", etapa_id: "e3", created_at: "2026-05-01T12:00:00.000Z" }),
    ]
    const historial = [hist("a", "e1"), hist("b", "e1"), hist("c", "e1"), hist("c", "e2"), hist("c", "e1"), hist("f", "e3")]
    const r = embudo(ops, historial, ETAPAS, "2026-04")
    expect(r.total).toBe(5)
    expect(r.pasos.map((p) => p.alcanzaron)).toEqual([5, 3, 1])
    expect(r.pasos[0].conversion).toBeNull()
    expect(r.pasos[1].conversion).toBeCloseTo(3 / 5)
    expect(r.pasos[2].conversion).toBeCloseTo(1 / 3)
    expect(r.pasos[2].proporcion).toBeCloseTo(1 / 5)
    expect(r.ganadas).toBe(1)
    expect(r.perdidas).toBe(1)
    expect(r.abiertas).toBe(3)
    expect(r.porcentajeGanadas).toBeCloseTo(0.2)
    expect(r.porcentajePerdidas).toBeCloseTo(0.2)
  })

  it("usa el orden de etapas inactivas para el alcance pero no las pinta", () => {
    const etapas = [etapa("e1", 1), etapa("e2", 2, false), etapa("e3", 3)]
    const ops = [op({ id: "a", etapa_id: "e2", created_at: "2026-04-10T15:00:00.000Z" })]
    const r = embudo(ops, [], etapas, "2026-04")
    expect(r.pasos.map((p) => p.etapaId)).toEqual(["e1", "e3"])
    expect(r.pasos.map((p) => p.alcanzaron)).toEqual([1, 0])
  })

  it("mes sin oportunidades: todo a cero sin dividir entre cero", () => {
    const r = embudo([], [], ETAPAS, "2026-03")
    expect(r.total).toBe(0)
    expect(r.pasos.every((p) => p.alcanzaron === 0 && p.proporcion === 0)).toBe(true)
    expect(r.pasos[1].conversion).toBeNull()
    expect(r.porcentajeGanadas).toBe(0)
  })
})

// ---------- Perdidas por motivo ----------

describe("perdidasPorMotivo", () => {
  it("agrupa por motivo dentro del rango (día Lima) y ordena por n", () => {
    const motivos = [motivo("m1", "Precio"), motivo("m2", "Sin respuesta")]
    const ops = [
      op({ etapa_id: "e1", estado: "perdida", motivo_perdida_id: "m2", importe: 10, perdida_at: "2026-06-10T12:00:00.000Z" }),
      op({ etapa_id: "e1", estado: "perdida", motivo_perdida_id: "m2", importe: 20, perdida_at: "2026-07-10T12:00:00.000Z" }),
      op({ etapa_id: "e1", estado: "perdida", motivo_perdida_id: "m1", importe: 300, perdida_at: "2026-07-11T12:00:00.000Z" }),
      // 2026-04-01 03:00 UTC = 31 de marzo en Lima: fuera del rango
      op({ etapa_id: "e1", estado: "perdida", motivo_perdida_id: "m1", importe: 999, perdida_at: "2026-04-01T03:00:00.000Z" }),
      op({ etapa_id: "e1", estado: "abierta" }),
    ]
    const filas = perdidasPorMotivo(ops, { desde: "2026-04-01", hasta: "2026-09-12" }, motivos)
    expect(filas).toEqual([
      { motivoId: "m2", motivo: "Sin respuesta", n: 2, suma: 30 },
      { motivoId: "m1", motivo: "Precio", n: 1, suma: 300 },
    ])
  })
})

// ---------- Vencidas por responsable ----------

describe("vencidasPorResponsable", () => {
  it("agrupa pendientes vencidas por responsable con la más antigua", () => {
    const tareas = [
      tarea({ responsable_id: "u1", vence_at: "2026-09-10T14:00:00.000Z" }),
      tarea({ responsable_id: "u1", vence_at: "2026-09-01T14:00:00.000Z" }),
      tarea({ responsable_id: "u2", vence_at: "2026-09-11T14:00:00.000Z" }),
      tarea({ responsable_id: "u2", vence_at: "2026-09-30T14:00:00.000Z" }), // futura
      tarea({ responsable_id: "u2", vence_at: "2026-09-01T14:00:00.000Z", estado: "hecha" }),
    ]
    const filas = vencidasPorResponsable(tareas, USUARIOS, AHORA)
    expect(filas).toEqual([
      { responsableId: "u1", nombre: "Ana", n: 2, masAntigua: "2026-09-01T14:00:00.000Z" },
      { responsableId: "u2", nombre: "Beto", n: 1, masAntigua: "2026-09-11T14:00:00.000Z" },
    ])
  })
})
