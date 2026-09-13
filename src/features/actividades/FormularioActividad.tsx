/**
 * Registro rápido de actividad ("acabo de colgar"): una sola pantalla, sheet en celular y
 * diálogo en computadora. Único campo obligatorio: el contacto. Tipo, resultado y nota con
 * chips; "Próximo paso" crea la tarea "Llamar a {contacto}" con recordatorio en un toque.
 * Si el contacto queda sin tarea pendiente, el toast ofrece "Añadir próximo paso", que reabre
 * solo esa parte.
 */
import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ChipsFecha } from "@/components/comunes/ChipsFecha"
import { ChipsSeleccion } from "@/components/comunes/ChipsSeleccion"
import { PanelFormulario } from "@/components/comunes/PanelFormulario"
import { registrarContactoReciente, SelectorContacto } from "@/components/comunes/SelectorContacto"
import { useConfiguracion } from "@/hooks/useConfiguracion"
import { useUsuarioActual } from "@/hooks/useUsuarioActual"
import * as apiContactos from "@/lib/api/contactos"
import * as apiTareas from "@/lib/api/tareas"
import { ETIQUETA_TIPO_ACTIVIDAD, type Contacto, type ResultadoActividad, type TareaInsert, type TipoActividad } from "@/lib/types"
import { calcularVenceAt, tituloPorDefecto } from "@/features/tareas/logica"
import { useContactoDeFormulario, useMutacionesTareas, useOportunidadesAbiertas } from "@/features/tareas/useTareas"
import { OPCIONES_RESULTADO, OPCIONES_TIPO } from "./constantes"
import { useMutacionesActividades } from "./useActividades"

export interface FormularioActividadProps {
  abierto: boolean
  onCerrar: () => void
  /** Tipo preseleccionado (Llamada, WhatsApp, Reunión, Nota...). */
  tipoInicial?: TipoActividad
  /** Contacto ya elegido (desde la ficha). */
  contactoId?: string
  /** Oportunidad ya elegida (desde su detalle). */
  oportunidadId?: string
}

interface ModoProximoPaso {
  contacto: Contacto
  oportunidadId: string | null
}

function mensajeError(e: unknown, porDefecto: string): string {
  return e instanceof Error && e.message ? e.message : porDefecto
}

export function FormularioActividad({ abierto, onCerrar, tipoInicial, contactoId, oportunidadId }: FormularioActividadProps) {
  const { uid } = useUsuarioActual()
  const { configuracion } = useConfiguracion()
  const queryClient = useQueryClient()
  const { crear: crearActividad } = useMutacionesActividades()
  const { crear: crearTarea } = useMutacionesTareas()

  /** Tras guardar sin tarea pendiente: el toast reabre solo el bloque "Próximo paso". */
  const [soloProximo, setSoloProximo] = useState<ModoProximoPaso | null>(null)
  const visible = abierto || soloProximo !== null

  const contactoFijo = !!contactoId
  const contactoInicial = useContactoDeFormulario(abierto ? contactoId : null)

  const [contacto, setContacto] = useState<Contacto | null>(null)
  const [oportunidad, setOportunidad] = useState<string | null>(null)
  const [tipo, setTipo] = useState<TipoActividad>(tipoInicial ?? "llamada")
  const [resultado, setResultado] = useState<ResultadoActividad | null>(null)
  const [nota, setNota] = useState("")
  const [fechaProximo, setFechaProximo] = useState("")
  const [tituloProximo, setTituloProximo] = useState("")
  const [tituloEditado, setTituloEditado] = useState(false)
  const [horaProximo, setHoraProximo] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [creandoContacto, setCreandoContacto] = useState(false)

  const { abiertas, cargando } = useOportunidadesAbiertas(contacto?.id)

  // Valores por defecto al abrir: tipo inicial, ahora, yo.
  useEffect(() => {
    if (!abierto) return
    setSoloProximo(null)
    setContacto(null)
    setOportunidad(oportunidadId ?? null)
    setTipo(tipoInicial ?? "llamada")
    setResultado(null)
    setNota("")
    setFechaProximo("")
    setTituloProximo("")
    setTituloEditado(false)
    setHoraProximo(configuracion.hora_recordatorio)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, tipoInicial])

  // Modo "solo próximo paso": contacto y oportunidad ya decididos.
  useEffect(() => {
    if (!soloProximo) return
    setContacto(soloProximo.contacto)
    setOportunidad(soloProximo.oportunidadId)
    setFechaProximo("")
    setTituloProximo(tituloPorDefecto(soloProximo.contacto.nombre))
    setTituloEditado(false)
    setHoraProximo(configuracion.hora_recordatorio)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soloProximo])

  useEffect(() => {
    if (abierto && contactoInicial.data && contactoInicial.data.id === contactoId) {
      setContacto((actual) => actual ?? contactoInicial.data ?? null)
    }
  }, [abierto, contactoInicial.data, contactoId])

  useEffect(() => {
    if (!tituloEditado) setTituloProximo(tituloPorDefecto(contacto?.nombre))
  }, [contacto?.nombre, tituloEditado])

  // Oportunidad automática: la única abierta del contacto; chips si hay varias; nada si ninguna.
  // Siempre se recalcula contra el contacto actual: al sustituir un contacto por otro, la
  // oportunidad del anterior no puede sobrevivir.
  useEffect(() => {
    if (!contacto || cargando) return
    setOportunidad((actual) =>
      actual && abiertas.some((o) => o.id === actual) ? actual : abiertas.length === 1 ? abiertas[0].id : null,
    )
  }, [abiertas, cargando, contacto?.id])

  const cambiarContacto = (c: Contacto | null) => {
    setContacto(c)
    if (!c) setOportunidad(null)
  }

  const crearContactoMinimo = async (nombre: string) => {
    setCreandoContacto(true)
    try {
      const creado = await apiContactos.crear({ nombre })
      registrarContactoReciente(uid, creado)
      void queryClient.invalidateQueries({ queryKey: ["contactos"] })
      setContacto(creado)
      toast.success(`Contacto «${creado.nombre}» creado`)
    } catch (e) {
      toast.error(mensajeError(e, "No se pudo crear el contacto."))
    } finally {
      setCreandoContacto(false)
    }
  }

  const datosTarea = (c: Contacto, op: string | null): TareaInsert => {
    const venceAt = calcularVenceAt(fechaProximo, horaProximo || configuracion.hora_recordatorio)
    const datos: TareaInsert = {
      titulo: tituloProximo.trim() || tituloPorDefecto(c.nombre),
      contacto_id: c.id,
      oportunidad_id: op,
      vence_at: venceAt,
      recordatorio_at: venceAt,
    }
    if (uid) datos.responsable_id = uid
    return datos
  }

  const cerrar = () => {
    if (soloProximo) setSoloProximo(null)
    else onCerrar()
  }

  const guardarSoloProximo = async () => {
    if (!soloProximo) return
    if (!fechaProximo) {
      toast.error("Elige cuándo será el próximo paso.")
      return
    }
    setGuardando(true)
    try {
      await crearTarea.mutateAsync(datosTarea(soloProximo.contacto, soloProximo.oportunidadId))
      toast.success("Guardado")
      setSoloProximo(null)
    } catch (e) {
      toast.error(mensajeError(e, "No se pudo crear la tarea."))
    } finally {
      setGuardando(false)
    }
  }

  const guardar = async () => {
    if (soloProximo) {
      await guardarSoloProximo()
      return
    }
    if (!contacto) {
      toast.error("Elige el contacto.")
      return
    }
    const c = contacto
    const op = oportunidad
    setGuardando(true)
    try {
      await crearActividad.mutateAsync({
        contacto_id: c.id,
        oportunidad_id: op,
        tipo,
        resultado,
        nota: nota.trim() || null,
        ocurrio_at: new Date().toISOString(),
      })
    } catch (e) {
      setGuardando(false)
      toast.error(mensajeError(e, "No se pudo registrar la actividad."))
      return
    }

    let tareaCreada = false
    if (fechaProximo) {
      try {
        await crearTarea.mutateAsync(datosTarea(c, op))
        tareaCreada = true
      } catch (e) {
        toast.error(`La actividad se guardó, pero no la tarea: ${mensajeError(e, "error desconocido")}`)
      }
    }
    setGuardando(false)
    onCerrar()

    if (tareaCreada) {
      toast.success("Guardado")
      return
    }
    let tienePendiente = true
    try {
      tienePendiente = await apiTareas.tienePendiente(c.id)
    } catch {
      tienePendiente = true
    }
    if (tienePendiente) {
      toast.success("Guardado")
    } else {
      toast.success("Guardado", {
        description: `${c.nombre} queda sin próximo paso.`,
        duration: 8000,
        action: { label: "Añadir próximo paso", onClick: () => setSoloProximo({ contacto: c, oportunidadId: op }) },
      })
    }
  }

  const etiquetaTipo = tipo === "whatsapp" ? ETIQUETA_TIPO_ACTIVIDAD.whatsapp : ETIQUETA_TIPO_ACTIVIDAD[tipo].toLowerCase()
  const titulo = soloProximo ? `Próximo paso · ${soloProximo.contacto.nombre}` : `Registrar ${etiquetaTipo}`
  const ocupado = guardando || creandoContacto

  const botonGuardar = (extra?: string) => (
    <Button type="button" size="lg" className={extra} disabled={ocupado} onClick={() => void guardar()}>
      {guardando && <Loader2 className="animate-spin" />}
      Guardar
    </Button>
  )

  const bloqueProximoPaso = (
    <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
      <Label className="text-base">Próximo paso</Label>
      <ChipsFecha valor={fechaProximo} onCambiar={setFechaProximo} permitirVacio etiqueta="Próximo paso" />
      {fechaProximo && (
        <div className="flex flex-wrap items-end gap-3 pt-1">
          <div className="min-w-48 flex-1 space-y-1.5">
            <Label htmlFor="actividad-proximo-titulo">Tarea</Label>
            <Input
              id="actividad-proximo-titulo"
              value={tituloProximo}
              onChange={(e) => {
                setTituloProximo(e.target.value)
                setTituloEditado(true)
              }}
              placeholder="Llamar a…"
              className="h-12"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="actividad-proximo-hora">Hora</Label>
            <Input id="actividad-proximo-hora" type="time" value={horaProximo} onChange={(e) => setHoraProximo(e.target.value)} className="h-12 w-32" />
          </div>
        </div>
      )}
      {fechaProximo && <p className="text-xs text-muted-foreground">Te avisaremos a esa hora.</p>}
    </div>
  )

  return (
    <PanelFormulario
      abierto={visible}
      onCerrar={cerrar}
      titulo={titulo}
      bloqueado={ocupado}
      accionCabecera={botonGuardar("min-h-11")}
      pie={botonGuardar("min-h-12 w-full text-base")}
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault()
          void guardar()
        }}
      >
        {soloProximo ? (
          bloqueProximoPaso
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="actividad-contacto">Contacto</Label>
              {contactoFijo && contactoInicial.isPending ? (
                <div className="flex h-12 items-center rounded-lg border px-3 text-muted-foreground">Cargando contacto…</div>
              ) : (
                <SelectorContacto
                  id="actividad-contacto"
                  valor={contacto}
                  onCambiar={cambiarContacto}
                  disabled={contactoFijo || creandoContacto}
                  permitirCrear
                  onCrear={(nombre) => void crearContactoMinimo(nombre)}
                  placeholder="¿Con quién?"
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
              <Label htmlFor="actividad-nota">Nota</Label>
              <Textarea
                id="actividad-nota"
                rows={2}
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="¿Qué pasó?"
                className="min-h-16 text-base"
              />
            </div>

            {bloqueProximoPaso}
          </>
        )}
        <button type="submit" className="sr-only" tabIndex={-1}>
          Guardar
        </button>
      </form>
    </PanelFormulario>
  )
}

export default FormularioActividad
