/** Helpers compartidos por src/lib/api/*. Todo el acceso a datos pasa por src/lib/almacen.ts. */
import { leer } from "@/lib/almacen"
import { idUsuarioActual } from "@/lib/sesion"
import { desdeLima, finDeDiaLima } from "@/lib/utils/fechas"

/** Rango de un filtro de fechas 'yyyy-MM-dd' (Lima) como instantes UTC. */
export function rangoLima(desde?: string, hasta?: string): { desdeIso?: string; hastaIso?: string } {
  return {
    desdeIso: desde ? desdeLima(desde, "00:00") : undefined,
    hastaIso: hasta ? finDeDiaLima(hasta) : undefined,
  }
}

/**
 * Id del usuario con el que se está trabajando, o null. Sigue siendo async para no
 * romper a quien la llama, aunque leer el almacén local sea inmediato.
 */
export async function uidActual(): Promise<string | null> {
  return Promise.resolve(idUsuarioActual())
}

/** Ids de contactos con alguna tarea pendiente (para "sin seguimiento" y "tarea vencida"). */
export interface ResumenTareasPendientes {
  contactosConPendiente: Set<string>
  contactosConVencida: Set<string>
  oportunidadesConPendiente: Set<string>
  oportunidadesConVencida: Set<string>
}

export async function resumenTareasPendientes(): Promise<ResumenTareasPendientes> {
  const ahora = Date.now()
  const r: ResumenTareasPendientes = {
    contactosConPendiente: new Set(),
    contactosConVencida: new Set(),
    oportunidadesConPendiente: new Set(),
    oportunidadesConVencida: new Set(),
  }
  for (const t of leer().tareas) {
    if (t.estado !== "pendiente") continue
    const vencida = new Date(t.vence_at).getTime() < ahora
    if (t.contacto_id) {
      r.contactosConPendiente.add(t.contacto_id)
      if (vencida) r.contactosConVencida.add(t.contacto_id)
    }
    if (t.oportunidad_id) {
      r.oportunidadesConPendiente.add(t.oportunidad_id)
      if (vencida) r.oportunidadesConVencida.add(t.oportunidad_id)
    }
  }
  return Promise.resolve(r)
}
