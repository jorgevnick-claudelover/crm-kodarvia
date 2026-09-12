/**
 * Línea de tiempo de actividades de un contacto o de una oportunidad: icono por tipo,
 * resultado, nota, usuario y fecha en Lima. Editar y eliminar solo si es mía o soy admin.
 * Reutilizable desde Contactos y Oportunidades.
 */
import { useEffect, useState } from "react"
import { History, Loader2, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AvatarUsuario } from "@/components/comunes/AvatarUsuario"
import { Cargando } from "@/components/comunes/Cargando"
import { ChipsSeleccion } from "@/components/comunes/ChipsSeleccion"
import { PanelFormulario } from "@/components/comunes/PanelFormulario"
import { Vacio } from "@/components/comunes/Vacio"
import { useUsuarioActual } from "@/hooks/useUsuarioActual"
import {
  ETIQUETA_RESULTADO_ACTIVIDAD,
  ETIQUETA_TIPO_ACTIVIDAD,
  type ActividadConRelaciones,
  type ResultadoActividad,
  type TipoActividad,
} from "@/lib/types"
import { cn } from "@/lib/utils"
import { etiquetaRelativaConHora, formatearFechaHora } from "@/lib/utils/fechas"
import { CLASE_RESULTADO, ICONO_TIPO_ACTIVIDAD, OPCIONES_RESULTADO, OPCIONES_TIPO } from "./constantes"
import { useActividadesPorContacto, useActividadesPorOportunidad, useMutacionesActividades } from "./useActividades"

export interface ListaActividadesProps {
  /** Una de las dos: actividades del contacto o de la oportunidad. */
  contactoId?: string
  oportunidadId?: string
  limite?: number
  className?: string
  /** Texto del estado vacío. */
  textoVacio?: string
}

function mensajeError(e: unknown, porDefecto: string): string {
  return e instanceof Error && e.message ? e.message : porDefecto
}

export function ListaActividades({ contactoId, oportunidadId, limite = 200, className, textoVacio }: ListaActividadesProps) {
  const { uid, esAdmin } = useUsuarioActual()
  const porContacto = useActividadesPorContacto(oportunidadId ? null : contactoId, limite)
  const porOportunidad = useActividadesPorOportunidad(oportunidadId, limite)
  const consulta = oportunidadId ? porOportunidad : porContacto
  const { actualizar, eliminar } = useMutacionesActividades()
  const [editando, setEditando] = useState<ActividadConRelaciones | null>(null)
  const [confirmarId, setConfirmarId] = useState<string | null>(null)

  useEffect(() => {
    if (consulta.isError) toast.error(mensajeError(consulta.error, "No se pudo cargar la actividad."))
  }, [consulta.isError, consulta.error])

  if (!contactoId && !oportunidadId) return null
  if (consulta.isPending) return <Cargando filas={3} className={className} />
  const actividades = consulta.data ?? []
  if (actividades.length === 0) {
    return <Vacio icono={History} titulo={textoVacio ?? "Sin actividad todavía"} descripcion="Registra una llamada, un WhatsApp o una nota con el botón +." className={className} />
  }

  const borrar = async (a: ActividadConRelaciones) => {
    if (confirmarId !== a.id) {
      setConfirmarId(a.id)
      return
    }
    try {
      await eliminar.mutateAsync(a.id)
      toast.success("Actividad eliminada")
    } catch (e) {
      toast.error(mensajeError(e, "No se pudo eliminar la actividad."))
    } finally {
      setConfirmarId(null)
    }
  }

  return (
    <>
      <ol className={cn("relative flex flex-col gap-4 border-l pl-6", className)}>
        {actividades.map((a) => {
          const Icono = ICONO_TIPO_ACTIVIDAD[a.tipo]
          const puedeEditar = esAdmin || a.usuario_id === uid
          return (
            <li key={a.id} className="relative">
              <span className="absolute top-0.5 -left-[calc(1.5rem+9px)] flex size-[18px] items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-background">
                <Icono className="size-3" aria-hidden />
              </span>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium">{ETIQUETA_TIPO_ACTIVIDAD[a.tipo]}</span>
                {a.resultado && (
                  <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", CLASE_RESULTADO[a.resultado])}>
                    {ETIQUETA_RESULTADO_ACTIVIDAD[a.resultado]}
                  </span>
                )}
                <time dateTime={a.ocurrio_at} title={formatearFechaHora(a.ocurrio_at)} className="text-sm text-muted-foreground tabular-nums">
                  {etiquetaRelativaConHora(a.ocurrio_at)}
                </time>
              </div>
              {a.nota && <p className="mt-1 text-sm whitespace-pre-wrap">{a.nota}</p>}
              <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                <AvatarUsuario nombre={a.usuario?.nombre} id={a.usuario_id} tamano="sm" />
                <span>{a.usuario?.nombre ?? "Usuario"}</span>
                {puedeEditar && (
                  <span className="ml-auto flex items-center gap-1">
                    <Button type="button" variant="ghost" size="icon" className="size-9" aria-label="Editar actividad" onClick={() => setEditando(a)}>
                      <Pencil />
                    </Button>
                    <Button
                      type="button"
                      variant={confirmarId === a.id ? "destructive" : "ghost"}
                      size={confirmarId === a.id ? "sm" : "icon"}
                      className={confirmarId === a.id ? "min-h-9" : "size-9"}
                      aria-label="Eliminar actividad"
                      disabled={eliminar.isPending}
                      onClick={() => void borrar(a)}
                      onBlur={() => setConfirmarId((id) => (id === a.id ? null : id))}
                    >
                      {eliminar.isPending && confirmarId === a.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                      {confirmarId === a.id && "¿Eliminar?"}
                    </Button>
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      <EditorActividad
        actividad={editando}
        onCerrar={() => setEditando(null)}
        guardando={actualizar.isPending}
        onGuardar={async (cambios) => {
          if (!editando) return
          try {
            await actualizar.mutateAsync({ id: editando.id, cambios })
            toast.success("Guardado")
            setEditando(null)
          } catch (e) {
            toast.error(mensajeError(e, "No se pudo guardar la actividad."))
          }
        }}
      />
    </>
  )
}

interface EditorActividadProps {
  actividad: ActividadConRelaciones | null
  onCerrar: () => void
  onGuardar: (cambios: { tipo: TipoActividad; resultado: ResultadoActividad | null; nota: string | null }) => Promise<void>
  guardando: boolean
}

function EditorActividad({ actividad, onCerrar, onGuardar, guardando }: EditorActividadProps) {
  const [tipo, setTipo] = useState<TipoActividad>("llamada")
  const [resultado, setResultado] = useState<ResultadoActividad | null>(null)
  const [nota, setNota] = useState("")

  useEffect(() => {
    if (!actividad) return
    setTipo(actividad.tipo)
    setResultado(actividad.resultado)
    setNota(actividad.nota ?? "")
  }, [actividad])

  const guardar = () => void onGuardar({ tipo, resultado, nota: nota.trim() || null })
  const boton = (extra?: string) => (
    <Button type="button" size="lg" className={extra} disabled={guardando} onClick={guardar}>
      {guardando && <Loader2 className="animate-spin" />}
      Guardar
    </Button>
  )

  return (
    <PanelFormulario
      abierto={actividad !== null}
      onCerrar={onCerrar}
      titulo="Editar actividad"
      bloqueado={guardando}
      accionCabecera={boton("min-h-11")}
      pie={boton("min-h-12 w-full text-base")}
    >
      <div className="flex flex-col gap-5">
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <ChipsSeleccion<TipoActividad> etiqueta="Tipo" valor={tipo} onCambiar={(v) => v && setTipo(v)} opciones={OPCIONES_TIPO} />
        </div>
        <div className="space-y-1.5">
          <Label>Resultado</Label>
          <ChipsSeleccion<ResultadoActividad>
            etiqueta="Resultado"
            valor={resultado}
            onCambiar={setResultado}
            permitirVacio
            tamano="sm"
            opciones={OPCIONES_RESULTADO}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="editar-actividad-nota">Nota</Label>
          <Textarea id="editar-actividad-nota" rows={3} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="¿Qué pasó?" className="text-base" />
        </div>
      </div>
    </PanelFormulario>
  )
}

export default ListaActividades
