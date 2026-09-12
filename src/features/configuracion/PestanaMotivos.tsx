/** Motivos de pérdida: añadir, renombrar, reordenar y activar o desactivar. */
import { useMemo } from "react"
import { useCatalogos } from "@/hooks/useCatalogos"
import { EditorCatalogo, type TextosCatalogo } from "./EditorCatalogo"
import { catalogoAElemento } from "./useConfiguracionPagina"

const TEXTOS: TextosCatalogo = {
  singular: "motivo",
  plural: "Motivos de pérdida",
  ayuda:
    "Al perder una oportunidad hay que elegir uno de estos motivos (es obligatorio). Los motivos desactivados ya no se ofrecen, pero siguen viéndose en las oportunidades perdidas y en el panel.",
  placeholder: "Por ejemplo: Precio",
  creado: "Motivo añadido.",
  femenino: false,
}

export function PestanaMotivos() {
  const { motivosTodos, cargando } = useCatalogos()
  const elementos = useMemo(() => motivosTodos.map(catalogoAElemento), [motivosTodos])

  return <EditorCatalogo tipo="motivos_perdida" elementos={elementos} cargando={cargando} textos={TEXTOS} />
}

export default PestanaMotivos
