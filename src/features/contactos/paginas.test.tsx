/**
 * Prueba de humo: renderiza la lista y la ficha con datos simulados (sin Supabase)
 * y comprueba que aparecen los textos clave. Los formularios de otros módulos se sustituyen.
 */
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ActividadConRelaciones, ContactoConRelaciones, TareaConRelaciones, Usuario } from "@/lib/types"

const USUARIO: Usuario = { id: "u1", nombre: "Ana Quispe", email: "ana@estudio.pe", rol: "miembro", activo: true, created_at: "", updated_at: "" }

const CONTACTO: ContactoConRelaciones = {
  id: "c1",
  nombre: "Juan Pérez",
  empresa: "Bodega Juan",
  doc_tipo: "DNI",
  doc_numero: "12345678",
  telefono: "+51987654321",
  telefono_raw: "987654321",
  email: "juan@correo.com",
  direccion: "Av. Ejército 123",
  origen_id: "o1",
  responsable_id: "u1",
  notas: null,
  extra: {},
  importacion_id: null,
  fila_origen: null,
  requiere_revision: false,
  ultima_actividad_at: null,
  created_by: "u1",
  created_at: "2026-09-01T14:05:00Z",
  updated_at: "2026-09-01T14:05:00Z",
  origen: { id: "o1", nombre: "Referido", orden: 1, activo: true, created_at: "", updated_at: "" },
  responsable: USUARIO,
}

const TAREA: TareaConRelaciones = {
  id: "t1",
  contacto_id: "c1",
  oportunidad_id: null,
  titulo: "Llamar a Juan Pérez",
  vence_at: "2026-09-15T14:00:00Z",
  recordatorio_at: "2026-09-15T14:00:00Z",
  responsable_id: "u1",
  estado: "pendiente",
  hecha_at: null,
  recordatorio_visto_at: null,
  created_by: "u1",
  created_at: "",
  updated_at: "",
  contacto: CONTACTO,
  oportunidad: null,
  responsable: USUARIO,
}

const ACTIVIDAD: ActividadConRelaciones = {
  id: "a1",
  contacto_id: "c1",
  oportunidad_id: null,
  tipo: "llamada",
  resultado: "contesto",
  nota: "Quiere cotización",
  ocurrio_at: "2026-09-10T20:30:00Z",
  usuario_id: "u1",
  created_at: "",
  usuario: USUARIO,
}

vi.mock("@/hooks/useUsuarioActual", () => ({
  useUsuarioActual: () => ({ usuario: USUARIO, uid: "u1", email: USUARIO.email, esAdmin: false, cargando: false, error: null }),
}))
vi.mock("@/hooks/useCatalogos", () => ({
  useCatalogos: () => ({
    etapas: [{ id: "e1", nombre: "Nuevo", orden: 1, color: "sky", activa: true, created_at: "", updated_at: "" }],
    etapasTodas: [],
    motivos: [],
    motivosTodos: [],
    origenes: [CONTACTO.origen],
    origenesTodos: [CONTACTO.origen],
    usuarios: [USUARIO],
    usuariosTodos: [USUARIO],
    cargando: false,
    error: null,
    etapaPorId: () => undefined,
    motivoPorId: () => undefined,
    origenPorId: (id: string | null | undefined) => (id === "o1" ? CONTACTO.origen : undefined),
    usuarioPorId: () => USUARIO,
  }),
}))
vi.mock("@/hooks/useConfiguracion", () => ({
  useConfiguracion: () => ({
    configuracion: {
      timezone: "America/Lima",
      moneda: "PEN",
      hora_recordatorio: "09:00",
      importe_default: 0,
      nombre_empresa: "Estudio",
      titulo_oportunidad_default: "Facturación electrónica",
      url_app: "",
    },
    cargando: false,
    error: null,
    guardar: async () => undefined,
    guardando: false,
  }),
}))
vi.mock("@/lib/api/contactosPagina", () => ({
  TAMANO_PAGINA_CONTACTOS: 50,
  listarPagina: async () => ({ filas: [CONTACTO], total: 1, desde: 0 }),
  resumenSeguimientoContactos: async () => ({ conPendiente: [], conVencida: [] }),
}))
vi.mock("@/lib/api/contactos", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/contactos")>()),
  obtener: async () => CONTACTO,
  listarTodo: async () => [CONTACTO],
  posiblesDuplicados: async () => [],
}))
vi.mock("@/lib/api/oportunidades", () => ({ listarPorContacto: async () => [], crear: async () => ({}) }))
vi.mock("@/lib/api/tareas", () => ({ listar: async () => [TAREA], completar: async () => TAREA }))
vi.mock("@/lib/api/actividades", () => ({ listarPorContacto: async () => [ACTIVIDAD] }))
vi.mock("@/features/actividades/FormularioActividad", () => ({ FormularioActividad: () => null }))
vi.mock("@/features/tareas/FormularioTarea", () => ({ FormularioTarea: () => null }))

import { FormularioContacto } from "./FormularioContacto"
import { PaginaContacto } from "./PaginaContacto"
import { PaginaContactos } from "./PaginaContactos"

let contenedor: HTMLDivElement
let root: Root

async function renderizar(ruta: string) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <QueryClientProvider client={cliente}>
        <MemoryRouter initialEntries={[ruta]}>
          <Routes>
            <Route path="/contactos" element={<PaginaContactos />} />
            <Route path="/contactos/:id" element={<PaginaContacto />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
  })
  // Deja resolver las consultas simuladas.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50))
  })
}

beforeEach(() => {
  ;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  contenedor = document.createElement("div")
  document.body.appendChild(contenedor)
  root = createRoot(contenedor)
})

afterEach(async () => {
  await act(async () => root.unmount())
  contenedor.remove()
})

describe("PaginaContactos", () => {
  it("muestra la lista, el buscador, los filtros y el botón de exportar", async () => {
    await renderizar("/contactos")
    const texto = contenedor.textContent ?? ""
    expect(texto).toContain("Juan Pérez")
    expect(texto).toContain("Bodega Juan")
    expect(texto).toContain("987 654 321")
    expect(texto).toContain("Sin seguimiento")
    expect(texto).toContain("Mostrando 1 de 1 contacto")
    expect(texto).toContain("Nuevo contacto")
    expect(texto).toContain("Míos")
    expect(texto).toContain("Todos")
    expect(texto).toContain("Referido")
    expect(contenedor.querySelector('input[aria-label="Buscar contactos"]')).not.toBeNull()
    expect(contenedor.querySelector('button[aria-label="Exportar"]')).not.toBeNull()
  })
})

describe("FormularioContacto", () => {
  it("al crear: nombre con foco, origen por defecto, bloque de oportunidad con título autogenerado", async () => {
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    await act(async () => {
      root.render(
        <QueryClientProvider client={cliente}>
          <MemoryRouter initialEntries={["/contactos"]}>
            <FormularioContacto abierto onCerrar={() => undefined} nombreInicial="María" />
          </MemoryRouter>
        </QueryClientProvider>,
      )
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300))
    })
    // El diálogo se monta en un portal: se mira todo el documento.
    const texto = document.body.textContent ?? ""
    expect(texto).toContain("Nuevo contacto")
    expect(texto).toContain("Celular")
    expect(texto).toContain("Origen")
    expect(texto).toContain("Más datos")
    expect(texto).toContain("Crear oportunidad")
    expect(texto).toContain("Responsable: Ana Quispe (yo)")
    const nombre = document.querySelector<HTMLInputElement>("#contacto-nombre")
    expect(nombre?.value).toBe("María")
    expect(document.activeElement).toBe(nombre)
    const titulo = document.querySelector<HTMLInputElement>("#oportunidad-titulo")
    expect(titulo?.value).toBe("María – Facturación electrónica")
    const importe = document.querySelector<HTMLInputElement>("#oportunidad-importe")
    expect(importe?.getAttribute("inputmode")).toBe("decimal")
    // Etapa por defecto: la primera activa, marcada como chip.
    const chipEtapa = Array.from(document.querySelectorAll('button[aria-pressed="true"]')).find((b) => b.textContent === "Nuevo")
    expect(chipEtapa).toBeDefined()
    // Guardar en la cabecera y en el pie.
    expect(Array.from(document.querySelectorAll("button")).filter((b) => b.textContent?.trim() === "Guardar").length).toBeGreaterThanOrEqual(2)
  })
})

describe("PaginaContacto", () => {
  it("muestra cabecera, acciones rápidas, tareas y actividad", async () => {
    await renderizar("/contactos/c1")
    const texto = contenedor.textContent ?? ""
    expect(texto).toContain("Juan Pérez")
    expect(texto).toContain("Bodega Juan")
    expect(texto).toContain("DNI 12345678")
    expect(texto).toContain("Referido")
    expect(texto).toContain("Ana Quispe")
    expect(texto).toContain("Llamar")
    expect(texto).toContain("WhatsApp")
    expect(texto).toContain("Nota")
    expect(texto).toContain("Tarea")
    expect(texto).toContain("Sin oportunidades todavía")
    expect(texto).toContain("Llamar a Juan Pérez")
    expect(texto).toContain("Hecha")
    expect(texto).toContain("Contestó")
    expect(texto).toContain("Quiere cotización")
    // Con tarea pendiente no se marca "sin seguimiento".
    expect(texto).not.toContain("Sin seguimiento")
    // Es responsable: puede editar y eliminar.
    expect(contenedor.querySelector('button[aria-label="Editar contacto"]')).not.toBeNull()
    expect(contenedor.querySelector('button[aria-label="Eliminar contacto"]')).not.toBeNull()
    expect(contenedor.querySelector('a[href="mailto:juan@correo.com"]')).not.toBeNull()
    expect(contenedor.querySelector('a[href="https://wa.me/51987654321?text=Hola%20Juan%2C"]')).not.toBeNull()
  })
})
