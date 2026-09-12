import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Check, ChevronsUpDown, Plus, User, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { useDebounce } from "@/hooks/useDebounce"
import { useEsMovil } from "@/hooks/useEsMovil"
import { useUsuarioActual } from "@/hooks/useUsuarioActual"
import * as apiContactos from "@/lib/api/contactos"
import type { Contacto } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatearTelefono } from "@/lib/utils/telefono"

const MAX_RECIENTES = 5

export function claveRecientes(uid: string | null | undefined): string {
  return `crm.recientes.${uid ?? "anonimo"}`
}

/** Últimos contactos usados por el usuario (localStorage). */
export function leerContactosRecientes(uid: string | null | undefined): Contacto[] {
  try {
    const crudo = localStorage.getItem(claveRecientes(uid))
    if (!crudo) return []
    const lista: unknown = JSON.parse(crudo)
    return Array.isArray(lista) ? (lista as Contacto[]).filter((c) => c && typeof c.id === "string") : []
  } catch {
    return []
  }
}

/** Guarda un contacto como reciente (al seleccionarlo o crearlo). */
export function registrarContactoReciente(uid: string | null | undefined, contacto: Contacto): void {
  try {
    const actuales = leerContactosRecientes(uid).filter((c) => c.id !== contacto.id)
    localStorage.setItem(claveRecientes(uid), JSON.stringify([contacto, ...actuales].slice(0, MAX_RECIENTES)))
  } catch {
    // sin localStorage: no pasa nada
  }
}

export interface SelectorContactoProps {
  valor: Contacto | null
  onCambiar: (contacto: Contacto | null) => void
  /** Muestra "Crear «texto»" al final de los resultados. */
  permitirCrear?: boolean
  /** Se llama con el texto escrito al elegir "Crear". */
  onCrear?: (nombre: string) => void
  placeholder?: string
  /** Abre el buscador nada más montar (primer campo del formulario). */
  autoAbrir?: boolean
  disabled?: boolean
  className?: string
  id?: string
}

/**
 * Buscador de contacto: 5 recientes antes de escribir, autocompleta por nombre,
 * teléfono, empresa o documento a partir de 2 letras (debounce 250 ms).
 * Popover en computadora, drawer en celular.
 */
export function SelectorContacto({
  valor,
  onCambiar,
  permitirCrear = false,
  onCrear,
  placeholder = "Buscar contacto…",
  autoAbrir = false,
  disabled = false,
  className,
  id,
}: SelectorContactoProps) {
  const esMovil = useEsMovil()
  const { uid } = useUsuarioActual()
  const [abierto, setAbierto] = useState(autoAbrir)
  const [texto, setTexto] = useState("")
  const q = useDebounce(texto.trim(), 250)
  const buscando = q.length >= 2

  const recientes = useMemo(() => (abierto ? leerContactosRecientes(uid) : []), [abierto, uid])

  const resultados = useQuery({
    queryKey: ["contactos", "rapido", q],
    queryFn: () => apiContactos.buscarRapido(q, 8),
    enabled: abierto && buscando,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!abierto) setTexto("")
  }, [abierto])

  const elegir = (c: Contacto) => {
    registrarContactoReciente(uid, c)
    onCambiar(c)
    setAbierto(false)
  }

  const crear = () => {
    const nombre = texto.trim()
    if (!nombre) return
    setAbierto(false)
    onCrear?.(nombre)
  }

  const lista = buscando ? (resultados.data ?? []) : recientes
  const textoCrear = texto.trim()

  const contenido = (
    <Command shouldFilter={false} className="rounded-none bg-transparent">
      <CommandInput
        value={texto}
        onValueChange={setTexto}
        placeholder="Nombre, teléfono, empresa o documento"
        autoFocus
        enterKeyHint="search"
      />
      <CommandList className="max-h-[50dvh]">
        {buscando && resultados.isPending && <div className="p-3 text-sm text-muted-foreground">Buscando…</div>}
        {buscando && resultados.isError && <div className="p-3 text-sm text-destructive">No se pudo buscar. Revisa tu conexión.</div>}
        {!buscando && texto.trim().length === 1 && <div className="p-3 text-sm text-muted-foreground">Escribe al menos 2 letras.</div>}
        {lista.length === 0 && !resultados.isPending && (buscando || recientes.length === 0) && (
          <CommandEmpty>{buscando ? "Sin resultados." : "Escribe para buscar un contacto."}</CommandEmpty>
        )}
        {lista.length > 0 && (
          <CommandGroup heading={buscando ? "Resultados" : "Recientes"}>
            {lista.map((c) => (
              <CommandItem key={c.id} value={c.id} onSelect={() => elegir(c)} className="min-h-11 gap-3">
                <User className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{c.nombre}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[c.empresa, formatearTelefono(c.telefono)].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {valor?.id === c.id && <Check className="size-4 shrink-0" aria-hidden />}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {permitirCrear && textoCrear.length > 0 && (
          <CommandGroup>
            <CommandItem value={`__crear__${textoCrear}`} onSelect={crear} className="min-h-11 gap-3 font-medium text-primary">
              <Plus className="size-4 shrink-0" aria-hidden />
              Crear «{textoCrear}»
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  )

  const disparador = (
    <Button
      id={id}
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={abierto}
      disabled={disabled}
      className={cn("h-12 w-full justify-between px-3 text-base font-normal", !valor && "text-muted-foreground", className)}
      onClick={() => setAbierto(true)}
    >
      <span className="flex min-w-0 items-center gap-2">
        <User className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate">{valor ? valor.nombre : placeholder}</span>
      </span>
      {valor ? (
        <span
          role="button"
          tabIndex={0}
          aria-label="Quitar contacto"
          className="flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-muted"
          onClick={(e) => {
            e.stopPropagation()
            onCambiar(null)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              e.stopPropagation()
              onCambiar(null)
            }
          }}
        >
          <X className="size-4" aria-hidden />
        </span>
      ) : (
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
      )}
    </Button>
  )

  if (esMovil) {
    return (
      <>
        {disparador}
        <Drawer open={abierto} onOpenChange={setAbierto} showSwipeHandle>
          <DrawerContent className="h-[85dvh]">
            <DrawerHeader className="text-left">
              <DrawerTitle>Contacto</DrawerTitle>
              <DrawerDescription className="sr-only">Busca o crea un contacto</DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-hidden">{contenido}</div>
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger render={disparador} />
      <PopoverContent className="w-(--anchor-width) min-w-80 p-0" align="start">
        {contenido}
      </PopoverContent>
    </Popover>
  )
}
