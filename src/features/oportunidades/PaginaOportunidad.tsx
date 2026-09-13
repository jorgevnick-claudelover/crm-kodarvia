import { useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeft,
  CalendarClock,
  CheckSquare,
  FileText,
  History,
  ListTodo,
  MessageCircle,
  Pencil,
  Phone,
  RotateCcw,
  ThumbsDown,
  Trash2,
  Trophy,
  User,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { AvatarUsuario } from "@/components/comunes/AvatarUsuario"
import { Cargando } from "@/components/comunes/Cargando"
import { ChipsSeleccion } from "@/components/comunes/ChipsSeleccion"
import { EnlaceTelefono } from "@/components/comunes/EnlaceTelefono"
import { Importe } from "@/components/comunes/Importe"
import { PanelFormulario } from "@/components/comunes/PanelFormulario"
import { Vacio } from "@/components/comunes/Vacio"
import { FormularioActividad } from "@/features/actividades/FormularioActividad"
import { FormularioTarea } from "@/features/tareas/FormularioTarea"
import { useCatalogos } from "@/hooks/useCatalogos"
import { useUsuarioActual } from "@/hooks/useUsuarioActual"
import * as apiActividades from "@/lib/api/actividades"
import * as apiTareas from "@/lib/api/tareas"
import type { FiltrosTareas } from "@/lib/api/tareas"
import { ETIQUETA_ESTADO_OPORTUNIDAD, ETIQUETA_RESULTADO_ACTIVIDAD, ETIQUETA_TIPO_ACTIVIDAD, type TipoActividad } from "@/lib/types"
import { cn } from "@/lib/utils"
import { diasEntre, esVencida, etiquetaRelativaConHora, formatearFecha, formatearFechaHora } from "@/lib/utils/fechas"
import { FormularioOportunidad } from "./FormularioOportunidad"
import { useModalesOportunidad } from "./ModalesOportunidad"
import { useEliminarOportunidad, useHistorialOportunidad, useMoverConDeshacer, useOportunidad, useReabrirOportunidad } from "./useOportunidades"

const CLASE_ESTADO: Record<string, string> = {
  abierta: "bg-sky-100 text-sky-800",
  ganada: "bg-green-100 text-green-800",
  perdida: "bg-red-100 text-red-800",
}

type AccionRapida = { tipo: "actividad"; tipoInicial: TipoActividad } | { tipo: "tarea" } | null

/** Detalle de la oportunidad: cabecera, stepper de etapas, acciones, tareas, actividad e historial. */
export function PaginaOportunidad() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { etapas, etapaPorId, usuarioPorId } = useCatalogos()
  const { uid, esAdmin } = useUsuarioActual()
  const consulta = useOportunidad(id)
  const historial = useHistorialOportunidad(id)
  const reabrir = useReabrirOportunidad()
  const eliminar = useEliminarOportunidad()
  const { moverConDeshacer } = useMoverConDeshacer()

  const [editando, setEditando] = useState(false)
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const [accion, setAccion] = useState<AccionRapida>(null)
  const [verTodaLaActividad, setVerTodaLaActividad] = useState(false)

  const o = consulta.data
  const contactoId = o?.contacto_id

  const filtrosTareas = useMemo<FiltrosTareas>(() => ({ oportunidadId: id ?? "", estado: "pendiente", orden: "vence" }), [id])
  const tareas = useQuery({
    queryKey: ["tareas", filtrosTareas],
    queryFn: () => apiTareas.listar(filtrosTareas),
    enabled: !!id,
  })
  const actividades = useQuery({
    queryKey: ["actividades", { contactoId }],
    queryFn: () => apiActividades.listarPorContacto(contactoId as string),
    enabled: !!contactoId,
  })

  const modales = useModalesOportunidad({
    etapas,
    onMover: (op, etapa) => moverConDeshacer(op, etapa, op.posicion),
  })

  if (!id) return <Vacio titulo="Oportunidad no encontrada" />
  if (consulta.isPending) return <Cargando tipo="pantalla" />
  if (consulta.isError || !o) {
    return (
      <div className="p-4">
        <Vacio
          titulo="No se pudo cargar la oportunidad"
          descripcion={consulta.error instanceof Error ? consulta.error.message : "Puede que haya sido eliminada."}
          accion={
            <Button variant="outline" nativeButton={false} render={<Link to="/oportunidades" />}>
              <ArrowLeft /> Volver a oportunidades
            </Button>
          }
        />
      </div>
    )
  }

  const puedeEditar = esAdmin || (!!uid && o.responsable_id === uid)
  const abierta = o.estado === "abierta"
  const diasAbierta = diasEntre(o.created_at, abierta ? new Date() : (o.ganada_at ?? o.perdida_at ?? new Date()))
  const etapaActual = o.etapa ?? etapaPorId(o.etapa_id)
  const actividadesFiltradas = (actividades.data ?? []).filter((a) => verTodaLaActividad || a.oportunidad_id === o.id)
  const hayActividadDeEsta = (actividades.data ?? []).some((a) => a.oportunidad_id === o.id)

  const alReabrir = () => {
    reabrir.mutate(o.id, {
      // La etapa puede haber cambiado al reabrir (si la suya fue desactivada): nombramos la de la fila devuelta.
      onSuccess: (devuelta) => toast.success(`Reabierta en ${etapaPorId(devuelta.etapa_id)?.nombre ?? etapaActual?.nombre ?? "su última etapa"}.`),
    })
  }
  const alEliminar = () => {
    eliminar.mutate(o.id, {
      onSuccess: () => {
        toast.success("Oportunidad eliminada.")
        navigate("/oportunidades", { replace: true })
      },
    })
  }
  const abrirAccion = (a: AccionRapida) => setAccion(a)

  const etapaAlEtapa = (nuevaId: string | null) => {
    if (!nuevaId || nuevaId === o.etapa_id) return
    const etapa = etapas.find((e) => e.id === nuevaId)
    if (!etapa) return
    moverConDeshacer(o, etapa, o.posicion)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Link to="/oportunidades" className="inline-flex min-h-9 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Oportunidades
      </Link>

      {/* Cabecera */}
      <section className="space-y-3 rounded-2xl border bg-card p-4 text-card-foreground">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold leading-tight">{o.titulo}</h1>
            {o.contacto && (
              <Link to={`/contactos/${o.contacto.id}`} className="mt-1 inline-flex items-center gap-1.5 text-base text-primary underline-offset-4 hover:underline">
                <User className="size-4" aria-hidden />
                {o.contacto.nombre}
                {o.contacto.empresa && <span className="text-muted-foreground">· {o.contacto.empresa}</span>}
              </Link>
            )}
          </div>
          <span className={cn("shrink-0 rounded-full px-3 py-1 text-sm font-semibold", CLASE_ESTADO[o.estado])}>
            {ETIQUETA_ESTADO_OPORTUNIDAD[o.estado]}
          </span>
        </div>

        {o.contacto?.telefono && <EnlaceTelefono telefono={o.contacto.telefono} tamano="sm" />}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Importe</dt>
            <dd className="text-base font-semibold">
              <Importe valor={o.importe} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Responsable</dt>
            <dd className="flex items-center gap-1.5">
              <AvatarUsuario nombre={o.responsable?.nombre} id={o.responsable_id} tamano="sm" />
              <span className="truncate">{o.responsable?.nombre ?? "—"}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Fecha prevista</dt>
            <dd>{o.fecha_cierre_prevista ? formatearFecha(`${o.fecha_cierre_prevista}T12:00:00Z`) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{abierta ? "Días abierta" : "Días hasta el cierre"}</dt>
            <dd>{diasAbierta}</dd>
          </div>
        </dl>

        {o.estado === "perdida" && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            <strong>Motivo:</strong> {o.motivo_perdida?.nombre ?? "—"}
            {o.detalle_perdida && <> · {o.detalle_perdida}</>}
            <span className="block text-xs text-red-700/80">Perdida el {formatearFechaHora(o.perdida_at)}</span>
          </p>
        )}
        {o.estado === "ganada" && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">Ganada el {formatearFechaHora(o.ganada_at)}</p>
        )}

        {/* Stepper de etapas */}
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground">Etapa{abierta && puedeEditar ? " (toca una para mover)" : ""}</div>
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <ChipsSeleccion
              etiqueta="Etapa"
              tamano="sm"
              className="flex-nowrap"
              valor={o.etapa_id}
              onCambiar={etapaAlEtapa}
              opciones={etapas.map((e) => ({ valor: e.id, etiqueta: e.nombre, color: e.color, deshabilitada: !abierta || !puedeEditar }))}
            />
          </div>
        </div>

        {/* Botones */}
        {puedeEditar && (
          <div className="flex flex-wrap gap-2">
            {abierta ? (
              <>
                <Button type="button" size="lg" className="min-h-11 gap-1.5 bg-green-600 text-white hover:bg-green-700" onClick={() => modales.abrirGanar(o)}>
                  <Trophy /> Ganar
                </Button>
                <Button type="button" size="lg" className="min-h-11 gap-1.5 bg-red-600 text-white hover:bg-red-700" onClick={() => modales.abrirPerder(o)}>
                  <ThumbsDown /> Perder
                </Button>
              </>
            ) : (
              <Button type="button" size="lg" variant="outline" className="min-h-11 gap-1.5" onClick={alReabrir} disabled={reabrir.isPending}>
                <RotateCcw /> Reabrir
              </Button>
            )}
            <Button type="button" size="lg" variant="outline" className="min-h-11 gap-1.5" onClick={() => setEditando(true)}>
              <Pencil /> Editar
            </Button>
            <Button type="button" size="lg" variant="ghost" className="min-h-11 gap-1.5 text-destructive" onClick={() => setConfirmarEliminar(true)}>
              <Trash2 /> Eliminar
            </Button>
          </div>
        )}
      </section>

      {/* Acciones rápidas */}
      <section className="grid grid-cols-4 gap-2">
        <button type="button" onClick={() => abrirAccion({ tipo: "actividad", tipoInicial: "llamada" })} className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-sky-200 bg-sky-50 text-xs font-semibold text-sky-700">
          <Phone className="size-5" aria-hidden /> Llamada
        </button>
        <button type="button" onClick={() => abrirAccion({ tipo: "actividad", tipoInicial: "whatsapp" })} className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-700">
          <MessageCircle className="size-5" aria-hidden /> WhatsApp
        </button>
        <button type="button" onClick={() => abrirAccion({ tipo: "actividad", tipoInicial: "nota" })} className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-amber-200 bg-amber-50 text-xs font-semibold text-amber-700">
          <FileText className="size-5" aria-hidden /> Nota
        </button>
        <button type="button" onClick={() => abrirAccion({ tipo: "tarea" })} className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-rose-200 bg-rose-50 text-xs font-semibold text-rose-700">
          <CheckSquare className="size-5" aria-hidden /> Tarea
        </button>
      </section>

      {/* Tareas pendientes */}
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <ListTodo className="size-4 text-muted-foreground" aria-hidden /> Tareas pendientes
        </h2>
        {tareas.isPending ? (
          <Cargando filas={2} />
        ) : (tareas.data ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
            Sin tareas pendientes.{" "}
            <button type="button" className="font-medium text-primary underline-offset-4 hover:underline" onClick={() => abrirAccion({ tipo: "tarea" })}>
              Añadir próximo paso
            </button>
          </p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {(tareas.data ?? []).map((t) => {
              const vencida = esVencida(t.vence_at)
              return (
                <li key={t.id}>
                  <Link to={`/tareas/${t.id}`} className="flex min-h-12 items-center gap-3 px-4 py-2 hover:bg-muted/50">
                    <CalendarClock className={cn("size-4 shrink-0", vencida ? "text-red-600" : "text-muted-foreground")} aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.titulo}</span>
                    <span className={cn("shrink-0 text-xs", vencida ? "font-semibold text-red-600" : "text-muted-foreground")}>
                      {etiquetaRelativaConHora(t.vence_at)}
                    </span>
                    <AvatarUsuario nombre={t.responsable?.nombre} id={t.responsable_id} tamano="sm" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Actividad */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Actividad</h2>
          {hayActividadDeEsta && (
            <ChipsSeleccion
              tamano="sm"
              etiqueta="Ámbito de la actividad"
              valor={verTodaLaActividad ? "todas" : "esta"}
              onCambiar={(v) => setVerTodaLaActividad(v === "todas")}
              opciones={[
                { valor: "esta", etiqueta: "De esta oportunidad" },
                { valor: "todas", etiqueta: "Todas del contacto" },
              ]}
            />
          )}
        </div>
        {actividades.isPending ? (
          <Cargando filas={3} />
        ) : actividadesFiltradas.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
            {hayActividadDeEsta ? "Sin actividad." : "Todavía no hay actividad registrada con este contacto."}
          </p>
        ) : (
          <ol className="divide-y rounded-xl border bg-card">
            {actividadesFiltradas.map((a) => (
              <li key={a.id} className="flex gap-3 px-4 py-3">
                <AvatarUsuario nombre={a.usuario?.nombre} id={a.usuario_id} tamano="sm" className="mt-0.5" />
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <span className="font-medium">{ETIQUETA_TIPO_ACTIVIDAD[a.tipo]}</span>
                    {a.resultado && <span className="rounded-full bg-muted px-2 text-xs">{ETIQUETA_RESULTADO_ACTIVIDAD[a.resultado]}</span>}
                    <span className="text-xs text-muted-foreground">{formatearFechaHora(a.ocurrio_at)}</span>
                    <span className="text-xs text-muted-foreground">· {a.usuario?.nombre ?? "—"}</span>
                  </div>
                  {a.nota && <p className="mt-0.5 whitespace-pre-line text-muted-foreground">{a.nota}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Historial de etapas */}
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <History className="size-4 text-muted-foreground" aria-hidden /> Historial de etapas
        </h2>
        {historial.isPending ? (
          <Cargando tipo="texto" filas={3} />
        ) : (historial.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin cambios registrados.</p>
        ) : (
          <ol className="space-y-1.5 text-sm">
            {[...(historial.data ?? [])].reverse().map((h) => {
              const de = h.de_estado && h.de_estado !== "abierta" ? ETIQUETA_ESTADO_OPORTUNIDAD[h.de_estado as keyof typeof ETIQUETA_ESTADO_OPORTUNIDAD] : etapaPorId(h.de_etapa_id)?.nombre
              const a = h.a_estado !== "abierta" ? ETIQUETA_ESTADO_OPORTUNIDAD[h.a_estado as keyof typeof ETIQUETA_ESTADO_OPORTUNIDAD] : etapaPorId(h.a_etapa_id)?.nombre
              const usuario = usuarioPorId(h.usuario_id)?.nombre
              return (
                <li key={h.id} className="flex flex-wrap items-center gap-x-2 rounded-lg bg-muted/40 px-3 py-2">
                  <span className="text-xs text-muted-foreground tabular-nums">{formatearFechaHora(h.created_at)}</span>
                  <span>
                    {de ? (
                      <>
                        {de} <span aria-hidden>→</span> <strong>{a ?? "—"}</strong>
                      </>
                    ) : (
                      <>
                        Creada en <strong>{a ?? "—"}</strong>
                      </>
                    )}
                  </span>
                  {usuario && <span className="text-xs text-muted-foreground">· {usuario}</span>}
                </li>
              )
            })}
          </ol>
        )}
      </section>

      {/* Modales (uno a la vez) */}
      {modales.modales}
      <FormularioOportunidad
        abierto={editando}
        onCerrar={() => setEditando(false)}
        oportunidad={o}
        onGuardado={() => setEditando(false)}
      />
      <FormularioActividad
        abierto={accion?.tipo === "actividad"}
        onCerrar={() => setAccion(null)}
        tipoInicial={accion?.tipo === "actividad" ? accion.tipoInicial : undefined}
        contactoId={o.contacto_id}
        oportunidadId={o.id}
      />
      <FormularioTarea abierto={accion?.tipo === "tarea"} onCerrar={() => setAccion(null)} contactoId={o.contacto_id} oportunidadId={o.id} />
      <PanelFormulario
        abierto={confirmarEliminar}
        onCerrar={() => setConfirmarEliminar(false)}
        titulo="Eliminar oportunidad"
        descripcion="Se borrará la oportunidad y su historial. Las tareas y actividades del contacto se conservan."
        bloqueado={eliminar.isPending}
        pie={
          <div className="flex w-full gap-2 sm:justify-end">
            <Button type="button" variant="outline" size="lg" className="min-h-11" onClick={() => setConfirmarEliminar(false)} disabled={eliminar.isPending}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" size="lg" className="min-h-11" onClick={alEliminar} disabled={eliminar.isPending}>
              <Trash2 /> Eliminar
            </Button>
          </div>
        }
      >
        <p className="text-sm">
          ¿Eliminar <strong>{o.titulo}</strong>?
        </p>
      </PanelFormulario>
    </div>
  )
}

export default PaginaOportunidad
