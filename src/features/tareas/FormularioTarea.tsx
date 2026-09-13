/**
 * Formulario de tarea (crear y editar). Un solo campo obligatorio: el título, con valor por
 * defecto "Llamar a {contacto}". Fecha con chips, hora por defecto la de configuración,
 * "Avisarme" activado (recordatorio_at = vence_at). Solo el admin cambia el responsable.
 */
import { useEffect, useState } from "react"
import { Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ChipsFecha } from "@/components/comunes/ChipsFecha"
import { ChipsSeleccion } from "@/components/comunes/ChipsSeleccion"
import { PanelFormulario } from "@/components/comunes/PanelFormulario"
import { SelectorContacto } from "@/components/comunes/SelectorContacto"
import { useCatalogos } from "@/hooks/useCatalogos"
import { useConfiguracion } from "@/hooks/useConfiguracion"
import { useUsuarioActual } from "@/hooks/useUsuarioActual"
import type { Contacto, Tarea, TareaInsert, TareaUpdate } from "@/lib/types"
import { partesLima } from "@/lib/utils/fechas"
import { calcularRecordatorioAt, calcularVenceAt, fechaPorDefecto, tituloPorDefecto } from "./logica"
import { useContactoDeFormulario, useMutacionesTareas, useOportunidadesAbiertas } from "./useTareas"

export interface FormularioTareaProps {
  abierto: boolean
  onCerrar: () => void
  contactoId?: string
  oportunidadId?: string
  /** Si viene, edita en vez de crear. */
  tarea?: Tarea
  onGuardado?: (tarea: Tarea) => void
}

function mensajeError(e: unknown, porDefecto: string): string {
  return e instanceof Error && e.message ? e.message : porDefecto
}

export function FormularioTarea({ abierto, onCerrar, contactoId, oportunidadId, tarea, onGuardado }: FormularioTareaProps) {
  const { uid, esAdmin } = useUsuarioActual()
  const { configuracion } = useConfiguracion()
  const { usuarios } = useCatalogos()
  const { crear, actualizar, eliminar } = useMutacionesTareas()
  const editando = !!tarea

  const idContactoInicial = contactoId ?? tarea?.contacto_id ?? null
  const contactoInicial = useContactoDeFormulario(abierto ? idContactoInicial : null)
  const contactoFijo = !!contactoId

  const [titulo, setTitulo] = useState("")
  const [tituloEditado, setTituloEditado] = useState(false)
  const [contacto, setContacto] = useState<Contacto | null>(null)
  const [oportunidad, setOportunidad] = useState<string | null>(null)
  const [fecha, setFecha] = useState("")
  const [hora, setHora] = useState("")
  const [avisar, setAvisar] = useState(true)
  const [responsableId, setResponsableId] = useState<string | null>(null)
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)

  const { abiertas, cargando } = useOportunidadesAbiertas(contacto?.id)
  const guardando = crear.isPending || actualizar.isPending || eliminar.isPending

  // Estado inicial cada vez que se abre (crear: valores por defecto; editar: los de la tarea).
  useEffect(() => {
    if (!abierto) return
    if (tarea) {
      const partes = partesLima(tarea.vence_at)
      setTitulo(tarea.titulo)
      setTituloEditado(true)
      setOportunidad(tarea.oportunidad_id)
      setFecha(partes.fecha)
      setHora(partes.hora)
      setAvisar(!!tarea.recordatorio_at)
      setResponsableId(tarea.responsable_id)
    } else {
      setTitulo("")
      setTituloEditado(false)
      setOportunidad(oportunidadId ?? null)
      setFecha(fechaPorDefecto(configuracion.hora_recordatorio))
      setHora(configuracion.hora_recordatorio)
      setAvisar(true)
      setResponsableId(uid)
    }
    setContacto(null)
    setConfirmarBorrado(false)
    // Solo al abrir o al cambiar de tarea; los valores por defecto se leen en ese momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, tarea?.id])

  // Contacto fijado (desde la ficha) o el de la tarea que se edita, cuando llega de la consulta.
  useEffect(() => {
    if (abierto && contactoInicial.data && contactoInicial.data.id === idContactoInicial) {
      setContacto((actual) => actual ?? contactoInicial.data ?? null)
    }
  }, [abierto, contactoInicial.data, idContactoInicial])

  // Título por defecto "Llamar a {contacto}" mientras el usuario no lo haya tocado.
  useEffect(() => {
    if (!tituloEditado) setTitulo(tituloPorDefecto(contacto?.nombre))
  }, [contacto?.nombre, tituloEditado])

  // Si el contacto tiene una sola oportunidad abierta, se vincula sola. La oportunidad retenida
  // (la de la ruta o la de la tarea que se edita) solo sobrevive si es de este contacto.
  // La que llega fijada por la ruta se respeta aunque esté ganada o perdida: "Tarea" desde una
  // oportunidad cerrada (volver a intentarlo más adelante) debe seguir ligada a ella.
  useEffect(() => {
    if (!contacto || cargando) return
    const fijada = oportunidadId ?? tarea?.oportunidad_id ?? null
    setOportunidad((actual) => {
      if (actual && (actual === fijada || abiertas.some((o) => o.id === actual))) return actual
      return abiertas.length === 1 ? abiertas[0].id : null
    })
  }, [abiertas, cargando, contacto?.id, oportunidadId, tarea?.oportunidad_id])

  const cambiarContacto = (c: Contacto | null) => {
    setContacto(c)
    if (!c) setOportunidad(null)
  }

  const guardar = async () => {
    const tituloLimpio = titulo.trim()
    if (!tituloLimpio) {
      toast.error("Escribe un título para la tarea.")
      return
    }
    if (!fecha) {
      toast.error("Elige la fecha.")
      return
    }
    if (!hora) {
      toast.error("Elige la hora.")
      return
    }
    const venceAt = calcularVenceAt(fecha, hora)
    const recordatorioAt = calcularRecordatorioAt(venceAt, avisar)
    try {
      let guardada: Tarea
      if (tarea) {
        const cambios: TareaUpdate = {
          titulo: tituloLimpio,
          contacto_id: contacto?.id ?? null,
          oportunidad_id: contacto ? oportunidad : null,
          vence_at: venceAt,
          recordatorio_at: recordatorioAt,
        }
        // Si cambió la hora, el recordatorio se vuelve a mostrar (y a enviar).
        if (venceAt !== tarea.vence_at || recordatorioAt !== tarea.recordatorio_at) cambios.recordatorio_visto_at = null
        if (esAdmin && responsableId && responsableId !== tarea.responsable_id) cambios.responsable_id = responsableId
        guardada = await actualizar.mutateAsync({ id: tarea.id, cambios })
      } else {
        const datos: TareaInsert = {
          titulo: tituloLimpio,
          contacto_id: contacto?.id ?? null,
          oportunidad_id: contacto ? oportunidad : null,
          vence_at: venceAt,
          recordatorio_at: recordatorioAt,
        }
        if (responsableId) datos.responsable_id = responsableId
        guardada = await crear.mutateAsync(datos)
      }
      toast.success("Guardado")
      onGuardado?.(guardada)
      onCerrar()
    } catch (e) {
      toast.error(mensajeError(e, "No se pudo guardar la tarea."))
    }
  }

  const borrar = async () => {
    if (!tarea) return
    if (!confirmarBorrado) {
      setConfirmarBorrado(true)
      return
    }
    try {
      await eliminar.mutateAsync(tarea.id)
      toast.success("Tarea eliminada")
      onCerrar()
    } catch (e) {
      toast.error(mensajeError(e, "No se pudo eliminar la tarea."))
    }
  }

  const puedeEditarResponsable = esAdmin && usuarios.length > 0
  const puedeBorrar = editando && (esAdmin || tarea?.responsable_id === uid)
  // La tarea de otro se puede consultar, pero no guardar: es lo que permite la RLS.
  const soloLectura = editando && !esAdmin && tarea?.responsable_id !== uid
  // En edición el contacto llega de la consulta: guardar antes lo borraría (contacto_id: null).
  const esperandoContacto = !!idContactoInicial && contactoInicial.isPending

  const botonGuardar = (extra?: string) => (
    <Button type="button" size="lg" className={extra} disabled={guardando || esperandoContacto} onClick={() => void guardar()}>
      {guardando && <Loader2 className="animate-spin" />}
      Guardar
    </Button>
  )

  return (
    <PanelFormulario
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={editando ? "Editar tarea" : "Nueva tarea"}
      bloqueado={guardando}
      accionCabecera={soloLectura ? undefined : botonGuardar("min-h-11")}
      pie={
        soloLectura ? undefined : (
        <div className="flex w-full gap-2">
          {puedeBorrar && (
            <Button
              type="button"
              variant={confirmarBorrado ? "destructive" : "ghost"}
              size="lg"
              className="min-h-12"
              disabled={guardando}
              onClick={() => void borrar()}
            >
              <Trash2 />
              {confirmarBorrado ? "¿Eliminar?" : "Eliminar"}
            </Button>
          )}
          {botonGuardar("min-h-12 flex-1 text-base")}
        </div>
        )
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void guardar()
        }}
      >
        <fieldset disabled={soloLectura} className="flex min-w-0 flex-col gap-5">
        <div className="space-y-1.5">
          <Label htmlFor="tarea-titulo">Título</Label>
          <Input
            id="tarea-titulo"
            value={titulo}
            onChange={(e) => {
              setTitulo(e.target.value)
              setTituloEditado(true)
            }}
            placeholder="Llamar a…"
            enterKeyHint="done"
            className="h-12"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tarea-contacto">Contacto</Label>
          {esperandoContacto ? (
            <div className="flex h-12 items-center rounded-lg border px-3 text-muted-foreground">Cargando contacto…</div>
          ) : (
            <SelectorContacto
              id="tarea-contacto"
              valor={contacto}
              onCambiar={cambiarContacto}
              disabled={contactoFijo}
              placeholder="Sin contacto (opcional)"
            />
          )}
        </div>

        {contacto && abiertas.length > 1 && (
          <div className="space-y-1.5">
            <Label>Oportunidad</Label>
            <ChipsSeleccion
              etiqueta="Oportunidad"
              valor={oportunidad ?? ""}
              onCambiar={setOportunidad}
              permitirVacio
              tamano="sm"
              opciones={abiertas.map((o) => ({ valor: o.id, etiqueta: o.titulo }))}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Fecha</Label>
          <ChipsFecha valor={fecha} onCambiar={setFecha} />
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="tarea-hora">Hora</Label>
            <Input id="tarea-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="h-12 w-36" required />
          </div>
          <div className="flex min-h-12 items-center gap-3">
            <Switch id="tarea-avisar" checked={avisar} onCheckedChange={(v) => setAvisar(v)} />
            <Label htmlFor="tarea-avisar" className="text-base">
              Avisarme
            </Label>
          </div>
        </div>

        {puedeEditarResponsable && (
          <div className="space-y-1.5">
            <Label>Responsable</Label>
            <ChipsSeleccion
              etiqueta="Responsable"
              valor={responsableId ?? ""}
              onCambiar={(v) => setResponsableId(v)}
              tamano="sm"
              opciones={usuarios.map((u) => ({ valor: u.id, etiqueta: u.nombre }))}
            />
          </div>
        )}
        <button type="submit" className="sr-only" tabIndex={-1}>
          Guardar
        </button>
        </fieldset>
      </form>
    </PanelFormulario>
  )
}

export default FormularioTarea
