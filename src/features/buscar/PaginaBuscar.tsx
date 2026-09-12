import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Briefcase, CheckSquare, Clock, MessageSquare, Search, User, UserPlus, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Cargando } from "@/components/comunes/Cargando"
import { Vacio } from "@/components/comunes/Vacio"
import { FormularioContacto } from "@/features/contactos/FormularioContacto"
import { useDebounce } from "@/hooks/useDebounce"
import { useEsMovil } from "@/hooks/useEsMovil"
import * as apiBuscar from "@/lib/api/buscar"
import type { Contacto, ResultadoBusqueda } from "@/lib/types"
import { cn } from "@/lib/utils"
import { etiquetaRelativaConHora } from "@/lib/utils/fechas"
import { truncar } from "@/lib/utils/texto"
import {
  agruparResultados,
  borrarRecientes,
  guardarReciente,
  leerRecientes,
  MINIMO_LETRAS,
  rutaResultado,
  type TipoResultado,
} from "./busqueda"

const ICONO: Record<TipoResultado, typeof User> = {
  contacto: User,
  oportunidad: Briefcase,
  tarea: CheckSquare,
  actividad: MessageSquare,
}

/** Búsqueda global: contactos, oportunidades, tareas y actividades desde la función SQL buscar(q). */
export function PaginaBuscar() {
  const esMovil = useEsMovil()
  const navigate = useNavigate()
  const [texto, setTexto] = useState("")
  const [recientes, setRecientes] = useState<string[]>(() => leerRecientes())
  const [crear, setCrear] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const q = useDebounce(texto.trim(), 250)
  const activa = q.length >= MINIMO_LETRAS

  const consulta = useQuery({
    queryKey: ["buscar", q],
    queryFn: () => apiBuscar.buscar(q),
    enabled: activa,
    staleTime: 30_000,
    placeholderData: (previa) => previa,
  })

  useEffect(() => {
    if (consulta.error) toast.error(consulta.error.message || "No se pudo buscar")
  }, [consulta.error])

  useEffect(() => {
    // Foco automático (también en móvil, donde el input está en la capa a pantalla completa).
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [])

  const grupos = useMemo(() => agruparResultados(consulta.data ?? []), [consulta.data])
  const escribiendo = texto.trim().length > 0
  const esperando = activa && (consulta.isPending || q !== texto.trim())

  const recordar = (termino: string) => setRecientes(guardarReciente(termino))

  const irA = (r: ResultadoBusqueda) => {
    recordar(q)
    navigate(rutaResultado(r))
  }

  /** Enter (o la tecla "buscar" del teclado del celular): guarda el término y oculta el teclado para ver los resultados. */
  const alEnter = () => {
    if (!activa) return
    recordar(q)
    if (esMovil) inputRef.current?.blur()
  }

  const cerrar = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate("/")
  }

  const alCrearContacto = (contacto: Contacto) => {
    setCrear(false)
    navigate(`/contactos/${contacto.id}`)
  }

  const campo = (
    <div className="relative flex-1">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        ref={inputRef}
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Nombre, celular, empresa, RUC, tarea…"
        aria-label="Buscar"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") alEnter()
          if (e.key === "Escape" && esMovil) cerrar()
        }}
        className="h-12 pl-10 pr-10 text-base md:text-base"
      />
      {escribiendo && (
        <button
          type="button"
          aria-label="Borrar texto"
          onClick={() => {
            setTexto("")
            inputRef.current?.focus()
          }}
          className="absolute top-1/2 right-1 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  )

  let cuerpo: ReactNode
  if (!escribiendo) {
    cuerpo = (
      <Recientes
        recientes={recientes}
        onElegir={(t) => setTexto(t)}
        onBorrar={() => {
          borrarRecientes()
          setRecientes([])
        }}
      />
    )
  } else if (!activa) {
    cuerpo = <p className="px-4 py-6 text-center text-sm text-muted-foreground">Escribe al menos {MINIMO_LETRAS} letras.</p>
  } else if (esperando && !consulta.data) {
    cuerpo = <Cargando filas={5} className="px-4 py-4" />
  } else if (grupos.length === 0) {
    cuerpo = (
      <Vacio
        icono={Search}
        titulo={`Nada con «${q}»`}
        descripcion="Prueba con otro nombre, celular o empresa. O crea el contacto ahora mismo."
        accion={
          <Button size="lg" className="h-11 px-4 text-base" onClick={() => setCrear(true)}>
            <UserPlus data-icon="inline-start" className="size-4" />
            Crear contacto «{truncar(q, 24)}»
          </Button>
        }
      />
    )
  } else {
    cuerpo = (
      <div className={cn("space-y-5 px-2 pb-6", esperando && "opacity-60 transition-opacity")} aria-busy={esperando}>
        {grupos.map((g) => (
          <section key={g.tipo} aria-label={g.etiqueta}>
            <h2 className="px-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {g.etiqueta} <span className="font-normal">({g.resultados.length})</span>
            </h2>
            <ul className="divide-y rounded-lg border bg-card">
              {g.resultados.map((r) => (
                <li key={`${r.tipo}-${r.id}`}>
                  <FilaResultado resultado={r} onClick={() => irA(r)} />
                </li>
              ))}
            </ul>
          </section>
        ))}
        {consulta.data && consulta.data.length >= 50 && (
          <p className="px-2 text-center text-xs text-muted-foreground">Se muestran los 50 más recientes. Afina la búsqueda para ver otros.</p>
        )}
      </div>
    )
  }

  const formulario = (
    <FormularioContacto abierto={crear} onCerrar={() => setCrear(false)} nombreInicial={q} onGuardado={alCrearContacto} />
  )

  if (esMovil) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-background" role="dialog" aria-label="Buscar">
        <div className="flex items-center gap-2 border-b px-3 py-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))]">
          {campo}
          <Button variant="ghost" size="icon-lg" className="size-11 shrink-0" aria-label="Cerrar búsqueda" onClick={cerrar}>
            <X className="size-5" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pt-3 pb-[env(safe-area-inset-bottom,0px)]">{cuerpo}</div>
        {formulario}
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-4">
      <div className="mb-4 flex items-center gap-2">{campo}</div>
      {cuerpo}
      {formulario}
    </div>
  )
}

function FilaResultado({ resultado, onClick }: { resultado: ResultadoBusqueda; onClick: () => void }) {
  const Icono = ICONO[resultado.tipo]
  const subtitulo = resultado.subtitulo
  const titulo = resultado.tipo === "actividad" ? truncar(resultado.titulo, 90) : resultado.titulo
  return (
    <Link
      to={rutaResultado(resultado)}
      onClick={(e) => {
        e.preventDefault()
        onClick()
      }}
      className="flex min-h-14 items-center gap-3 px-3 py-2 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icono className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-medium">{titulo || "(Sin título)"}</span>
        {subtitulo && <span className="block truncate text-sm text-muted-foreground">{subtitulo}</span>}
      </span>
      {resultado.fecha && (resultado.tipo === "tarea" || resultado.tipo === "actividad") && (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{etiquetaRelativaConHora(resultado.fecha)}</span>
      )}
    </Link>
  )
}

function Recientes({ recientes, onElegir, onBorrar }: { recientes: string[]; onElegir: (t: string) => void; onBorrar: () => void }) {
  if (recientes.length === 0) {
    return (
      <Vacio
        icono={Search}
        titulo="Busca en todo el CRM"
        descripcion="Contactos por nombre, celular, empresa o RUC; también oportunidades, tareas y notas."
      />
    )
  }
  return (
    <section className="px-2" aria-label="Búsquedas recientes">
      <div className="flex items-center justify-between px-2 pb-1">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Recientes</h2>
        <button type="button" onClick={onBorrar} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
          Borrar
        </button>
      </div>
      <ul className="divide-y rounded-lg border bg-card">
        {recientes.map((t) => (
          <li key={t}>
            <button
              type="button"
              onClick={() => onElegir(t)}
              className="flex min-h-12 w-full items-center gap-3 px-3 text-left text-base hover:bg-muted"
            >
              <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{t}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default PaginaBuscar
