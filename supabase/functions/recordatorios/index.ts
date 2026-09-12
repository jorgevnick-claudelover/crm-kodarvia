// Edge Function "recordatorios": puerta de entrada de Kodarvia a la cola de
// correos de recordatorio (tabla recordatorios_correo).
//
//   GET  /functions/v1/recordatorios?limite=50
//        -> reclama hasta N recordatorios vencidos (los bloquea 10 minutos) y
//           los devuelve en JSON.
//   POST /functions/v1/recordatorios/<id>   body: { "estado": "enviado" | "error", "error": "..." }
//        -> confirma el resultado del envío.
//
// Autenticación: cabecera "x-api-key" igual al secreto KODARVIA_API_KEY.
// Internamente usa la clave de servicio (SUPABASE_SERVICE_ROLE_KEY), que
// Supabase inyecta en el entorno de la función; Kodarvia nunca la ve.
//
// Despliegue (desde la raíz del repo, con la CLI de Supabase enlazada):
//   supabase secrets set KODARVIA_API_KEY=<clave-larga-aleatoria>
//   supabase functions deploy recordatorios --no-verify-jwt
// --no-verify-jwt es necesario porque Kodarvia no manda un JWT de Supabase,
// solo la x-api-key. Detalle del contrato en docs/CONTRATO-RECORDATORIOS.md.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CABECERAS_CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-api-key, content-type, apikey',
}

const LIMITE_POR_DEFECTO = 50
const LIMITE_MAXIMO = 200
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function json(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...CABECERAS_CORS, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function error(mensaje: string, estado: number, detalle?: unknown): Response {
  return json({ ok: false, error: mensaje, ...(detalle !== undefined ? { detalle } : {}) }, estado)
}

// Comparación de longitud constante para no filtrar información por tiempo.
function clavesIguales(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a)
  const eb = new TextEncoder().encode(b)
  if (ea.length !== eb.length) return false
  let diferencia = 0
  for (let i = 0; i < ea.length; i++) diferencia |= ea[i] ^ eb[i]
  return diferencia === 0
}

function clienteServicio() {
  const url = Deno.env.get('SUPABASE_URL')
  const clave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !clave) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno')
  return createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } })
}

// Extrae el id que sigue a "/recordatorios" en la ruta, si lo hay.
function idDeRuta(pathname: string): string | null {
  const partes = pathname.split('/').filter(Boolean)
  const indice = partes.lastIndexOf('recordatorios')
  const id = indice >= 0 ? partes[indice + 1] : undefined
  return id ?? null
}

Deno.serve(async (peticion: Request): Promise<Response> => {
  if (peticion.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CABECERAS_CORS })
  }

  const claveEsperada = Deno.env.get('KODARVIA_API_KEY')
  if (!claveEsperada) {
    return error('La función no tiene configurado el secreto KODARVIA_API_KEY', 500)
  }
  const claveRecibida = peticion.headers.get('x-api-key') ?? ''
  if (!claveRecibida || !clavesIguales(claveRecibida, claveEsperada)) {
    return error('No autorizado: cabecera x-api-key ausente o incorrecta', 401)
  }

  const url = new URL(peticion.url)

  try {
    const supabase = clienteServicio()

    // GET: reclamar recordatorios vencidos.
    if (peticion.method === 'GET') {
      const limiteBruto = Number.parseInt(url.searchParams.get('limite') ?? '', 10)
      const limite = Number.isFinite(limiteBruto) ? Math.min(Math.max(limiteBruto, 1), LIMITE_MAXIMO) : LIMITE_POR_DEFECTO

      const { data, error: errorRpc } = await supabase.rpc('reclamar_recordatorios', { p_limite: limite })
      if (errorRpc) return error('No se pudieron reclamar los recordatorios', 500, errorRpc.message)

      const recordatorios = (data ?? []) as Record<string, unknown>[]
      return json({ ok: true, total: recordatorios.length, limite, recordatorios })
    }

    // POST /recordatorios/<id>: confirmar resultado.
    if (peticion.method === 'POST') {
      const id = idDeRuta(url.pathname)
      if (!id || !UUID.test(id)) {
        return error('Falta el id del recordatorio en la ruta: POST /recordatorios/<uuid>', 400)
      }

      let cuerpo: { estado?: unknown; error?: unknown }
      try {
        cuerpo = await peticion.json()
      } catch {
        return error('El cuerpo debe ser JSON: { "estado": "enviado" | "error", "error": "..." }', 400)
      }

      const estado = cuerpo.estado
      if (estado !== 'enviado' && estado !== 'error') {
        return error('El campo "estado" debe ser "enviado" o "error"', 400)
      }
      const detalleError = typeof cuerpo.error === 'string' ? cuerpo.error : null

      const { data, error: errorRpc } = await supabase.rpc('marcar_recordatorio', {
        p_id: id,
        p_estado: estado,
        p_error: detalleError,
      })
      if (errorRpc) return error('No se pudo marcar el recordatorio', 500, errorRpc.message)

      const actualizado = data === true
      return json({
        ok: true,
        id,
        estado,
        actualizado,
        ...(actualizado
          ? {}
          : { aviso: 'El recordatorio no estaba en estado "enviando" (ya confirmado, cancelado o reprogramado); no se cambió nada' }),
      })
    }

    return error(`Método no permitido: ${peticion.method}`, 405)
  } catch (excepcion) {
    const mensaje = excepcion instanceof Error ? excepcion.message : String(excepcion)
    return error('Error interno de la función', 500, mensaje)
  }
})
