import { PanelFormulario } from "@/components/comunes/PanelFormulario"
import { EnConstruccion } from "@/components/comunes/EnConstruccion"
import type { Tarea } from "@/lib/types"

export interface FormularioTareaProps {
  abierto: boolean
  onCerrar: () => void
  contactoId?: string
  oportunidadId?: string
  /** Si viene, edita en vez de crear. */
  tarea?: Tarea
  onGuardado?: (tarea: Tarea) => void
}

/** Provisional: el módulo de tareas lo sustituye en la fase 2 manteniendo estas props. */
export function FormularioTarea({ abierto, onCerrar, tarea }: FormularioTareaProps) {
  const titulo = tarea ? "Editar tarea" : "Nueva tarea"
  return (
    <PanelFormulario abierto={abierto} onCerrar={onCerrar} titulo={titulo}>
      <EnConstruccion titulo={titulo} />
    </PanelFormulario>
  )
}

export default FormularioTarea
