/** Soles peruanos: 'S/ 1,250.00' (dos decimales, miles con coma). */

const SIMBOLO = "S/"

export function formatearNumero(n: number | null | undefined, decimales = 2): string {
  const valor = Number.isFinite(n) ? (n as number) : 0
  const negativo = valor < 0
  const [entero, decimal] = Math.abs(valor).toFixed(decimales).split(".")
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  const resultado = decimales > 0 ? `${conMiles}.${decimal}` : conMiles
  return negativo ? `-${resultado}` : resultado
}

export function formatearImporte(n: number | null | undefined, simbolo = SIMBOLO): string {
  return `${simbolo} ${formatearNumero(n, 2)}`
}

/** Importe sin símbolo y con punto decimal, como va al CSV: '1250.00'. */
export function importeParaCSV(n: number | null | undefined): string {
  const valor = Number.isFinite(n) ? (n as number) : 0
  return valor.toFixed(2)
}

/** Convierte texto escrito por el usuario ('S/ 1,250.00', '1250', '1.250,50') en número. */
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
