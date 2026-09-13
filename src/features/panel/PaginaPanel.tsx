import { useEffect, useMemo, useState } from "react"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Cargando } from "@/components/comunes/Cargando"
import { Vacio } from "@/components/comunes/Vacio"
import { useCatalogos } from "@/hooks/useCatalogos"
import { useFiltrosURL } from "@/hooks/useFiltrosURL"
import { hoyLima } from "@/lib/utils/fechas"
import {
  calcularResumen,
  embudo,
  filtrarPorResponsable,
  ganadoPorMes,
  mesActualLima,
  mesesDelGrafico,
  perdidasPorMotivo,
  porEtapaYResponsable,
  PRESETS_RANGO,
  rangoDePreset,
  vencidasPorResponsable,
  type PresetRango,
} from "./calculos"
import { Embudo } from "./Embudo"
import { FiltrosPanel, type FiltrosPanelValores } from "./FiltrosPanel"
import { GraficoGanadoPorMes } from "./GraficoGanadoPorMes"
import { GraficoPorEtapa } from "./GraficoPorEtapa"
import { ListaVencidas } from "./ListaVencidas"
import { TablaPerdidasPorMotivo } from "./TablaPerdidasPorMotivo"
import { TarjetasResumen } from "./TarjetasResumen"
import { usePanelDatos } from "./usePanelDatos"

/** Constante estable para useFiltrosURL (todo string; el preset se valida al leer). */
const FILTROS_PANEL_DEFAULT = { preset: "6m", desde: "", hasta: "", responsableId: "" }

function presetValido(v: string): PresetRango {
  return (PRESETS_RANGO as readonly string[]).includes(v) ? (v as PresetRango) : "6m"
}

/** Panel con métricas: filtros, tarjetas, gráficos, embudo mensual, perdidas por motivo y vencidas. */
export function PaginaPanel() {
  const { filtros, setFiltros, limpiar, hayFiltros } = useFiltrosURL(FILTROS_PANEL_DEFAULT)
  const valores: FiltrosPanelValores = { ...filtros, preset: presetValido(filtros.preset) }
  const catalogos = useCatalogos()
  const hoy = hoyLima()
  const mesActual = mesActualLima()
  const [mesEmbudo, setMesEmbudo] = useState(mesActual)
  const [ahora, setAhora] = useState(() => new Date())

  const rango = useMemo(() => rangoDePreset(valores.preset, hoy, valores.desde, valores.hasta), [valores.preset, valores.desde, valores.hasta, hoy])
  const desdeHistorial = rango.desde < `${mesEmbudo}-01` ? rango.desde : `${mesEmbudo}-01`
  const datos = usePanelDatos(desdeHistorial)

  useEffect(() => {
    if (datos.error) toast.error(datos.error.message || "No se pudo cargar el panel")
  }, [datos.error])

  // "Ahora" se refresca cada minuto para que las vencidas no se queden congeladas.
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const responsableId = valores.responsableId
  const oportunidades = useMemo(() => filtrarPorResponsable(datos.oportunidades, responsableId), [datos.oportunidades, responsableId])
  const tareas = useMemo(() => filtrarPorResponsable(datos.tareasPendientes, responsableId), [datos.tareasPendientes, responsableId])
  const contactos = useMemo(() => filtrarPorResponsable(datos.contactos, responsableId), [datos.contactos, responsableId])

  const resumen = useMemo(() => calcularResumen(oportunidades, tareas, contactos, ahora), [oportunidades, tareas, contactos, ahora])
  const matriz = useMemo(() => porEtapaYResponsable(oportunidades, catalogos.etapas, catalogos.usuariosTodos), [oportunidades, catalogos.etapas, catalogos.usuariosTodos])
  const meses = useMemo(() => mesesDelGrafico(rango), [rango])
  const ganado = useMemo(() => ganadoPorMes(oportunidades, meses), [oportunidades, meses])
  const resultadoEmbudo = useMemo(() => embudo(oportunidades, datos.historial, catalogos.etapasTodas, mesEmbudo), [oportunidades, datos.historial, catalogos.etapasTodas, mesEmbudo])
  const perdidas = useMemo(() => perdidasPorMotivo(oportunidades, rango, catalogos.motivosTodos), [oportunidades, rango, catalogos.motivosTodos])
  const vencidas = useMemo(() => vencidasPorResponsable(tareas, catalogos.usuariosTodos, ahora), [tareas, catalogos.usuariosTodos, ahora])

  const cargando = datos.cargando || catalogos.cargando

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <FiltrosPanel
            valores={valores}
            rango={rango}
            usuarios={catalogos.usuarios}
            onCambiar={(parcial) => setFiltros(parcial)}
            onLimpiar={limpiar}
            hayFiltros={hayFiltros}
          />
        </div>
        <Button
          variant="ghost"
          size="icon-lg"
          className="size-11 shrink-0"
          aria-label="Actualizar"
          onClick={() => {
            setAhora(new Date())
            datos.refrescar()
          }}
        >
          <RefreshCw className="size-5" />
        </Button>
      </div>

      {cargando ? (
        <Cargando tipo="tarjetas" filas={5} />
      ) : datos.error ? (
        <Vacio
          titulo="No se pudo cargar el panel"
          descripcion={datos.error.message}
          accion={
            <Button type="button" variant="outline" className="min-h-11" onClick={() => datos.refrescar()}>
              Reintentar
            </Button>
          }
        />
      ) : (
        <>
          <TarjetasResumen resumen={resumen} responsableId={responsableId || undefined} />
          <div className="grid gap-4 lg:grid-cols-2">
            <GraficoPorEtapa matriz={matriz} />
            <GraficoGanadoPorMes puntos={ganado} />
          </div>
          <Embudo resultado={resultadoEmbudo} mes={mesEmbudo} mesMaximo={mesActual} onCambiarMes={setMesEmbudo} cargando={datos.cargandoHistorial} />
          <div className="grid gap-4 lg:grid-cols-2">
            <TablaPerdidasPorMotivo filas={perdidas} />
            <ListaVencidas filas={vencidas} />
          </div>
        </>
      )}
    </div>
  )
}

export default PaginaPanel
