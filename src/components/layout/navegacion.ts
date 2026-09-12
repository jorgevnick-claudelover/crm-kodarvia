import {
  BarChart3,
  CalendarCheck,
  HelpCircle,
  KanbanSquare,
  ListTodo,
  Search,
  Settings,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react"

export interface ItemNavegacion {
  ruta: string
  etiqueta: string
  icono: LucideIcon
  soloAdmin?: boolean
}

/** Secciones de la barra lateral (computadora), en el orden de docs/ARQUITECTURA.md §9. */
export const NAVEGACION: ItemNavegacion[] = [
  { ruta: "/", etiqueta: "Hoy", icono: CalendarCheck },
  { ruta: "/contactos", etiqueta: "Contactos", icono: Users },
  { ruta: "/oportunidades", etiqueta: "Oportunidades", icono: KanbanSquare },
  { ruta: "/tareas", etiqueta: "Tareas", icono: ListTodo },
  { ruta: "/panel", etiqueta: "Panel", icono: BarChart3 },
  { ruta: "/buscar", etiqueta: "Buscar", icono: Search },
  { ruta: "/importar", etiqueta: "Importar", icono: Upload, soloAdmin: true },
  { ruta: "/configuracion", etiqueta: "Configuración", icono: Settings, soloAdmin: true },
  { ruta: "/ayuda", etiqueta: "Ayuda", icono: HelpCircle },
]

/** Pestañas de la barra inferior (celular). "Más" se añade aparte. */
export const NAVEGACION_MOVIL: ItemNavegacion[] = NAVEGACION.filter((i) =>
  ["/", "/contactos", "/oportunidades", "/buscar"].includes(i.ruta),
)

/** Lo que abre "Más" en celular. */
export const NAVEGACION_MAS: ItemNavegacion[] = NAVEGACION.filter((i) =>
  ["/panel", "/tareas", "/configuracion", "/importar", "/ayuda"].includes(i.ruta),
)

/** Título de la cabecera según la ruta. */
export function tituloDeRuta(pathname: string): string {
  if (pathname === "/") return "Hoy"
  if (pathname.startsWith("/contactos/")) return "Contacto"
  if (pathname.startsWith("/oportunidades/")) return "Oportunidad"
  const item = NAVEGACION.find((i) => i.ruta !== "/" && pathname.startsWith(i.ruta))
  return item?.etiqueta ?? "CRM"
}

export function rutaActiva(pathname: string, ruta: string): boolean {
  if (ruta === "/") return pathname === "/"
  return pathname === ruta || pathname.startsWith(`${ruta}/`)
}
