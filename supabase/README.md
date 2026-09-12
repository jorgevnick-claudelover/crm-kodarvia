# Base de datos (Supabase)

Todo lo que necesita el proyecto en Supabase está en esta carpeta:

| Archivo | Qué es |
|---|---|
| `migrations/0001_init.sql` | Esquema completo: tablas, índices, triggers, funciones, RLS y realtime. Se aplica una sola vez sobre un proyecto vacío. |
| `seed.sql` | Catálogos de ejemplo (etapas, motivos de pérdida, orígenes) y configuración inicial. Idempotente. No crea usuarios. |
| `tests/comprobaciones.sql` | Comprobaciones manuales que se ejecutan tras la migración; termina en `ROLLBACK`, no deja rastro. |
| `functions/recordatorios/` | Edge Function que consume Kodarvia para enviar los correos de recordatorio. |

Antes de tocar nada, valida la sintaxis en local: `npm run validar-sql` (usa el parser real de Postgres; no sustituye a probar en Supabase, pero atrapa cualquier error de escritura).

## 1. Crear el proyecto

1. En [supabase.com](https://supabase.com) crea un proyecto nuevo (plan Free basta para 5 usuarios).
2. **Región**: elige `South America (São Paulo)` (`sa-east-1`) por cercanía a Arequipa. Si no aparece o quieren la latencia más estable con Cloudflare, `East US (North Virginia)` (`us-east-1`) también sirve; entre ambas la diferencia para este uso es de decenas de milisegundos.
3. Guarda la contraseña de la base de datos: hace falta para `pg_dump` y para la CLI.
4. Anota en `Project Settings > API`: la **URL del proyecto**, la clave **anon** (pública, va en `.env.local` del front) y la clave **service_role** (secreta, nunca al repositorio ni al navegador).

## 2. Aplicar la migración y el seed

### Opción A: SQL Editor (sin instalar nada)

1. `SQL Editor > New query`. Pega **todo** el contenido de `migrations/0001_init.sql` y pulsa **Run**. Debe terminar sin errores (tarda unos segundos).
2. Nueva consulta: pega `seed.sql` y ejecuta.
3. (Recomendado) Nueva consulta: pega `tests/comprobaciones.sql` y ejecuta. En la salida deben aparecer líneas `OK 1.` a `OK 10f.` y al final "Todas las comprobaciones pasaron". Como acaba en `ROLLBACK`, no queda nada guardado. Si el editor solo muestra "Success. No rows returned", abre el panel de mensajes/logs de la consulta para ver los `NOTICE`.

Notas:
- La migración da por hecho que las extensiones `pgcrypto`, `pg_trgm` y `unaccent` viven en el esquema `extensions` (así las instala Supabase). Si tu proyecto ya tenía `unaccent` en otro esquema, cambia las referencias `extensions.unaccent` y `extensions.gin_trgm_ops` antes de ejecutar.
- Si la migración falla a medias, lo más limpio es **borrar el proyecto y crear otro** (o `Database > Backups > Restore` a un punto anterior en planes de pago). El archivo no es reentrante a propósito: es una instalación inicial.

### Opción B: CLI de Supabase

```bash
npm i -g supabase            # o brew install supabase/tap/supabase
supabase login
supabase init                # crea supabase/config.toml si no existe (no lo subas con secretos)
supabase link --project-ref <ref-del-proyecto>
supabase db push             # aplica supabase/migrations/*.sql que falten en el proyecto
psql "$SUPABASE_DB_URL" -f supabase/seed.sql            # el seed en remoto se aplica a mano
psql "$SUPABASE_DB_URL" -f supabase/tests/comprobaciones.sql
```

`SUPABASE_DB_URL` es la cadena de conexión de `Project Settings > Database` (usa el pooler en modo *session*). Sin Docker no hay Supabase local; todo se prueba contra el proyecto en la nube.

## 3. Crear los usuarios

La app no registra usuarios: los crea el desarrollador o el administrador. Dos formas:

**Script** (recomendado, crea varios de golpe y fija el rol):

```bash
export SUPABASE_URL="https://xxxx.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJ..."     # secreta: solo en tu terminal, nunca en el repo
cp scripts/usuarios.ejemplo.json /tmp/usuarios.json   # edita nombres, correos, contraseñas y roles
node scripts/crear-usuarios.mjs /tmp/usuarios.json
```

El script crea cada usuario con el correo confirmado (no hace falta que reciban un email), espera a que el trigger `crear_usuario_desde_auth` cree la fila en `public.usuarios` y ajusta el rol si el archivo lo indica. No imprime contraseñas.

**Panel de Supabase**: `Authentication > Users > Add user > Create new user`, marca *Auto Confirm User* y en *User Metadata* pon `{"nombre": "Ana Quispe"}`. El **primer usuario creado en el proyecto queda como administrador**; los siguientes son miembros. Para cambiar un rol después: desde la app (Configuración > Usuarios, solo el admin) o en `Table Editor > usuarios`.

Cada usuario puede cambiar solo su nombre; rol, activo y correo los cambia el administrador (lo impone un trigger). Siempre debe quedar al menos un administrador activo.

## 4. Edge Function `recordatorios` (para Kodarvia)

Es la puerta de entrada de Kodarvia a la cola `recordatorios_correo`. Contrato completo en `docs/CONTRATO-RECORDATORIOS.md`.

```bash
supabase link --project-ref <ref-del-proyecto>          # si no lo hiciste ya
supabase secrets set KODARVIA_API_KEY="$(openssl rand -hex 32)"   # guarda el valor: es lo que se entrega a Kodarvia
supabase functions deploy recordatorios --no-verify-jwt
```

- `--no-verify-jwt` es obligatorio: Kodarvia no manda un JWT de Supabase, se autentica solo con la cabecera `x-api-key`.
- `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` las inyecta Supabase en el entorno de la función; no hay que configurarlas.
- Prueba rápida: `curl -H "x-api-key: <clave>" "https://<ref>.supabase.co/functions/v1/recordatorios?limite=5"` debe devolver `{"ok":true,"total":0,...}` en un proyecto sin tareas vencidas.
- Para rotar la clave: `supabase secrets set KODARVIA_API_KEY=...` y volver a desplegar no es necesario (los secretos se leen en cada arranque de la función, pero conviene esperar un minuto).

## 5. Si el proyecto Free se pausa

Supabase pausa los proyectos Free tras **7 días sin actividad** (ninguna petición a la API o a la base). Efectos: la app muestra error de conexión y Kodarvia recibe errores 5xx al llamar a la función.

- Reactivar: `Dashboard > proyecto > Restore project`. Tarda uno o dos minutos y no se pierde nada.
- Evitarlo: el uso normal del CRM (varias personas cada día) ya lo mantiene activo. Si el cliente deja de usarlo una temporada, cualquier consulta cada pocos días basta (la propia llamada de Kodarvia cada minuto cuenta como actividad).
- Para producción sin sobresaltos, el plan Pro elimina la pausa y añade copias diarias.

## 6. Copias de seguridad

**pg_dump** (copia completa restaurable):

```bash
pg_dump "$SUPABASE_DB_URL" --schema=public --no-owner --no-privileges -Fc -f crm_$(date +%Y%m%d).dump
# restaurar en otro proyecto (después de aplicar 0001_init.sql):
pg_restore --data-only --no-owner -d "$OTRO_DB_URL" crm_20260912.dump
```

`--schema=public` deja fuera `auth.users`; los usuarios se vuelven a crear con el script. Si además quieres los usuarios, añade `--schema=auth --table=auth.users` (contiene hashes de contraseña: trátalo como secreto).

**Exportación CSV** (sin herramientas): `Table Editor > tabla > Export > CSV` para cada tabla, o desde la app con el botón Exportar (respeta los filtros en pantalla). Sirve como copia de lectura, no para restaurar relaciones.

**Panel**: `Database > Backups`. En Free no hay copias automáticas; en Pro hay diarias con 7 días de retención.

## 7. Qué hay dentro (resumen)

- 12 tablas en `public`: `usuarios`, `etapas`, `motivos_perdida`, `origenes`, `contactos`, `oportunidades`, `historial_etapas`, `tareas`, `recordatorios_correo`, `actividades`, `importaciones`, `configuracion`.
- RLS activa en todas. Todos los autenticados ven todo; cada uno edita lo suyo (`responsable_id` o `usuario_id`); el admin edita todo; `recordatorios_correo` no es visible desde el cliente.
- Funciones que llama la app: `es_admin()`, `mover_oportunidad(id, etapa_id, posicion)`, `buscar(q)`, `recordatorios_pendientes_usuario()`, `sin_tildes(texto)`.
- Funciones para Kodarvia (solo `service_role`): `reclamar_recordatorios(limite)`, `marcar_recordatorio(id, estado, error)`.
- Realtime: publicación `supabase_realtime` con las 9 tablas que escucha la app y `replica identity full`.
