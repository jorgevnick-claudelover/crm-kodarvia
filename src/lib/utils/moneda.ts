/**
 * Importes de la app: dos decimales y miles con coma ('1,250.00'), precedidos del
 * símbolo de la moneda activa ('S/ 1,250.00', '$ 1,250.00').
 *
 * La moneda se elige en Configuración y se guarda en la clave `moneda`. Aquí vive el
 * símbolo activo a nivel de módulo para que cualquier función pura pueda formatear sin
 * arrastrar la configuración por medio mundo; `fijarMoneda` lo cambia y avisa a la
 * interfaz (`suscribirMoneda`). Por defecto PEN, que es lo que usaba el estudio antes
 * de que la moneda se pudiera cambiar.
 */

export interface Moneda {
  /** Código ISO 4217, lo que se guarda en la configuración. */
  codigo: string
  simbolo: string
  /** En minúsculas, para escribirlo dentro de una frase: 'soles'. */
  nombre: string
}

/** Monedas que ofrece Configuración. */
export const MONEDAS: readonly Moneda[] = [
  { codigo: "PEN", simbolo: "S/", nombre: "soles" },
  { codigo: "USD", simbolo: "$", nombre: "dólares" },
  { codigo: "EUR", simbolo: "€", nombre: "euros" },
  { codigo: "COP", simbolo: "$", nombre: "pesos colombianos" },
  { codigo: "MXN", simbolo: "$", nombre: "pesos mexicanos" },
  { codigo: "CLP", simbolo: "$", nombre: "pesos chilenos" },
  { codigo: "ARS", simbolo: "$", nombre: "pesos argentinos" },
  { codigo: "BOB", simbolo: "Bs", nombre: "bolivianos" },
]

/** La de siempre: soles. Se usa mientras no haya configuración leída. */
export const MONEDA_DEFAULT = "PEN"

function codigoLimpio(codigo: unknown): string {
  return typeof codigo === "string" ? codigo.trim().toUpperCase() : ""
}

export function monedaPorCodigo(codigo: string): Moneda | undefined {
  const c = codigoLimpio(codigo)
  return MONEDAS.find((m) => m.codigo === c)
}

/** Símbolo de un código. Si no está en la lista se usa el propio código, y no se rompe nada. */
export function simboloDe(codigo: string): string {
  const c = codigoLimpio(codigo)
  if (!c) return MONEDAS[0].simbolo
  return monedaPorCodigo(c)?.simbolo ?? c
}

/** Cómo se lee en Configuración: 'PEN — soles (S/)'. */
export function etiquetaMoneda(codigo: string): string {
  const c = codigoLimpio(codigo)
  const moneda = monedaPorCodigo(c)
  return moneda ? `${moneda.codigo} — ${moneda.nombre} (${moneda.simbolo})` : c
}

let codigoActivo = MONEDA_DEFAULT
let simboloActivo = simboloDe(MONEDA_DEFAULT)
const oyentes = new Set<() => void>()

/** Fija la moneda de toda la interfaz. La llama la capa de configuración al leerla o guardarla. */
export function fijarMoneda(codigo: string): void {
  const nuevoCodigo = codigoLimpio(codigo) || MONEDA_DEFAULT
  const nuevoSimbolo = simboloDe(nuevoCodigo)
  if (nuevoCodigo === codigoActivo && nuevoSimbolo === simboloActivo) return
  codigoActivo = nuevoCodigo
  simboloActivo = nuevoSimbolo
  for (const oyente of oyentes) oyente()
}

/** Código de la moneda activa ('PEN'). */
export function monedaActual(): string {
  return codigoActivo
}

/** Símbolo de la moneda activa ('S/'). */
export function simboloActual(): string {
  return simboloActivo
}

/** Avisa cuando cambia la moneda; devuelve la función para dejar de escuchar (useSyncExternalStore). */
export function suscribirMoneda(oyente: () => void): () => void {
  oyentes.add(oyente)
  return () => {
    oyentes.delete(oyente)
  }
}

export function formatearNumero(n: number | null | undefined, decimales = 2): string {
  const valor = Number.isFinite(n) ? (n as number) : 0
  const negativo = valor < 0
  const [entero, decimal] = Math.abs(valor).toFixed(decimales).split(".")
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  const resultado = decimales > 0 ? `${conMiles}.${decimal}` : conMiles
  return negativo ? `-${resultado}` : resultado
}

/** Importe con símbolo. Sin `simbolo` usa el de la moneda activa. */
export function formatearImporte(n: number | null | undefined, simbolo?: string): string {
  return `${simbolo ?? simboloActual()} ${formatearNumero(n, 2)}`
}

/** Importe sin símbolo y con punto decimal, como va al CSV: '1250.00'. No depende de la moneda. */
export function importeParaCSV(n: number | null | undefined): string {
  const valor = Number.isFinite(n) ? (n as number) : 0
  return valor.toFixed(2)
}

/**
 * Convierte texto escrito por el usuario en número. Quita cualquier símbolo de moneda
 * ('S/ 1,250.00', '$ 1,250.00', '€ 12,5') y entiende '1250' y '1.250,50'.
 */
export function parsearImporte(texto: string | number | null | undefined): number {
  if (typeof texto === "number") return Number.isFinite(texto) ? texto : 0
  if (!texto) return 0
  let s = texto.replace(/[^\d.,-]/g, "")
  if (!s) return 0
  const ultimaComa = s.lastIndexOf(",")
  const ultimoPunto = s.lastIndexOf(".")
  if (ultimaComa > ultimoPunto) {
    // formato '1.250,50'
    s = s.replace(/\./g, "").replace(",", ".")
  } else {
    s = s.replace(/,/g, "")
  }
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}
