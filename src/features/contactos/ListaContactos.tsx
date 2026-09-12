import type { ReactNode } from "react"
import { Loader2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Cargando } from "@/components/comunes/Cargando"
import { Vacio } from "@/components/comunes/Vacio"
import type { ContactoConRelaciones } from "@/lib/types"
import { TarjetaContacto } from "./TarjetaContacto"
import type { ResumenSeguimiento } from "./useContactos"

export interface ListaContactosProps {
  contactos: ContactoConRelaciones[]
  total: number
  cargando: boolean
  error: Error | null
  hayMas: boolean
  cargarMas: () => void
  cargandoMas: boolean
  resumen: ResumenSeguimiento
  /** true si hay filtros distintos de los de por defecto (cambia el texto del vacío). */
  hayFiltros: boolean
  /** Botón de llamada a la acción del estado vacío. */
  accionVacio?: ReactNode
  onLimpiarFiltros?: () => void
  onReintentar?: () => void
}

/** Lista de tarjetas con carga incremental de 50 en 50. */
export function ListaContactos({
  contactos,
  total,
  cargando,
  error,
  hayMas,
  cargarMas,
  cargandoMas,
  resumen,
  hayFiltros,
  accionVacio,
  onLimpiarFiltros,
  onReintentar,
}: ListaContactosProps) {
  if (cargando) return <Cargando tipo="lista" filas={6} className="py-2" />

  if (error) {
    return (
      <Vacio
        titulo="No se pudieron cargar los contactos"
        descripcion={error.message}
        accion={
          onReintentar && (
            <Button type="button" variant="outline" className="min-h-11" onClick={onReintentar}>
              Reintentar
            </Button>
          )
        }
      />
    )
  }

  if (contactos.length === 0) {
    if (hayFiltros) {
      return (
        <Vacio
          icono={Users}
          titulo="Sin resultados con estos filtros"
          descripcion="Prueba con otro texto o quita los filtros."
          accion={
            onLimpiarFiltros && (
              <Button type="button" variant="outline" className="min-h-11" onClick={onLimpiarFiltros}>
                Quitar filtros
              </Button>
            )
          }
        />
      )
    }
    return (
      <Vacio
        icono={Users}
        titulo="Todavía no hay contactos"
        descripcion="Crea el primero en menos de un minuto: solo necesitas el nombre."
        accion={accionVacio}
      />
    )
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-2" aria-label="Contactos">
        {contactos.map((c) => (
          <li key={c.id}>
            <TarjetaContacto
              contacto={c}
              tienePendiente={resumen.cargado ? resumen.conPendiente.has(c.id) : undefined}
              tieneVencida={resumen.cargado ? resumen.conVencida.has(c.id) : undefined}
            />
          </li>
        ))}
      </ul>
      <div className="flex flex-col items-center gap-2 py-3 text-sm text-muted-foreground">
        <span>
          Mostrando {contactos.length} de {total} {total === 1 ? "contacto" : "contactos"}
        </span>
        {hayMas && (
          <Button type="button" variant="outline" className="min-h-12 w-full max-w-xs text-base" onClick={cargarMas} disabled={cargandoMas}>
            {cargandoMas && <Loader2 className="animate-spin" />}
            Cargar más
          </Button>
        )}
      </div>
    </div>
  )
}

export default ListaContactos
