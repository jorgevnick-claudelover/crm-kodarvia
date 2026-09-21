/**
 * Consultas de apoyo del módulo de oportunidades (tablero y lista):
 * cierre del mes en curso y fecha del último cambio de etapa por oportunidad.
 * Todo sale del almacén local; las fechas se comparan en hora de Lima.
 */
import { leer } from "@/lib/almacen"
import { desdeLima, inicioDeMesLima } from "@/lib/utils/fechas"

export interface ResumenCerradasMes {
  ganadas: number
  importeGanado: number
  perdidas: number
  /** 'yyyy-MM-dd' del primer día del mes en Lima. */
  desde: string
}

/** Ganadas y perdidas cuyo cierre cae en el mes actual (hora de Lima). */
export async function cerradasEsteMes(): Promise<ResumenCerradasMes> {
  const desde = inicioDeMesLima()
  const desdeIso = desdeLima(desde, "00:00")
  const resumen: ResumenCerradasMes = { ganadas: 0, importeGanado: 0, perdidas: 0, desde }
  for (const fila of leer().oportunidades) {
    if (fila.estado === "abierta") continue
    if (fila.estado === "ganada" && fila.ganada_at && fila.ganada_at >= desdeIso) {
      resumen.ganadas += 1
      resumen.importeGanado += Number(fila.importe) || 0
    } else if (fila.estado === "perdida" && fila.perdida_at && fila.perdida_at >= desdeIso) {
      resumen.perdidas += 1
    }
  }
  return Promise.resolve(resumen)
}

/**
 * Fecha del último registro de historial_etapas de cada oportunidad (para "N días en etapa").
 * Devuelve un mapa id -> ISO. Las que no aparezcan usan updated_at como respaldo.
 */
export async function ultimoCambioEtapa(ids: readonly string[]): Promise<Record<string, string>> {
  const resultado: Record<string, string> = {}
  if (ids.length === 0) return Promise.resolve(resultado)
  const buscados = new Set(ids)
  for (const fila of leer().historial_etapas) {
    if (!buscados.has(fila.oportunidad_id)) continue
    const previo = resultado[fila.oportunidad_id]
    if (previo === undefined || fila.created_at > previo) resultado[fila.oportunidad_id] = fila.created_at
  }
  return Promise.resolve(resultado)
}
