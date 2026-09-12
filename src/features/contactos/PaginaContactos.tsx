import { useEffect, useMemo, useState } from "react"
import { Search, UserPlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BotonExportar } from "@/components/comunes/BotonExportar"
import { useCatalogos } from "@/hooks/useCatalogos"
import { useDebounce } from "@/hooks/useDebounce"
import { useEsMovil } from "@/hooks/useEsMovil"
import { useFiltrosURL } from "@/hooks/useFiltrosURL"
import { useUsuarioActual } from "@/hooks/useUsuarioActual"
import * as apiContactos from "@/lib/api/contactos"
import { FiltrosContactos } from "./FiltrosContactos"
import { FormularioContacto } from "./FormularioContacto"
import { ListaContactos } from "./ListaContactos"
import { COLUMNAS_EXPORTACION_CONTACTOS, FILTROS_URL_CONTACTOS, filaExportacionContacto, filtrosEfectivosContactos } from "./logica"
import { useContactos, useResumenSeguimiento } from "./useContactos"

/** Lista de contactos con buscador, filtros en la URL, carga de 50 en 50 y exportación con los mismos filtros. */
export function PaginaContactos() {
  const esMovil = useEsMovil()
  const { uid, esAdmin, cargando: cargandoUsuario } = useUsuarioActual()
  const { origenes } = useCatalogos()
  const { filtros, setFiltros, limpiar, hayFiltros } = useFiltrosURL(FILTROS_URL_CONTACTOS)
  const [texto, setTexto] = useState(filtros.texto)
  const textoRetrasado = useDebounce(texto.trim(), 300)
  const [formularioAbierto, setFormularioAbierto] = useState(false)

  // El texto escrito va a la URL con retraso; la lista y la exportación leen de la URL.
  useEffect(() => {
    if (textoRetrasado !== filtros.texto) setFiltros({ texto: textoRetrasado })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textoRetrasado])

  // Mismo objeto de filtros para la lista y para el CSV (criterio 7).
  const filtrosEfectivos = useMemo(() => filtrosEfectivosContactos(filtros, uid, esAdmin), [filtros, uid, esAdmin])
  const listo = !cargandoUsuario && !!uid
  const lista = useContactos(filtrosEfectivos, { enabled: listo })
  const resumen = useResumenSeguimiento(listo)

  const limpiarTodo = () => {
    setTexto("")
    limpiar()
  }

  const botonNuevo = (
    <Button type="button" className="min-h-11 gap-1.5 text-base" onClick={() => setFormularioAbierto(true)}>
      <UserPlus />
      Nuevo contacto
    </Button>
  )

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            aria-label="Buscar contactos"
            placeholder="Nombre, celular, empresa o documento"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="h-11 pl-9 text-base"
          />
          {texto && (
            <button
              type="button"
              aria-label="Borrar búsqueda"
              className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              onClick={() => setTexto("")}
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
        <BotonExportar
          nombreBase="contactos"
          filtros={{ ...filtrosEfectivos, orden: filtrosEfectivos.orden === "nombre" ? "" : filtrosEfectivos.orden }}
          columnas={COLUMNAS_EXPORTACION_CONTACTOS}
          obtenerFilas={async () => (await apiContactos.listarTodo(filtrosEfectivos)).map(filaExportacionContacto)}
          texto={esMovil ? "CSV" : "Exportar"}
          className="min-h-11"
        />
        {!esMovil && botonNuevo}
      </div>

      <FiltrosContactos filtros={filtros} setFiltros={setFiltros} esAdmin={esAdmin} origenes={origenes} />

      {hayFiltros && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Filtros aplicados. La exportación respeta estos filtros.</span>
          <button type="button" className="min-h-9 px-2 font-medium text-primary underline-offset-4 hover:underline" onClick={limpiarTodo}>
            Quitar filtros
          </button>
        </div>
      )}

      {esMovil && <div className="flex">{botonNuevo}</div>}

      <ListaContactos
        contactos={lista.contactos}
        total={lista.total}
        cargando={lista.cargando || cargandoUsuario}
        error={lista.error}
        hayMas={lista.hayMas}
        cargarMas={lista.cargarMas}
        cargandoMas={lista.cargandoMas}
        resumen={resumen}
        hayFiltros={hayFiltros}
        accionVacio={botonNuevo}
        onLimpiarFiltros={limpiarTodo}
        onReintentar={lista.refrescar}
      />

      <FormularioContacto abierto={formularioAbierto} onCerrar={() => setFormularioAbierto(false)} />
    </div>
  )
}

export default PaginaContactos
