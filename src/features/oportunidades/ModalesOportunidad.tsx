import { useCallback, useState, type ReactNode } from "react"
import type { Etapa, Oportunidad, OportunidadConRelaciones } from "@/lib/types"
import { ModalGanar } from "./ModalGanar"
import { ModalPerder } from "./ModalPerder"
import { SheetMoverA } from "./SheetMoverA"

type Op = OportunidadConRelaciones

export interface OpcionesModales {
  etapas: Etapa[]
  /** Mover a una etapa desde el sheet (posición la decide el que llama). */
  onMover: (oportunidad: Op, etapa: Etapa) => void
  onGanada?: (oportunidad: Oportunidad) => void
  onPerdida?: (oportunidad: Oportunidad) => void
  /** Se llama al cancelar el modal de perder o ganar (para devolver una tarjeta arrastrada). */
  onCancelar?: () => void
}

export interface ModalesOportunidad {
  abrirMoverA: (o: Op) => void
  abrirGanar: (o: Op) => void
  abrirPerder: (o: Op) => void
  /** Renderiza SheetMoverA, ModalGanar y ModalPerder (uno a la vez). */
  modales: ReactNode
}

const RETRASO_ENTRE_MODALES = 140

/** Estado compartido de los tres modales de cierre/movimiento; nunca dos apilados. */
export function useModalesOportunidad({ etapas, onMover, onGanada, onPerdida, onCancelar }: OpcionesModales): ModalesOportunidad {
  const [moverA, setMoverA] = useState<Op | null>(null)
  const [ganar, setGanar] = useState<Op | null>(null)
  const [perder, setPerder] = useState<Op | null>(null)

  const abrirMoverA = useCallback((o: Op) => setMoverA(o), [])
  const abrirGanar = useCallback((o: Op) => setGanar(o), [])
  const abrirPerder = useCallback((o: Op) => setPerder(o), [])

  const cerrarGanar = () => {
    setGanar(null)
    onCancelar?.()
  }
  const cerrarPerder = () => {
    setPerder(null)
    onCancelar?.()
  }

  const modales = (
    <>
      <SheetMoverA
        abierto={moverA !== null}
        onCerrar={() => setMoverA(null)}
        oportunidad={moverA}
        etapas={etapas}
        onMover={(etapa) => {
          if (moverA) onMover(moverA, etapa)
        }}
        onGanar={() => {
          const o = moverA
          if (o) setTimeout(() => setGanar(o), RETRASO_ENTRE_MODALES)
        }}
        onPerder={() => {
          const o = moverA
          if (o) setTimeout(() => setPerder(o), RETRASO_ENTRE_MODALES)
        }}
      />
      <ModalGanar
        abierto={ganar !== null}
        onCerrar={cerrarGanar}
        oportunidad={ganar}
        onGanada={(o) => {
          setGanar(null)
          onGanada?.(o)
        }}
      />
      <ModalPerder
        abierto={perder !== null}
        onCerrar={cerrarPerder}
        oportunidad={perder}
        onPerdida={(o) => {
          setPerder(null)
          onPerdida?.(o)
        }}
      />
    </>
  )

  return { abrirMoverA, abrirGanar, abrirPerder, modales }
}
