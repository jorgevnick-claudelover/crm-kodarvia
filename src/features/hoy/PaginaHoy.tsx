/**
 * Pantalla Hoy: recordatorios vencidos (Visto / Hecha), bloques Vencidas · Hoy · Próximos 7 días,
 * filtro Mías / Todas (el admin ve Todas por defecto) y botón Nueva tarea.
 */
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { BellRing, CalendarCheck, Check, Eye, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Cargando } from "@/components/comunes/Cargando"
import { ChipsSeleccion } from "@/components/comunes/ChipsSeleccion"
import { Vacio } from "@/components/comunes/Vacio"
import { useUsuarioActual } from "@/hooks/useUsuarioActual"
import { FILTROS_TAREAS_DEFAULT } from "@/lib/api/tareas"
import type { Tarea, TareaConRelaciones } from "@/lib/types"
import { cn } from "@/lib/utils"
import { etiquetaRelativaConHora } from "@/lib/utils/fechas"
import { FilaTarea } from "@/features/tareas/FilaTarea"
import { FormularioTarea } from "@/features/tareas/FormularioTarea"
import { agruparParaHoy } from "@/features/tareas/logica"
import { useRecordatorios } from "@/features/tareas/useRecordatorios"
import { FILTROS_MIAS_PENDIENTES, indexarTareas, useMutacionesTareas, useTareas } from "@/features/tareas/useTareas"

export { useContadorHoy } from "./useContadorHoy"

type Ambito = "mias" | "todas"
const OPCIONES_AMBITO: { valor: Ambito; etiqueta: string }[] = [
  { valor: "mias", etiqueta: "Mías" },
  { valor: "todas", etiqueta: "Todas" },
]

interface BloqueProps {
  titulo: string
  tareas: TareaConRelaciones[]
  onEditar: (t: TareaConRelaciones) => void
  formatoFecha: "hora" | "relativa"
  claseTitulo?: string
}

function Bloque({ titulo, tareas, onEditar, formatoFecha, claseTitulo }: BloqueProps) {
  if (tareas.length === 0) return null
  return (
    <section aria-label={titulo} className="rounded-xl border bg-card px-4">
      <h2 className={cn("flex items-center gap-2 pt-3 text-sm font-semibold text-muted-foreground", claseTitulo)}>
        {titulo}
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">{tareas.length}</span>
      </h2>
      <ul className="divide-y">
        {tareas.map((t) => (
          <FilaTarea key={t.id} tarea={t} onEditar={onEditar} formatoFecha={formatoFecha} />
        ))}
      </ul>
    </section>
  )
}

interface TarjetaRecordatoriosProps {
  recordatorios: Tarea[]
  indice: Map<string, TareaConRelaciones>
  onEditar: (t: TareaConRelaciones) => void
}

function TarjetaRecordatorios({ recordatorios, indice, onEditar }: TarjetaRecordatoriosProps) {
  const { marcarVisto, completar } = useMutacionesTareas()
  if (recordatorios.length === 0) return null
  return (
    <section aria-label="Recordatorios" className="rounded-xl border border-amber-200 bg-amber-50 px-4 text-amber-950">
      <h2 className="flex items-center gap-2 pt-3 text-sm font-semibold">
        <BellRing className="size-4" aria-hidden />
        Recordatorios
        <span className="rounded-full bg-amber-200/70 px-2 py-0.5 text-xs tabular-nums">{recordatorios.length}</span>
      </h2>
      <ul className="divide-y divide-amber-200">
        {recordatorios.map((r) => {
          const completa = indice.get(r.id)
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-2 py-3">
              <div className="min-w-0 flex-1">
                <button type="button" className="block w-full truncate text-left text-base font-medium" onClick={() => completa && onEditar(completa)}>
                  {r.titulo}
                </button>
                <p className="text-sm text-amber-900/80">
                  <span className="tabular-nums">{etiquetaRelativaConHora(r.recordatorio_at ?? r.vence_at)}</span>
                  {completa?.contacto && (
                    <>
                      {" · "}
                      <Link to={`/contactos/${completa.contacto.id}`} className="underline-offset-4 hover:underline">
                        {completa.contacto.nombre}
                      </Link>
                    </>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button type="button" variant="outline" size="lg" className="min-h-11 bg-background" disabled={marcarVisto.isPending} onClick={() => marcarVisto.mutate(r.id)}>
                  <Eye />
                  Visto
                </Button>
                <Button type="button" size="lg" className="min-h-11" disabled={completar.isPending} onClick={() => completar.mutate(r.id)}>
                  <Check />
                  Hecha
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function PaginaHoy() {
  const { esAdmin, cargando: cargandoUsuario } = useUsuarioActual()
  const [eleccion, setEleccion] = useState<Ambito | null>(null)
  const ambito: Ambito = eleccion ?? (esAdmin ? "todas" : "mias")
  const filtros = ambito === "mias" ? FILTROS_MIAS_PENDIENTES : FILTROS_TAREAS_DEFAULT
  const lista = useTareas(filtros, { enabled: !cargandoUsuario })
  const { recordatorios } = useRecordatorios()
  const [nuevaAbierta, setNuevaAbierta] = useState(false)
  const [editando, setEditando] = useState<TareaConRelaciones | null>(null)

  const tareas = useMemo(() => lista.data ?? [], [lista.data])
  const grupos = useMemo(() => agruparParaHoy(tareas), [tareas])
  const indice = useMemo(() => indexarTareas(tareas), [tareas])
  const nadaPendiente = grupos.vencidas.length === 0 && grupos.hoy.length === 0 && grupos.proximos.length === 0

  const editar = (t: TareaConRelaciones) => {
    setNuevaAbierta(false)
    setEditando(t)
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <ChipsSeleccion<Ambito> etiqueta="Ver tareas" tamano="sm" valor={ambito} onCambiar={(v) => v && setEleccion(v)} opciones={OPCIONES_AMBITO} />
        <Button type="button" size="lg" className="min-h-11" onClick={() => setNuevaAbierta(true)}>
          <Plus />
          Nueva tarea
        </Button>
      </div>

      <TarjetaRecordatorios recordatorios={recordatorios} indice={indice} onEditar={editar} />

      {lista.isPending || cargandoUsuario ? (
        <Cargando filas={5} />
      ) : lista.isError ? (
        <Vacio titulo="No se pudieron cargar las tareas" descripcion={lista.error instanceof Error ? lista.error.message : undefined} accion={<Button type="button" variant="outline" className="min-h-11" onClick={() => void lista.refetch()}>Reintentar</Button>} />
      ) : nadaPendiente ? (
        <Vacio
          icono={CalendarCheck}
          titulo="Nada pendiente"
          descripcion="Buen momento para llamar a alguien sin seguimiento."
          accion={
            <Button variant="outline" className="min-h-11" nativeButton={false} render={<Link to="/contactos?sinSeguimiento=1" />}>
              Ver contactos sin seguimiento
            </Button>
          }
        />
      ) : (
        <>
          <Bloque titulo="Vencidas" tareas={grupos.vencidas} onEditar={editar} formatoFecha="relativa" claseTitulo="text-destructive" />
          <Bloque titulo="Hoy" tareas={grupos.hoy} onEditar={editar} formatoFecha="hora" />
          <Bloque titulo="Próximos 7 días" tareas={grupos.proximos} onEditar={editar} formatoFecha="relativa" />
        </>
      )}

      <FormularioTarea abierto={nuevaAbierta} onCerrar={() => setNuevaAbierta(false)} />
      {editando && <FormularioTarea abierto={!nuevaAbierta} onCerrar={() => setEditando(null)} tarea={editando} />}
    </div>
  )
}

export default PaginaHoy
