/**
 * Etapas del tablero: añadir, renombrar, reordenar con flechas, color y activar o desactivar.
 * No se puede desactivar una etapa que aún tiene oportunidades abiertas dentro.
 */
import { useMemo } from "react"
import { ChipsSeleccion, type OpcionChip } from "@/components/comunes/ChipsSeleccion"
import { useCatalogos } from "@/hooks/useCatalogos"
import { COLORES_ETAPA } from "@/lib/api/catalogos"
import { EditorCatalogo, type TextosCatalogo } from "./EditorCatalogo"
import { mensajeEtapaConAbiertas, type ElementoCatalogo } from "./logica"
import { etapaAElemento, useAbiertasPorEtapa, useComprobarEtapaDesactivable, useMutacionesCatalogo } from "./useConfiguracionPagina"

const NOMBRE_COLOR: Record<string, string> = {
  slate: "Pizarra",
  sky: "Cielo",
  teal: "Turquesa",
  emerald: "Esmeralda",
  amber: "Ámbar",
  orange: "Naranja",
  rose: "Rosa",
  violet: "Violeta",
}

const OPCIONES_COLOR: OpcionChip<string>[] = COLORES_ETAPA.map((c) => ({
  valor: c,
  etiqueta: NOMBRE_COLOR[c] ?? c,
  color: c,
}))

const TEXTOS: TextosCatalogo = {
  singular: "etapa",
  plural: "Etapas",
  ayuda:
    "Son las columnas del tablero (solo etapas abiertas: Ganada y Perdida no son etapas). El orden de aquí es el del tablero y el del embudo del panel.",
  placeholder: "Por ejemplo: Propuesta enviada",
  creado: "Etapa añadida.",
  femenino: true,
}

export function PestanaEtapas() {
  const { etapasTodas, cargando } = useCatalogos()
  const { guardar } = useMutacionesCatalogo("etapas")
  const comprobar = useComprobarEtapaDesactivable()

  const elementos = useMemo(() => etapasTodas.map(etapaAElemento), [etapasTodas])
  const ids = useMemo(() => elementos.map((e) => e.id), [elementos])
  const { conteo } = useAbiertasPorEtapa(ids)

  const colores = (elemento: ElementoCatalogo) => (
    <div className="space-y-1.5">
      <p className="text-sm text-muted-foreground">Color</p>
      <ChipsSeleccion<string>
        tamano="sm"
        etiqueta={`Color de ${elemento.nombre}`}
        valor={elemento.color ?? "slate"}
        opciones={OPCIONES_COLOR}
        onCambiar={(color) => {
          if (color) void guardar(elemento.id, { color })
        }}
      />
    </div>
  )

  return (
    <EditorCatalogo
      tipo="etapas"
      elementos={elementos}
      cargando={cargando}
      textos={TEXTOS}
      extras={colores}
      motivoNoDesactivar={(elemento) => {
        const n = conteo[elemento.id] ?? 0
        return n > 0 ? mensajeEtapaConAbiertas(n) : null
      }}
      comprobarDesactivar={async (elemento) => {
        const n = await comprobar(elemento.id)
        return n > 0 ? mensajeEtapaConAbiertas(n) : null
      }}
    />
  )
}

export default PestanaEtapas
