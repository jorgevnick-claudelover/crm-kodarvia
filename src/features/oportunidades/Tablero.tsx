import { useCallback, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type Collision,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { KanbanSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Cargando } from "@/components/comunes/Cargando"
import { Importe } from "@/components/comunes/Importe"
import { Vacio } from "@/components/comunes/Vacio"
import { useCatalogos } from "@/hooks/useCatalogos"
import { useUsuarioActual } from "@/hooks/useUsuarioActual"
import type { FiltrosOportunidades } from "@/lib/api/oportunidades"
import type { OportunidadConRelaciones } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ColumnaTablero, PREFIJO_ETAPA, ZONA_GANADA, ZONA_PERDIDA, ZonaCierre, type DatosArrastre } from "./ColumnaTablero"
import type { FiltrosURLOportunidades } from "./FiltrosOportunidades"
import { agruparPorEtapa, calcularPosicionDestino, diasEnEtapa, posicionAlFinal } from "./logica"
import { useModalesOportunidad } from "./ModalesOportunidad"
import { TarjetaOportunidad } from "./TarjetaOportunidad"
import {
  useCerradasEsteMes,
  useIndicadoresTareas,
  useMoverConDeshacer,
  useMoverOportunidad,
  useOportunidades,
  useUltimoCambioEtapa,
} from "./useOportunidades"

export interface TableroProps {
  filtros: FiltrosURLOportunidades
  className?: string
}

type Destino =
  | { tipo: "zona"; zona: "ganada" | "perdida" }
  | { tipo: "columna"; etapaId: string; sobreId: string | null }

/** Primero lo que está bajo el puntero; si no, intersección de rectángulos (columnas vacías). */
const detectarColision: CollisionDetection = (args) => {
  const bajoPuntero = pointerWithin(args)
  if (bajoPuntero.length > 0) return bajoPuntero
  return rectIntersection(args)
}

function datosDe(colision: Collision): DatosArrastre | undefined {
  const contenedor = colision.data?.droppableContainer as { data?: { current?: DatosArrastre } } | undefined
  return contenedor?.data?.current
}

/** Resuelve la columna o zona destino a partir de las colisiones (las zonas mandan; luego tarjetas; luego columnas). */
export function resolverDestino(colisiones: Collision[] | null | undefined, overId: UniqueIdentifier | null | undefined): Destino | null {
  const lista = colisiones ?? []
  const ids = lista.map((c) => String(c.id))
  if (ids.includes(ZONA_GANADA) || overId === ZONA_GANADA) return { tipo: "zona", zona: "ganada" }
  if (ids.includes(ZONA_PERDIDA) || overId === ZONA_PERDIDA) return { tipo: "zona", zona: "perdida" }
  for (const c of lista) {
    const datos = datosDe(c)
    if (datos?.tipo === "tarjeta" && datos.etapaId) return { tipo: "columna", etapaId: datos.etapaId, sobreId: String(c.id) }
  }
  for (const c of lista) {
    const id = String(c.id)
    if (id.startsWith(PREFIJO_ETAPA)) return { tipo: "columna", etapaId: id.slice(PREFIJO_ETAPA.length), sobreId: null }
  }
  if (typeof overId === "string" && overId.startsWith(PREFIJO_ETAPA)) {
    return { tipo: "columna", etapaId: overId.slice(PREFIJO_ETAPA.length), sobreId: null }
  }
  return null
}

function claveDestino(d: Destino | null): string | null {
  if (!d) return null
  return d.tipo === "zona" ? `zona:${d.zona}` : `${PREFIJO_ETAPA}${d.etapaId}`
}

/** Tablero kanban de computadora (dnd-kit) con zonas Ganada/Perdida y pie de cerradas del mes. */
export function Tablero({ filtros, className }: TableroProps) {
  const navigate = useNavigate()
  const { etapas } = useCatalogos()
  const { uid, esAdmin } = useUsuarioActual()
  const indicadores = useIndicadoresTareas()
  const mover = useMoverOportunidad()
  const { moverConDeshacer } = useMoverConDeshacer()
  const cerradas = useCerradasEsteMes()

  const filtrosTablero = useMemo<FiltrosOportunidades>(() => ({ ...filtros, estado: "abierta", etapaId: "", orden: "posicion" }), [filtros])
  const consulta = useOportunidades(filtrosTablero)
  const lista = consulta.data ?? []
  const porEtapa = useMemo(() => agruparPorEtapa(lista, etapas), [lista, etapas])
  const ids = useMemo(() => lista.map((o) => o.id), [lista])
  const ultimoCambio = useUltimoCambioEtapa(ids)

  const [activa, setActiva] = useState<OportunidadConRelaciones | null>(null)
  const [destino, setDestino] = useState<string | null>(null)

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  const puedeMover = useCallback((o: OportunidadConRelaciones) => esAdmin || (!!uid && o.responsable_id === uid), [esAdmin, uid])

  const modales = useModalesOportunidad({
    etapas,
    onMover: (o, etapa) => moverConDeshacer(o, etapa, posicionAlFinal(porEtapa.get(etapa.id) ?? [])),
  })

  const alEmpezar = (e: DragStartEvent) => {
    const datos = e.active.data.current as DatosArrastre | undefined
    setActiva(datos?.oportunidad ?? lista.find((o) => o.id === e.active.id) ?? null)
  }

  const alPasar = (e: DragOverEvent) => {
    setDestino(claveDestino(resolverDestino(e.collisions, e.over?.id)))
  }

  const alSoltar = (e: DragEndEvent) => {
    const tarjeta = activa
    setActiva(null)
    setDestino(null)
    if (!tarjeta) return
    const d = resolverDestino(e.collisions, e.over?.id)
    if (!d) return
    if (d.tipo === "zona") {
      // No se escribe nada hasta confirmar en el modal; cancelar deja la tarjeta donde estaba.
      if (d.zona === "ganada") modales.abrirGanar(tarjeta)
      else modales.abrirPerder(tarjeta)
      return
    }
    const columna = porEtapa.get(d.etapaId) ?? []
    const posicion = calcularPosicionDestino(columna, tarjeta.id, d.sobreId)
    const mismaEtapa = d.etapaId === tarjeta.etapa_id
    if (mismaEtapa && posicion === tarjeta.posicion) return
    // Soltar en la misma columna sin tarjeta debajo y ya siendo la última: nada que hacer.
    if (mismaEtapa && d.sobreId === null && columna[columna.length - 1]?.id === tarjeta.id) return
    const etapa = etapas.find((x) => x.id === d.etapaId) ?? null
    mover.mutate({ id: tarjeta.id, etapaId: d.etapaId, posicion, etapa })
  }

  const alCancelar = () => {
    setActiva(null)
    setDestino(null)
  }

  const muchasColumnas = etapas.length > 5

  if (consulta.isPending) return <Cargando tipo="tarjetas" filas={6} className={className} />
  if (consulta.isError) {
    return (
      <Vacio
        titulo="No se pudieron cargar las oportunidades"
        descripcion={consulta.error instanceof Error ? consulta.error.message : undefined}
        accion={
          <Button type="button" variant="outline" className="min-h-11" onClick={() => void consulta.refetch()}>
            Reintentar
          </Button>
        }
        className={className}
      />
    )
  }
  if (etapas.length === 0) {
    return <Vacio icono={KanbanSquare} titulo="No hay etapas configuradas" descripcion="Crea las etapas en Configuración para ver el tablero." />
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <DndContext sensors={sensores} collisionDetection={detectarColision} onDragStart={alEmpezar} onDragOver={alPasar} onDragEnd={alSoltar} onDragCancel={alCancelar}>
        <div className="-mx-4 overflow-x-auto px-4 pb-2">
          <div className="flex h-[calc(100dvh-17rem)] min-h-80 gap-3">
            {etapas.map((etapa) => (
              <ColumnaTablero
                key={etapa.id}
                etapa={etapa}
                oportunidades={porEtapa.get(etapa.id) ?? []}
                destino={destino === `${PREFIJO_ETAPA}${etapa.id}`}
                diasEnEtapaDe={(o) => diasEnEtapa(o, ultimoCambio.data?.[o.id])}
                tieneVencida={indicadores.tieneVencida}
                sinTarea={(o) => indicadores.disponible && indicadores.sinTarea(o)}
                puedeMover={puedeMover}
                onAbrir={(o) => navigate(`/oportunidades/${o.id}`)}
                className={muchasColumnas ? "w-72" : "w-72 xl:w-auto xl:min-w-60 xl:flex-1"}
              />
            ))}
          </div>
        </div>

        <div className={cn("flex h-16 gap-3 transition-opacity", activa ? "opacity-100" : "opacity-70")}>
          <ZonaCierre tipo="ganada" visible={!!activa} destino={destino === ZONA_GANADA} />
          <ZonaCierre tipo="perdida" visible={!!activa} destino={destino === ZONA_PERDIDA} />
        </div>

        <DragOverlay dropAnimation={null}>
          {activa && (
            <div className="w-72 rotate-1">
              <TarjetaOportunidad
                oportunidad={activa}
                diasEnEtapa={diasEnEtapa(activa, ultimoCambio.data?.[activa.id])}
                tareaVencida={indicadores.tieneVencida(activa)}
                sinTarea={indicadores.disponible && indicadores.sinTarea(activa)}
                compacta
                arrastrando
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <footer className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <span>Cerradas este mes:</span>
        {cerradas.data ? (
          <>
            <Link to="/oportunidades?estado=ganada" className="font-medium text-green-700 underline-offset-4 hover:underline">
              {cerradas.data.ganadas} {cerradas.data.ganadas === 1 ? "ganada" : "ganadas"} (<Importe valor={cerradas.data.importeGanado} />)
            </Link>
            <span aria-hidden>·</span>
            <Link to="/oportunidades?estado=perdida" className="font-medium text-red-700 underline-offset-4 hover:underline">
              {cerradas.data.perdidas} {cerradas.data.perdidas === 1 ? "perdida" : "perdidas"}
            </Link>
          </>
        ) : (
          <span>…</span>
        )}
      </footer>

      {modales.modales}
    </div>
  )
}

export default Tablero
