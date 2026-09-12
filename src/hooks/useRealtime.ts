import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { supabase, supabaseConfigurado } from "@/lib/supabase"

/** Tablas con publicación realtime (docs/ARQUITECTURA.md sección 7). */
export const TABLAS_REALTIME = [
  "contactos",
  "oportunidades",
  "tareas",
  "actividades",
  "etapas",
  "motivos_perdida",
  "origenes",
  "usuarios",
  "configuracion",
] as const
export type TablaRealtime = (typeof TABLAS_REALTIME)[number]

/** Claves adicionales que hay que invalidar cuando cambia una tabla. */
const CLAVES_DERIVADAS: Partial<Record<TablaRealtime, string[]>> = {
  contactos: ["buscar"],
  oportunidades: ["buscar", "historial_etapas"],
  tareas: ["buscar", "recordatorios"],
  actividades: ["buscar"],
}

export type EstadoCanal = "inactivo" | "conectando" | "conectado" | "error" | "cerrado"

/**
 * Estado compartido del canal, legible fuera de React: el QueryClient usa
 * `realtime.conectado` para activar refetchInterval de respaldo cuando no hay canal.
 */
export const realtime: { conectado: boolean; estado: EstadoCanal } = { conectado: false, estado: "inactivo" }

export interface EstadoRealtime {
  estado: EstadoCanal
  conectado: boolean
}

/**
 * Un canal postgres_changes sobre las tablas indicadas. Cada evento invalida las
 * consultas de esa tabla (queryKey[0] = tabla). Se monta una sola vez en AppShell.
 */
export function useRealtime(activo = true): EstadoRealtime {
  const queryClient = useQueryClient()
  const [estado, setEstado] = useState<EstadoCanal>("inactivo")

  useEffect(() => {
    if (!activo || !supabaseConfigurado) return
    const pendientes = new Set<string>()
    let temporizador: ReturnType<typeof setTimeout> | null = null

    // Agrupa invalidaciones en 150 ms para no disparar cientos de refetch durante una importación.
    const programar = (tabla: TablaRealtime) => {
      pendientes.add(tabla)
      for (const clave of CLAVES_DERIVADAS[tabla] ?? []) pendientes.add(clave)
      if (temporizador) return
      temporizador = setTimeout(() => {
        temporizador = null
        for (const clave of pendientes) void queryClient.invalidateQueries({ queryKey: [clave] })
        pendientes.clear()
      }, 150)
    }

    const cambiarEstado = (nuevo: EstadoCanal) => {
      realtime.estado = nuevo
      realtime.conectado = nuevo === "conectado"
      setEstado(nuevo)
    }

    cambiarEstado("conectando")
    let canal: RealtimeChannel = supabase.channel("crm-cambios")
    for (const tabla of TABLAS_REALTIME) {
      canal = canal.on("postgres_changes", { event: "*", schema: "public", table: tabla }, () => programar(tabla))
    }
    canal.subscribe((status) => {
      if (status === "SUBSCRIBED") cambiarEstado("conectado")
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") cambiarEstado("error")
      else if (status === "CLOSED") cambiarEstado("cerrado")
    })

    return () => {
      if (temporizador) clearTimeout(temporizador)
      void supabase.removeChannel(canal)
      cambiarEstado("inactivo")
    }
  }, [activo, queryClient])

  return { estado, conectado: estado === "conectado" }
}
