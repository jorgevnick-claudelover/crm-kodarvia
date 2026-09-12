import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ChipsSeleccion } from "@/components/comunes/ChipsSeleccion"
import { PanelFormulario } from "@/components/comunes/PanelFormulario"
import { useCatalogos } from "@/hooks/useCatalogos"
import type { MotivoPerdida, Oportunidad } from "@/lib/types"
import { validarPerdida } from "./logica"
import { usePerderOportunidad } from "./useOportunidades"

export interface FormularioPerderProps {
  motivos: MotivoPerdida[]
  guardando?: boolean
  onConfirmar: (motivoId: string, detalle: string) => void
  onCancelar: () => void
}

/**
 * Contenido del modal (sin el contenedor): motivo obligatorio + detalle opcional.
 * Exportado aparte para poder probarlo sin drawer ni diálogo.
 */
export function FormularioPerder({ motivos, guardando = false, onConfirmar, onCancelar }: FormularioPerderProps) {
  const [motivoId, setMotivoId] = useState<string | null>(null)
  const [detalle, setDetalle] = useState("")
  const valido = validarPerdida(motivoId).ok

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valido || !motivoId) return
        onConfirmar(motivoId, detalle)
      }}
    >
      <div className="space-y-2">
        <Label className="text-base">
          Motivo <span className="text-destructive">*</span>
        </Label>
        {motivos.length === 0 ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            No hay motivos de pérdida configurados. Pide al administrador que los cree en Configuración.
          </p>
        ) : (
          <ChipsSeleccion
            etiqueta="Motivo de pérdida"
            valor={motivoId}
            onCambiar={setMotivoId}
            opciones={motivos.map((m) => ({ valor: m.id, etiqueta: m.nombre, color: "red" }))}
          />
        )}
        {!valido && <p className="text-sm text-muted-foreground">Elige un motivo para poder confirmar.</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="detalle-perdida" className="text-base">
          Detalle (opcional)
        </Label>
        <Textarea
          id="detalle-perdida"
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
          placeholder="Qué pasó, con quién se fue, cuándo volver a intentar…"
          rows={2}
          enterKeyHint="done"
        />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" size="lg" className="min-h-11" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button
          type="submit"
          size="lg"
          className="min-h-11 bg-red-600 text-white hover:bg-red-700"
          disabled={!valido || guardando}
          aria-disabled={!valido || guardando}
        >
          {guardando && <Loader2 className="animate-spin" />}
          Confirmar pérdida
        </Button>
      </div>
    </form>
  )
}

export interface ModalPerderProps {
  abierto: boolean
  onCerrar: () => void
  oportunidad: Oportunidad | null
  /** Se llama tras guardar (el modal ya se cerró). */
  onPerdida?: (oportunidad: Oportunidad) => void
}

/** Perder exige motivo (criterio 3): Confirmar está deshabilitado hasta elegir uno. No escribe nada antes de confirmar. */
export function ModalPerder({ abierto, onCerrar, oportunidad, onPerdida }: ModalPerderProps) {
  const { motivos } = useCatalogos()
  const perder = usePerderOportunidad()
  // Reinicia el formulario cada vez que se abre para otra oportunidad.
  const [clave, setClave] = useState(0)
  useEffect(() => {
    if (abierto) setClave((k) => k + 1)
  }, [abierto, oportunidad?.id])

  const confirmar = (motivoId: string, detalle: string) => {
    if (!oportunidad) return
    perder.mutate(
      { id: oportunidad.id, motivoId, detalle },
      {
        onSuccess: (guardada) => {
          toast.success("Oportunidad marcada como perdida.")
          if (onPerdida) onPerdida(guardada)
          else onCerrar()
        },
      },
    )
  }

  return (
    <PanelFormulario
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Marcar como perdida"
      descripcion={oportunidad ? `${oportunidad.titulo}. Indica el motivo; sin motivo no se puede perder.` : undefined}
      bloqueado={perder.isPending}
    >
      <FormularioPerder key={clave} motivos={motivos} guardando={perder.isPending} onConfirmar={confirmar} onCancelar={onCerrar} />
    </PanelFormulario>
  )
}

export default ModalPerder
