import type { ReactNode } from "react"
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useEsMovil } from "@/hooks/useEsMovil"
import { cn } from "@/lib/utils"

export interface PanelFormularioProps {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  descripcion?: string
  children: ReactNode
  /** Botones fijos abajo (Guardar, Cancelar). */
  pie?: ReactNode
  /** Acción en la cabecera (por ejemplo, Guardar en móvil). */
  accionCabecera?: ReactNode
  className?: string
  /** Evita cerrar al tocar fuera mientras se guarda. */
  bloqueado?: boolean
}

/**
 * Contenedor de formularios: drawer inferior en celular, diálogo en computadora.
 * Nunca se apilan dos: el que abre otro debe cerrarse antes.
 */
export function PanelFormulario({
  abierto,
  onCerrar,
  titulo,
  descripcion,
  children,
  pie,
  accionCabecera,
  className,
  bloqueado = false,
}: PanelFormularioProps) {
  const esMovil = useEsMovil()
  const alCambiar = (open: boolean) => {
    if (!open && !bloqueado) onCerrar()
  }

  if (esMovil) {
    return (
      <Drawer open={abierto} onOpenChange={alCambiar} showSwipeHandle>
        <DrawerContent className={cn("max-h-[92dvh]", className)}>
          <DrawerHeader className="flex flex-row items-start justify-between gap-3 text-left">
            <div className="min-w-0 flex-1">
              <DrawerTitle className="text-lg">{titulo}</DrawerTitle>
              {descripcion ? <DrawerDescription>{descripcion}</DrawerDescription> : <DrawerDescription className="sr-only">{titulo}</DrawerDescription>}
            </div>
            {accionCabecera}
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
          {pie && <DrawerFooter className="area-segura-inferior border-t bg-background">{pie}</DrawerFooter>}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={abierto} onOpenChange={alCambiar}>
      <DialogContent className={cn("flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-lg", className)}>
        <DialogHeader className="flex flex-row items-start justify-between gap-3 border-b px-6 py-4 text-left">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-lg">{titulo}</DialogTitle>
            {descripcion ? <DialogDescription>{descripcion}</DialogDescription> : <DialogDescription className="sr-only">{titulo}</DialogDescription>}
          </div>
          {accionCabecera && <div className="mr-8">{accionCabecera}</div>}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {pie && <DialogFooter className="border-t px-6 py-4">{pie}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}
