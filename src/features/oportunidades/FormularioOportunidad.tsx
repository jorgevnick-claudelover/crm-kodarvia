import { useEffect, useMemo, useState, type FormEvent } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { ChipsSeleccion } from "@/components/comunes/ChipsSeleccion"
import { PanelFormulario } from "@/components/comunes/PanelFormulario"
import { SelectorContacto } from "@/components/comunes/SelectorContacto"
import { useCatalogos } from "@/hooks/useCatalogos"
import { useConfiguracion } from "@/hooks/useConfiguracion"
import { useSimboloMoneda } from "@/hooks/useMoneda"
import { useUsuarioActual } from "@/hooks/useUsuarioActual"
import * as apiContactos from "@/lib/api/contactos"
import type { Contacto, Oportunidad, OportunidadInsert, OportunidadUpdate } from "@/lib/types"
import { parsearImporte } from "@/lib/utils/moneda"
import { tituloPorDefecto } from "./logica"
import { useActualizarOportunidad, useCrearOportunidad } from "./useOportunidades"

export interface FormularioOportunidadProps {
  abierto: boolean
  onCerrar: () => void
  /** Contacto fijo (desde la ficha del contacto). */
  contactoId?: string
  /** Si viene, edita en vez de crear. Puede traer el contacto ya cargado. */
  oportunidad?: Oportunidad & { contacto?: Contacto | null }
  onGuardado?: (oportunidad: Oportunidad) => void
}

/**
 * Crear o editar una oportunidad. Un solo obligatorio en la práctica: el contacto
 * (el título se autogenera "{contacto} – {título por defecto}", la etapa es la primera,
 * el importe el de configuración y el responsable soy yo).
 */
export function FormularioOportunidad({ abierto, onCerrar, contactoId, oportunidad, onGuardado }: FormularioOportunidadProps) {
  const { etapas, usuarios } = useCatalogos()
  const { configuracion } = useConfiguracion()
  const simbolo = useSimboloMoneda()
  const { uid, esAdmin } = useUsuarioActual()
  const crear = useCrearOportunidad()
  const actualizar = useActualizarOportunidad()
  const editando = !!oportunidad
  const guardando = crear.isPending || actualizar.isPending

  const idContactoFijo = contactoId ?? (editando ? oportunidad.contacto_id : undefined)
  const contactoFijo = useQuery({
    queryKey: ["contactos", idContactoFijo],
    queryFn: () => apiContactos.obtener(idContactoFijo as string),
    enabled: abierto && !!idContactoFijo && !oportunidad?.contacto,
    staleTime: 60_000,
  })

  const [contacto, setContacto] = useState<Contacto | null>(null)
  const [titulo, setTitulo] = useState("")
  const [tituloEditado, setTituloEditado] = useState(false)
  const [importeTexto, setImporteTexto] = useState("")
  const [etapaId, setEtapaId] = useState<string | null>(null)
  const [fechaPrevista, setFechaPrevista] = useState("")
  const [responsableId, setResponsableId] = useState<string | null>(null)

  // Valores iniciales cada vez que se abre.
  useEffect(() => {
    if (!abierto) return
    if (oportunidad) {
      setContacto(oportunidad.contacto ?? null)
      setTitulo(oportunidad.titulo)
      setTituloEditado(true)
      setImporteTexto(String(oportunidad.importe ?? 0))
      setEtapaId(oportunidad.etapa_id)
      setFechaPrevista(oportunidad.fecha_cierre_prevista ?? "")
      setResponsableId(oportunidad.responsable_id)
    } else {
      setContacto(null)
      setTitulo("")
      setTituloEditado(false)
      setImporteTexto(String(configuracion.importe_default ?? 0))
      setEtapaId(etapas[0]?.id ?? null)
      setFechaPrevista("")
      setResponsableId(uid)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, oportunidad?.id])

  // Contacto fijo cargado desde la base.
  useEffect(() => {
    if (contactoFijo.data && (!contacto || contacto.id !== contactoFijo.data.id)) setContacto(contactoFijo.data)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactoFijo.data])

  // Etapa por defecto cuando las etapas llegan después de abrir.
  useEffect(() => {
    if (abierto && !etapaId && etapas[0]) setEtapaId(etapas[0].id)
  }, [abierto, etapaId, etapas])

  // Título autogenerado mientras el usuario no lo haya tocado.
  const tituloAuto = useMemo(() => tituloPorDefecto(contacto?.nombre, configuracion.titulo_oportunidad_default), [contacto?.nombre, configuracion.titulo_oportunidad_default])
  useEffect(() => {
    if (!tituloEditado) setTitulo(contacto ? tituloAuto : "")
  }, [tituloAuto, tituloEditado, contacto])

  const contactoBloqueado = !!idContactoFijo

  const guardar = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!contacto) {
      toast.error("Elige el contacto de la oportunidad.")
      return
    }
    if (!etapaId) {
      toast.error("No hay etapas configuradas. Pide al administrador que las cree.")
      return
    }
    const importe = parsearImporte(importeTexto)
    if (importe < 0) {
      toast.error("El importe no puede ser negativo.")
      return
    }
    const tituloFinal = titulo.trim() || tituloPorDefecto(contacto.nombre, configuracion.titulo_oportunidad_default)
    try {
      if (editando) {
        const cambios: OportunidadUpdate = {
          titulo: tituloFinal,
          importe,
          etapa_id: etapaId,
          fecha_cierre_prevista: fechaPrevista || null,
        }
        if (esAdmin && responsableId && responsableId !== oportunidad.responsable_id) cambios.responsable_id = responsableId
        const guardada = await actualizar.mutateAsync({ id: oportunidad.id, cambios })
        toast.success("Guardado")
        onGuardado?.(guardada)
        if (!onGuardado) onCerrar()
      } else {
        const datos: OportunidadInsert = {
          contacto_id: contacto.id,
          titulo: tituloFinal,
          importe,
          etapa_id: etapaId,
          fecha_cierre_prevista: fechaPrevista || null,
        }
        if (esAdmin && responsableId) datos.responsable_id = responsableId
        const creada = await crear.mutateAsync(datos)
        toast.success("Oportunidad creada")
        onGuardado?.(creada)
        if (!onGuardado) onCerrar()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la oportunidad.")
    }
  }

  const botonGuardar = (
    <Button type="button" size="lg" className="min-h-11 flex-1 sm:flex-none" disabled={guardando || !contacto} onClick={() => void guardar()}>
      {guardando && <Loader2 className="animate-spin" />}
      Guardar
    </Button>
  )

  return (
    <PanelFormulario
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={editando ? "Editar oportunidad" : "Nueva oportunidad"}
      bloqueado={guardando}
      accionCabecera={<Button type="button" size="sm" className="min-h-9" disabled={guardando || !contacto} onClick={() => void guardar()}>Guardar</Button>}
      pie={
        <div className="flex w-full gap-2 sm:justify-end">
          <Button type="button" variant="outline" size="lg" className="min-h-11" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          {botonGuardar}
        </div>
      }
    >
      <form className="space-y-5" onSubmit={(e) => void guardar(e)} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="op-contacto" className="text-base">
            Contacto <span className="text-destructive">*</span>
          </Label>
          {contactoBloqueado && !contacto && contactoFijo.isPending ? (
            <div className="h-12 animate-pulse rounded-lg bg-muted" aria-label="Cargando contacto" />
          ) : (
            <SelectorContacto
              id="op-contacto"
              valor={contacto}
              onCambiar={setContacto}
              disabled={contactoBloqueado}
              autoAbrir={abierto && !contactoBloqueado && !editando && !contacto}
              placeholder="Buscar contacto…"
            />
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="op-titulo" className="text-base">
            Título
          </Label>
          <Input
            id="op-titulo"
            className="h-12 text-base"
            value={titulo}
            placeholder={contacto ? tituloAuto : "Se completa con el nombre del contacto"}
            enterKeyHint="next"
            onChange={(e) => {
              setTitulo(e.target.value)
              setTituloEditado(true)
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="op-importe" className="text-base">
            Importe
          </Label>
          <InputGroup className="h-12">
            <InputGroupAddon>
              <InputGroupText className="text-base font-semibold">{simbolo}</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              id="op-importe"
              inputMode="decimal"
              enterKeyHint="next"
              className="text-base"
              value={importeTexto}
              onChange={(e) => setImporteTexto(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              placeholder="0.00"
            />
          </InputGroup>
        </div>

        <div className="space-y-1.5">
          <Label className="text-base">Etapa</Label>
          {etapas.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay etapas configuradas.</p>
          ) : (
            <ChipsSeleccion
              etiqueta="Etapa"
              valor={etapaId}
              onCambiar={setEtapaId}
              opciones={etapas.map((e) => ({ valor: e.id, etiqueta: e.nombre, color: e.color }))}
            />
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="op-fecha" className="text-base">
            Fecha prevista de cierre (opcional)
          </Label>
          <Input id="op-fecha" type="date" className="h-12 text-base" value={fechaPrevista} onChange={(e) => setFechaPrevista(e.target.value)} />
        </div>

        {esAdmin && usuarios.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-base">Responsable</Label>
            <ChipsSeleccion
              etiqueta="Responsable"
              tamano="sm"
              valor={responsableId}
              onCambiar={(v) => setResponsableId(v ?? uid)}
              opciones={usuarios.map((u) => ({ valor: u.id, etiqueta: u.nombre }))}
            />
          </div>
        )}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </PanelFormulario>
  )
}

export default FormularioOportunidad
