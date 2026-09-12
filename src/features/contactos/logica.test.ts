import { describe, expect, it } from "vitest"
import type { ContactoConRelaciones } from "@/lib/types"
import {
  COLUMNAS_EXPORTACION_CONTACTOS,
  DIAS_SIN_SEGUIMIENTO,
  FILTROS_URL_CONTACTOS,
  estaSinSeguimiento,
  filaExportacionContacto,
  filtrosEfectivosContactos,
  mismoTelefono,
  textoDocumento,
  tituloOportunidadPorDefecto,
  verSoloMios,
} from "./logica"

const AHORA = new Date("2026-09-12T15:00:00Z")

function haceDias(dias: number): string {
  return new Date(AHORA.getTime() - dias * 24 * 60 * 60 * 1000).toISOString()
}

describe("estaSinSeguimiento", () => {
  it("sin actividad registrada: sin seguimiento", () => {
    expect(estaSinSeguimiento({ ultimaActividadAt: null }, AHORA)).toBe(true)
    expect(estaSinSeguimiento({ ultimaActividadAt: undefined }, AHORA)).toBe(true)
    expect(estaSinSeguimiento({ ultimaActividadAt: "" }, AHORA)).toBe(true)
  })
  it("actividad reciente: con seguimiento", () => {
    expect(estaSinSeguimiento({ ultimaActividadAt: haceDias(0) }, AHORA)).toBe(false)
    expect(estaSinSeguimiento({ ultimaActividadAt: haceDias(13) }, AHORA)).toBe(false)
    expect(estaSinSeguimiento({ ultimaActividadAt: haceDias(DIAS_SIN_SEGUIMIENTO) }, AHORA)).toBe(false)
  })
  it("actividad hace más de 14 días: sin seguimiento", () => {
    expect(estaSinSeguimiento({ ultimaActividadAt: haceDias(DIAS_SIN_SEGUIMIENTO + 0.5) }, AHORA)).toBe(true)
    expect(estaSinSeguimiento({ ultimaActividadAt: haceDias(60) }, AHORA)).toBe(true)
  })
  it("una tarea pendiente siempre cuenta como seguimiento", () => {
    expect(estaSinSeguimiento({ ultimaActividadAt: null, tienePendiente: true }, AHORA)).toBe(false)
    expect(estaSinSeguimiento({ ultimaActividadAt: haceDias(90), tienePendiente: true }, AHORA)).toBe(false)
  })
  it("sin tarea pendiente se aplica la regla de los 14 días", () => {
    expect(estaSinSeguimiento({ ultimaActividadAt: haceDias(2), tienePendiente: false }, AHORA)).toBe(false)
    expect(estaSinSeguimiento({ ultimaActividadAt: haceDias(20), tienePendiente: false }, AHORA)).toBe(true)
    expect(estaSinSeguimiento({ ultimaActividadAt: null, tienePendiente: false }, AHORA)).toBe(true)
  })
  it("fecha inválida: sin seguimiento", () => {
    expect(estaSinSeguimiento({ ultimaActividadAt: "no es fecha" }, AHORA)).toBe(true)
  })
})

describe("tituloOportunidadPorDefecto", () => {
  it("une nombre y título por defecto con guion largo", () => {
    expect(tituloOportunidadPorDefecto("Juan Pérez", "Facturación electrónica")).toBe("Juan Pérez – Facturación electrónica")
  })
  it("limpia espacios sobrantes del nombre", () => {
    expect(tituloOportunidadPorDefecto("  Juan   Pérez ", "Facturación electrónica")).toBe("Juan Pérez – Facturación electrónica")
  })
  it("sin nombre devuelve solo el título por defecto", () => {
    expect(tituloOportunidadPorDefecto("", "Facturación electrónica")).toBe("Facturación electrónica")
    expect(tituloOportunidadPorDefecto(null, "Facturación electrónica")).toBe("Facturación electrónica")
  })
  it("sin título por defecto devuelve solo el nombre", () => {
    expect(tituloOportunidadPorDefecto("Juan Pérez", "")).toBe("Juan Pérez")
    expect(tituloOportunidadPorDefecto("Juan Pérez", undefined)).toBe("Juan Pérez")
  })
  it("sin nada devuelve cadena vacía", () => {
    expect(tituloOportunidadPorDefecto("", "")).toBe("")
  })
})

describe("filtros Mios / Todos", () => {
  it("por defecto: Mios para miembros, Todos para el administrador", () => {
    expect(verSoloMios("", false)).toBe(true)
    expect(verSoloMios("", true)).toBe(false)
    expect(verSoloMios("mios", true)).toBe(true)
    expect(verSoloMios("todos", false)).toBe(false)
  })
  it("Mios fija responsableId al usuario actual; Todos lo deja libre", () => {
    const base = { ...FILTROS_URL_CONTACTOS, texto: "juan", origenId: "o1", sinSeguimiento: true }
    expect(filtrosEfectivosContactos({ ...base, quien: "" }, "u1", false)).toEqual({
      texto: "juan",
      responsableId: "u1",
      origenId: "o1",
      sinSeguimiento: true,
      desde: "",
      hasta: "",
      orden: "nombre",
    })
    expect(filtrosEfectivosContactos({ ...base, quien: "todos" }, "u1", false).responsableId).toBe("")
    expect(filtrosEfectivosContactos({ ...base, quien: "" }, "u1", true).responsableId).toBe("")
    expect(filtrosEfectivosContactos({ ...base, quien: "mios" }, "u1", true).responsableId).toBe("u1")
  })
  it("sin sesión no filtra por responsable", () => {
    expect(filtrosEfectivosContactos({ ...FILTROS_URL_CONTACTOS, quien: "mios" }, null, false).responsableId).toBe("")
  })
})

describe("textoDocumento", () => {
  it("tipo y número", () => {
    expect(textoDocumento("DNI", "12345678")).toBe("DNI 12345678")
    expect(textoDocumento("RUC", " 20123456789 ")).toBe("RUC 20123456789")
  })
  it("sin número no muestra nada; sin tipo solo el número", () => {
    expect(textoDocumento("DNI", "")).toBe("")
    expect(textoDocumento(null, "12345678")).toBe("12345678")
  })
})

describe("mismoTelefono", () => {
  it("compara el número normalizado", () => {
    expect(mismoTelefono("+51987654321", { telefono: "+51987654321" })).toBe(true)
    expect(mismoTelefono("+51987654321", { telefono: "+51987654322" })).toBe(false)
    expect(mismoTelefono(null, { telefono: null })).toBe(false)
  })
})

describe("filaExportacionContacto", () => {
  const contacto: ContactoConRelaciones = {
    id: "c1",
    nombre: "Juan Pérez",
    empresa: "Bodega Juan",
    doc_tipo: "RUC",
    doc_numero: "20123456789",
    telefono: "+51987654321",
    telefono_raw: "987 654 321",
    email: "juan@correo.com",
    direccion: null,
    origen_id: "o1",
    responsable_id: "u1",
    notas: null,
    extra: {},
    importacion_id: null,
    fila_origen: null,
    requiere_revision: false,
    ultima_actividad_at: "2026-09-10T20:30:00Z",
    created_by: "u1",
    created_at: "2026-09-01T14:05:00Z",
    updated_at: "2026-09-01T14:05:00Z",
    origen: { id: "o1", nombre: "Referido", orden: 1, activo: true, created_at: "", updated_at: "" },
    responsable: { id: "u1", nombre: "Ana", email: "ana@estudio.pe", rol: "miembro", activo: true, created_at: "", updated_at: "" },
  }

  it("usa nombres legibles y fechas en Lima", () => {
    const fila = filaExportacionContacto(contacto)
    expect(fila).toEqual({
      nombre: "Juan Pérez",
      empresa: "Bodega Juan",
      celular: "987 654 321",
      correo: "juan@correo.com",
      documento: "RUC 20123456789",
      origen: "Referido",
      responsable: "Ana",
      ultima_actividad: "10/09/2026 15:30",
      creado: "01/09/2026 09:05",
    })
  })
  it("cae al teléfono crudo y a vacíos cuando faltan datos", () => {
    const fila = filaExportacionContacto({
      ...contacto,
      telefono: null,
      telefono_raw: "12345",
      empresa: null,
      email: null,
      doc_numero: null,
      origen: null,
      responsable: null,
      ultima_actividad_at: null,
    })
    expect(fila.celular).toBe("12345")
    expect(fila.empresa).toBe("")
    expect(fila.correo).toBe("")
    expect(fila.documento).toBe("")
    expect(fila.origen).toBe("")
    expect(fila.responsable).toBe("")
    expect(fila.ultima_actividad).toBe("")
  })
  it("todas las columnas exportadas existen en la fila", () => {
    const fila = filaExportacionContacto(contacto)
    for (const col of COLUMNAS_EXPORTACION_CONTACTOS) expect(col.clave in fila).toBe(true)
  })
})
