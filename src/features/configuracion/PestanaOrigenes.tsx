/** Orígenes del contacto: añadir, renombrar, reordenar y activar o desactivar. */
import { useMemo } from "react"
import { useCatalogos } from "@/hooks/useCatalogos"
import { EditorCatalogo, type TextosCatalogo } from "./EditorCatalogo"
import { catalogoAElemento } from "./useConfiguracionPagina"

const TEXTOS: TextosCatalogo = {
  singular: "origen",
  plural: "Orígenes",
  ayuda:
    "De dónde llega el contacto. Aparecen como chips al crear un contacto, en el orden de esta lista; pon primero los más usados. Los desactivados dejan de ofrecerse, pero se siguen viendo en los contactos que ya los tienen.",
  placeholder: "Por ejemplo: Referido",
  creado: "Origen añadido.",
  femenino: false,
}

export function PestanaOrigenes() {
  const { origenesTodos, cargando } = useCatalogos()
  const elementos = useMemo(() => origenesTodos.map(catalogoAElemento), [origenesTodos])

  return <EditorCatalogo tipo="origenes" elementos={elementos} cargando={cargando} textos={TEXTOS} />
}

export default PestanaOrigenes
