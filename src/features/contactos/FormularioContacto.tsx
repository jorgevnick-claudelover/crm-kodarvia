import { PanelFormulario } from "@/components/comunes/PanelFormulario"
import { EnConstruccion } from "@/components/comunes/EnConstruccion"
import type { Contacto } from "@/lib/types"

export interface FormularioContactoProps {
  abierto: boolean
  onCerrar: () => void
  /** Si viene, el formulario edita en vez de crear. */
  contacto?: Contacto
  /** Se llama con el contacto creado o editado. */
  onGuardado?: (contacto: Contacto) => void
  /** Nombre inicial (desde "Crear «Juan»" del SelectorContacto). */
  nombreInicial?: string
}

/** Provisional: el módulo de contactos lo sustituye en la fase 2 manteniendo estas props. */
export function FormularioContacto({ abierto, onCerrar, contacto }: FormularioContactoProps) {
  const titulo = contacto ? "Editar contacto" : "Nuevo contacto"
  return (
    <PanelFormulario abierto={abierto} onCerrar={onCerrar} titulo={titulo}>
      <EnConstruccion titulo={titulo} />
    </PanelFormulario>
  )
}

export default FormularioContacto
