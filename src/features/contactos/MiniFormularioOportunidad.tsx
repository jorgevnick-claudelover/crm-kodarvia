import { type FormEvent, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChipsSeleccion } from "@/components/comunes/ChipsSeleccion"
import { PanelFormulario } from "@/components/comunes/PanelFormulario"
import { useCatalogos } from "@/hooks/useCatalogos"
import { useConfiguracion } from "@/hooks/useConfiguracion"
import { useSimboloMoneda } from "@/hooks/useMoneda"
import { useUsuarioActual } from "@/hooks/useUsuarioActual"
import type { Contacto, Oportunidad } from "@/lib/types"
import { parsearImporte } from "@/lib/utils/moneda"
import { tituloOportunidadPorDefecto } from "./logica"
import { useCrearOportunidadContacto } from "./useContactos"

export interface MiniFormularioOportunidadProps {
  abierto: boolean
  onCerrar: () => void
  contacto: Contacto
  onGuardado?: (oportunidad: Oportunidad) => void
}

/**
 * Alta rápida de oportunidad desde la ficha del contacto: título (autogenerado), importe y etapa.
 * El módulo de oportunidades tiene el formulario completo; este cubre el criterio 1 desde la ficha.
 */
export function MiniFormularioOportunidad({ abierto, onCerrar, contacto, onGuardado }: MiniFormularioOportunidadProps) {
  const { esAdmin } = useUsuarioActual()
  const { etapas } = useCatalogos()
  const { configuracion } = useConfiguracion()
  const simbolo = useSimboloMoneda()
  const crear = useCrearOportunidadContacto()
  const [titulo, setTitulo] = useState<string | null>(null)
  const [importe, setImporte] = useState<string | null>(null)
  const [etapaId, setEtapaId] = useState<string | null>(null)

  useEffect(() => {
    if (abierto) {
      setTitulo(null)
      setImporte(null)
      setEtapaId(null)
    }
  }, [abierto, contacto.id])

  const tituloAuto = tituloOportunidadPorDefecto(contacto.nombre, configuracion.titulo_oportunidad_default)
  const tituloEfectivo = titulo ?? tituloAuto
  const importeEfectivo = importe ?? (configuracion.importe_default > 0 ? String(configuracion.importe_default) : "")
  const etapaEfectiva = etapaId ?? etapas[0]?.id ?? null

  const guardar = async () => {
    if (crear.isPending) return
    if (!etapaEfectiva) {
      toast.error("No hay etapas activas. Pide al administrador que configure una.")
      return
    }
    try {
      const creada = await crear.mutateAsync({
        contacto_id: contacto.id,
        titulo: tituloEfectivo.trim() || tituloAuto || contacto.nombre,
        importe: parsearImporte(importeEfectivo),
        etapa_id: etapaEfectiva,
        // Solo el administrador puede asignar a otro; el resto queda como responsable por defecto (auth.uid()).
        ...(esAdmin ? { responsable_id: contacto.responsable_id } : {}),
      })
      toast.success("Creada")
      onCerrar()
      onGuardado?.(creada)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear la oportunidad.")
    }
  }

  const alEnviar = (e: FormEvent) => {
    e.preventDefault()
    void guardar()
  }

  const botonGuardar = (clase: string) => (
    <Button type="button" onClick={() => void guardar()} disabled={crear.isPending} className={clase}>
      {crear.isPending && <Loader2 className="animate-spin" />}
      Guardar
    </Button>
  )

  return (
    <PanelFormulario
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Nueva oportunidad"
      descripcion={contacto.nombre}
      bloqueado={crear.isPending}
      accionCabecera={botonGuardar("min-h-10 px-5 text-base")}
      pie={
        <div className="flex w-full gap-2">
          <Button type="button" variant="outline" className="min-h-12 flex-1 text-base" onClick={onCerrar} disabled={crear.isPending}>
            Cancelar
          </Button>
          {botonGuardar("min-h-12 flex-1 text-base")}
        </div>
      }
    >
      <form onSubmit={alEnviar} noValidate className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="mini-op-titulo">Título</Label>
          <Input
            id="mini-op-titulo"
            autoFocus
            value={tituloEfectivo}
            onChange={(e) => setTitulo(e.target.value === "" ? null : e.target.value)}
            enterKeyHint="next"
            className="h-12 text-base"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mini-op-importe">Importe</Label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-base text-muted-foreground">{simbolo}</span>
            <Input
              id="mini-op-importe"
              inputMode="decimal"
              enterKeyHint="done"
              value={importeEfectivo}
              onChange={(e) => setImporte(e.target.value)}
              placeholder="0.00"
              className="h-12 pl-10 text-base tabular-nums"
            />
          </div>
        </div>
        {etapas.length > 0 ? (
          <div className="space-y-1.5">
            <Label>Etapa</Label>
            <ChipsSeleccion
              etiqueta="Etapa"
              tamano="sm"
              valor={etapaEfectiva}
              onCambiar={setEtapaId}
              opciones={etapas.map((e) => ({ valor: e.id, etiqueta: e.nombre, color: e.color }))}
            />
          </div>
        ) : (
          <p className="text-sm text-amber-800">No hay etapas activas configuradas.</p>
        )}
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden>
          Guardar
        </button>
      </form>
    </PanelFormulario>
  )
}

export default MiniFormularioOportunidad
