import { Link, Outlet } from "react-router-dom"
import { ShieldAlert } from "lucide-react"
import { Cargando } from "@/components/comunes/Cargando"
import { Vacio } from "@/components/comunes/Vacio"
import { Button } from "@/components/ui/button"
import { useUsuarioActual } from "@/hooks/useUsuarioActual"

/** Solo el administrador entra (Importar, Configuración). Los demás ven un aviso. */
export function RequiereAdmin() {
  const { esAdmin, cargando } = useUsuarioActual()
  if (cargando) return <Cargando tipo="pantalla" />
  if (!esAdmin) {
    return (
      <Vacio
        icono={ShieldAlert}
        titulo="Solo para el administrador"
        descripcion="Esta sección la gestiona el administrador del estudio. Si necesitas algo de aquí, pídeselo."
        accion={
          <Button render={<Link to="/" />} nativeButton={false}>
            Volver a Hoy
          </Button>
        }
      />
    )
  }
  return <Outlet />
}

export default RequiereAdmin
