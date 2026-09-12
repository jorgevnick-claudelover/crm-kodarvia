/**
 * Aviso a la hora fijada: muestra un toast persistente la primera vez que aparece cada recordatorio
 * vencido mientras la app está abierta, y programa con setTimeout los que vencen en breve para
 * que salten a la hora exacta aunque el refetch de 30 s no haya ocurrido todavía.
 * Se monta en PaginaHoy; el layout puede montarlo en el futuro (no pinta nada).
 */
import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { formatearHora } from "@/lib/utils/fechas"
import type { Tarea } from "@/lib/types"
import { proximosAvisos } from "./logica"
import { FILTROS_MIAS_PENDIENTES, useMutacionesTareas, useTareas } from "./useTareas"
import { INTERVALO_RECORDATORIOS_MS, useRecordatorios } from "./useRecordatorios"

/** Ids ya avisados mientras la app está abierta (sobrevive a montar/desmontar el componente). */
const avisados = new Set<string>()

export function idToastRecordatorio(tareaId: string): string {
  return `recordatorio-${tareaId}`
}

export function AvisoRecordatorios() {
  const navigate = useNavigate()
  const { recordatorios, cargando, refrescar } = useRecordatorios()
  const pendientes = useTareas(FILTROS_MIAS_PENDIENTES)
  const { marcarVisto } = useMutacionesTareas()
  const marcarVistoRef = useRef(marcarVisto.mutate)
  marcarVistoRef.current = marcarVisto.mutate

  const mostrar = (tarea: Pick<Tarea, "id" | "titulo" | "recordatorio_at" | "vence_at">) => {
    if (avisados.has(tarea.id)) return
    avisados.add(tarea.id)
    const id = idToastRecordatorio(tarea.id)
    toast(tarea.titulo, {
      id,
      duration: Infinity,
      description: `Recordatorio · ${formatearHora(tarea.recordatorio_at ?? tarea.vence_at)}`,
      action: {
        label: "Ver",
        onClick: () => {
          toast.dismiss(id)
          navigate(`/tareas/${tarea.id}`)
        },
      },
      cancel: {
        label: "Visto",
        onClick: () => {
          toast.dismiss(id)
          marcarVistoRef.current(tarea.id)
        },
      },
    })
  }
  const mostrarRef = useRef(mostrar)
  mostrarRef.current = mostrar

  // Recordatorios ya vencidos que llegan de la consulta (cada 30 s o por realtime).
  useEffect(() => {
    for (const r of recordatorios) mostrarRef.current(r)
  }, [recordatorios])

  // Los que ya se marcaron vistos o hechos no deben volver a avisar aunque reaparezcan.
  useEffect(() => {
    if (cargando) return
    const vigentes = new Set(recordatorios.map((r) => r.id))
    for (const id of avisados) {
      if (!vigentes.has(id)) toast.dismiss(idToastRecordatorio(id))
    }
  }, [recordatorios, cargando])

  // Temporizador local: aviso exacto para los que vencen en breve.
  useEffect(() => {
    const lista = pendientes.data ?? []
    const temporizadores = proximosAvisos(lista, Date.now()).map((aviso) =>
      setTimeout(() => {
        const tarea = lista.find((t) => t.id === aviso.id)
        if (tarea) mostrarRef.current(tarea)
        refrescar()
      }, aviso.retrasoMs + 500),
    )
    // Reevalúa periódicamente por si la lista no cambia en mucho tiempo.
    const tic = setInterval(() => void pendientes.refetch(), INTERVALO_RECORDATORIOS_MS * 10)
    return () => {
      temporizadores.forEach(clearTimeout)
      clearInterval(tic)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendientes.data])

  return null
}

export default AvisoRecordatorios
