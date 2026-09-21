import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  Building2,
  Check,
  FileText,
  IdCard,
  ListTodo,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Tag,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { AvatarUsuario } from "@/components/comunes/AvatarUsuario"
import { Cargando } from "@/components/comunes/Cargando"
import { EnlaceTelefono } from "@/components/comunes/EnlaceTelefono"
import { Importe } from "@/components/comunes/Importe"
import { PanelFormulario } from "@/components/comunes/PanelFormulario"
import { Vacio } from "@/components/comunes/Vacio"
import { useUsuarioActual } from "@/hooks/useUsuarioActual"
import { FormularioActividad } from "@/features/actividades/FormularioActividad"
import { FormularioTarea } from "@/features/tareas/FormularioTarea"
import {
  ETIQUETA_ESTADO_OPORTUNIDAD,
  ETIQUETA_RESULTADO_ACTIVIDAD,
  ETIQUETA_TIPO_ACTIVIDAD,
  type ActividadConRelaciones,
  type OportunidadConRelaciones,
  type TareaConRelaciones,
  type TipoActividad,
} from "@/lib/types"
import { cn } from "@/lib/utils"
import { esVencida, etiquetaRelativaConHora, formatearFechaHora } from "@/lib/utils/fechas"
import { FormularioContacto } from "./FormularioContacto"
import { MiniFormularioOportunidad } from "./MiniFormularioOportunidad"
import { estaSinSeguimiento, textoDocumento } from "./logica"
import {
  useActividadesDeContacto,
  useCompletarTareaContacto,
  useContacto,
  useEliminarContacto,
  useOportunidadesDeContacto,
  useTareasPendientesDeContacto,
} from "./useContactos"

type Panel = { tipo: "actividad"; tipoInicial: TipoActividad } | { tipo: "tarea" } | { tipo: "oportunidad" } | { tipo: "editar" } | { tipo: "eliminar" } | null

const ICONO_TIPO: Record<TipoActividad, LucideIcon> = {
  llamada: Phone,
  whatsapp: MessageCircle,
  correo: Mail,
  reunion: Users,
  nota: FileText,
}

const COLOR_ESTADO: Record<OportunidadConRelaciones["estado"], string> = {
  abierta: "bg-sky-100 text-sky-800",
  ganada: "bg-emerald-100 text-emerald-800",
  perdida: "bg-rose-100 text-rose-800",
}

const COLOR_ETAPA: Record<string, string> = {
  slate: "bg-slate-600",
  sky: "bg-sky-600",
  teal: "bg-teal-600",
  emerald: "bg-emerald-600",
  amber: "bg-amber-500",
  orange: "bg-orange-600",
  rose: "bg-rose-600",
  violet: "bg-violet-600",
  red: "bg-red-600",
  green: "bg-green-600",
}

function Chip({ icono: Icono, children, className }: { icono?: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex min-h-8 items-center gap-1.5 rounded-full border bg-background px-3 text-sm", className)}>
      {Icono && <Icono className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
      {children}
    </span>
  )
}

function Seccion({ titulo, accion, children }: { titulo: string; accion?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{titulo}</h2>
        {accion}
      </div>
      {children}
    </section>
  )
}

function FilaOportunidad({ o }: { o: OportunidadConRelaciones }) {
  return (
    <Link
      to={`/oportunidades/${o.id}`}
      className="flex min-h-14 items-center gap-3 rounded-xl border bg-card px-3 py-2 transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{o.titulo}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
          <span className={cn("rounded-full px-2 py-0.5 font-medium", COLOR_ESTADO[o.estado])}>{ETIQUETA_ESTADO_OPORTUNIDAD[o.estado]}</span>
          {o.etapa && (
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-muted-foreground">
              <span className={cn("size-2 rounded-full", COLOR_ETAPA[o.etapa.color] ?? "bg-slate-600")} aria-hidden />
              {o.etapa.nombre}
            </span>
          )}
        </div>
      </div>
      <Importe valor={o.importe} className="shrink-0 font-semibold" />
    </Link>
  )
}

/** Sin `onHecha` (tarea de otro) no se pinta el botón: solo su responsable puede marcarla. */
function FilaTarea({ t, onHecha, completando }: { t: TareaConRelaciones; onHecha?: () => void; completando: boolean }) {
  const vencida = esVencida(t.vence_at)
  return (
    <li className="flex min-h-14 items-center gap-3 rounded-xl border bg-card px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{t.titulo}</div>
        <div className={cn("text-xs", vencida ? "font-medium text-red-600" : "text-muted-foreground")}>
          {vencida ? "Vencida · " : ""}
          {etiquetaRelativaConHora(t.vence_at)}
          {t.responsable && ` · ${t.responsable.nombre}`}
        </div>
      </div>
      {onHecha && (
        <Button type="button" variant="outline" className="min-h-10 gap-1.5" onClick={onHecha} disabled={completando} aria-label={`Marcar hecha: ${t.titulo}`}>
          {completando ? <Loader2 className="animate-spin" /> : <Check />}
          Hecha
        </Button>
      )}
    </li>
  )
}

function FilaActividad({ a }: { a: ActividadConRelaciones }) {
  const Icono = ICONO_TIPO[a.tipo]
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icono className="size-4" aria-hidden />
        </span>
        <span className="w-px flex-1 bg-border" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 pb-4">
        <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-medium">{ETIQUETA_TIPO_ACTIVIDAD[a.tipo]}</span>
          {a.resultado && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{ETIQUETA_RESULTADO_ACTIVIDAD[a.resultado]}</span>}
        </div>
        {a.nota && <p className="mt-1 text-sm whitespace-pre-wrap">{a.nota}</p>}
        <div className="mt-1 text-xs text-muted-foreground">
          {a.usuario?.nombre ?? "Usuario"} · {formatearFechaHora(a.ocurrio_at)}
        </div>
      </div>
    </li>
  )
}

/** Ficha del contacto: cabecera, acciones rápidas, oportunidades, tareas pendientes y línea de tiempo. */
export function PaginaContacto() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { uid, esAdmin } = useUsuarioActual()
  const contacto = useContacto(id)
  const oportunidades = useOportunidadesDeContacto(id)
  const tareas = useTareasPendientesDeContacto(id)
  const actividades = useActividadesDeContacto(id)
  const completar = useCompletarTareaContacto()
  const eliminar = useEliminarContacto()
  const [panel, setPanel] = useState<Panel>(null)
  const [completandoId, setCompletandoId] = useState<string | null>(null)
  const cerrarPanel = () => setPanel(null)

  if (contacto.isPending) return <Cargando tipo="pantalla" />
  if (contacto.isError || !contacto.data) {
    return (
      <Vacio
        titulo="No se pudo abrir el contacto"
        descripcion={contacto.error?.message ?? "El contacto no existe o fue eliminado."}
        accion={
          <Button variant="outline" className="min-h-11" nativeButton={false} render={<Link to="/contactos" />}>
            <ArrowLeft />
            Volver a contactos
          </Button>
        }
      />
    )
  }

  const c = contacto.data
  const puedeEditar = esAdmin || c.responsable_id === uid
  const tienePendiente = tareas.data ? tareas.data.length > 0 : undefined
  const sinSeguimiento = estaSinSeguimiento({ ultimaActividadAt: c.ultima_actividad_at, tienePendiente })
  const documento = textoDocumento(c.doc_tipo, c.doc_numero)

  const marcarHecha = async (t: TareaConRelaciones) => {
    setCompletandoId(t.id)
    try {
      await completar.mutateAsync(t.id)
      toast.success("Tarea hecha")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar la tarea.")
    } finally {
      setCompletandoId(null)
    }
  }

  const confirmarEliminar = async () => {
    try {
      await eliminar.mutateAsync(c.id)
      toast.success("Contacto eliminado")
      setPanel(null)
      navigate("/contactos", { replace: true })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar el contacto.")
    }
  }

  const acciones: { etiqueta: string; icono: LucideIcon; clase: string; panel: Panel }[] = [
    { etiqueta: "Llamada", icono: Phone, clase: "bg-sky-50 text-sky-700 border-sky-200", panel: { tipo: "actividad", tipoInicial: "llamada" } },
    { etiqueta: "WhatsApp", icono: MessageCircle, clase: "bg-emerald-50 text-emerald-700 border-emerald-200", panel: { tipo: "actividad", tipoInicial: "whatsapp" } },
    { etiqueta: "Nota", icono: FileText, clase: "bg-amber-50 text-amber-700 border-amber-200", panel: { tipo: "actividad", tipoInicial: "nota" } },
    { etiqueta: "Tarea", icono: ListTodo, clase: "bg-rose-50 text-rose-700 border-rose-200", panel: { tipo: "tarea" } },
  ]

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4">
      {/* Cabecera */}
      <header className="space-y-3">
        <div className="flex items-start gap-3">
          <Link to="/contactos" className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-muted" aria-label="Volver a contactos">
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold leading-tight break-words">{c.nombre}</h1>
            {c.empresa && (
              <p className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
                <Building2 className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{c.empresa}</span>
              </p>
            )}
          </div>
          {puedeEditar && (
            <div className="flex shrink-0 gap-1">
              <Button type="button" variant="outline" size="icon-lg" className="size-11" aria-label="Editar contacto" onClick={() => setPanel({ tipo: "editar" })}>
                <Pencil className="size-5" />
              </Button>
              <Button type="button" variant="ghost" size="icon-lg" className="size-11 text-destructive" aria-label="Eliminar contacto" onClick={() => setPanel({ tipo: "eliminar" })}>
                <Trash2 className="size-5" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sinSeguimiento && (
            <Chip className="border-amber-300 bg-amber-50 font-medium text-amber-800">
              <span className="size-2 rounded-full bg-amber-500" aria-hidden />
              Sin seguimiento
            </Chip>
          )}
          {tareas.data?.some((t) => esVencida(t.vence_at)) && (
            <Chip className="border-red-200 bg-red-50 font-medium text-red-700">
              <span className="size-2 rounded-full bg-red-500" aria-hidden />
              Tarea vencida
            </Chip>
          )}
          {c.requiere_revision && <Chip>Requiere revisión</Chip>}
        </div>

        <EnlaceTelefono telefono={c.telefono ?? c.telefono_raw} mensajeWhatsApp={`Hola ${c.nombre.split(" ")[0]},`} />

        <div className="flex flex-wrap items-center gap-2">
          {c.email && (
            <a href={`mailto:${c.email}`} className="inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-sm hover:bg-muted">
              <Mail className="size-3.5 text-muted-foreground" aria-hidden />
              <span className="truncate">{c.email}</span>
            </a>
          )}
          {c.origen && <Chip icono={Tag}>{c.origen.nombre}</Chip>}
          {documento && <Chip icono={IdCard}>{documento}</Chip>}
          {c.direccion && <Chip icono={MapPin}>{c.direccion}</Chip>}
          <Chip className="pl-1">
            <AvatarUsuario nombre={c.responsable?.nombre} id={c.responsable_id} tamano="sm" />
            {c.responsable?.nombre ?? "Sin responsable"}
          </Chip>
        </div>
        {c.notas && <p className="rounded-xl bg-muted/60 px-3 py-2 text-sm whitespace-pre-wrap">{c.notas}</p>}
      </header>

      {/* Acciones rápidas */}
      <div className="grid grid-cols-4 gap-2" role="group" aria-label="Acciones rápidas">
        {acciones.map((a) => (
          <button
            key={a.etiqueta}
            type="button"
            onClick={() => setPanel(a.panel)}
            className={cn(
              "flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border text-xs font-semibold transition-transform active:scale-95 sm:text-sm",
              a.clase,
            )}
          >
            <a.icono className="size-6" aria-hidden />
            {a.etiqueta}
          </button>
        ))}
      </div>

      {/* Oportunidades */}
      <Seccion
        titulo="Oportunidades"
        accion={
          <Button type="button" variant="outline" className="min-h-10 gap-1.5" onClick={() => setPanel({ tipo: "oportunidad" })}>
            <Plus />
            Nueva oportunidad
          </Button>
        }
      >
        {oportunidades.isPending && <Cargando tipo="lista" filas={2} />}
        {oportunidades.isError && <p className="text-sm text-destructive">{oportunidades.error.message}</p>}
        {oportunidades.data && oportunidades.data.length === 0 && (
          <p className="rounded-xl border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">Sin oportunidades todavía.</p>
        )}
        {oportunidades.data && oportunidades.data.length > 0 && (
          <div className="space-y-2">
            {oportunidades.data.map((o) => (
              <FilaOportunidad key={o.id} o={o} />
            ))}
          </div>
        )}
      </Seccion>

      {/* Tareas pendientes */}
      <Seccion
        titulo="Tareas pendientes"
        accion={
          <Button type="button" variant="ghost" className="min-h-10 gap-1.5" onClick={() => setPanel({ tipo: "tarea" })}>
            <Plus />
            Tarea
          </Button>
        }
      >
        {tareas.isPending && <Cargando tipo="lista" filas={2} />}
        {tareas.isError && <p className="text-sm text-destructive">{tareas.error.message}</p>}
        {tareas.data && tareas.data.length === 0 && (
          <p className="rounded-xl border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
            Sin próximo paso. Crea una tarea para no perder el seguimiento.
          </p>
        )}
        {tareas.data && tareas.data.length > 0 && (
          <ul className="space-y-2">
            {tareas.data.map((t) => (
              <FilaTarea
                key={t.id}
                t={t}
                onHecha={esAdmin || t.responsable_id === uid ? () => void marcarHecha(t) : undefined}
                completando={completandoId === t.id}
              />
            ))}
          </ul>
        )}
      </Seccion>

      {/* Actividad */}
      <Seccion titulo="Actividad">
        {actividades.isPending && <Cargando tipo="lista" filas={3} />}
        {actividades.isError && <p className="text-sm text-destructive">{actividades.error.message}</p>}
        {actividades.data && actividades.data.length === 0 && (
          <p className="rounded-xl border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
            Todavía no hay actividad. Registra la primera llamada o nota con los botones de arriba.
          </p>
        )}
        {actividades.data && actividades.data.length > 0 && (
          <ul className="pt-1">
            {actividades.data.map((a) => (
              <FilaActividad key={a.id} a={a} />
            ))}
          </ul>
        )}
      </Seccion>

      <p className="text-xs text-muted-foreground">Creado el {formatearFechaHora(c.created_at)}</p>

      {/* Formularios: nunca dos abiertos a la vez */}
      <FormularioActividad
        abierto={panel?.tipo === "actividad"}
        onCerrar={cerrarPanel}
        tipoInicial={panel?.tipo === "actividad" ? panel.tipoInicial : undefined}
        contactoId={c.id}
      />
      <FormularioTarea abierto={panel?.tipo === "tarea"} onCerrar={cerrarPanel} contactoId={c.id} />
      <MiniFormularioOportunidad abierto={panel?.tipo === "oportunidad"} onCerrar={cerrarPanel} contacto={c} />
      {puedeEditar && <FormularioContacto abierto={panel?.tipo === "editar"} onCerrar={cerrarPanel} contacto={c} />}
      {puedeEditar && (
        <PanelFormulario
          abierto={panel?.tipo === "eliminar"}
          onCerrar={cerrarPanel}
          titulo="¿Eliminar contacto?"
          descripcion={`Se eliminará ${c.nombre} con sus oportunidades, tareas y actividad. No se puede deshacer.`}
          bloqueado={eliminar.isPending}
          pie={
            <div className="flex w-full gap-2">
              <Button type="button" variant="outline" className="min-h-12 flex-1 text-base" onClick={cerrarPanel} disabled={eliminar.isPending}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" className="min-h-12 flex-1 text-base" onClick={() => void confirmarEliminar()} disabled={eliminar.isPending}>
                {eliminar.isPending && <Loader2 className="animate-spin" />}
                Eliminar
              </Button>
            </div>
          }
        >
          <p className="text-sm text-muted-foreground">Si solo quieres dejar de hacerle seguimiento, mejor pierde sus oportunidades con un motivo.</p>
        </PanelFormulario>
      )}
    </div>
  )
}

export default PaginaContacto
