import { Hammer } from "lucide-react"
import { Vacio } from "./Vacio"

export interface EnConstruccionProps {
  titulo: string
  descripcion?: string
}

/** Página provisional: la sustituye el módulo correspondiente en la fase 2. */
export function EnConstruccion({ titulo, descripcion }: EnConstruccionProps) {
  return (
    <div className="p-4">
      <h1 className="mb-2 text-2xl font-semibold">{titulo}</h1>
      <Vacio icono={Hammer} titulo="En construcción" descripcion={descripcion ?? "Esta pantalla estará lista muy pronto."} />
    </div>
  )
}
