import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/** Combina clases de Tailwind resolviendo conflictos (clsx + tailwind-merge). */
export function cn(...entradas: ClassValue[]): string {
  return twMerge(clsx(entradas))
}
