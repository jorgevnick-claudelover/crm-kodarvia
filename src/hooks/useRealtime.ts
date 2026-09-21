import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { suscribirse } from "@/lib/almacen"

/** Tablas que la app vigila para refrescar sus consultas (docs/ARQUITECTURA.md sección 7). */
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
const CLAVES_DERIVADAS: Record<string, string[]> = {
  contactos: ["buscar"],
  oportunidades: ["buscar", "historial_etapas"],
  tareas: ["buscar", "recordatorios"],
  actividades: ["buscar"],
  historial_etapas: ["historial_etapas"],
}

export type EstadoCanal = "inactivo" | "conectando" | "conectado" | "error" | "cerrado"

/**
 * Estado compartido, legible fuera de React: el QueryClient usa `realtime.conectado`
 * para activar el refetch de respaldo cuando no hay canal. Con el almacén local
 * siempre estamos "conectados" mientras el hook está montado.
 */
export const realtime: { conectado: boolean; estado: EstadoCanal } = { conectado: false, estado: "inactivo" }

export interface EstadoRealtime {
  estado: EstadoCanal
  conectado: boolean
}

/**
 * Propaga los cambios del almacén local a TanStack Query. Cada aviso trae las
 * tablas tocadas y se invalidan sus consultas (queryKey[0] = tabla). Cubre esta
 * pestaña y las demás ventanas del mismo navegador (criterio 2). Se monta una
 * sola vez en AppShell.
 */
export function useRealtime(activo = true): EstadoRealtime {
  const queryClient = useQueryClient()
  const [estado, setEstado] = useState<EstadoCanal>("inactivo")

  useEffect(() => {
    if (!activo) return
    const pendientes = new Set<string>()
    let temporizador: ReturnType<typeof setTimeout> | null = null

    // Agrupa invalidaciones en 150 ms para no disparar cientos de refetch durante una importación.
    const programar = (tablas: string[]) => {
      for (const tabla of tablas) {
        pendientes.add(tabla)
        for (const clave of CLAVES_DERIVADAS[tabla] ?? []) pendientes.add(clave)
      }
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

    const cancelar = suscribirse(programar)
    cambiarEstado("conectado")

    return () => {
      if (temporizador) clearTimeout(temporizador)
      cancelar()
      cambiarEstado("inactivo")
    }
  }, [activo, queryClient])

  return { estado, conectado: estado === "conectado" }
}
