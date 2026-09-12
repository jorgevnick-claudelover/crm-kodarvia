import { useState } from "react"
import { FileText, Mail, MessageCircle, Phone, Plus, UserPlus, Users, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useEsMovil } from "@/hooks/useEsMovil"
import { FormularioActividad } from "@/features/actividades/FormularioActividad"
import { FormularioContacto } from "@/features/contactos/FormularioContacto"
import { FormularioTarea } from "@/features/tareas/FormularioTarea"
import type { TipoActividad } from "@/lib/types"
import { cn } from "@/lib/utils"

type Accion =
  | { tipo: "actividad"; tipoInicial: TipoActividad }
  | { tipo: "tarea" }
  | { tipo: "contacto" }

interface Opcion {
  etiqueta: string
  icono: LucideIcon
  accion: Accion
  clase: string
}

const OPCIONES: Opcion[] = [
  { etiqueta: "Llamada", icono: Phone, accion: { tipo: "actividad", tipoInicial: "llamada" }, clase: "bg-sky-50 text-sky-700 border-sky-200" },
  { etiqueta: "WhatsApp", icono: MessageCircle, accion: { tipo: "actividad", tipoInicial: "whatsapp" }, clase: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { etiqueta: "Reunión", icono: Users, accion: { tipo: "actividad", tipoInicial: "reunion" }, clase: "bg-violet-50 text-violet-700 border-violet-200" },
  { etiqueta: "Nota", icono: FileText, accion: { tipo: "actividad", tipoInicial: "nota" }, clase: "bg-amber-50 text-amber-700 border-amber-200" },
  { etiqueta: "Tarea", icono: Mail, accion: { tipo: "tarea" }, clase: "bg-rose-50 text-rose-700 border-rose-200" },
  { etiqueta: "Nuevo contacto", icono: UserPlus, accion: { tipo: "contacto" }, clase: "bg-teal-50 text-teal-700 border-teal-200" },
]

export interface BotonMasProps {
  /** 'flotante' (celular, esquina inferior derecha) o 'cabecera' (botón normal). */
  variante?: "flotante" | "cabecera"
  /** Contacto/oportunidad del contexto actual (ficha abierta) para preseleccionar. */
  contactoId?: string
  oportunidadId?: string
  className?: string
}

/**
 * Botón + : abre un sheet con seis botones grandes (Llamada · WhatsApp · Reunión · Nota · Tarea · Nuevo contacto).
 * Cierra el menú antes de abrir el formulario: nunca dos modales apilados.
 */
export function BotonMas({ variante = "flotante", contactoId, oportunidadId, className }: BotonMasProps) {
  const esMovil = useEsMovil()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [accion, setAccion] = useState<Accion | null>(null)

  const elegir = (a: Accion) => {
    setMenuAbierto(false)
    // Espera a que el menú se cierre para no apilar dos modales.
    setTimeout(() => setAccion(a), 120)
  }
  const cerrarFormulario = () => setAccion(null)

  const botones = (
    <div className="grid grid-cols-3 gap-3 px-4 pb-4">
      {OPCIONES.map((o) => (
        <button
          key={o.etiqueta}
          type="button"
          onClick={() => elegir(o.accion)}
          className={cn(
            "flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border text-sm font-semibold transition-transform active:scale-95",
            o.clase,
          )}
        >
          <o.icono className="size-7" aria-hidden />
          {o.etiqueta}
        </button>
      ))}
    </div>
  )

  return (
    <>
      {variante === "flotante" ? (
        <Button
          type="button"
          size="icon-lg"
          aria-label="Registrar algo nuevo"
          onClick={() => setMenuAbierto(true)}
          className={cn(
            "fixed right-4 z-40 size-14 rounded-full shadow-lg md:hidden",
            "bottom-[calc(4rem+env(safe-area-inset-bottom,0px))]",
            className,
          )}
        >
          <Plus className="size-7" />
        </Button>
      ) : (
        <Button type="button" onClick={() => setMenuAbierto(true)} className={cn("min-h-10 gap-1.5", className)}>
          <Plus />
          Nuevo
        </Button>
      )}

      {esMovil ? (
        <Drawer open={menuAbierto} onOpenChange={setMenuAbierto} showSwipeHandle>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle>¿Qué quieres registrar?</DrawerTitle>
              <DrawerDescription className="sr-only">Elige una acción</DrawerDescription>
            </DrawerHeader>
            <div className="area-segura-inferior">{botones}</div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={menuAbierto} onOpenChange={setMenuAbierto}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>¿Qué quieres registrar?</DialogTitle>
              <DialogDescription className="sr-only">Elige una acción</DialogDescription>
            </DialogHeader>
            {botones}
          </DialogContent>
        </Dialog>
      )}

      <FormularioActividad
        abierto={accion?.tipo === "actividad"}
        onCerrar={cerrarFormulario}
        tipoInicial={accion?.tipo === "actividad" ? accion.tipoInicial : undefined}
        contactoId={contactoId}
        oportunidadId={oportunidadId}
      />
      <FormularioTarea abierto={accion?.tipo === "tarea"} onCerrar={cerrarFormulario} contactoId={contactoId} oportunidadId={oportunidadId} />
      <FormularioContacto abierto={accion?.tipo === "contacto"} onCerrar={cerrarFormulario} />
    </>
  )
}

export default BotonMas
