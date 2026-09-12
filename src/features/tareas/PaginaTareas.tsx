/**
 * Lista completa de tareas con filtros en la URL, agrupada por día, exportación con los mismos
 * filtros (criterio 7) y ruta /tareas/:id que abre la tarea en el formulario sobre la lista.
 */
import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { BotonExportar } from "@/components/comunes/BotonExportar"
import { Cargando } from "@/components/comunes/Cargando"
import { useFiltrosURL } from "@/hooks/useFiltrosURL"
import * as apiTareas from "@/lib/api/tareas"
import { FILTROS_TAREAS_DEFAULT } from "@/lib/api/tareas"
import type { Tarea, TareaConRelaciones } from "@/lib/types"
import { FiltrosTareas } from "./FiltrosTareas"
import { FormularioTarea } from "./FormularioTarea"
import { ListaTareas } from "./ListaTareas"
import { COLUMNAS_EXPORTACION_TAREAS, filaExportacionTarea } from "./logica"
import { useTarea, useTareas } from "./useTareas"

export function PaginaTareas() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { search } = useLocation()
  const { filtros, setFiltros, limpiar, hayFiltros } = useFiltrosURL(FILTROS_TAREAS_DEFAULT)
  const lista = useTareas(filtros)
  const [nuevaAbierta, setNuevaAbierta] = useState(false)

  const tareas = useMemo(() => lista.data ?? [], [lista.data])
  const tareaDeLista = id ? tareas.find((t) => t.id === id) : undefined
  const detalle = useTarea(tareaDeLista ? undefined : id)
  const tareaAbierta: Tarea | undefined = tareaDeLista ?? detalle.data

  useEffect(() => {
    if (id && detalle.isError) {
      toast.error(detalle.error instanceof Error ? detalle.error.message : "No se encontró la tarea.")
      navigate(`/tareas${search}`, { replace: true })
    }
  }, [id, detalle.isError, detalle.error, navigate, search])

  useEffect(() => {
    if (lista.isError) toast.error(lista.error instanceof Error ? lista.error.message : "No se pudieron cargar las tareas.")
  }, [lista.isError, lista.error])

  const cerrarDetalle = () => navigate(`/tareas${search}`, { replace: true })
  const editar = (t: TareaConRelaciones) => navigate(`/tareas/${t.id}${search}`)

  const obtenerFilas = async () => (await apiTareas.listarTodo(filtros)).map(filaExportacionTarea)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <FiltrosTareas filtros={filtros} setFiltros={setFiltros} limpiar={limpiar} hayFiltros={hayFiltros} className="flex-1" />
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {lista.isPending ? "Cargando…" : `${tareas.length} ${tareas.length === 1 ? "tarea" : "tareas"}`}
        </p>
        <div className="flex items-center gap-2">
          <BotonExportar obtenerFilas={obtenerFilas} columnas={COLUMNAS_EXPORTACION_TAREAS} nombreBase="tareas" filtros={filtros} size="lg" />
          <Button type="button" size="lg" className="min-h-11" onClick={() => setNuevaAbierta(true)}>
            <Plus />
            Nueva tarea
          </Button>
        </div>
      </div>

      {lista.isPending ? (
        <Cargando filas={6} />
      ) : (
        <ListaTareas
          tareas={tareas}
          onEditar={editar}
          vacio={{
            titulo: hayFiltros ? "Nada con esos filtros" : "Sin tareas pendientes",
            descripcion: hayFiltros ? "Prueba a quitar algún filtro." : "Crea una tarea o registra una llamada con próximo paso.",
            accion: hayFiltros ? (
              <Button type="button" variant="outline" className="min-h-11" onClick={limpiar}>
                Quitar filtros
              </Button>
            ) : undefined,
          }}
        />
      )}

      <FormularioTarea abierto={nuevaAbierta} onCerrar={() => setNuevaAbierta(false)} />
      {tareaAbierta && <FormularioTarea abierto={!!id && !nuevaAbierta} onCerrar={cerrarDetalle} tarea={tareaAbierta} />}
      {id && !tareaAbierta && detalle.isPending && <Cargando tipo="pantalla" className="min-h-0 py-4" />}
    </div>
  )
}

export default PaginaTareas
