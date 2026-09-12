/**
 * Lista editable compartida por Etapas, Motivos de pérdida y Orígenes: añadir, renombrar
 * en línea, subir y bajar con flechas (persiste el campo orden) y activar o desactivar.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { ArrowDown, ArrowUp, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Cargando } from "@/components/comunes/Cargando"
import { Vacio } from "@/components/comunes/Vacio"
import { cn } from "@/lib/utils"
import { moverEnLista, nombreRepetido, type ElementoCatalogo } from "./logica"
import { useMutacionesCatalogo, type TipoCatalogo } from "./useConfiguracionPagina"

export interface TextosCatalogo {
  /** "etapa", "motivo de pérdida", "origen". */
  singular: string
  /** "Etapas", "Motivos de pérdida", "Orígenes". */
  plural: string
  /** Texto de ayuda bajo el título. */
  ayuda: string
  /** Placeholder del campo de alta. */
  placeholder: string
  /** Confirmación tras crear ("Etapa añadida."). */
  creado: string
  /** true para "Activa" (etapa), false para "Activo" (motivo, origen). */
  femenino: boolean
}

export interface EditorCatalogoProps {
  tipo: TipoCatalogo
  elementos: ElementoCatalogo[]
  cargando: boolean
  textos: TextosCatalogo
  /** Contenido extra bajo cada fila (los colores de las etapas). */
  extras?: (elemento: ElementoCatalogo) => ReactNode
  /** Explicación fija de por qué no se puede desactivar (null si sí se puede). */
  motivoNoDesactivar?: (elemento: ElementoCatalogo) => string | null
  /** Comprobación en el momento de desactivar; devuelve el mensaje de error o null. */
  comprobarDesactivar?: (elemento: ElementoCatalogo) => Promise<string | null>
}

export function EditorCatalogo({
  tipo,
  elementos,
  cargando,
  textos,
  extras,
  motivoNoDesactivar,
  comprobarDesactivar,
}: EditorCatalogoProps) {
  const { crear, guardar, reordenar, guardando } = useMutacionesCatalogo(tipo)
  const [nuevo, setNuevo] = useState("")
  const [comprobandoId, setComprobandoId] = useState<string | null>(null)

  const ordenados = useMemo(() => [...elementos].sort((a, b) => a.orden - b.orden), [elementos])
  const etiquetaActivo = textos.femenino ? "Activa" : "Activo"

  const anadir = async () => {
    const nombre = nuevo.trim()
    if (!nombre) {
      toast.error("Escribe un nombre.")
      return
    }
    if (nombreRepetido(nombre, ordenados)) {
      toast.error(`Ya existe «${nombre}».`)
      return
    }
    if (await crear(nombre)) {
      setNuevo("")
      toast.success(textos.creado)
    }
  }

  const mover = async (indice: number, direccion: -1 | 1) => {
    const ids = moverEnLista(ordenados.map((e) => e.id), indice, direccion)
    await reordenar(ids)
  }

  const cambiarActivo = async (elemento: ElementoCatalogo, activo: boolean) => {
    if (!activo && comprobarDesactivar) {
      setComprobandoId(elemento.id)
      try {
        const error = await comprobarDesactivar(elemento)
        if (error) {
          toast.error(error)
          return
        }
      } catch {
        toast.error("No se pudo comprobar si se puede desactivar. Inténtalo de nuevo.")
        return
      } finally {
        setComprobandoId(null)
      }
    }
    await guardar(elemento.id, { activo })
  }

  return (
    <section className="space-y-4" aria-label={textos.plural}>
      <p className="text-sm text-muted-foreground">{textos.ayuda}</p>

      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor={`nuevo-${tipo}`} className="text-base">
            Añadir {textos.singular}
          </Label>
          <Input
            id={`nuevo-${tipo}`}
            className="h-12 text-base"
            value={nuevo}
            enterKeyHint="done"
            placeholder={textos.placeholder}
            onChange={(e) => setNuevo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void anadir()
              }
            }}
          />
        </div>
        <Button type="button" size="lg" className="min-h-12 px-4" disabled={guardando} onClick={() => void anadir()}>
          <Plus />
          Añadir
        </Button>
      </div>

      {cargando ? (
        <Cargando filas={4} />
      ) : ordenados.length === 0 ? (
        <Vacio titulo={`Todavía no hay ${textos.plural.toLowerCase()}`} descripcion="Usa el campo de arriba para añadir el primero." />
      ) : (
        <ul className="space-y-3">
          {ordenados.map((elemento, indice) => (
            <FilaCatalogo
              key={elemento.id}
              elemento={elemento}
              indice={indice}
              total={ordenados.length}
              etiquetaActivo={etiquetaActivo}
              ocupado={guardando || comprobandoId === elemento.id}
              avisoDesactivar={motivoNoDesactivar?.(elemento) ?? null}
              extras={extras?.(elemento)}
              onMover={(direccion) => void mover(indice, direccion)}
              onRenombrar={async (nombre) => {
                if (nombreRepetido(nombre, ordenados, elemento.id)) {
                  toast.error(`Ya existe «${nombre}».`)
                  return false
                }
                return guardar(elemento.id, { nombre })
              }}
              onActivo={(activo) => void cambiarActivo(elemento, activo)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

interface FilaCatalogoProps {
  elemento: ElementoCatalogo
  indice: number
  total: number
  etiquetaActivo: string
  ocupado: boolean
  avisoDesactivar: string | null
  extras?: ReactNode
  onMover: (direccion: -1 | 1) => void
  onRenombrar: (nombre: string) => Promise<boolean>
  onActivo: (activo: boolean) => void
}

function FilaCatalogo({
  elemento,
  indice,
  total,
  etiquetaActivo,
  ocupado,
  avisoDesactivar,
  extras,
  onMover,
  onRenombrar,
  onActivo,
}: FilaCatalogoProps) {
  const [nombre, setNombre] = useState(elemento.nombre)

  // Si el nombre cambia desde el servidor (otro usuario o tiempo real), refresca el campo.
  useEffect(() => {
    setNombre(elemento.nombre)
  }, [elemento.nombre])

  const confirmar = async () => {
    const limpio = nombre.trim()
    if (!limpio) {
      setNombre(elemento.nombre)
      return
    }
    if (limpio === elemento.nombre) return
    const bien = await onRenombrar(limpio)
    if (!bien) setNombre(elemento.nombre)
  }

  const bloqueado = !!avisoDesactivar && elemento.activo
  const idSwitch = `activo-${elemento.id}`

  return (
    <li className={cn("space-y-3 rounded-xl border bg-card p-3", !elemento.activo && "opacity-70")}>
      <div className="flex items-center gap-2">
        <span className="w-6 shrink-0 text-center text-sm text-muted-foreground tabular-nums" aria-hidden>
          {indice + 1}
        </span>
        <Input
          className="h-12 min-w-0 flex-1 text-base"
          aria-label={`Nombre de «${elemento.nombre}»`}
          value={nombre}
          enterKeyHint="done"
          onChange={(e) => setNombre(e.target.value)}
          onBlur={() => void confirmar()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              e.currentTarget.blur()
            }
            if (e.key === "Escape") setNombre(elemento.nombre)
          }}
        />
      </div>

      {extras}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            className="size-11"
            aria-label={`Subir «${elemento.nombre}»`}
            disabled={indice === 0 || ocupado}
            onClick={() => onMover(-1)}
          >
            <ArrowUp />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            className="size-11"
            aria-label={`Bajar «${elemento.nombre}»`}
            disabled={indice === total - 1 || ocupado}
            onClick={() => onMover(1)}
          >
            <ArrowDown />
          </Button>
        </div>

        <div className="flex min-h-11 items-center gap-2">
          <Switch
            id={idSwitch}
            checked={elemento.activo}
            disabled={ocupado || bloqueado}
            onCheckedChange={(valor: boolean) => onActivo(valor)}
          />
          <Label htmlFor={idSwitch} className="text-base">
            {etiquetaActivo}
          </Label>
        </div>
      </div>

      {bloqueado && <p className="text-sm text-amber-700 dark:text-amber-400">{avisoDesactivar}</p>}
    </li>
  )
}

export default EditorCatalogo
