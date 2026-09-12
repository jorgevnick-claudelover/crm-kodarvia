import { useEffect, useState } from "react"
import { Loader2, Trophy } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { PanelFormulario } from "@/components/comunes/PanelFormulario"
import type { Oportunidad } from "@/lib/types"
import { formatearImporte, parsearImporte } from "@/lib/utils/moneda"
import { useGanarOportunidad } from "./useOportunidades"

export interface ModalGanarProps {
  abierto: boolean
  onCerrar: () => void
  oportunidad: Oportunidad | null
  onGanada?: (oportunidad: Oportunidad) => void
}

/** Marcar como ganada: importe editable (prefijado con el actual) y Confirmar. */
export function ModalGanar({ abierto, onCerrar, oportunidad, onGanada }: ModalGanarProps) {
  const ganar = useGanarOportunidad()
  const [importeTexto, setImporteTexto] = useState("")

  useEffect(() => {
    if (abierto) setImporteTexto(oportunidad ? String(oportunidad.importe ?? 0) : "")
  }, [abierto, oportunidad])

  const importe = parsearImporte(importeTexto)

  const confirmar = () => {
    if (!oportunidad) return
    if (importe < 0) {
      toast.error("El importe no puede ser negativo.")
      return
    }
    ganar.mutate(
      { id: oportunidad.id, importe },
      {
        onSuccess: (guardada) => {
          toast.success(`Ganada por ${formatearImporte(importe)}.`)
          if (onGanada) onGanada(guardada)
          else onCerrar()
        },
      },
    )
  }

  return (
    <PanelFormulario
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Marcar como ganada"
      descripcion={oportunidad ? `${oportunidad.titulo}. Confirma el importe final.` : undefined}
      bloqueado={ganar.isPending}
      pie={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="lg" className="min-h-11" onClick={onCerrar} disabled={ganar.isPending}>
            Cancelar
          </Button>
          <Button
            type="button"
            size="lg"
            className="min-h-11 bg-green-600 text-white hover:bg-green-700"
            onClick={confirmar}
            disabled={ganar.isPending || !oportunidad}
          >
            {ganar.isPending ? <Loader2 className="animate-spin" /> : <Trophy />}
            Confirmar ganada
          </Button>
        </div>
      }
    >
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          confirmar()
        }}
      >
        <Label htmlFor="importe-ganada" className="text-base">
          Importe final
        </Label>
        <InputGroup className="h-12">
          <InputGroupAddon>
            <InputGroupText className="text-base font-semibold">S/</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            id="importe-ganada"
            inputMode="decimal"
            autoFocus
            enterKeyHint="done"
            className="text-base"
            value={importeTexto}
            onChange={(e) => setImporteTexto(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            placeholder="0.00"
          />
        </InputGroup>
        <p className="text-sm text-muted-foreground">Se guardará {formatearImporte(importe)} como importe ganado.</p>
      </form>
    </PanelFormulario>
  )
}

export default ModalGanar
