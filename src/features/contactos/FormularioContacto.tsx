import { type FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ChipsSeleccion } from "@/components/comunes/ChipsSeleccion"
import { PanelFormulario } from "@/components/comunes/PanelFormulario"
import { registrarContactoReciente } from "@/components/comunes/SelectorContacto"
import { useCatalogos } from "@/hooks/useCatalogos"
import { useConfiguracion } from "@/hooks/useConfiguracion"
import { useDebounce } from "@/hooks/useDebounce"
import { useSimboloMoneda } from "@/hooks/useMoneda"
import { useUsuarioActual } from "@/hooks/useUsuarioActual"
import * as apiContactos from "@/lib/api/contactos"
import type { Contacto, ContactoInsert, ContactoUpdate, DocTipo } from "@/lib/types"
import { cn } from "@/lib/utils"
import { parsearImporte } from "@/lib/utils/moneda"
import { formatearTelefono, normalizarTelefonoPE } from "@/lib/utils/telefono"
import { guardarOrigenPorDefecto, leerOrigenPorDefecto, mismoTelefono, tituloOportunidadPorDefecto } from "./logica"
import { useActualizarContacto, useCrearContacto, useCrearOportunidadContacto } from "./useContactos"

export interface FormularioContactoProps {
  abierto: boolean
  onCerrar: () => void
  /** Si viene, el formulario edita en vez de crear. */
  contacto?: Contacto
  /** Se llama con el contacto creado o editado. Si no viene, al crear se navega a la ficha. */
  onGuardado?: (contacto: Contacto) => void
  /** Nombre inicial (desde "Crear «Juan»" del SelectorContacto). */
  nombreInicial?: string
}

const DOC_TIPOS: { valor: DocTipo; etiqueta: string }[] = [
  { valor: "DNI", etiqueta: "DNI" },
  { valor: "RUC", etiqueta: "RUC" },
  { valor: "CE", etiqueta: "CE" },
]

interface EstadoFormulario {
  nombre: string
  telefono: string
  origenId: string | null
  responsableId: string | null
  empresa: string
  docTipo: DocTipo | null
  docNumero: string
  email: string
  direccion: string
  notas: string
  masDatos: boolean
  crearOportunidad: boolean
  /** null = título autogenerado a partir del nombre. */
  tituloOportunidad: string | null
  /** null = importe por defecto de configuración. */
  importe: string | null
  /** null = primera etapa activa. */
  etapaId: string | null
}

function estadoInicial(contacto: Contacto | undefined, nombreInicial: string | undefined, uid: string | null): EstadoFormulario {
  if (contacto) {
    return {
      nombre: contacto.nombre,
      telefono: contacto.telefono_raw ?? contacto.telefono ?? "",
      origenId: contacto.origen_id,
      responsableId: contacto.responsable_id,
      empresa: contacto.empresa ?? "",
      docTipo: contacto.doc_tipo,
      docNumero: contacto.doc_numero ?? "",
      email: contacto.email ?? "",
      direccion: contacto.direccion ?? "",
      notas: contacto.notas ?? "",
      masDatos: !!(contacto.empresa || contacto.doc_numero || contacto.email || contacto.direccion || contacto.notas),
      crearOportunidad: false,
      tituloOportunidad: null,
      importe: null,
      etapaId: null,
    }
  }
  return {
    nombre: nombreInicial ?? "",
    telefono: "",
    origenId: leerOrigenPorDefecto(uid),
    responsableId: uid,
    empresa: "",
    docTipo: null,
    docNumero: "",
    email: "",
    direccion: "",
    notas: "",
    masDatos: false,
    crearOportunidad: true,
    tituloOportunidad: null,
    importe: null,
    etapaId: null,
  }
}

function aNulo(texto: string): string | null {
  const t = texto.trim()
  return t ? t : null
}

/**
 * Alta y edición de contacto. Un solo campo obligatorio (nombre), origen y responsable
 * por defecto, bloque "Oportunidad" activado al crear. Sheet en celular, diálogo en computadora.
 */
export function FormularioContacto({ abierto, onCerrar, contacto, onGuardado, nombreInicial }: FormularioContactoProps) {
  const navigate = useNavigate()
  const { uid, esAdmin, usuario } = useUsuarioActual()
  const { origenes, etapas, usuarios, origenPorId } = useCatalogos()
  const { configuracion } = useConfiguracion()
  const simbolo = useSimboloMoneda()
  const crear = useCrearContacto()
  const actualizar = useActualizarContacto()
  const crearOportunidad = useCrearOportunidadContacto()

  const [f, setF] = useState<EstadoFormulario>(() => estadoInicial(contacto, nombreInicial, uid))
  const [guardando, setGuardando] = useState(false)
  const refNombre = useRef<HTMLInputElement>(null)
  const editando = !!contacto
  const puedeEditar = !contacto || esAdmin || contacto.responsable_id === uid

  const cambiar = <K extends keyof EstadoFormulario>(clave: K, valor: EstadoFormulario[K]) => setF((prev) => ({ ...prev, [clave]: valor }))

  // Reinicia el formulario cada vez que se abre (o cambia el contacto a editar). Se depende del id,
  // no del objeto: un refresco por tiempo real mientras se edita no debe borrar lo escrito.
  const contactoRef = useRef(contacto)
  contactoRef.current = contacto
  const contactoId = contacto?.id
  useEffect(() => {
    if (!abierto) return
    setF(estadoInicial(contactoRef.current, nombreInicial, uid))
    const t = setTimeout(() => refNombre.current?.focus(), 250)
    return () => clearTimeout(t)
  }, [abierto, contactoId, nombreInicial, uid])

  // ---- Duplicados mientras se escribe (debounce) ----
  const nombreRetrasado = useDebounce(f.nombre.trim(), 400)
  const telefonoRetrasado = useDebounce(f.telefono.trim(), 400)
  const buscarDuplicados = abierto && (nombreRetrasado.length >= 3 || telefonoRetrasado.replace(/\D+/g, "").length >= 6)
  const duplicados = useQuery({
    queryKey: ["contactos", "duplicados", { nombre: nombreRetrasado, telefono: telefonoRetrasado, excluirId: contacto?.id ?? "" }],
    queryFn: () => apiContactos.posiblesDuplicados({ nombre: nombreRetrasado, telefono: telefonoRetrasado, excluirId: contacto?.id }, 5),
    enabled: buscarDuplicados,
    staleTime: 30_000,
  })
  const listaDuplicados = buscarDuplicados ? (duplicados.data ?? []) : []
  const telefonoNormalizado = normalizarTelefonoPE(f.telefono)
  const duplicadoPorCelular = useMemo(
    () => listaDuplicados.find((d) => mismoTelefono(telefonoNormalizado, d)) ?? null,
    [listaDuplicados, telefonoNormalizado],
  )

  // ---- Valores efectivos de la oportunidad ----
  const tituloAuto = tituloOportunidadPorDefecto(f.nombre, configuracion.titulo_oportunidad_default)
  const tituloEfectivo = f.tituloOportunidad ?? tituloAuto
  const importeEfectivo = f.importe ?? (configuracion.importe_default > 0 ? String(configuracion.importe_default) : "")
  const etapaEfectiva = f.etapaId ?? etapas[0]?.id ?? null
  const origenValido = f.origenId && origenPorId(f.origenId)?.activo ? f.origenId : null

  const abrirDuplicado = (id: string) => {
    onCerrar()
    navigate(`/contactos/${id}`)
  }

  const guardar = async () => {
    if (guardando) return
    const nombre = f.nombre.trim()
    if (!nombre) {
      toast.error("Escribe el nombre del contacto.")
      refNombre.current?.focus()
      return
    }
    setGuardando(true)
    try {
      const comunes: ContactoUpdate = {
        nombre,
        telefono: aNulo(f.telefono),
        empresa: aNulo(f.empresa),
        doc_tipo: aNulo(f.docNumero) ? f.docTipo : null,
        doc_numero: aNulo(f.docNumero),
        email: aNulo(f.email)?.toLowerCase() ?? null,
        direccion: aNulo(f.direccion),
        notas: aNulo(f.notas),
        origen_id: origenValido,
      }
      // Solo el administrador puede fijar o cambiar el responsable (trigger proteger_reasignacion).
      const responsable = esAdmin && f.responsableId ? f.responsableId : undefined

      if (contacto) {
        const cambios: ContactoUpdate = { ...comunes }
        if (responsable && responsable !== contacto.responsable_id) cambios.responsable_id = responsable
        const guardado = await actualizar.mutateAsync({ id: contacto.id, cambios })
        guardarOrigenPorDefecto(uid, origenValido)
        toast.success("Guardado")
        onCerrar()
        onGuardado?.(guardado)
        return
      }

      const datos: ContactoInsert = { ...comunes, nombre }
      if (responsable) datos.responsable_id = responsable
      const creado = await crear.mutateAsync(datos)
      guardarOrigenPorDefecto(uid, origenValido)
      registrarContactoReciente(uid, creado)

      if (f.crearOportunidad && etapaEfectiva) {
        try {
          await crearOportunidad.mutateAsync({
            contacto_id: creado.id,
            titulo: tituloEfectivo.trim() || tituloAuto || nombre,
            importe: parsearImporte(importeEfectivo),
            etapa_id: etapaEfectiva,
            ...(responsable ? { responsable_id: responsable } : {}),
          })
        } catch (e) {
          toast.error(`Contacto creado, pero no se pudo crear la oportunidad: ${e instanceof Error ? e.message : String(e)}`)
        }
      }
      toast.success("Creado")
      onCerrar()
      if (onGuardado) onGuardado(creado)
      else navigate(`/contactos/${creado.id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el contacto.")
    } finally {
      setGuardando(false)
    }
  }

  const alEnviar = (e: FormEvent) => {
    e.preventDefault()
    void guardar()
  }

  if (!puedeEditar) return null

  const botonGuardar = (extra?: string) => (
    <Button type="button" onClick={() => void guardar()} disabled={guardando} className={cn("min-h-11 px-5 text-base", extra)}>
      {guardando && <Loader2 className="animate-spin" />}
      Guardar
    </Button>
  )

  return (
    <PanelFormulario
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={editando ? "Editar contacto" : "Nuevo contacto"}
      bloqueado={guardando}
      accionCabecera={botonGuardar("min-h-10")}
      pie={
        <div className="flex w-full gap-2">
          <Button type="button" variant="outline" className="min-h-12 flex-1 text-base" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          {botonGuardar("min-h-12 flex-1")}
        </div>
      }
    >
      <form onSubmit={alEnviar} noValidate className="space-y-5">
        {/* Nombre: único obligatorio */}
        <div className="space-y-1.5">
          <Label htmlFor="contacto-nombre">
            Nombre <span className="text-destructive">*</span>
          </Label>
          <Input
            id="contacto-nombre"
            ref={refNombre}
            value={f.nombre}
            onChange={(e) => cambiar("nombre", e.target.value)}
            autoFocus
            autoCapitalize="words"
            autoComplete="off"
            enterKeyHint="next"
            placeholder="Juan Pérez"
            className="h-12 text-base"
            required
            aria-required="true"
          />
          {listaDuplicados.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900" aria-label="Posibles duplicados">
              {listaDuplicados.slice(0, 3).map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <span className="font-medium">¿Es este?</span>
                  <span className="truncate">{d.nombre}</span>
                  {d.telefono && <span>· {formatearTelefono(d.telefono)}</span>}
                  <button
                    type="button"
                    className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-md px-2 font-medium text-primary underline-offset-4 hover:underline"
                    onClick={() => abrirDuplicado(d.id)}
                  >
                    <ExternalLink className="size-3.5" aria-hidden />
                    Abrir
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Celular */}
        <div className="space-y-1.5">
          <Label htmlFor="contacto-telefono">Celular</Label>
          <Input
            id="contacto-telefono"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="next"
            value={f.telefono}
            onChange={(e) => cambiar("telefono", e.target.value)}
            placeholder="987 654 321"
            className="h-12 text-base"
          />
          {duplicadoPorCelular && (
            <p role="alert" className="flex items-start gap-1.5 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Ya existe un contacto con este celular: <strong>{duplicadoPorCelular.nombre}</strong>.{" "}
                <button type="button" className="font-medium text-primary underline-offset-4 hover:underline" onClick={() => abrirDuplicado(duplicadoPorCelular.id)}>
                  Abrir
                </button>
              </span>
            </p>
          )}
          {f.telefono.trim() && !telefonoNormalizado && (
            <p className="text-xs text-muted-foreground">No parece un número peruano; se guardará tal cual.</p>
          )}
        </div>

        {/* Origen */}
        {origenes.length > 0 && (
          <div className="space-y-1.5">
            <Label>Origen</Label>
            <ChipsSeleccion
              etiqueta="Origen"
              valor={origenValido}
              onCambiar={(v) => cambiar("origenId", v)}
              permitirVacio
              opciones={origenes.map((o) => ({ valor: o.id, etiqueta: o.nombre }))}
            />
          </div>
        )}

        {/* Responsable: solo admin */}
        {esAdmin && usuarios.length > 0 && (
          <div className="space-y-1.5">
            <Label>Responsable</Label>
            <ChipsSeleccion
              etiqueta="Responsable"
              valor={f.responsableId ?? uid ?? ""}
              onCambiar={(v) => cambiar("responsableId", v)}
              opciones={usuarios.map((u) => ({ valor: u.id, etiqueta: u.id === uid ? `${u.nombre} (yo)` : u.nombre }))}
            />
          </div>
        )}
        {!esAdmin && !editando && usuario && <p className="text-sm text-muted-foreground">Responsable: {usuario.nombre} (yo)</p>}

        {/* Más datos */}
        <div className="rounded-xl border">
          <button
            type="button"
            className="flex min-h-12 w-full items-center justify-between px-3 text-base font-medium"
            aria-expanded={f.masDatos}
            onClick={() => cambiar("masDatos", !f.masDatos)}
          >
            Más datos
            {f.masDatos ? <ChevronUp className="size-5" aria-hidden /> : <ChevronDown className="size-5" aria-hidden />}
          </button>
          {f.masDatos && (
            <div className="space-y-4 border-t px-3 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="contacto-empresa">Empresa</Label>
                <Input
                  id="contacto-empresa"
                  value={f.empresa}
                  onChange={(e) => cambiar("empresa", e.target.value)}
                  autoCapitalize="words"
                  enterKeyHint="next"
                  className="h-12 text-base"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contacto-documento">Documento</Label>
                <ChipsSeleccion
                  etiqueta="Tipo de documento"
                  tamano="sm"
                  valor={f.docTipo}
                  onCambiar={(v) => cambiar("docTipo", v)}
                  permitirVacio
                  opciones={DOC_TIPOS}
                />
                <Input
                  id="contacto-documento"
                  inputMode="numeric"
                  enterKeyHint="next"
                  value={f.docNumero}
                  onChange={(e) => cambiar("docNumero", e.target.value)}
                  placeholder={f.docTipo === "RUC" ? "20123456789" : f.docTipo === "DNI" ? "12345678" : "Número"}
                  className="h-12 text-base"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contacto-email">Correo</Label>
                <Input
                  id="contacto-email"
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoComplete="email"
                  enterKeyHint="next"
                  value={f.email}
                  onChange={(e) => cambiar("email", e.target.value)}
                  className="h-12 text-base"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contacto-direccion">Dirección</Label>
                <Input
                  id="contacto-direccion"
                  value={f.direccion}
                  onChange={(e) => cambiar("direccion", e.target.value)}
                  autoCapitalize="sentences"
                  enterKeyHint="next"
                  className="h-12 text-base"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contacto-notas">Notas</Label>
                <Textarea id="contacto-notas" rows={3} value={f.notas} onChange={(e) => cambiar("notas", e.target.value)} className="text-base" />
              </div>
            </div>
          )}
        </div>

        {/* Oportunidad: solo al crear */}
        {!editando && (
          <div className="rounded-xl border">
            <div className="flex min-h-12 items-center justify-between gap-3 px-3">
              <Label htmlFor="contacto-crear-oportunidad" className="text-base font-medium">
                Crear oportunidad
              </Label>
              <Switch
                id="contacto-crear-oportunidad"
                checked={f.crearOportunidad}
                onCheckedChange={(checked) => cambiar("crearOportunidad", checked)}
                aria-label="Crear oportunidad"
              />
            </div>
            {f.crearOportunidad && (
              <div className="space-y-4 border-t px-3 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="oportunidad-titulo">Título</Label>
                  <Input
                    id="oportunidad-titulo"
                    value={tituloEfectivo}
                    onChange={(e) => cambiar("tituloOportunidad", e.target.value === "" ? null : e.target.value)}
                    enterKeyHint="next"
                    className="h-12 text-base"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="oportunidad-importe">Importe</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-base text-muted-foreground">{simbolo}</span>
                    <Input
                      id="oportunidad-importe"
                      inputMode="decimal"
                      enterKeyHint="done"
                      value={importeEfectivo}
                      onChange={(e) => cambiar("importe", e.target.value)}
                      placeholder="0.00"
                      className="h-12 pl-10 text-base tabular-nums"
                    />
                  </div>
                </div>
                {etapas.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Etapa</Label>
                    <ChipsSeleccion
                      etiqueta="Etapa"
                      tamano="sm"
                      valor={etapaEfectiva}
                      onCambiar={(v) => cambiar("etapaId", v)}
                      opciones={etapas.map((e) => ({ valor: e.id, etiqueta: e.nombre, color: e.color }))}
                    />
                  </div>
                )}
                {etapas.length === 0 && (
                  <p className="text-sm text-amber-800">No hay etapas activas: la oportunidad no se podrá crear hasta que el administrador configure una.</p>
                )}
              </div>
            )}
          </div>
        )}
        {/* Permite guardar con Enter desde cualquier campo. */}
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden>
          Guardar
        </button>
      </form>
    </PanelFormulario>
  )
}

export default FormularioContacto
