import { Navigate, Outlet, useLocation } from "react-router-dom"
import { Cargando } from "@/components/comunes/Cargando"
import { useSesion } from "@/hooks/useSesion"

/** Protege todas las rutas menos /login: sin sesión redirige a /login recordando a dónde iba. */
export function RequiereSesion() {
  const { sesion, cargando } = useSesion()
  const location = useLocation()
  if (cargando) return <Cargando tipo="pantalla" className="min-h-dvh" />
  if (!sesion) return <Navigate to="/login" replace state={{ desde: location.pathname + location.search }} />
  return <Outlet />
}

export default RequiereSesion
