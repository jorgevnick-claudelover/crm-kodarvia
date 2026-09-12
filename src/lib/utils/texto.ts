/** Utilidades de texto: sin tildes, iniciales y similitud para el mapeo de columnas. */

export function sinTildes(s: string | null | undefined): string {
  return (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

/** Texto normalizado para comparar: sin tildes, minúsculas, sin símbolos, espacios simples. */
export function normalizarTexto(s: string | null | undefined): string {
  return sinTildes(s)
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim()
}

/** Iniciales (máximo 2) de un nombre: "Juan Pérez" => "JP", "Ana" => "A". */
export function iniciales(nombre: string | null | undefined): string {
  const partes = (nombre ?? "").trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return "?"
  if (partes.length === 1) return partes[0].slice(0, 1).toUpperCase()
  return (partes[0].slice(0, 1) + partes[partes.length - 1].slice(0, 1)).toUpperCase()
}

function bigramas(s: string): Map<string, number> {
  const m = new Map<string, number>()
  for (let i = 0; i < s.length - 1; i++) {
    const b = s.slice(i, i + 2)
    m.set(b, (m.get(b) ?? 0) + 1)
  }
  return m
}

function coeficienteDice(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0
  const ba = bigramas(a)
  const bb = bigramas(b)
  let comunes = 0
  for (const [k, v] of ba) comunes += Math.min(v, bb.get(k) ?? 0)
  return (2 * comunes) / (a.length - 1 + (b.length - 1))
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      const coste = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + coste)
    }
    prev = cur
  }
  return prev[b.length]
}

/**
 * Similitud 0..1 entre dos textos (sin tildes ni mayúsculas). 1 = iguales.
 * Combina contención, bigramas (Dice) y distancia de edición.
 */
export function similitud(a: string | null | undefined, b: string | null | undefined): number {
  const x = normalizarTexto(a).replace(/\s+/g, "")
  const y = normalizarTexto(b).replace(/\s+/g, "")
  if (!x || !y) return 0
  if (x === y) return 1
  if (x.includes(y) || y.includes(x)) {
    const corto = Math.min(x.length, y.length)
    const largo = Math.max(x.length, y.length)
    return Math.max(0.8, 0.8 + 0.2 * (corto / largo))
  }
  const dice = coeficienteDice(x, y)
  const lev = 1 - levenshtein(x, y) / Math.max(x.length, y.length)
  return Math.max(dice, lev)
}

/** Recorta con puntos suspensivos. */
export function truncar(s: string | null | undefined, max = 60): string {
  const t = (s ?? "").trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}
