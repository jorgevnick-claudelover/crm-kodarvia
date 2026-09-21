import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { KanbanSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Cargando } from "@/components/comunes/Cargando"
import { Importe } from "@/components/comunes/Importe"
import { Vacio } from "@/components/comunes/Vacio"
import { useCatalogos } from "@/hooks/useCatalogos"
import { useUsuarioActual } from "@/hooks/useUsuarioActual"
import type { FiltrosOportunidades } from "@/lib/api/oportunidades"
import type { Etapa, EstadoOportunidad, OportunidadConRelaciones } from "@/lib/types"
import { cn } from "@/lib/utils"
import type { FiltrosURLOportunidades } from "./FiltrosOportunidades"
import { agruparPorEtapa, diasEnEtapa, posicionAlFinal, siguienteEtapa, sumaImportes } from "./logica"
import { useModalesOportunidad } from "./ModalesOportunidad"
import { colorPuntoEtapa } from "./SheetMoverA"
import { TarjetaOportunidad } from "./TarjetaOportunidad"
import { useIndicadoresTareas, useMoverConDeshacer, useOportunidades, useUltimoCambioEtapa } from "./useOportunidades"

export interface ListaPorEtapaProps {
  filtros: FiltrosURLOportunidades
  setFiltros: (parcial: Partial<FiltrosURLOportunidades>) => void
  className?: string
}

/** Chips de etapas con contador (más Ganadas y Perdidas) y tarjetas de la etapa elegida. */
export function ListaPorEtapa({ filtros, setFiltros, className }: ListaPorEtapaProps) {
  const navigate = useNavigate()
  const { etapas } = useCatalogos()
  const { uid, esAdmin } = useUsuarioActual()
  const indicadores = useIndicadoresTareas()
  const { moverConDeshacer } = useMoverConDeshacer()

  const estado: EstadoOportunidad = filtros.estado === "ganada" || filtros.estado === "perdida" ? filtros.estado : "abierta"

  // Abiertas siempre (para los contadores de los chips); las cerradas solo cuando se eligen.
  const filtrosAbiertas = useMemo<FiltrosOportunidades>(
    () => ({ ...filtros, estado: "abierta", etapaId: "", orden: "posicion" }),
    [filtros],
  )
  const filtrosCerradas = useMemo<FiltrosOportunidades>(
    () => ({ ...filtros, estado, etapaId: "", orden: "reciente" }),
    [filtros, estado],
  )
  const abiertas = useOportunidades(filtrosAbiertas)
  const cerradas = useOportunidades(filtrosCerradas, estado !== "abierta")

  const listaAbiertas = abiertas.data ?? []
  const porEtapa = useMemo(() => agruparPorEtapa(listaAbiertas, etapas), [listaAbiertas, etapas])
  const ids = useMemo(() => listaAbiertas.map((o) => o.id), [listaAbiertas])
  const ultimoCambio = useUltimoCambioEtapa(ids)

  const etapaElegida: Etapa | null =
    estado === "abierta" ? (etapas.find((e) => e.id === filtros.etapaId) ?? etapas[0] ?? null) : null

  const modales = useModalesOportunidad({
    etapas,
    onMover: (o, etapa) => moverConDeshacer(o, etapa, posicionAlFinal(porEtapa.get(etapa.id) ?? [])),
  })

  const elegirEtapa = (etapa: Etapa) => setFiltros({ estado: "abierta", etapaId: etapa.id })
  const elegirEstado = (nuevo: EstadoOportunidad) => setFiltros({ estado: nuevo, etapaId: "" })

  const tarjetas: OportunidadConRelaciones[] =
    estado === "abierta" ? (etapaElegida ? (porEtapa.get(etapaElegida.id) ?? []) : []) : (cerradas.data ?? [])
  const consulta = estado === "abierta" ? abiertas : cerradas
  const cargando = consulta.isPending

  const chipBase =
    "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium whitespace-nowrap transition-colors select-none"

  return (
    <div className={cn("space-y-3", className)}>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="tablist" aria-label="Etapas">
        {etapas.map((e) => {
          const activo = estado === "abierta" && etapaElegida?.id === e.id
          const n = porEtapa.get(e.id)?.length ?? 0
          return (
            <button
              key={e.id}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => elegirEtapa(e)}
              className={cn(chipBase, activo ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}
            >
              <span className={cn("size-2.5 rounded-full", activo ? "bg-white/80" : colorPuntoEtapa(e.color))} aria-hidden />
              {e.nombre}
              <span className={cn("rounded-full px-1.5 text-xs", activo ? "bg-white/20" : "bg-muted text-muted-foreground")}>{n}</span>
            </button>
          )
        })}
        <button
          type="button"
          role="tab"
          aria-selected={estado === "ganada"}
          onClick={() => elegirEstado("ganada")}
          className={cn(chipBase, estado === "ganada" ? "border-green-600 bg-green-600 text-white" : "border-green-300 bg-green-50 text-green-800")}
        >
          Ganadas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={estado === "perdida"}
          onClick={() => elegirEstado("perdida")}
          className={cn(chipBase, estado === "perdida" ? "border-red-600 bg-red-600 text-white" : "border-red-300 bg-red-50 text-red-800")}
        >
          Perdidas
        </button>
      </div>

      {estado === "abierta" && etapaElegida && tarjetas.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {tarjetas.length} {tarjetas.length === 1 ? "oportunidad" : "oportunidades"} · <Importe valor={sumaImportes(tarjetas)} />
        </p>
      )}

      {cargando ? (
        <Cargando tipo="tarjetas" filas={4} />
      ) : consulta.isError ? (
        <Vacio
          titulo="No se pudieron cargar las oportunidades"
          descripcion={consulta.error instanceof Error ? consulta.error.message : undefined}
          accion={
            <Button type="button" variant="outline" className="min-h-11" onClick={() => void consulta.refetch()}>
              Reintentar
            </Button>
          }
        />
      ) : etapas.length === 0 && estado === "abierta" ? (
        <Vacio icono={KanbanSquare} titulo="No hay etapas configuradas" descripcion="El administrador debe crear las etapas en Configuración." />
      ) : tarjetas.length === 0 ? (
        <Vacio
          icono={KanbanSquare}
          titulo={estado === "abierta" ? `Nada en ${etapaElegida?.nombre ?? "esta etapa"}` : estado === "ganada" ? "Sin ganadas" : "Sin perdidas"}
          descripcion={estado === "abierta" ? "Crea una oportunidad con el botón + o mueve una hasta aquí." : "Con los filtros actuales no hay resultados."}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {tarjetas.map((o) => {
            const sig = siguienteEtapa(etapas, o.etapa_id)
            // Mismo permiso que el tablero (Tablero.tsx): sin él la acción siempre falla al guardar.
            const mio = esAdmin || (!!uid && o.responsable_id === uid)
            return (
              <TarjetaOportunidad
                key={o.id}
                oportunidad={o}
                diasEnEtapa={diasEnEtapa(o, ultimoCambio.data?.[o.id])}
                tareaVencida={indicadores.tieneVencida(o)}
                sinTarea={indicadores.disponible && indicadores.sinTarea(o)}
                onAbrir={() => navigate(`/oportunidades/${o.id}`)}
                onMoverA={mio ? () => modales.abrirMoverA(o) : undefined}
                siguiente={sig}
                onSiguiente={mio && sig ? () => moverConDeshacer(o, sig, posicionAlFinal(porEtapa.get(sig.id) ?? [])) : undefined}
              />
            )
          })}
        </div>
      )}

      {modales.modales}
    </div>
  )
}

export default ListaPorEtapa
