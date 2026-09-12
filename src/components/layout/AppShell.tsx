import { Outlet, useLocation, useParams } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useEsMovil } from "@/hooks/useEsMovil"
import { useRealtime } from "@/hooks/useRealtime"
import { BarraInferior } from "./BarraInferior"
import { BarraLateral } from "./BarraLateral"
import { BotonMas } from "./BotonMas"
import { Cabecera } from "./Cabecera"

/**
 * Estructura de la app con sesión: celular = cabecera + contenido + barra inferior + botón +;
 * computadora = barra lateral + cabecera + contenido. Monta el canal realtime y los toasts.
 */
export function AppShell() {
  const esMovil = useEsMovil()
  const { estado } = useRealtime(true)
  const { pathname } = useLocation()
  const params = useParams()
  const contactoId = pathname.startsWith("/contactos/") ? params.id : undefined
  const oportunidadId = pathname.startsWith("/oportunidades/") ? params.id : undefined
  const sinTiempoReal = estado === "error" || estado === "cerrado"

  return (
    <TooltipProvider>
      <div className="flex min-h-dvh bg-background">
        {!esMovil && <BarraLateral />}
        <div className="flex min-w-0 flex-1 flex-col">
          <Cabecera
            sinTiempoReal={sinTiempoReal}
            acciones={!esMovil ? <BotonMas variante="cabecera" contactoId={contactoId} oportunidadId={oportunidadId} /> : undefined}
          />
          <main className={esMovil ? "flex-1 pb-[calc(5rem+env(safe-area-inset-bottom,0px))]" : "flex-1"}>
            <Outlet />
          </main>
        </div>
        {esMovil && (
          <>
            <BotonMas variante="flotante" contactoId={contactoId} oportunidadId={oportunidadId} />
            <BarraInferior />
          </>
        )}
      </div>
      <Toaster />
    </TooltipProvider>
  )
}

export default AppShell
