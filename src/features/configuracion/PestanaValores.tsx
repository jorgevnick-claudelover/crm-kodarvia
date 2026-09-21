/**
 * Valores por defecto del estudio: nombre de la empresa, moneda, hora del recordatorio,
 * importe por defecto, título de oportunidad y URL de la app. Al guardar la moneda, el
 * símbolo cambia en toda la interfaz sin recargar.
 */
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Cargando } from "@/components/comunes/Cargando"
import { useConfiguracion } from "@/hooks/useConfiguracion"
import { ZONA } from "@/lib/utils/fechas"
import { MONEDAS, MONEDA_DEFAULT, etiquetaMoneda, simboloDe } from "@/lib/utils/moneda"
import { importeDesdeTexto, validarValores, type ValoresFormulario } from "./logica"
import { mensajeError } from "./useConfiguracionPagina"

/** Lo que muestra el desplegable: { PEN: 'PEN — soles (S/)', … }. */
const ETIQUETAS_MONEDA: Record<string, string> = Object.fromEntries(MONEDAS.map((m) => [m.codigo, etiquetaMoneda(m.codigo)]))

const VACIO: ValoresFormulario = {
  nombre_empresa: "",
  moneda: MONEDA_DEFAULT,
  hora_recordatorio: "09:00",
  importe_default: "0",
  titulo_oportunidad_default: "",
  url_app: "",
}

export function PestanaValores() {
  const { configuracion, cargando, guardar, guardando } = useConfiguracion()
  const [valores, setValores] = useState<ValoresFormulario>(VACIO)
  const cargado = useRef(false)

  // Carga los valores del servidor una vez; después manda lo que escribe el administrador.
  useEffect(() => {
    if (cargando || cargado.current) return
    cargado.current = true
    setValores({
      nombre_empresa: configuracion.nombre_empresa,
      moneda: configuracion.moneda,
      hora_recordatorio: configuracion.hora_recordatorio,
      importe_default: String(configuracion.importe_default ?? 0),
      titulo_oportunidad_default: configuracion.titulo_oportunidad_default,
      url_app: configuracion.url_app,
    })
  }, [cargando, configuracion])

  const cambiar = (campo: keyof ValoresFormulario, valor: string) => setValores((v) => ({ ...v, [campo]: valor }))

  const enviar = async () => {
    const error = validarValores(valores)
    if (error) {
      toast.error(error)
      return
    }
    try {
      await guardar({
        nombre_empresa: valores.nombre_empresa.trim(),
        moneda: valores.moneda,
        hora_recordatorio: valores.hora_recordatorio,
        importe_default: importeDesdeTexto(valores.importe_default),
        titulo_oportunidad_default: valores.titulo_oportunidad_default.trim(),
        url_app: valores.url_app.trim(),
      })
      toast.success("Configuración guardada.")
    } catch (e) {
      toast.error(mensajeError(e, "No se pudo guardar la configuración."))
    }
  }

  if (cargando && !cargado.current) return <Cargando filas={5} tipo="texto" />

  return (
    <form
      className="space-y-5"
      aria-label="Valores por defecto"
      onSubmit={(e) => {
        e.preventDefault()
        void enviar()
      }}
    >
      <p className="text-sm text-muted-foreground">
        Estos valores salen ya puestos en los formularios, para que crear un contacto o una oportunidad desde el celular tarde menos de un minuto.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="cfg-empresa" className="text-base">
          Nombre de la empresa
        </Label>
        <Input
          id="cfg-empresa"
          className="h-12 text-base"
          value={valores.nombre_empresa}
          enterKeyHint="next"
          placeholder="Estudio contable"
          onChange={(e) => cambiar("nombre_empresa", e.target.value)}
        />
        <p className="text-sm text-muted-foreground">Aparece en la app y en los correos de recordatorio.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cfg-moneda" className="text-base">
          Moneda
        </Label>
        <Select
          items={ETIQUETAS_MONEDA}
          value={valores.moneda}
          onValueChange={(valor: string | null) => {
            if (valor) cambiar("moneda", valor)
          }}
        >
          <SelectTrigger id="cfg-moneda" className="h-12 w-full max-w-80 text-base" aria-label="Moneda">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONEDAS.map((m) => (
              <SelectItem key={m.codigo} value={m.codigo}>
                {etiquetaMoneda(m.codigo)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">El símbolo acompaña a todos los importes de la app. Los valores guardados no se convierten.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cfg-hora" className="text-base">
          Hora del recordatorio
        </Label>
        <Input
          id="cfg-hora"
          type="time"
          className="h-12 w-40 text-base"
          value={valores.hora_recordatorio}
          onChange={(e) => cambiar("hora_recordatorio", e.target.value)}
        />
        <p className="text-sm text-muted-foreground">Hora del Perú ({ZONA}) que se propone al crear una tarea con recordatorio.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cfg-importe" className="text-base">
          Importe por defecto
        </Label>
        <InputGroup className="h-12 max-w-56">
          <InputGroupAddon>
            <InputGroupText className="text-base font-semibold">{simboloDe(valores.moneda)}</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            id="cfg-importe"
            inputMode="decimal"
            enterKeyHint="next"
            className="text-base"
            value={valores.importe_default}
            placeholder="0.00"
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => cambiar("importe_default", e.target.value)}
          />
        </InputGroup>
        <p className="text-sm text-muted-foreground">Sale escrito en las oportunidades nuevas. Déjalo en 0 si casi nunca se sabe al inicio.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cfg-titulo" className="text-base">
          Título de oportunidad por defecto
        </Label>
        <Input
          id="cfg-titulo"
          className="h-12 text-base"
          value={valores.titulo_oportunidad_default}
          enterKeyHint="next"
          placeholder="Facturación electrónica"
          onChange={(e) => cambiar("titulo_oportunidad_default", e.target.value)}
        />
        <p className="text-sm text-muted-foreground">El título se arma como «Nombre del contacto – {valores.titulo_oportunidad_default || "Facturación electrónica"}».</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cfg-url" className="text-base">
          URL de la app
        </Label>
        <Input
          id="cfg-url"
          type="url"
          inputMode="url"
          className="h-12 text-base"
          value={valores.url_app}
          enterKeyHint="done"
          placeholder="https://crm.miestudio.pe"
          onChange={(e) => cambiar("url_app", e.target.value)}
        />
        <p className="text-sm text-muted-foreground">La dirección pública del CRM, para compartirla con el equipo. Ya no se envían correos: los recordatorios avisan dentro de la app.</p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="lg" className="min-h-12 w-full px-6 sm:w-auto" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  )
}

export default PestanaValores
