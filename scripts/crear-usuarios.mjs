#!/usr/bin/env node
// Crea los usuarios del CRM en Supabase Auth usando la clave de servicio.
// Lo ejecuta el desarrollador (o el administrador) una vez; la app no crea usuarios.
//
// Uso:
//   export SUPABASE_URL="https://xxxx.supabase.co"
//   export SUPABASE_SERVICE_ROLE_KEY="eyJ..."        # Project Settings > API > service_role (secreta)
//   node scripts/crear-usuarios.mjs                  # lee scripts/usuarios.ejemplo.json
//   node scripts/crear-usuarios.mjs ruta/a/usuarios.json
//
// Formato del archivo: lista de objetos { nombre, email, password, rol? }
//   rol: "admin" | "miembro" (opcional; si se omite, la base de datos decide:
//   el primer usuario del proyecto es admin y el resto miembros).
//
// Qué hace por cada usuario:
//   1. auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nombre } })
//      (si el correo ya existe, lo reutiliza y no cambia la contraseña).
//   2. Espera a que el trigger crear_usuario_desde_auth deje la fila en public.usuarios.
//   3. Si el archivo indica rol, lo actualiza en public.usuarios.
//   4. Imprime un resumen. Nunca imprime contraseñas.
//
// La clave de servicio NO va al repositorio: se lee siempre del entorno.

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function salir(mensaje) {
  console.error(`Error: ${mensaje}`)
  process.exit(1)
}

const url = process.env.SUPABASE_URL
const claveServicio = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !claveServicio) {
  salir('Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno (no las escribas en el repositorio).')
}

const rutaArchivo = resolve(process.argv[2] ?? resolve(raiz, 'scripts', 'usuarios.ejemplo.json'))
let usuarios
try {
  usuarios = JSON.parse(readFileSync(rutaArchivo, 'utf8'))
} catch (error) {
  salir(`No se pudo leer ${rutaArchivo}: ${error.message}`)
}
if (!Array.isArray(usuarios) || usuarios.length === 0) {
  salir('El archivo debe contener una lista con al menos un usuario.')
}

for (const [indice, u] of usuarios.entries()) {
  if (!u || typeof u.email !== 'string' || !u.email.includes('@')) salir(`Usuario ${indice + 1}: falta un email válido.`)
  if (typeof u.password !== 'string' || u.password.length < 8) salir(`Usuario ${indice + 1} (${u.email}): la contraseña debe tener al menos 8 caracteres.`)
  if (typeof u.nombre !== 'string' || u.nombre.trim() === '') salir(`Usuario ${indice + 1} (${u.email}): falta el nombre.`)
  if (u.rol !== undefined && u.rol !== 'admin' && u.rol !== 'miembro') salir(`Usuario ${indice + 1} (${u.email}): rol debe ser "admin" o "miembro".`)
}

const supabase = createClient(url, claveServicio, { auth: { persistSession: false, autoRefreshToken: false } })

const espera = (ms) => new Promise((r) => setTimeout(r, ms))

async function buscarPorEmail(email) {
  // La API admin no filtra por email: se recorre la lista (hasta 5 usuarios, sobra).
  let pagina = 1
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: pagina, perPage: 200 })
    if (error) throw new Error(`listUsers: ${error.message}`)
    const encontrado = data.users.find((x) => (x.email ?? '').toLowerCase() === email.toLowerCase())
    if (encontrado) return encontrado
    if (data.users.length < 200) return null
    pagina++
  }
}

async function esperarPerfil(id) {
  for (let intento = 0; intento < 20; intento++) {
    const { data, error } = await supabase.from('usuarios').select('id, nombre, email, rol, activo').eq('id', id).maybeSingle()
    if (error) throw new Error(`consultar usuarios: ${error.message}`)
    if (data) return data
    await espera(250)
  }
  return null
}

const resumen = []

for (const u of usuarios) {
  const email = u.email.trim().toLowerCase()
  const nombre = u.nombre.trim()
  const fila = { email, nombre, resultado: '', rol: '' }
  resumen.push(fila)

  try {
    let id
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: u.password,
      email_confirm: true,
      user_metadata: { nombre },
    })

    if (error) {
      const yaExiste = /already|exists|registered/i.test(error.message)
      if (!yaExiste) throw new Error(`createUser: ${error.message}`)
      const existente = await buscarPorEmail(email)
      if (!existente) throw new Error(`createUser dice que existe pero no se encuentra: ${error.message}`)
      id = existente.id
      fila.resultado = 'ya existía (sin cambiar contraseña)'
    } else {
      id = data.user.id
      fila.resultado = 'creado'
    }

    const perfil = await esperarPerfil(id)
    if (!perfil) throw new Error('el trigger no creó la fila en public.usuarios (¿está aplicada la migración?)')

    if (u.rol && perfil.rol !== u.rol) {
      const { error: errorRol } = await supabase.from('usuarios').update({ rol: u.rol, activo: true }).eq('id', id)
      if (errorRol) throw new Error(`actualizar rol: ${errorRol.message}`)
      fila.rol = `${u.rol} (actualizado)`
    } else {
      fila.rol = perfil.rol
    }
  } catch (error) {
    fila.resultado = `ERROR: ${error.message}`
  }
}

console.log('\nResumen:')
for (const f of resumen) {
  console.log(`  ${f.email.padEnd(32)} ${f.nombre.padEnd(24)} rol: ${(f.rol || '-').padEnd(22)} ${f.resultado}`)
}
const fallos = resumen.filter((f) => f.resultado.startsWith('ERROR')).length
console.log(`\n${resumen.length - fallos} correcto(s), ${fallos} con error.`)
process.exit(fallos > 0 ? 1 : 0)
