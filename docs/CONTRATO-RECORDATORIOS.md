# Contrato de recordatorios por correo (para Kodarvia)

Versión 1 · 12 de septiembre de 2026

El CRM **no envía correos**. Deja cada recordatorio de tarea en una cola dentro de su base de datos (Supabase/Postgres) y Kodarvia la consume, envía el correo y confirma el resultado. Este documento describe la cola, sus estados y las tres formas de consumirla. Recomendamos la primera (Edge Function): solo necesitan una URL y una clave.

## 1. Qué es la cola

Tabla `public.recordatorios_correo`. Hay **como máximo una fila por tarea** (`tarea_id` es único): si el usuario cambia la hora del recordatorio, se actualiza la misma fila; si completa la tarea, la fila pasa a `cancelado`. Eso hace la cola idempotente: dos consumidores nunca verán dos filas para la misma tarea, y reintentar sobre el mismo `id` es seguro.

Una fila entra en la cola cuando un usuario crea una tarea con recordatorio (o lo activa después). Está "vencida" (lista para enviar) cuando `enviar_at <= now()`.

## 2. Campos de cada recordatorio

| Campo | Tipo | Significado |
|---|---|---|
| `id` | uuid | Identificador del recordatorio. Es el que se usa para confirmar. |
| `tarea_id` | uuid | Tarea del CRM a la que pertenece (único). |
| `usuario_id` | uuid | Responsable de la tarea (destinatario). |
| `email` | texto | Correo del destinatario. |
| `enviar_at` | timestamp con zona | Momento de envío en **UTC** (ISO 8601). |
| `enviar_local` | texto | El mismo momento en hora de Lima, informativo: `2026-09-15 09:00 America/Lima`. |
| `asunto` | texto | Asunto del correo, ya redactado: `Recordatorio: {título de la tarea}`. |
| `cuerpo` | texto | Cuerpo en texto plano, ya redactado (saludo con el nombre, tarea, contacto, fecha en Lima, enlace). Pueden enviarlo tal cual o maquetarlo. |
| `url` | texto | Enlace directo a la tarea en la app. |
| `estado` | texto | `pendiente`, `enviando`, `enviado`, `error`, `cancelado`. |
| `intentos` | entero | Veces que se ha reclamado. Máximo 5. |
| `bloqueado_hasta` | timestamp | Hasta cuándo no se volverá a entregar a otro consumidor. |
| `enviado_at` | timestamp | Cuándo se confirmó el envío. |
| `ultimo_error` | texto | Último mensaje de error que nos reportaron. |
| `created_at`, `updated_at` | timestamp | Auditoría. |

Ejemplo (tal como lo devuelve la Edge Function):

```json
{
  "id": "6f1d2c4e-9b3a-4c7e-8d21-0a5e7b9c1f33",
  "tarea_id": "b2a7e6c1-3d4f-4a5b-9c8d-7e6f5a4b3c2d",
  "usuario_id": "0c9e8d7f-6a5b-4c3d-2e1f-0a9b8c7d6e5f",
  "email": "ana@estudiocontable.pe",
  "enviar_at": "2026-09-15T14:00:00+00:00",
  "enviar_local": "2026-09-15 09:00 America/Lima",
  "asunto": "Recordatorio: Llamar a Zoraida Quispe",
  "cuerpo": "Hola Ana Quispe,\n\nTienes una tarea pendiente: Llamar a Zoraida Quispe\nContacto: Zoraida Quispe (Panadería Ñusta)\nVence: 15/09/2026 09:00 (hora de Lima)\n\nAbrir la tarea: https://crm.estudiocontable.pe/tareas/b2a7e6c1-3d4f-4a5b-9c8d-7e6f5a4b3c2d\n",
  "url": "https://crm.estudiocontable.pe/tareas/b2a7e6c1-3d4f-4a5b-9c8d-7e6f5a4b3c2d",
  "estado": "enviando",
  "intentos": 1,
  "bloqueado_hasta": "2026-09-15T14:10:12+00:00",
  "enviado_at": null,
  "ultimo_error": null,
  "created_at": "2026-09-14T21:03:44+00:00",
  "updated_at": "2026-09-15T14:00:12+00:00"
}
```

El nombre del responsable va dentro del `cuerpo` ("Hola Ana Quispe,"). Si lo necesitan como campo aparte, díganlo y lo añadimos.

## 3. Estados y transiciones

```
              crear tarea con recordatorio
                        │
                        ▼
                   ┌──────────┐   reclamar (GET)    ┌──────────┐  confirmar enviado   ┌─────────┐
                   │pendiente │ ──────────────────► │ enviando │ ───────────────────► │ enviado │
                   └──────────┘                     └──────────┘                      └─────────┘
                        ▲                                │ confirmar error                 │
                        │  bloqueo vencido y < 5 intentos ▼                                │
                        │                           ┌──────────┐                           │
                        └────────── reclamar ────── │  error   │                           │
                                                    └──────────┘                           │
   tarea completada o sin recordatorio  ─────────────────────────────────────►  ┌───────────┐
   (desde pendiente / enviando / error)                                         │ cancelado │
                                                                                └───────────┘
   cambia la hora (desde enviado / error / cancelado / enviando) ───────────────► pendiente (intentos = 0)
```

- **pendiente**: listo para enviar cuando `enviar_at <= now()`.
- **enviando**: reclamado por un consumidor; bloqueado 10 minutos. Si nadie confirma en ese tiempo, no se reintenta solo: sigue en `enviando` hasta que confirmen (`enviado` o `error`). Recomendación: confirmen siempre, aunque sea con `error`.
- **enviado**: final. No se vuelve a entregar salvo que el usuario cambie la hora.
- **error**: se volverá a entregar cuando pase `bloqueado_hasta` (espera creciente) mientras `intentos < 5`. Tras el quinto intento fallido se queda en `error` y nadie lo reclama más; queda visible para revisarlo a mano.
- **cancelado**: la tarea se completó o perdió el recordatorio. Si un consumidor lo tenía reclamado, su confirmación posterior no cambia nada (respuesta `actualizado: false`).

## 4. Cómo consumir la cola

### Opción 1 (recomendada): Edge Function `recordatorios`

Base: `https://<ref>.supabase.co/functions/v1/recordatorios`. Autenticación: cabecera `x-api-key` con la clave que les entregamos. Sin ella, o con una incorrecta, responde `401`.

**Reclamar** (cada minuto, o con la frecuencia que quieran):

```bash
curl -s "https://<ref>.supabase.co/functions/v1/recordatorios?limite=50" \
  -H "x-api-key: $KODARVIA_API_KEY"
```

Respuesta:

```json
{ "ok": true, "total": 2, "limite": 50, "recordatorios": [ { "...": "ver ejemplo arriba" } ] }
```

Devuelve solo recordatorios vencidos (`enviar_at <= now()`) que no estén bloqueados, ya marcados como `enviando` y con `intentos + 1`. `limite` va de 1 a 200 (50 por defecto). Si no hay nada: `total: 0` y lista vacía. Pueden llamar con varios procesos a la vez: cada fila se entrega a uno solo (`FOR UPDATE SKIP LOCKED`).

**Confirmar** (una llamada por recordatorio, tras intentar el envío):

```bash
# Enviado correctamente
curl -s -X POST "https://<ref>.supabase.co/functions/v1/recordatorios/6f1d2c4e-9b3a-4c7e-8d21-0a5e7b9c1f33" \
  -H "x-api-key: $KODARVIA_API_KEY" -H "Content-Type: application/json" \
  -d '{ "estado": "enviado" }'

# Falló el envío (se reintentará)
curl -s -X POST "https://<ref>.supabase.co/functions/v1/recordatorios/6f1d2c4e-9b3a-4c7e-8d21-0a5e7b9c1f33" \
  -H "x-api-key: $KODARVIA_API_KEY" -H "Content-Type: application/json" \
  -d '{ "estado": "error", "error": "SMTP 451 temporarily unavailable" }'
```

Respuesta: `{ "ok": true, "id": "...", "estado": "enviado", "actualizado": true }`. Si `actualizado` es `false`, el recordatorio ya no estaba en `enviando` (lo cancelaron, lo reprogramaron o ya se había confirmado) y no se cambió nada: no es un error, pueden ignorarlo.

Errores: siempre JSON `{ "ok": false, "error": "mensaje" }` con código `400` (petición mal formada), `401` (clave), `405` (método) o `500` (fallo interno; reintenten más tarde).

### Opción 2: funciones SQL por la API REST de Supabase

Si prefieren no depender de la Edge Function, las mismas dos operaciones existen como funciones de Postgres ejecutables **solo con la clave `service_role`** del proyecto (que compartiríamos por un canal seguro; da acceso total a la base, así que la opción 1 es preferible).

```bash
# Reclamar
curl -s -X POST "https://<ref>.supabase.co/rest/v1/rpc/reclamar_recordatorios" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" -d '{ "p_limite": 50 }'
# -> lista JSON de recordatorios (mismos campos que arriba)

# Confirmar
curl -s -X POST "https://<ref>.supabase.co/rest/v1/rpc/marcar_recordatorio" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "p_id": "6f1d2c4e-...", "p_estado": "enviado", "p_error": null }'
# -> true si se actualizó, false si ya no estaba en "enviando"
```

Firmas: `reclamar_recordatorios(p_limite int default 50) returns setof recordatorios_correo` y `marcar_recordatorio(p_id uuid, p_estado text, p_error text default null) returns boolean`. Las claves `anon` y `authenticated` no pueden ejecutarlas (permiso revocado) ni leer la tabla (RLS sin políticas).

### Opción 3: webhook saliente (pg_cron + pg_net)

Nosotros les llamamos: cada minuto la base reclama los vencidos y hace un `POST` a una URL suya con el recordatorio en el cuerpo (JSON con los campos de la sección 2) y la cabecera `x-api-key` con un secreto compartido. Ustedes envían el correo y **confirman igualmente** con la opción 1 o 2 (el `POST` no espera la respuesta; si no confirman, el recordatorio queda en `enviando`).

SQL listo para pegar en el SQL Editor cuando tengamos la URL y el secreto. **Está desactivado**: no se ejecuta hasta que rellenemos los dos valores y programemos el cron.

```sql
-- Extensiones (en Supabase se activan en Database > Extensions: pg_cron y pg_net).
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Reclama y envía cada recordatorio vencido a la URL de Kodarvia.
create or replace function public.enviar_recordatorios_webhook()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url     text := 'https://WEBHOOK.DE.KODARVIA/recordatorios';   -- <- rellenar
  v_secreto text := 'SECRETO-COMPARTIDO';                           -- <- rellenar
  r         public.recordatorios_correo;
begin
  for r in select * from public.reclamar_recordatorios(50) loop
    perform net.http_post(
      url     := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-api-key', v_secreto),
      body    := to_jsonb(r),
      timeout_milliseconds := 8000
    );
  end loop;
end;
$$;

revoke execute on function public.enviar_recordatorios_webhook() from public, anon, authenticated;

-- Programar (cada minuto). Ejecutar solo cuando la URL y el secreto estén puestos:
-- select cron.schedule('recordatorios-webhook', '* * * * *', $$select public.enviar_recordatorios_webhook()$$);
-- Para desactivar:  select cron.unschedule('recordatorios-webhook');
```

## 5. Reintentos, bloqueos y concurrencia

- Al reclamar, la fila pasa a `enviando`, `intentos` sube en 1 y `bloqueado_hasta = now() + 10 minutos`. Mientras está bloqueada, ninguna llamada la devuelve.
- Si confirman `error`, pasa a `error` con `bloqueado_hasta = now() + 10 min × 2^(intentos − 1)`: 10, 20, 40 y 80 minutos. Cuando vence el bloqueo vuelve a ser reclamable.
- Tope: **5 intentos**. Después se queda en `error` con `ultimo_error` para revisión manual (nosotros lo vemos en la tabla).
- Si reclaman y no confirman, la fila queda en `enviando` indefinidamente (no se reenvía sola). Por eso pedimos confirmar siempre. Si detectan un proceso caído, avísennos y la reencolamos, o confírmenla con `error` cuando la recuperen.
- Varios consumidores en paralelo son seguros: `FOR UPDATE SKIP LOCKED` en la reclamación.

## 6. Idempotencia

- Una fila por tarea (`tarea_id` único). Cambiar la hora no crea duplicados.
- Un `enviado` sobre una fila que ya no está en `enviando` no hace nada (`actualizado: false`).
- Si necesitan idempotencia en su lado (por ejemplo, evitar dos correos si reciben la misma fila dos veces por un reintento suyo), usen `id` + `intentos` como clave de deduplicación.

## 7. Zona horaria

- `enviar_at` (y todos los timestamps) están en **UTC** con formato ISO 8601.
- `enviar_local` es la misma hora en `America/Lima` (UTC−5, sin horario de verano), solo para leerla o mostrarla. La app también escribe la fecha en hora de Lima dentro del `cuerpo`.
- Comparen contra `now()` en UTC; no hace falta convertir nada para decidir qué enviar.

## 8. Qué hace la app cuando la tarea cambia

| Acción del usuario | Efecto en la cola |
|---|---|
| Crea una tarea con recordatorio | Nueva fila `pendiente`. |
| Cambia el título, el contacto o el responsable | Se actualizan `asunto`, `cuerpo`, `email`; el estado no cambia (si ya se envió, no se reenvía). |
| Cambia la hora del recordatorio | La misma fila vuelve a `pendiente` con `intentos = 0` (aunque estuviera `enviado`, `error` o `cancelado`). Nuevo `enviar_at`. |
| Marca la tarea como hecha | `cancelado` (si no se había enviado ya). |
| Reabre la tarea | Vuelve a `pendiente` si tiene hora de recordatorio. |
| Quita el recordatorio | `cancelado`. |
| Borra la tarea | La fila desaparece. |
| Ve el aviso en la app | Nada: el aviso en pantalla y el correo son independientes. |

## 9. Qué necesitan de nosotros y qué necesitamos de ustedes

**De nosotros (lo entregamos por un canal seguro, no por correo):**
- URL de la Edge Function: `https://<ref>.supabase.co/functions/v1/recordatorios`.
- Clave `x-api-key` (64 caracteres hexadecimales). Se puede rotar en cualquier momento; avisaremos con antelación.
- Si eligen la opción 2: la clave `service_role` del proyecto (mucho más sensible).

**De ustedes:**
- Nada para las opciones 1 y 2.
- Para la opción 3: la URL del webhook y el secreto que quieren recibir en `x-api-key`.
- En todos los casos: un correo o contacto al que avisar si vemos recordatorios atascados en `error`.

**Remitente y plantilla**: el correo sale desde su sistema, así que el remitente (`From`) lo deciden ustedes. Sugerimos "CRM {nombre_empresa} <no-responder@…>". El cuerpo que damos es texto plano; pueden envolverlo en su plantilla HTML sin cambiar el contenido.
