/**
 * Usuarios sobre el almacén local. No hay autenticación: la sesión es elegir con
 * quién se trabaja (`src/lib/sesion.ts`). Las reglas que protegían la tabla en
 * Postgres (trigger `proteger_usuario`) viven en `src/lib/reglas.ts`.
 */
import { ahora, escribir, leer } from "@/lib/almacen"
import { ErrorRegla, marcarActualizado, validarCambioUsuario } from "@/lib/reglas"
import { usuarioActual } from "@/lib/sesion"
import type { Usuario, UsuarioUpdate } from "@/lib/types"

/** Copia la fila aplicando solo las claves definidas de `cambios` (undefined = no tocar). */
function fusionar<T extends object>(fila: T, cambios: Partial<T>): T {
  const salida = { ...fila }
  for (const clave of Object.keys(cambios) as (keyof T)[]) {
    const valor = cambios[clave]
    if (valor !== undefined) salida[clave] = valor as T[keyof T]
  }
  return salida
}

export async function listar(soloActivos = false): Promise<Usuario[]> {
  return leer()
    .usuarios.filter((u) => !soloActivos || u.activo)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
}

export async function obtener(id: string): Promise<Usuario | null> {
  return leer().usuarios.find((u) => u.id === id) ?? null
}

/**
 * Un miembro solo puede cambiar su nombre; el administrador cambia rol, estado y
 * correo. Siempre debe quedar un administrador activo y nadie puede quitarse a sí
 * mismo el rol de administrador ni desactivarse.
 */
export async function actualizar(id: string, cambios: UsuarioUpdate): Promise<Usuario> {
  const actor = usuarioActual()
  const momento = ahora()
  return escribir((db) => {
    const indice = db.usuarios.findIndex((u) => u.id === id)
    if (indice === -1) throw new ErrorRegla("Ese usuario ya no existe.")
    const anterior = db.usuarios[indice]
    const siguiente = fusionar(anterior, cambios as Partial<Usuario>)
    if (cambios.nombre !== undefined) siguiente.nombre = cambios.nombre.trim()
    validarCambioUsuario(actor, anterior, siguiente, db.usuarios)
    if (actor && actor.id === anterior.id) {
      if (anterior.rol === "admin" && siguiente.rol !== "admin") {
        throw new ErrorRegla("No puedes quitarte a ti mismo el rol de administrador.")
      }
      if (anterior.activo && !siguiente.activo) {
        throw new ErrorRegla("No puedes desactivar tu propio usuario.")
      }
    }
    const guardado = marcarActualizado(siguiente, momento)
    db.usuarios[indice] = guardado
    return guardado
  })
}
