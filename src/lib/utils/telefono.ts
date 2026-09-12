/**
 * Teléfonos del Perú. Celulares: 9 dígitos que empiezan por 9. Fijos: código de área
 * (Lima 1 + 7 dígitos; el resto 2 dígitos + 6 dígitos). Guardamos E.164 (+51...).
 */

/** Códigos de área de dos dígitos (fijos de 6 dígitos). Lima es "1" con 7 dígitos. */
const CODIGOS_AREA_2 = new Set([
  "41", "42", "43", "44", "51", "52", "53", "54", "56",
  "61", "62", "63", "64", "65", "66", "67",
  "72", "73", "74", "76",
  "82", "83", "84",
])

function soloDigitos(s: string): string {
  return s.replace(/\D+/g, "")
}

/**
 * Normaliza a E.164 (+51XXXXXXXXX). Devuelve null si no se reconoce como número peruano.
 * Acepta espacios, guiones, paréntesis, prefijos +51, 51, 0051 y el 0 nacional (054, 01).
 */
export function normalizarTelefonoPE(raw: string | null | undefined): string | null {
  if (!raw) return null
  const limpio = raw.trim()
  if (!limpio) return null
  const conMas = limpio.startsWith("+")
  let d = soloDigitos(limpio)
  if (!d) return null

  // Prefijo internacional: 0051, +51, 51 (solo cuando sobran dígitos para que sea prefijo)
  if (d.startsWith("0051")) d = d.slice(4)
  else if (conMas && d.startsWith("51")) d = d.slice(2)
  else if (d.startsWith("51") && (d.length === 11 || d.length === 10 || (d.length === 12 && d[2] === "0"))) d = d.slice(2)

  // Prefijo nacional 0 (054 123456, 01 1234567)
  if (d.startsWith("0")) d = d.slice(1)

  // Celular
  if (d.length === 9 && d.startsWith("9")) return `+51${d}`

  // Lima: 1 + 7 dígitos
  if (d.length === 8 && d.startsWith("1")) return `+51${d}`

  // Provincias: área de 2 dígitos + 6 dígitos
  if (d.length === 8 && CODIGOS_AREA_2.has(d.slice(0, 2))) return `+51${d}`

  return null
}

/** '+51987654321' => '987 654 321'; fijos '(054) 123 456' y '(01) 123 4567'. Si no es E.164 peruano, devuelve tal cual. */
export function formatearTelefono(telefono: string | null | undefined): string {
  if (!telefono) return ""
  const m = /^\+51(\d{8,9})$/.exec(telefono)
  if (!m) return telefono
  const n = m[1]
  if (n.length === 9) return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`
  if (n.startsWith("1")) return `(01) ${n.slice(1, 4)} ${n.slice(4)}`
  return `(0${n.slice(0, 2)}) ${n.slice(2, 5)} ${n.slice(5)}`
}

/** Enlace de WhatsApp: https://wa.me/51987654321 (sin +). Acepta E.164 o texto crudo. */
export function enlaceWhatsApp(telefono: string | null | undefined, mensaje?: string): string | null {
  if (!telefono) return null
  const normalizado = normalizarTelefonoPE(telefono) ?? (telefono.startsWith("+") ? telefono : null)
  const digitos = normalizado ? soloDigitos(normalizado) : soloDigitos(telefono)
  if (!digitos) return null
  const base = `https://wa.me/${digitos}`
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base
}

/** Enlace tel: para llamar desde el celular. */
export function enlaceLlamada(telefono: string | null | undefined): string | null {
  if (!telefono) return null
  const normalizado = normalizarTelefonoPE(telefono) ?? telefono
  return `tel:${normalizado.replace(/[^\d+]/g, "")}`
}

/** true si es un celular peruano (para mostrar el botón de WhatsApp). */
export function esCelularPE(telefono: string | null | undefined): boolean {
  return /^\+519\d{8}$/.test(telefono ?? "")
}
