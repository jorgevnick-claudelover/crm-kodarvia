/**
 * Paso 2: a qué campo del CRM va cada columna de la hoja y qué hacemos con los
 * valores de origen, etapa y responsable que no existen en los catálogos.
 */
import { useMemo, type ReactNode } from "react"
import { AlertTriangle, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSimboloMoneda } from "@/hooks/useMoneda"
import { cn } from "@/lib/utils"
import {
  type CampoDestino,
  type Equivalencia,
  type TipoCatalogo,
  type ValorCatalogo,
  CAMPOS_DESTINO,
  etiquetaCampo,
  textoCelda,
} from "./mapeo"
import type { Importacion4Pasos } from "./useImportacion"

/**
 * Selector nativo: en el celular abre la rueda del sistema (objetivo táctil grande,
 * texto de 16 px para que iOS no haga zoom) y funciona igual en la computadora.
 */
function Selector({
  etiqueta,
  valor,
  onCambiar,
  children,
  className,
}: {
  etiqueta: string
  valor: string
  onCambiar: (valor: string) => void
  children: ReactNode
  className?: string
}) {
  return (
    <select
      aria-label={etiqueta}
      value={valor}
      onChange={(e) => onCambiar(e.target.value)}
      className={cn(
        "min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
    >
      {children}
    </select>
  )
}

const CLAVE_CREAR = "crear"
const CLAVE_ADMIN = "admin"
const CLAVE_GANADA = "estado:ganada"
const CLAVE_PERDIDA = "estado:perdida"

function aClave(eq: Equivalencia | undefined): string {
  if (!eq) return CLAVE_CREAR
  switch (eq.tipo) {
    case "existente":
      return `existente:${eq.id}`
    case "crear":
      return CLAVE_CREAR
    case "admin":
      return CLAVE_ADMIN
    case "estado":
      return eq.estado === "ganada" ? CLAVE_GANADA : CLAVE_PERDIDA
  }
}

function desdeClave(clave: string): Equivalencia {
  if (clave.startsWith("existente:")) return { tipo: "existente", id: clave.slice("existente:".length) }
  if (clave === CLAVE_GANADA) return { tipo: "estado", estado: "ganada" }
  if (clave === CLAVE_PERDIDA) return { tipo: "estado", estado: "perdida" }
  if (clave === CLAVE_ADMIN) return { tipo: "admin" }
  return { tipo: "crear" }
}

interface BloqueEquivalenciasProps {
  titulo: string
  ayuda: string
  tipo: TipoCatalogo
  valores: ValorCatalogo[]
  opciones: { id: string; nombre: string }[]
  estado: Importacion4Pasos
  /** Opciones extra al final del selector (crear, estados, administrador). */
  extras: { valor: string; etiqueta: (texto: string) => string }[]
}

function BloqueEquivalencias({ titulo, ayuda, tipo, valores, opciones, estado, extras }: BloqueEquivalenciasProps) {
  if (valores.length === 0) return null
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold">{titulo}</h3>
        <p className="text-sm text-muted-foreground">{ayuda}</p>
      </div>
      <ul className="space-y-3">
        {valores.map((v) => (
          <li key={v.clave} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2 pb-2">
              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900">«{v.texto}»</span>
              <span className="text-xs text-muted-foreground">
                {v.veces} {v.veces === 1 ? "fila" : "filas"}
              </span>
              <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
            </div>
            <Selector
              etiqueta={`Equivalencia de ${v.texto}`}
              valor={aClave(estado.equivalencias[tipo][v.clave])}
              onCambiar={(clave) => estado.cambiarEquivalencia(tipo, v.clave, desdeClave(clave))}
            >
              {opciones.map((o) => (
                <option key={o.id} value={`existente:${o.id}`}>
                  {o.nombre}
                </option>
              ))}
              {extras.map((e) => (
                <option key={e.valor} value={e.valor}>
                  {e.etiqueta(v.texto)}
                </option>
              ))}
            </Selector>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function PasoMapeo({ estado }: { estado: Importacion4Pasos }) {
  const hoja = estado.hoja
  // La etiqueta del importe lleva el símbolo de la moneda elegida.
  const simbolo = useSimboloMoneda()

  /** Primer valor no vacío de cada columna, como ejemplo debajo del selector. */
  const ejemplos = useMemo(() => {
    const salida = new Map<number, string>()
    if (!hoja) return salida
    for (const col of estado.columnas) {
      for (const fila of hoja.filas.slice(estado.indiceCabecera + 1, estado.indiceCabecera + 30)) {
        const texto = textoCelda(fila[col.indice])
        if (texto) {
          salida.set(col.indice, texto)
          break
        }
      }
    }
    return salida
  }, [hoja, estado.columnas, estado.indiceCabecera])

  const sinCatalogo = (valores: ValorCatalogo[]) => valores.filter((v) => !v.coincidencia)

  const origenesNuevos = sinCatalogo(estado.valores.origenes)
  const etapasNuevas = sinCatalogo(estado.valores.etapas)
  const responsablesNuevos = sinCatalogo(estado.valores.responsables)
  const hayEquivalencias = origenesNuevos.length + etapasNuevas.length + responsablesNuevos.length > 0

  const sinNombre = !Object.values(estado.mapeo).includes("nombre")

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold">Columnas de la hoja</h3>
          <p className="text-sm text-muted-foreground">
            Ya viene rellenado con lo que reconocimos. Cambia lo que no cuadre; lo que dejes en «Guardar como dato extra» se
            conserva igual dentro del contacto.
          </p>
        </div>

        {estado.repetidos.length > 0 && (
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Hay más de una columna con el mismo destino: {estado.repetidos.map((c) => etiquetaCampo(c, simbolo)).join(", ")}. Se usará la
              última.
            </span>
          </p>
        )}

        <ul className="grid gap-3 sm:grid-cols-2">
          {estado.columnas.map((col) => (
            <li key={col.indice} className="rounded-lg border p-3">
              <p className="truncate text-sm font-medium" title={col.nombre}>
                {col.nombre}
              </p>
              <p className="mb-2 truncate text-xs text-muted-foreground">
                {ejemplos.get(col.indice) ? `Ejemplo: ${ejemplos.get(col.indice)}` : "Sin datos en las primeras filas"}
              </p>
              <Selector
                etiqueta={`Campo destino de la columna ${col.nombre}`}
                valor={estado.mapeo[col.indice] ?? "extra"}
                onCambiar={(v) => estado.cambiarMapeo(col.indice, v as CampoDestino)}
              >
                {CAMPOS_DESTINO.map((campo) => (
                  <option key={campo} value={campo}>
                    {etiquetaCampo(campo, simbolo)}
                  </option>
                ))}
              </Selector>
            </li>
          ))}
        </ul>

        {sinNombre && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Ninguna columna va a «Nombre». Se puede importar igual: esas filas entrarán con un nombre provisional y marcadas para
            revisar, pero es mejor elegir la columna correcta.
          </p>
        )}
      </section>

      {hayEquivalencias && (
        <div className="space-y-5 rounded-xl border bg-muted/30 p-3 sm:p-4">
          <div>
            <h2 className="text-base font-semibold">Equivalencias</h2>
            <p className="text-sm text-muted-foreground">
              Estos valores de la hoja no existen en el CRM. Dinos a qué equivalen para no perder nada.
            </p>
          </div>

          <BloqueEquivalencias
            titulo="Orígenes"
            ayuda="Elige el origen del CRM que le corresponde o créalo tal cual."
            tipo="origenes"
            valores={origenesNuevos}
            opciones={estado.catalogos.origenes}
            estado={estado}
            extras={[{ valor: CLAVE_CREAR, etiqueta: (t) => `Crear el origen «${t}»` }]}
          />

          <BloqueEquivalencias
            titulo="Etapas"
            ayuda="Las etapas que signifiquen un cierre puedes marcarlas como Ganada o Perdida."
            tipo="etapas"
            valores={etapasNuevas}
            opciones={estado.catalogos.etapas}
            estado={estado}
            extras={[
              { valor: CLAVE_CREAR, etiqueta: (t) => `Crear la etapa «${t}»` },
              { valor: CLAVE_GANADA, etiqueta: () => "Marcar la oportunidad como Ganada" },
              { valor: CLAVE_PERDIDA, etiqueta: () => "Marcar la oportunidad como Perdida" },
            ]}
          />

          <BloqueEquivalencias
            titulo="Responsables"
            ayuda={`Los usuarios no se crean desde aquí. Si esa persona ya no trabaja en el estudio, sus filas se asignan a ${estado.nombreAdministrador} y quedan marcadas para revisar.`}
            tipo="responsables"
            valores={responsablesNuevos}
            opciones={estado.catalogos.usuarios}
            estado={estado}
            extras={[{ valor: CLAVE_ADMIN, etiqueta: () => `Asignar a ${estado.nombreAdministrador} y revisar` }]}
          />
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" size="lg" className="min-h-11 text-base" onClick={estado.atras}>
          Atrás
        </Button>
        <Button type="button" size="lg" className="min-h-11 text-base" onClick={estado.siguiente}>
          Ver la previsualización
        </Button>
      </div>
    </div>
  )
}

export default PasoMapeo
