import { PanelFormulario } from "@/components/comunes/PanelFormulario"
import { EnConstruccion } from "@/components/comunes/EnConstruccion"
import { ETIQUETA_TIPO_ACTIVIDAD, type TipoActividad } from "@/lib/types"

export interface FormularioActividadProps {
  abierto: boolean
  onCerrar: () => void
  /** Tipo preseleccionado (Llamada, WhatsApp, Reunión, Nota...). */
  tipoInicial?: TipoActividad
  /** Contacto ya elegido (desde la ficha). */
  contactoId?: string
  /** Oportunidad ya elegida (desde su detalle). */
  oportunidadId?: string
}

/** Provisional: el módulo de actividades lo sustituye en la fase 2 manteniendo estas props. */
export function FormularioActividad({ abierto, onCerrar, tipoInicial }: FormularioActividadProps) {
  const titulo = tipoInicial ? `Registrar ${ETIQUETA_TIPO_ACTIVIDAD[tipoInicial].toLowerCase()}` : "Registrar actividad"
  return (
    <PanelFormulario abierto={abierto} onCerrar={onCerrar} titulo={titulo}>
      <EnConstruccion titulo={titulo} />
    </PanelFormulario>
  )
}

export default FormularioActividad
