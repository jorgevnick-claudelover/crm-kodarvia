/**
 * Prueba de humo en jsdom: las pantallas y formularios del módulo renderizan con datos
 * simulados sin lanzar errores (no hay proyecto Supabase para probar contra datos reales).
 */
import { act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Contacto, TareaConRelaciones, Usuario } from "@/lib/types"

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

const usuario: Usuario = { id: "u1", nombre: "Rosa Quispe", email: "rosa@estudio.pe", rol: "miembro", activo: true, created_at: "", updated_at: "" }
const contacto: Contacto = {
  id: "c1",
  nombre: "Juan Pérez",
  empresa: "Ferretería Pérez",
  doc_tipo: null,
  doc_numero: null,
  telefono: "+51987654321",
  telefono_raw: "987654321",
  email: null,
  direccion: null,
  origen_id: null,
  responsable_id: "u1",
  notas: null,
  extra: {},
  importacion_id: null,
  fila_origen: null,
  requiere_revision: false,
  ultima_actividad_at: null,
  created_by: "u1",
  created_at: "",
  updated_at: "",
}
const tareas: TareaConRelaciones[] = [
  {
    id: "t1",
    contacto_id: "c1",
    oportunidad_id: null,
    titulo: "Llamar a Juan Pérez",
    vence_at: "2026-09-15T13:00:00Z",
    recordatorio_at: "2026-09-15T13:00:00Z",
    responsable_id: "u1",
    estado: "pendiente",
    hecha_at: null,
    recordatorio_visto_at: null,
    created_by: "u1",
    created_at: "",
    updated_at: "",
    contacto,
    oportunidad: null,
    responsable: usuario,
  },
  {
    id: "t2",
    contacto_id: null,
    oportunidad_id: null,
    titulo: "Preparar propuesta",
    vence_at: "2026-09-15T21:00:00Z",
    recordatorio_at: "2026-09-15T21:00:00Z",
    responsable_id: "u1",
    estado: "pendiente",
    hecha_at: null,
    recordatorio_visto_at: null,
    created_by: "u1",
    created_at: "",
    updated_at: "",
    contacto: null,
    oportunidad: null,
    responsable: usuario,
  },
]

vi.mock("@/hooks/useUsuarioActual", () => ({
  useUsuarioActual: () => ({ usuario, uid: "u1", email: usuario.email, esAdmin: false, cargando: false, error: null }),
}))
vi.mock("@/lib/api/tareas", async (importar) => {
  const real = await importar<typeof import("@/lib/api/tareas")>()
  return {
    ...real,
    listar: vi.fn(async () => tareas),
    listarTodo: vi.fn(async () => tareas),
    obtener: vi.fn(async (id: string) => tareas.find((t) => t.id === id) ?? tareas[0]),
    listarRecordatoriosPendientes: vi.fn(async () => [tareas[0]]),
    tienePendiente: vi.fn(async () => true),
  }
})
vi.mock("@/lib/api/contactos", () => ({ obtener: vi.fn(async () => contacto), buscarRapido: vi.fn(async () => [contacto]), crear: vi.fn(async () => contacto) }))
vi.mock("@/lib/api/oportunidades", () => ({ listarPorContacto: vi.fn(async () => []) }))
vi.mock("@/lib/api/actividades", () => ({
  listarPorContacto: vi.fn(async () => [
    { id: "a1", contacto_id: "c1", oportunidad_id: null, tipo: "llamada", resultado: "contesto", nota: "Quiere cotización", ocurrio_at: "2026-09-15T14:00:00Z", usuario_id: "u1", created_at: "", usuario },
  ]),
  listarPorOportunidad: vi.fn(async () => []),
}))
vi.mock("@/lib/api/catalogos", () => ({ listarEtapas: vi.fn(async () => []), listarMotivos: vi.fn(async () => []), listarOrigenes: vi.fn(async () => []) }))
vi.mock("@/lib/api/usuarios", () => ({ listar: vi.fn(async () => [usuario]), obtener: vi.fn(async () => usuario) }))
vi.mock("@/lib/api/configuracion", async (importar) => {
  const real = await importar<typeof import("@/lib/api/configuracion")>()
  return { ...real, obtenerTodo: vi.fn(async () => real.CONFIGURACION_DEFAULT) }
})

import { PaginaHoy } from "./PaginaHoy"
import { PaginaTareas } from "@/features/tareas/PaginaTareas"
import { FormularioTarea } from "@/features/tareas/FormularioTarea"
import { FormularioActividad } from "@/features/actividades/FormularioActividad"
import { ListaActividades } from "@/features/actividades/ListaActividades"

let contenedor: HTMLDivElement
let root: Root

function Envoltorio({ children, ruta = "/" }: { children: ReactNode; ruta?: string }) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[ruta]}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

async function renderizar(nodo: ReactNode, ruta?: string) {
  await act(async () => {
    root.render(<Envoltorio ruta={ruta}>{nodo}</Envoltorio>)
  })
  // Deja resolver las consultas simuladas.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50))
  })
  return document.body.textContent ?? ""
}

describe("renderizado del módulo de tareas, actividades y hoy", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date("2026-09-15T15:00:00Z")) // 10:00 en Lima
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    contenedor = document.createElement("div")
    document.body.appendChild(contenedor)
    root = createRoot(contenedor)
  })
  afterEach(async () => {
    await act(async () => root.unmount())
    contenedor.remove()
    vi.useRealTimers()
  })

  it("PaginaHoy muestra recordatorios y bloques Vencidas / Hoy", async () => {
    const texto = await renderizar(<PaginaHoy />)
    expect(texto).toContain("Recordatorios")
    expect(texto).toContain("Vencidas")
    expect(texto).toContain("Hoy")
    expect(texto).toContain("Llamar a Juan Pérez")
    expect(texto).toContain("Preparar propuesta")
    expect(texto).toContain("Nueva tarea")
  })

  it("PaginaTareas lista agrupada por día con exportación", async () => {
    const texto = await renderizar(<PaginaTareas />, "/tareas")
    expect(texto).toContain("2 tareas")
    expect(texto).toContain("Exportar")
    expect(texto).toContain("Llamar a Juan Pérez")
  })

  it("FormularioTarea abierto con contacto fijo propone el título por defecto", async () => {
    await renderizar(<FormularioTarea abierto onCerrar={() => {}} contactoId="c1" />)
    const titulo = document.querySelector<HTMLInputElement>("#tarea-titulo")
    expect(titulo?.value).toBe("Llamar a Juan Pérez")
    const hora = document.querySelector<HTMLInputElement>("#tarea-hora")
    expect(hora?.value).toBe("09:00")
    expect(document.body.textContent).toContain("Avisarme")
  })

  it("FormularioActividad abierto muestra chips de tipo, resultado y próximo paso", async () => {
    const texto = await renderizar(<FormularioActividad abierto onCerrar={() => {}} tipoInicial="whatsapp" contactoId="c1" />)
    expect(texto).toContain("Registrar WhatsApp")
    expect(texto).toContain("Contestó")
    expect(texto).toContain("Próximo paso")
    expect(document.querySelector("#actividad-nota")?.getAttribute("placeholder")).toBe("¿Qué pasó?")
  })

  it("ListaActividades pinta la línea de tiempo", async () => {
    const texto = await renderizar(<ListaActividades contactoId="c1" />)
    expect(texto).toContain("Llamada")
    expect(texto).toContain("Contestó")
    expect(texto).toContain("Quiere cotización")
    expect(texto).toContain("Rosa Quispe")
  })
})
