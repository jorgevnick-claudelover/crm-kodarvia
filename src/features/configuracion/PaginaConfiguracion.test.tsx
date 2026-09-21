/**
 * Prueba de humo en jsdom: la página de configuración solo la ve el administrador,
 * muestra las seis secciones y explica por qué no se puede desactivar una etapa con
 * oportunidades abiertas.
 */
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Etapa, MotivoPerdida, Origen, Usuario } from "@/lib/types"

const ADMIN: Usuario = { id: "u1", nombre: "Rosa Quispe", email: "rosa@estudio.pe", rol: "admin", activo: true, created_at: "", updated_at: "" }
const MIEMBRO: Usuario = { id: "u2", nombre: "Luis Mamani", email: "luis@estudio.pe", rol: "miembro", activo: true, created_at: "", updated_at: "" }
const ETAPAS: Etapa[] = [
  { id: "e1", nombre: "Nuevo", orden: 1, color: "sky", activa: true, created_at: "", updated_at: "" },
  { id: "e2", nombre: "Propuesta", orden: 2, color: "amber", activa: true, created_at: "", updated_at: "" },
]
const MOTIVOS: MotivoPerdida[] = [{ id: "m1", nombre: "Precio", orden: 1, activo: true, created_at: "", updated_at: "" }]
const ORIGENES: Origen[] = [{ id: "o1", nombre: "Referido", orden: 1, activo: true, created_at: "", updated_at: "" }]

const mockEstado = { esAdmin: true, esMovil: false }

vi.mock("@/hooks/useUsuarioActual", () => ({
  useUsuarioActual: () => ({ usuario: ADMIN, uid: "u1", email: ADMIN.email, esAdmin: mockEstado.esAdmin, cargando: false, error: null }),
}))
vi.mock("@/hooks/useEsMovil", () => ({ useEsMovil: () => mockEstado.esMovil, CONSULTA_MOVIL: "(max-width: 767px)" }))
vi.mock("@/hooks/useCatalogos", () => ({
  useCatalogos: () => ({
    etapas: ETAPAS,
    etapasTodas: ETAPAS,
    motivos: MOTIVOS,
    motivosTodos: MOTIVOS,
    origenes: ORIGENES,
    origenesTodos: ORIGENES,
    usuarios: [ADMIN, MIEMBRO],
    usuariosTodos: [ADMIN, MIEMBRO],
    cargando: false,
    error: null,
    etapaPorId: () => undefined,
    motivoPorId: () => undefined,
    origenPorId: () => undefined,
    usuarioPorId: () => undefined,
  }),
}))
vi.mock("@/hooks/useConfiguracion", () => ({
  useConfiguracion: () => ({
    configuracion: {
      timezone: "America/Lima",
      moneda: "PEN",
      hora_recordatorio: "09:00",
      importe_default: 0,
      nombre_empresa: "Estudio Quispe",
      titulo_oportunidad_default: "Facturación electrónica",
      url_app: "https://crm.estudio.pe",
    },
    cargando: false,
    error: null,
    guardar: async () => undefined,
    guardando: false,
  }),
}))
vi.mock("@/lib/api/oportunidades", () => ({ contarAbiertasEnEtapa: async () => 2 }))
vi.mock("@/lib/api/catalogos", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/catalogos")>()),
  crearEtapa: async () => ETAPAS[0],
  actualizarEtapa: async () => ETAPAS[0],
  reordenarEtapas: async () => undefined,
  crearMotivo: async () => MOTIVOS[0],
  actualizarMotivo: async () => MOTIVOS[0],
  reordenarMotivos: async () => undefined,
  crearOrigen: async () => ORIGENES[0],
  actualizarOrigen: async () => ORIGENES[0],
  reordenarOrigenes: async () => undefined,
}))
vi.mock("@/lib/api/usuarios", () => ({ listar: async () => [ADMIN, MIEMBRO], obtener: async () => ADMIN, actualizar: async () => ADMIN }))

import { PaginaConfiguracion } from "./PaginaConfiguracion"
import { PestanaUsuarios } from "./PestanaUsuarios"
import { PestanaValores } from "./PestanaValores"

let contenedor: HTMLDivElement
let root: Root

async function renderizar(nodo: React.ReactNode) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <QueryClientProvider client={cliente}>
        <MemoryRouter initialEntries={["/configuracion"]}>{nodo}</MemoryRouter>
      </QueryClientProvider>,
    )
  })
  await act(async () => {
    await new Promise((r) => setTimeout(r, 60))
  })
}

beforeEach(() => {
  ;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  mockEstado.esAdmin = true
  mockEstado.esMovil = false
  contenedor = document.createElement("div")
  document.body.appendChild(contenedor)
  root = createRoot(contenedor)
})

afterEach(async () => {
  await act(async () => root.unmount())
  contenedor.remove()
})

describe("PaginaConfiguracion", () => {
  it("muestra las seis secciones y las etapas ordenadas", async () => {
    await renderizar(<PaginaConfiguracion />)
    const texto = contenedor.textContent ?? ""
    expect(texto).toContain("Etapas")
    expect(texto).toContain("Motivos de pérdida")
    expect(texto).toContain("Orígenes")
    expect(texto).toContain("Usuarios")
    expect(texto).toContain("Valores")
    expect(texto).toContain("Datos")
    const nombres = Array.from(contenedor.querySelectorAll('li input[data-slot="input"]')).map((i) => (i as HTMLInputElement).value)
    expect(nombres).toEqual(["Nuevo", "Propuesta"])
  })

  it("impide desactivar una etapa con oportunidades abiertas y explica por qué", async () => {
    await renderizar(<PaginaConfiguracion />)
    const texto = contenedor.textContent ?? ""
    expect(texto).toContain("No se puede desactivar: tiene 2 oportunidades abiertas")
    const interruptor = contenedor.querySelector<HTMLButtonElement>("#activo-e1")
    expect(interruptor).not.toBeNull()
    expect(interruptor?.disabled).toBe(true)
  })

  it("en celular usa un selector de sección que no se sale de pantalla", async () => {
    mockEstado.esMovil = true
    await renderizar(<PaginaConfiguracion />)
    const selector = contenedor.querySelector<HTMLButtonElement>('[aria-label="Sección de configuración"]')
    expect(selector).not.toBeNull()
    expect(selector?.className).toContain("w-full")
    expect(selector?.textContent ?? "").toContain("Etapas")
    // La sección elegida se sigue viendo aunque la lista de pestañas esté oculta.
    expect(contenedor.textContent ?? "").toContain("Añadir etapa")
  })

  it("avisa a quien no es administrador", async () => {
    mockEstado.esAdmin = false
    await renderizar(<PaginaConfiguracion />)
    expect(contenedor.textContent ?? "").toContain("Solo para el administrador")
  })
})

describe("PestanaUsuarios", () => {
  it("lista los usuarios con nombre y correo editables, y no deja al admin actual cambiarse el rol ni desactivarse", async () => {
    await renderizar(<PestanaUsuarios />)
    const texto = contenedor.textContent ?? ""
    expect(texto).toContain("no tiene contraseñas")
    expect(texto).toContain("5 personas")
    // El nombre y el correo son campos: el cliente pone aquí a su equipo real.
    const valor = (etiqueta: string) =>
      contenedor.querySelector<HTMLInputElement>(`input[aria-label="${etiqueta}"]`)?.value
    expect(valor("Nombre de Rosa Quispe")).toBe("Rosa Quispe")
    expect(valor("Correo de Luis Mamani")).toBe("luis@estudio.pe")
    const propioRol = contenedor.querySelector<HTMLButtonElement>('[aria-label="Rol de Rosa Quispe"]')
    const propioActivo = contenedor.querySelector<HTMLButtonElement>("#usuario-activo-u1")
    const otroActivo = contenedor.querySelector<HTMLButtonElement>("#usuario-activo-u2")
    expect(propioRol?.getAttribute("data-disabled")).not.toBeNull()
    expect(propioActivo?.disabled).toBe(true)
    expect(otroActivo?.disabled).toBe(false)
  })
})

describe("PestanaValores", () => {
  it("trae los valores guardados y deja elegir la moneda", async () => {
    await renderizar(<PestanaValores />)
    const empresa = contenedor.querySelector<HTMLInputElement>("#cfg-empresa")
    const hora = contenedor.querySelector<HTMLInputElement>("#cfg-hora")
    const url = contenedor.querySelector<HTMLInputElement>("#cfg-url")
    const moneda = contenedor.querySelector<HTMLButtonElement>("#cfg-moneda")
    expect(empresa?.value).toBe("Estudio Quispe")
    expect(hora?.value).toBe("09:00")
    expect(url?.value).toBe("https://crm.estudio.pe")
    expect(moneda?.textContent).toContain("PEN")
    expect(moneda?.textContent).toContain("soles")
    expect(moneda?.disabled).toBe(false)
  })
})
