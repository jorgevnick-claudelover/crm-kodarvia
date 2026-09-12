import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BotonExportar } from "@/components/comunes/BotonExportar"
import { useCatalogos } from "@/hooks/useCatalogos"
import { useEsMovil } from "@/hooks/useEsMovil"
import { useFiltrosURL } from "@/hooks/useFiltrosURL"
import * as apiOportunidades from "@/lib/api/oportunidades"
import { FILTROS_OPORTUNIDADES_DEFAULT, type FiltrosOportunidades as Filtros } from "@/lib/api/oportunidades"
import { FiltrosOportunidades, type FiltrosURLOportunidades } from "./FiltrosOportunidades"
import { FormularioOportunidad } from "./FormularioOportunidad"
import { ListaPorEtapa } from "./ListaPorEtapa"
import { COLUMNAS_EXPORTACION, filaExportacion } from "./logica"
import { Tablero } from "./Tablero"

/**
 * Oportunidades: lista por etapa en celular, tablero en computadora. Ambos comparten
 * los filtros de la URL y la exportación usa exactamente el mismo objeto (criterio 7).
 */
export function PaginaOportunidades() {
  const esMovil = useEsMovil()
  const navigate = useNavigate()
  const { etapas, origenPorId } = useCatalogos()
  const { filtros, setFiltros, limpiar } = useFiltrosURL<FiltrosURLOportunidades>(FILTROS_OPORTUNIDADES_DEFAULT)
  const [nuevaAbierta, setNuevaAbierta] = useState(false)

  const estadoCerrado = filtros.estado === "ganada" || filtros.estado === "perdida"
  const verLista = esMovil || estadoCerrado

  // Lo que realmente se ve en pantalla: en la lista, la etapa elegida (o la primera); en el tablero, todas las abiertas.
  const filtrosEfectivos = useMemo<Filtros>(() => {
    if (!verLista) return { ...filtros, estado: "abierta", etapaId: "", orden: "posicion" }
    if (estadoCerrado) return { ...filtros, etapaId: "", orden: "reciente" }
    const etapaId = etapas.find((e) => e.id === filtros.etapaId)?.id ?? etapas[0]?.id ?? ""
    return { ...filtros, estado: "abierta", etapaId, orden: "posicion" }
  }, [filtros, verLista, estadoCerrado, etapas])

  const obtenerFilas = async () => {
    const lista = await apiOportunidades.listarTodo(filtrosEfectivos)
    return lista.map((o) => filaExportacion(o, { origenPorId }))
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <FiltrosOportunidades filtros={filtros} setFiltros={setFiltros} limpiar={limpiar} className="min-w-0 flex-1" />
        {!esMovil && (
          <>
            <BotonExportar obtenerFilas={obtenerFilas} columnas={COLUMNAS_EXPORTACION} nombreBase="oportunidades" filtros={{ ...filtrosEfectivos }} size="lg" />
            <Button type="button" size="lg" className="min-h-11 gap-1.5" onClick={() => setNuevaAbierta(true)}>
              <Plus />
              Nueva oportunidad
            </Button>
          </>
        )}
      </div>

      {verLista ? <ListaPorEtapa filtros={filtros} setFiltros={setFiltros} /> : <Tablero filtros={filtros} />}

      {esMovil && (
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="lg" className="min-h-11 flex-1 gap-1.5" onClick={() => setNuevaAbierta(true)}>
            <Plus />
            Nueva oportunidad
          </Button>
          <BotonExportar obtenerFilas={obtenerFilas} columnas={COLUMNAS_EXPORTACION} nombreBase="oportunidades" filtros={{ ...filtrosEfectivos }} size="lg" />
        </div>
      )}

      <FormularioOportunidad
        abierto={nuevaAbierta}
        onCerrar={() => setNuevaAbierta(false)}
        onGuardado={(o) => {
          setNuevaAbierta(false)
          navigate(`/oportunidades/${o.id}`)
        }}
      />
    </div>
  )
}

export default PaginaOportunidades
