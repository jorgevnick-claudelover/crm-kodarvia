/**
 * Pruebas de la lógica pura de importación (criterio 6) contra la hoja real de
 * ejemplo: fixtures/hoja-ejemplo.xlsx, leída aquí con la librería xlsx desde Node.
 *
 * Lo que se comprueba (fixtures/README.md manda):
 *  - la cabecera está en la fila 2 y se detecta sola;
 *  - hay 20 filas no vacías y NINGUNA se descarta (creadas + fusionadas + para revisar = 20);
 *  - la pestaña "Notas" no se importa;
 *  - teléfonos de todos los formatos normalizados a +51;
 *  - importes con "S/" y comas de miles;
 *  - las tres formas de fecha (dd/mm/yyyy, ISO y serial de Excel);
 *  - el duplicado exacto se fusiona y el casi duplicado con otro nombre NO;
 *  - la fila TOTAL y la fila con solo observaciones se importan marcadas para revisar.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import * as XLSX from "xlsx"
import { hojasDesdeLibro } from "./leerArchivo"
import {
  type CatalogosImportacion,
  type ColumnaHoja,
  type ContactoExistente,
  type FilaNormalizada,
  type HojaLeida,
  type Mapeo,
  type PlanFila,
  columnasDeHoja,
  describirResultado,
  detectarFilaCabecera,
  filasDeDatos,
  normalizarFilas,
  parsearFechaHoja,
  parsearImporteHoja,
  planificarImportacion,
  sugerirEquivalencias,
  sugerirMapeo,
  valoresDeCatalogos,
} from "./mapeo"

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const RUTA_FIXTURE = path.resolve(__dirname, "../../../fixtures/hoja-ejemplo.xlsx")

function leerFixture(): HojaLeida[] {
  const libro = XLSX.read(readFileSync(RUTA_FIXTURE), { type: "buffer", cellDates: false })
  return hojasDesdeLibro(libro)
}

const hojas = leerFixture()
const hojaContactos = hojas.find((h) => h.nombre === "Contactos") as HojaLeida
const indiceCabecera = detectarFilaCabecera(hojaContactos.filas)
const columnas: ColumnaHoja[] = columnasDeHoja(hojaContactos.filas, indiceCabecera)
const mapeo: Mapeo = sugerirMapeo(columnas)
const filas: FilaNormalizada[] = normalizarFilas(hojaContactos.filas, indiceCabecera, mapeo, columnas)

/** Catálogos como los deja la semilla (src/lib/semilla.ts), con dos vendedoras y un administrador. */
const catalogos: CatalogosImportacion = {
  etapas: [
    { id: "e1", nombre: "Nuevo contacto" },
    { id: "e2", nombre: "Contactado" },
    { id: "e3", nombre: "Reunión" },
    { id: "e4", nombre: "Propuesta enviada" },
    { id: "e5", nombre: "Negociación" },
  ],
  origenes: [
    { id: "o1", nombre: "Referido" },
    { id: "o2", nombre: "WhatsApp" },
    { id: "o3", nombre: "Redes sociales" },
    { id: "o4", nombre: "Web" },
    { id: "o5", nombre: "Llamada entrante" },
    { id: "o6", nombre: "Evento" },
    { id: "o7", nombre: "Otro" },
  ],
  usuarios: [
    { id: "u-admin", nombre: "Rocío Valdivia", email: "admin@estudio.pe" },
    { id: "u-ana", nombre: "Ana García", email: "ana@estudio.pe" },
    { id: "u-luis", nombre: "Luis Quispe", email: "luis@estudio.pe" },
  ],
  motivos: [
    { id: "m-precio", nombre: "Precio" },
    { id: "m-otro", nombre: "Otro" },
  ],
  adminId: "u-admin",
}

function planDe(existentes: ContactoExistente[] = []) {
  const valores = valoresDeCatalogos(filas, catalogos)
  const equivalencias = sugerirEquivalencias(valores, catalogos)
  return planificarImportacion(filas, {
    mapeo,
    equivalencias,
    catalogos,
    existentes,
    tituloDefault: "Facturación electrónica",
    importeDefault: 0,
  })
}

const plan = planDe()

function fila(numero: number): FilaNormalizada {
  const f = filas.find((x) => x.fila === numero)
  if (!f) throw new Error(`No hay fila ${numero} en la hoja`)
  return f
}

function planFila(numero: number): PlanFila {
  const p = plan.filas.find((x) => x.fila === numero)
  if (!p) throw new Error(`La fila ${numero} no aparece en el plan (se habría descartado)`)
  return p
}

// ---------------------------------------------------------------------------

describe("hoja de ejemplo", () => {
  it("tiene la pestaña Contactos y la pestaña Notas, y solo se importa Contactos", () => {
    expect(hojas.map((h) => h.nombre)).toEqual(["Contactos", "Notas"])
    const notas = hojas.find((h) => h.nombre === "Notas") as HojaLeida
    // La pestaña "Notas" existe pero no aporta ninguna fila a la importación.
    expect(notas.filas.length).toBeGreaterThan(0)
    expect(plan.filas.every((p) => p.datos.nombre !== "Notas sueltas")).toBe(true)
  })

  it("detecta la cabecera en la fila 2 (índice 1), no en el título de la fila 1", () => {
    expect(indiceCabecera).toBe(1)
    expect(columnas.map((c) => c.nombre)).toEqual([
      "Nombre",
      "Empresa / Negocio",
      "Celular",
      "Correo",
      "RUC / DNI",
      "Origen",
      "Vendedor",
      "Etapa",
      "Monto (S/)",
      "Fecha",
      "Observaciones",
    ])
  })

  it("tiene 22 filas de datos, 20 no vacías", () => {
    expect(filasDeDatos(hojaContactos.filas, indiceCabecera)).toHaveLength(22)
    expect(filas).toHaveLength(22)
    expect(filas.filter((f) => !f.vacia)).toHaveLength(20)
    // Los datos empiezan en la fila 3 de la hoja (la que ve el usuario en Excel).
    expect(filas[0].fila).toBe(3)
    expect(fila(3).nombre).toBe("Juan Pérez Quispe")
  })
})

describe("sugerencia de mapeo", () => {
  it("reconoce las columnas de la hoja del cliente", () => {
    const porNombre = Object.fromEntries(columnas.map((c) => [c.nombre, mapeo[c.indice]]))
    expect(porNombre).toEqual({
      Nombre: "nombre",
      "Empresa / Negocio": "empresa",
      Celular: "telefono",
      Correo: "email",
      "RUC / DNI": "doc_numero",
      Origen: "origen",
      Vendedor: "responsable",
      Etapa: "etapa",
      "Monto (S/)": "importe",
      Fecha: "fecha",
      Observaciones: "notas",
    })
  })
})

describe("normalización de teléfonos", () => {
  it("lleva todos los formatos de la hoja a +51", () => {
    expect(fila(3).telefono).toBe("+51987654321") // número de Excel 987654321
    expect(fila(4).telefono).toBe("+51987111222") // "+51 987 111 222"
    expect(fila(5).telefono).toBe("+51955444333") // "51-955444333"
    expect(fila(6).telefono).toBe("+5154123456") // fijo "054-123456"
    expect(fila(7).telefono).toBe("+51955123456") // "9 5 5 1 2 3 4 5 6"
    expect(fila(9).telefono).toBe("+51944222111") // "944222111 / 987000111"
    expect(fila(16).telefono).toBe("+5154654321") // fijo "(054) 654321"
    expect(fila(17).telefono).toBe("+51987555444") // "987 555 444"
    expect(fila(20).telefono).toBe("+51987123123") // "0051987123123"
    expect(fila(21).telefono).toBe("+51987123123") // "987123123" (mismo número, otra persona)
    // Todos los teléfonos reconocidos quedan en E.164 peruano.
    for (const f of filas.filter((x) => x.telefono)) expect(f.telefono).toMatch(/^\+51\d{8,9}$/)
  })

  it("guarda el segundo número de la celda con dos teléfonos", () => {
    expect(fila(9).extra.telefono2).toBe("+51987000111")
  })

  it("conserva el texto original del teléfono", () => {
    expect(fila(7).telefono_raw).toBe("9 5 5 1 2 3 4 5 6")
  })
})

describe("importes", () => {
  it("entiende números, texto con S/ y comas de miles", () => {
    expect(fila(3).importe).toBe(120) // número
    expect(fila(4).importe).toBe(150) // "S/ 150"
    expect(fila(6).importe).toBe(350.5) // decimal con punto
    expect(fila(7).importe).toBe(1200) // "1,200"
    expect(fila(18).importe).toBe(320) // "S/ 320.00"
    expect(fila(24).importe).toBe(4020.5) // fila TOTAL
  })

  it("parsea los formatos sueltos habituales", () => {
    expect(parsearImporteHoja("S/ 1,250.50")).toBe(1250.5)
    expect(parsearImporteHoja("1.250,50")).toBe(1250.5)
    expect(parsearImporteHoja("S/")).toBeNull()
  })
})

describe("fechas", () => {
  it("entiende dd/mm/yyyy, ISO y el serial de Excel", () => {
    expect(fila(3).fecha).toBe("2026-08-12") // "12/08/2026"
    expect(fila(5).fecha).toBe("2026-08-15") // "2026-08-15" (ISO)
    expect(fila(4).fecha).toBe("2025-08-02") // serial de Excel 45871
    expect(fila(7).fecha).toBeNull() // vacía
  })

  it("parsea las tres formas por separado", () => {
    expect(parsearFechaHoja("12/08/2026")).toBe("2026-08-12")
    expect(parsearFechaHoja("2026-08-15")).toBe("2026-08-15")
    expect(parsearFechaHoja(45871)).toBe("2025-08-02")
  })
})

describe("plan de importación: cero filas descartadas (criterio 6)", () => {
  it("creadas + fusionadas + para revisar = 20 y ninguna fila se pierde", () => {
    const { recuento } = plan
    expect(recuento.total).toBe(22)
    expect(recuento.noVacias).toBe(20)
    expect(recuento.crear + recuento.fusionar + recuento.revisar).toBe(20)
    // Toda fila no vacía aparece una sola vez en el plan; las vacías, nunca.
    expect(plan.filas).toHaveLength(20)
    const numeros = plan.filas.map((p) => p.fila)
    expect(new Set(numeros).size).toBe(20)
    const noVacias = filas.filter((f) => !f.vacia).map((f) => f.fila)
    expect(numeros.sort((a, b) => a - b)).toEqual(noVacias.sort((a, b) => a - b))
    // Descartadas: siempre 0.
    const descartadas = filas.filter((f) => !f.vacia && !numeros.includes(f.fila))
    expect(descartadas).toHaveLength(0)
  })

  it("crea oportunidades porque se mapearon etapa e importe", () => {
    expect(plan.creaOportunidades).toBe(true)
    expect(planFila(3).oportunidad?.importe).toBe(120)
    expect(planFila(9).oportunidad?.estado).toBe("ganada") // "Cerrado ganado"
    expect(planFila(10).oportunidad?.estado).toBe("perdida") // "Perdido"
    expect(planFila(10).oportunidad?.motivoPerdidaId).toBe("m-otro")
  })
})

describe("duplicados", () => {
  it("fusiona la fila duplicada exacta de Juan Pérez", () => {
    const p = planFila(11)
    expect(p.resultado).toBe("fusionado")
    expect(p.fusionarCon).toEqual({ origen: "archivo", fila: 3, nombre: "Juan Pérez Quispe" })
    expect(describirResultado(p)).toBe("Fusionar con Juan Pérez Quispe")
  })

  it("fusiona JUAN PEREZ QUISPE (mismo celular y el mismo nombre sin tildes)", () => {
    const p = planFila(12)
    expect(p.resultado).toBe("fusionado")
    expect(p.fusionarCon).toEqual({ origen: "archivo", fila: 3, nombre: "Juan Pérez Quispe" })
  })

  it("son exactamente 2 las fusionadas", () => {
    expect(plan.recuento.fusionar).toBe(2)
  })

  it("NO fusiona en silencio a Valeria Cruz, que comparte celular con Diego Ramos", () => {
    const p = planFila(21)
    expect(p.resultado).toBe("revisar")
    expect(p.fusionarCon).toBeNull()
    expect(p.contacto?.nombre).toBe("Valeria Cruz")
    expect(p.contacto?.requiere_revision).toBe(true)
    expect(p.motivos.join(" ")).toMatch(/celular que Diego Ramos/i)
    expect(p.motivos.join(" ")).toMatch(/nombre es distinto/i)
  })

  it("fusiona contra un contacto que ya está en el CRM", () => {
    const planConBase = planDe([
      { id: "c-1", nombre: "Juan Pérez Quispe", telefono: "+51987654321", email: null, doc_numero: null },
    ])
    const p = planConBase.filas.find((x) => x.fila === 3) as PlanFila
    expect(p.resultado).toBe("fusionado")
    expect(p.fusionarCon).toEqual({ origen: "base", id: "c-1", nombre: "Juan Pérez Quispe" })
    expect(planConBase.recuento.crear + planConBase.recuento.fusionar + planConBase.recuento.revisar).toBe(20)
  })
})

describe("filas raras: se importan igual, marcadas para revisar", () => {
  it("la fila con solo observaciones entra con nombre generado", () => {
    const p = planFila(14)
    expect(p.resultado).toBe("revisar")
    expect(p.contacto?.nombre).toBe("(Sin nombre) fila 14")
    expect(p.contacto?.requiere_revision).toBe(true)
    expect(p.motivos).toContain("Sin nombre, celular ni correo")
    expect(p.contacto?.notas).toMatch(/panader/i)
  })

  it("la fila TOTAL entra marcada para revisar", () => {
    const p = planFila(24)
    expect(p.resultado).toBe("revisar")
    expect(p.contacto?.nombre).toBe("TOTAL")
    expect(p.contacto?.requiere_revision).toBe(true)
    expect(p.motivos).toContain("Sin celular ni correo")
  })

  it("Elena Vilca (solo nombre) se importa para revisar", () => {
    const p = planFila(13)
    expect(p.resultado).toBe("revisar")
    expect(p.contacto?.nombre).toBe("Elena Vilca")
    expect(p.motivos).toContain("Sin celular ni correo")
  })

  it("Ricardo Flores queda para el administrador porque Carmen ya no trabaja aquí", () => {
    const p = planFila(22)
    expect(p.resultado).toBe("revisar")
    expect(p.contacto?.responsable).toEqual({ tipo: "admin" })
    expect(p.motivos.join(" ")).toMatch(/Carmen/)
  })

  it("al menos 5 filas quedan para revisar", () => {
    expect(plan.recuento.revisar).toBeGreaterThanOrEqual(5)
    const paraRevisar = plan.filas.filter((p) => p.resultado === "revisar").map((p) => p.fila)
    expect(paraRevisar).toEqual(expect.arrayContaining([10, 13, 14, 21, 22, 24]))
  })

  it("limpia los espacios sobrantes del nombre", () => {
    expect(fila(18).nombre).toBe("Roberto Salas")
  })
})

describe("equivalencias de catálogos", () => {
  const valores = valoresDeCatalogos(filas, catalogos)
  const equivalencias = sugerirEquivalencias(valores, catalogos)

  it("reconoce los orígenes del catálogo y propone crear Facebook", () => {
    expect(equivalencias.origenes["referido"]).toEqual({ tipo: "existente", id: "o1" })
    expect(equivalencias.origenes["facebook"]).toEqual({ tipo: "crear" })
  })

  it("interpreta 'Cerrado ganado' y 'Perdido' como estados, no como etapas", () => {
    expect(equivalencias.etapas["cerrado ganado"]).toEqual({ tipo: "estado", estado: "ganada" })
    expect(equivalencias.etapas["perdido"]).toEqual({ tipo: "estado", estado: "perdida" })
    expect(equivalencias.etapas["contactado"]).toEqual({ tipo: "existente", id: "e2" })
  })

  it("empareja a las vendedoras por nombre corto y manda Carmen al administrador", () => {
    expect(equivalencias.responsables["ana"]).toEqual({ tipo: "existente", id: "u-ana" })
    expect(equivalencias.responsables["luis q"]).toEqual({ tipo: "existente", id: "u-luis" })
    expect(equivalencias.responsables["carmen"]).toEqual({ tipo: "admin" })
  })
})
