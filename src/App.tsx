import { useMemo } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { PersistQueryClientProvider, type Persister } from "@tanstack/react-query-persist-client"
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister"
import { AppShell } from "@/components/layout/AppShell"
import { RequiereAdmin } from "@/components/layout/RequiereAdmin"
import { RequiereSesion } from "@/components/layout/RequiereSesion"
import { realtime } from "@/hooks/useRealtime"
import { PaginaLogin } from "@/features/auth/PaginaLogin"
import { PaginaHoy } from "@/features/hoy/PaginaHoy"
import { PaginaContactos } from "@/features/contactos/PaginaContactos"
import { PaginaContacto } from "@/features/contactos/PaginaContacto"
import { PaginaOportunidades } from "@/features/oportunidades/PaginaOportunidades"
import { PaginaOportunidad } from "@/features/oportunidades/PaginaOportunidad"
import { PaginaTareas } from "@/features/tareas/PaginaTareas"
import { PaginaBuscar } from "@/features/buscar/PaginaBuscar"
import { PaginaPanel } from "@/features/panel/PaginaPanel"
import { PaginaImportar } from "@/features/importar/PaginaImportar"
import { PaginaConfiguracion } from "@/features/configuracion/PaginaConfiguracion"
import { PaginaAyuda } from "@/features/ayuda/PaginaAyuda"

/**
 * Prefijo bajo el que se sirve la app. En GitHub Pages es "/crm-kodarvia/", en local "/".
 * Sin él, al recargar en /crm-kodarvia/contactos el router no reconocería ninguna ruta.
 */
const BASE_RUTAS = import.meta.env.BASE_URL.replace(/\/$/, "")

const UN_DIA = 24 * 60 * 60 * 1000
/** Cambiar cuando cambie la forma de los datos cacheados para descartar la caché vieja. */
const VERSION_CACHE = "v1"

export function crearQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: UN_DIA,
        refetchOnWindowFocus: true,
        // Respaldo cuando el canal realtime no está conectado (docs/ARQUITECTURA.md §7).
        refetchInterval: () => (realtime.conectado ? false : 30_000),
        retry: 1,
      },
      mutations: { retry: 0 },
    },
  })
}

function crearPersister(): Persister | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null
    return createSyncStoragePersister({ storage: window.localStorage, key: "crm.cache", throttleTime: 1000 })
  } catch {
    return null
  }
}

function Rutas() {
  return (
    <Routes>
      <Route path="/login" element={<PaginaLogin />} />
      <Route element={<RequiereSesion />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<PaginaHoy />} />
          <Route path="/contactos" element={<PaginaContactos />} />
          <Route path="/contactos/:id" element={<PaginaContacto />} />
          <Route path="/oportunidades" element={<PaginaOportunidades />} />
          <Route path="/oportunidades/:id" element={<PaginaOportunidad />} />
          <Route path="/tareas" element={<PaginaTareas />} />
          <Route path="/tareas/:id" element={<PaginaTareas />} />
          <Route path="/buscar" element={<PaginaBuscar />} />
          <Route path="/panel" element={<PaginaPanel />} />
          <Route element={<RequiereAdmin />}>
            <Route path="/importar" element={<PaginaImportar />} />
            <Route path="/configuracion" element={<PaginaConfiguracion />} />
          </Route>
          <Route path="/ayuda" element={<PaginaAyuda />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default function App() {
  const queryClient = useMemo(crearQueryClient, [])
  const persister = useMemo(crearPersister, [])

  const contenido = (
    <BrowserRouter basename={BASE_RUTAS}>
      <Rutas />
    </BrowserRouter>
  )

  if (!persister) return <QueryClientProvider client={queryClient}>{contenido}</QueryClientProvider>

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: UN_DIA,
        buster: VERSION_CACHE,
        dehydrateOptions: {
          // Solo consultas con éxito; la búsqueda global y el autocompletado no merecen caché.
          shouldDehydrateQuery: (q) => q.state.status === "success" && q.queryKey[0] !== "buscar" && q.queryKey[1] !== "rapido",
        },
      }}
    >
      {contenido}
    </PersistQueryClientProvider>
  )
}
