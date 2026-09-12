/**
 * Prueba de humo: las pantallas del módulo renderizan con datos simulados
 * (sin Supabase) tanto en computadora (tablero) como en celular (lista por etapa).
 */
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Etapa, HistorialEtapa, MotivoPerdida, OportunidadConRelaciones, Origen, Usuario } from "@/lib/types"

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const usuario: Usuario = { id: "u1", nombre: "Ana Quispe", email: "ana@estudio.pe", rol: "admin", activo: true, created_at: "", updated_at: "" }
const etapas: Etapa[] = [
  { id: "e1", nombre: "Nuevo", orden: 1, color: "sky", activa: true, created_at: "", updated_at: "" },
  { id: "e2", nombre: "Contactado", orden: 2, color: "teal", activa: true, created_at: "", updated_at: "" },
  { id: "e3", nombre: "Propuesta", orden: 3, color: "amber", activa: true, created_at: "", updated_at: "" },
]
const motivos: MotivoPerdida[] = [{ id: "m1", nombre: "Precio", orden: 1, activo: true, created_at: "", updated_at: "" }]
const origenes: Origen[] = [{ id: "o1", nombre: "Referido", orden: 1, activo: true, created_at: "", updated_at: "" }]

const contacto = {
  id: "c1",
  nombre: "Juan Pérez",
  empresa: "Bodega Juan",
  doc_tipo: null,
  doc_numero: null,
  telefono: "+51987654321",
  telefono_raw: null,
  email: null,
  direccion: null,
  origen_id: "o1",
  responsable_id: "u1",
  notas: null,
  extra: {},
  importacion_id: null,
  fila_origen: null,
  requiere_revision: false,
  ultima_actividad_at: null,
  created_by: null,
  created_at: "2026-09-01T15:00:00Z",
  updated_at: "2026-09-01T15:00:00Z",
}

const oportunidades: OportunidadConRelaciones[] = [
  {
    id: "op1",
    contacto_id: "c1",
    titulo: "Juan Pérez – Facturación electrónica",
    importe: 1250,
    moneda: "PEN",
    etapa_id: "e1",
    estado: "abierta",
    posicion: 1,
    responsable_id: "u1",
    motivo_perdida_id: null,
    detalle_perdida: null,
    fecha_cierre_prevista: "2026-09-30",
    ganada_at: null,
    perdida_at: null,
    created_by: "u1",
    created_at: "2026-09-01T15:00:00Z",
    updated_at: "2026-09-05T15:00:00Z",
    contacto,
    etapa: etapas[0],
    responsable: usuario,
    motivo_perdida: null,
  },
  {
    id: "op2",
    contacto_id: "c1",
    titulo: "Juan Pérez – Planilla",
    importe: 300.5,
    moneda: "PEN",
    etapa_id: "e2",
    estado: "abierta",
    posicion: 2,
    responsable_id: "u1",
    motivo_perdida_id: null,
    detalle_perdida: null,
    fecha_cierre_prevista: null,
    ganada_at: null,
    perdida_at: null,
    created_by: "u1",
    created_at: "2026-09-02T15:00:00Z",
    updated_at: "2026-09-02T15:00:00Z",
    contacto,
    etapa: etapas[1],
    responsable: usuario,
    motivo_perdida: null,
  },
]

const historial: HistorialEtapa[] = [
  { id: 1, oportunidad_id: "op1", de_etapa_id: null, a_etapa_id: "e1", de_estado: null, a_estado: "abierta", usuario_id: "u1", created_at: "2026-09-01T15:00:00Z" },
]

vi.mock("@/lib/supabase", () => ({ supabase: {}, supabaseConfigurado: false }))
vi.mock("@/hooks/useUsuarioActual", () => ({
  useUsuarioActual: () => ({ usuario, uid: "u1", email: usuario.email, esAdmin: true, cargando: false, error: null }),
}))
vi.mock("@/lib/api/catalogos", () => ({
  listarEtapas: async () => etapas,
  listarMotivos: async () => motivos,
  listarOrigenes: async () => origenes,
}))
vi.mock("@/lib/api/usuarios", () => ({ listar: async () => [usuario], obtener: async () => usuario }))
vi.mock("@/lib/api/configuracion", () => ({
  CONFIGURACION_DEFAULT: { timezone: "America/Lima", moneda: "PEN", hora_recordatorio: "09:00", importe_default: 0, nombre_empresa: "Estudio", titulo_oportunidad_default: "Facturación electrónica", url_app: "" },
  obtenerTodo: async () => ({ timezone: "America/Lima", moneda: "PEN", hora_recordatorio: "09:00", importe_default: 0, nombre_empresa: "Estudio", titulo_oportunidad_default: "Facturación electrónica", url_app: "" }),
  guardar: async () => undefined,
  guardarVarias: async () => undefined,
}))
vi.mock("@/lib/api/oportunidades", () => ({
  FILTROS_OPORTUNIDADES_DEFAULT: { texto: "", responsableId: "", origenId: "", etapaId: "", estado: "abierta", sinSeguimiento: false, conTareaVencida: false, desde: "", hasta: "", orden: "posicion" },
  listar: async () => oportunidades,
  listarTodo: async () => oportunidades,
  obtener: async (id: string) => oportunidades.find((o) => o.id === id),
  historial: async () => historial,
  mover: async () => undefined,
}))
vi.mock("@/lib/api/oportunidadesTablero", () => ({
  cerradasEsteMes: async () => ({ ganadas: 2, importeGanado: 3000, perdidas: 1, desde: "2026-09-01" }),
  ultimoCambioEtapa: async () => ({ op1: "2026-09-05T15:00:00Z" }),
}))
vi.mock("@/lib/api/comun", () => ({
  resumenTareasPendientes: async () => ({
    contactosConPendiente: new Set<string>(),
    contactosConVencida: new Set<string>(),
    oportunidadesConPendiente: new Set<string>(["op2"]),
    oportunidadesConVencida: new Set<string>(["op2"]),
  }),
}))
vi.mock("@/lib/api/tareas", () => ({ listar: async () => [] }))
vi.mock("@/lib/api/actividades", () => ({ listarPorContacto: async () => [] }))
vi.mock("@/lib/api/contactos", () => ({ obtener: async () => contacto, buscarRapido: async () => [] }))

const { PaginaOportunidades } = await import("./PaginaOportunidades")
const { PaginaOportunidad } = await import("./PaginaOportunidad")

let contenedor: HTMLDivElement
let root: Root

function simularAncho(esMovil: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (consulta: string) => ({
      matches: consulta.includes("max-width") ? esMovil : false,
      media: consulta,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

async function montar(ruta: string, esMovil: boolean) {
  simularAncho(esMovil)
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <QueryClientProvider client={cliente}>
        <MemoryRouter initialEntries={[ruta]}>
          <Routes>
            <Route path="/oportunidades" element={<PaginaOportunidades />} />
            <Route path="/oportunidades/:id" element={<PaginaOportunidad />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
  })
  // Deja que resuelvan las consultas simuladas.
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
  }
}

describe("pantallas de oportunidades (humo)", () => {
  beforeEach(() => {
    contenedor = document.createElement("div")
    document.body.appendChild(contenedor)
    root = createRoot(contenedor)
  })
  afterEach(() => {
    act(() => root.unmount())
    contenedor.remove()
  })

  it("en computadora muestra el tablero con columnas, sumas y el pie de cerradas", async () => {
    await montar("/oportunidades", false)
    const texto = contenedor.textContent ?? ""
    expect(texto).toContain("Nuevo")
    expect(texto).toContain("Contactado")
    expect(texto).toContain("Propuesta")
    expect(texto).toContain("S/ 1,250.00")
    expect(texto).toContain("S/ 300.50")
    expect(texto).toContain("Cerradas este mes")
    expect(texto).toContain("2 ganadas")
    expect(texto).toContain("1 perdida")
    expect(contenedor.querySelector('[aria-label="Soltar para marcar como perdida"]')).not.toBeNull()
    expect(contenedor.querySelectorAll('[data-testid="tarjeta-oportunidad"]').length).toBe(2)
  })

  it("en celular muestra chips de etapa con contador y las tarjetas de la primera etapa", async () => {
    await montar("/oportunidades", true)
    const chips = [...contenedor.querySelectorAll('[role="tab"]')].map((c) => c.textContent?.replace(/\s+/g, " ").trim())
    expect(chips).toEqual(["Nuevo1", "Contactado1", "Propuesta0", "Ganadas", "Perdidas"])
    const tarjetas = contenedor.querySelectorAll('[data-testid="tarjeta-oportunidad"]')
    expect(tarjetas.length).toBe(1)
    expect(tarjetas[0].textContent).toContain("Juan Pérez")
    expect(tarjetas[0].textContent).toContain("Mover a")
    expect(tarjetas[0].textContent).toContain("Contactado")
  })

  it("el detalle muestra cabecera, stepper, botones e historial", async () => {
    await montar("/oportunidades/op1", false)
    const texto = contenedor.textContent ?? ""
    expect(texto).toContain("Juan Pérez – Facturación electrónica")
    expect(texto).toContain("Abierta")
    expect(texto).toContain("S/ 1,250.00")
    expect(texto).toContain("Ana Quispe")
    expect(texto).toContain("30/09/2026")
    expect(texto).toContain("Ganar")
    expect(texto).toContain("Perder")
    expect(texto).toContain("Historial de etapas")
    expect(texto).toContain("Creada en Nuevo")
    expect(texto).toContain("Sin tareas pendientes")
  })
})
