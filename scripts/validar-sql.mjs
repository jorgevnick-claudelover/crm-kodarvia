#!/usr/bin/env node
// Valida la sintaxis de todos los .sql de supabase/ con el parser real de
// Postgres (libpg-query compilado a WASM, paquete @libpg-query/parser).
//
// Comprueba dos niveles:
//   1. Sintaxis SQL de cada sentencia (parse).
//   2. Sintaxis PL/pgSQL del cuerpo de cada funcion "language plpgsql" y de
//      cada bloque DO (parsePlPgSQL), que el parser SQL trata como texto opaco.
//
// No sustituye a ejecutar la migracion en Supabase: no detecta errores
// semanticos (columnas inexistentes, tipos incompatibles, permisos...).
//
// Uso: npm run validar-sql            (o: node scripts/validar-sql.mjs [ruta...])
// Sale con codigo 1 si hay algun error.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, parsePlPgSQL, loadModule } from '@libpg-query/parser'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function listarSql(dir) {
  const salida = []
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre)
    const info = statSync(ruta)
    if (info.isDirectory()) salida.push(...listarSql(ruta))
    else if (nombre.endsWith('.sql')) salida.push(ruta)
  }
  return salida.sort()
}

// Convierte un desplazamiento en bytes (lo que devuelve el parser) a linea y columna.
function posicion(texto, desplazamientoBytes) {
  const bytes = Buffer.from(texto, 'utf8').subarray(0, Math.max(0, desplazamientoBytes))
  const previo = bytes.toString('utf8')
  const lineas = previo.split('\n')
  return { linea: lineas.length, columna: lineas[lineas.length - 1].length + 1 }
}

function lineaDeTexto(texto, linea) {
  return (texto.split('\n')[linea - 1] ?? '').trim()
}

function describirError(error, texto, desplazamientoBase = 0) {
  const detalle = error?.sqlDetails
  const mensaje = detalle?.message ?? error?.message ?? String(error)
  const cursor = detalle?.cursorPosition
  if (typeof cursor === 'number' && cursor > 0) {
    const { linea, columna } = posicion(texto, desplazamientoBase + cursor - 1)
    return { mensaje, linea, columna, fragmento: lineaDeTexto(texto, linea) }
  }
  return { mensaje }
}

// Extrae "language X" de una sentencia CREATE FUNCTION ya parseada.
function lenguajeDeFuncion(nodo) {
  for (const opcion of nodo.options ?? []) {
    const def = opcion.DefElem
    if (def?.defname === 'language') return def.arg?.String?.sval ?? def.arg?.String?.str
  }
  return undefined
}

async function validarArchivo(ruta) {
  const texto = readFileSync(ruta, 'utf8')
  const errores = []
  let resultado
  try {
    resultado = await parse(texto)
  } catch (error) {
    errores.push({ nivel: 'SQL', ...describirError(error, texto) })
    return { texto, errores, sentencias: 0 }
  }

  const sentencias = resultado.stmts ?? []
  const bytes = Buffer.from(texto, 'utf8')

  for (const raw of sentencias) {
    // stmt_location apunta justo despues del ';' anterior: se saltan los
    // espacios y comentarios en blanco iniciales para informar la linea real.
    let inicio = raw.stmt_location ?? 0
    const fin = inicio + (raw.stmt_len ?? bytes.length - inicio)
    while (inicio < fin && /\s/.test(String.fromCharCode(bytes[inicio]))) inicio++
    const fuente = bytes.subarray(inicio, fin).toString('utf8')

    // Funciones PL/pgSQL: se pasa la sentencia completa al parser de PL/pgSQL.
    const fn = raw.stmt?.CreateFunctionStmt
    if (fn && lenguajeDeFuncion(fn) === 'plpgsql') {
      try {
        await parsePlPgSQL(fuente)
      } catch (error) {
        errores.push({ nivel: 'PL/pgSQL', ...describirError(error, texto, inicio), contexto: primeraLinea(fuente) })
      }
    }

    // Bloques DO: se envuelven en una funcion ficticia para poder parsearlos.
    const bloque = raw.stmt?.DoStmt
    if (bloque) {
      let cuerpo
      let lenguaje = 'plpgsql'
      for (const arg of bloque.args ?? []) {
        const def = arg.DefElem
        if (def?.defname === 'as') cuerpo = def.arg?.String?.sval ?? def.arg?.String?.str
        if (def?.defname === 'language') lenguaje = def.arg?.String?.sval ?? def.arg?.String?.str
      }
      if (cuerpo !== undefined && lenguaje === 'plpgsql') {
        const envoltorio = `create function _bloque_do() returns void language plpgsql as $validar$${cuerpo}$validar$;`
        try {
          await parsePlPgSQL(envoltorio)
        } catch (error) {
          // La posicion dentro del envoltorio no se corresponde con el archivo;
          // se informa la linea de inicio del bloque DO y el mensaje.
          const { linea } = posicion(texto, inicio)
          errores.push({ nivel: 'PL/pgSQL (DO)', mensaje: error?.sqlDetails?.message ?? error.message, linea, fragmento: 'bloque DO que empieza en esta linea' })
        }
      }
    }
  }

  return { texto, errores, sentencias: sentencias.length }
}

function primeraLinea(fuente) {
  return fuente.split('\n').find((l) => l.trim() !== '')?.trim().slice(0, 100) ?? ''
}

async function principal() {
  await loadModule()
  const argumentos = process.argv.slice(2)
  const archivos = argumentos.length > 0 ? argumentos.map((a) => resolve(a)) : listarSql(join(raiz, 'supabase'))

  let totalErrores = 0
  for (const ruta of archivos) {
    const { errores, sentencias } = await validarArchivo(ruta)
    const nombre = relative(raiz, ruta)
    if (errores.length === 0) {
      console.log(`OK   ${nombre} (${sentencias} sentencias)`)
      continue
    }
    totalErrores += errores.length
    console.log(`FALLO ${nombre}`)
    for (const e of errores) {
      const donde = e.linea ? `linea ${e.linea}${e.columna ? `, columna ${e.columna}` : ''}` : 'posicion desconocida'
      console.log(`  [${e.nivel}] ${donde}: ${e.mensaje}`)
      if (e.contexto) console.log(`      en: ${e.contexto}`)
      if (e.fragmento) console.log(`      -> ${e.fragmento}`)
    }
  }

  if (totalErrores > 0) {
    console.log(`\n${totalErrores} error(es) de sintaxis.`)
    process.exit(1)
  }
  console.log('\nTodos los archivos SQL tienen sintaxis valida.')
}

principal().catch((error) => {
  console.error('Error inesperado del validador:', error)
  process.exit(1)
})
