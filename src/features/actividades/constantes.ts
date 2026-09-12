/** Iconos, orden de chips y etiquetas del módulo de actividades. */
import { FileText, Mail, MessageCircle, Phone, Users, type LucideIcon } from "lucide-react"
import type { OpcionChip } from "@/components/comunes/ChipsSeleccion"
import { ETIQUETA_RESULTADO_ACTIVIDAD, ETIQUETA_TIPO_ACTIVIDAD, type ResultadoActividad, type TipoActividad } from "@/lib/types"

export const ICONO_TIPO_ACTIVIDAD: Record<TipoActividad, LucideIcon> = {
  llamada: Phone,
  whatsapp: MessageCircle,
  reunion: Users,
  nota: FileText,
  correo: Mail,
}

/** Orden de los chips: Llamada · WhatsApp · Reunión · Nota · Correo. */
export const ORDEN_TIPOS: readonly TipoActividad[] = ["llamada", "whatsapp", "reunion", "nota", "correo"]

export const OPCIONES_TIPO: OpcionChip<TipoActividad>[] = ORDEN_TIPOS.map((t) => ({ valor: t, etiqueta: ETIQUETA_TIPO_ACTIVIDAD[t] }))

export const ORDEN_RESULTADOS: readonly ResultadoActividad[] = ["contesto", "no_contesto", "volver_a_llamar", "interesado", "no_interesado"]

export const OPCIONES_RESULTADO: OpcionChip<ResultadoActividad>[] = ORDEN_RESULTADOS.map((r) => ({
  valor: r,
  etiqueta: ETIQUETA_RESULTADO_ACTIVIDAD[r],
}))

/** Color del chip de resultado en la línea de tiempo. */
export const CLASE_RESULTADO: Record<ResultadoActividad, string> = {
  contesto: "bg-emerald-50 text-emerald-700 border-emerald-200",
  no_contesto: "bg-slate-100 text-slate-700 border-slate-200",
  volver_a_llamar: "bg-amber-50 text-amber-700 border-amber-200",
  interesado: "bg-teal-50 text-teal-700 border-teal-200",
  no_interesado: "bg-rose-50 text-rose-700 border-rose-200",
}
