/**
 * Sesión simulada: no hay autenticación. El usuario con el que se está trabajando
 * se guarda en localStorage bajo `crm.usuario` y es solo un id de la tabla `usuarios`.
 *
 * Vive en `src/lib` (y no en el hook) para que `src/lib/api/*` pueda saber quién
 * está trabajando sin depender de React. El hook `useSesion` lo reexporta todo.
 */
import { leer } from "@/lib/almacen"
import type { Usuario } from "@/lib/types"

/** Clave de localStorage con el usuario elegido en este navegador. */
export const CLAVE_USUARIO = "crm.usuario"

function leerId(): string | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null
    const valor = window.localStorage.getItem(CLAVE_USUARIO)
    return valor && valor.trim() !== "" ? valor : null
  } catch {
    return null
  }
}

function guardarId(id: string | null): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return
    if (id === null) window.localStorage.removeItem(CLAVE_USUARIO)
    else window.localStorage.setItem(CLAVE_USUARIO, id)
  } catch {
    // Modo privado sin almacenamiento: la sesión dura lo que dure la pestaña.
  }
}

// Avisos de cambio de sesión dentro de esta misma pestaña (el evento `storage` solo llega a las otras).
const oyentes = new Set<() => void>()

function avisar(): void {
  for (const oyente of [...oyentes]) oyente()
}

/** Escucha los cambios de usuario (entrar, salir, o hacerlo desde otra pestaña). */
export function suscribirseSesion(escucha: () => void): () => void {
  oyentes.add(escucha)
  return () => {
    oyentes.delete(escucha)
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (evento: StorageEvent) => {
    if (evento.key === null || evento.key === CLAVE_USUARIO) avisar()
  })
}

/** Usuario con el que se está trabajando, o null si nadie ha entrado todavía. */
export function usuarioActual(): Usuario | null {
  const id = leerId()
  if (!id) return null
  const usuario = leer().usuarios.find((u) => u.id === id) ?? null
  return usuario && usuario.activo ? usuario : null
}

/** Id del usuario con el que se está trabajando, o null. Utilizable fuera de React. */
export function idUsuarioActual(): string | null {
  return usuarioActual()?.id ?? null
}

/** Entra como ese usuario (un toque en la pantalla de inicio). Lanza si no existe o está desactivado. */
export function entrarComo(usuarioId: string): Usuario {
  const usuario = leer().usuarios.find((u) => u.id === usuarioId)
  if (!usuario) throw new Error("Ese usuario ya no existe en este navegador.")
  if (!usuario.activo) throw new Error("Ese usuario está desactivado. Pídele al administrador que lo active.")
  guardarId(usuario.id)
  avisar()
  return usuario
}

/** Deja de trabajar como el usuario actual (la limpieza de la caché la hace `cerrarSesion`). */
export function olvidarUsuario(): void {
  guardarId(null)
  avisar()
}
