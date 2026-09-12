import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { iniciales } from "@/lib/utils/texto"

const COLORES = [
  "bg-teal-600",
  "bg-sky-600",
  "bg-violet-600",
  "bg-rose-600",
  "bg-amber-600",
  "bg-emerald-600",
  "bg-indigo-600",
  "bg-orange-600",
]

/** Color estable a partir del id (o del nombre si no hay id). */
export function colorUsuario(semilla: string | null | undefined): string {
  const s = semilla ?? ""
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return COLORES[h % COLORES.length]
}

export interface AvatarUsuarioProps {
  nombre: string | null | undefined
  id?: string | null
  tamano?: "sm" | "md" | "lg"
  className?: string
  /** Título accesible; por defecto el nombre. */
  titulo?: string
}

const TAMANOS = { sm: "size-6 text-[10px]", md: "size-8 text-xs", lg: "size-12 text-base" }

export function AvatarUsuario({ nombre, id, tamano = "md", className, titulo }: AvatarUsuarioProps) {
  const etiqueta = titulo ?? nombre ?? "Sin responsable"
  return (
    <Avatar className={cn(TAMANOS[tamano], className)} title={etiqueta} aria-label={etiqueta}>
      <AvatarFallback className={cn("font-semibold text-white", colorUsuario(id ?? nombre))}>{iniciales(nombre)}</AvatarFallback>
    </Avatar>
  )
}
