# Decisiones de base de datos

Decisiones tomadas al escribir `supabase/migrations/0001_init.sql` y la integración con Kodarvia. Complementa `docs/DECISIONES.md` (decisiones generales). Fecha: 12 de septiembre de 2026.

## Entorno y validación

- **Sin Postgres ni Docker en la máquina**: el SQL no se ha ejecutado. Se compensa con validación sintáctica real (parser de Postgres) y con `supabase/tests/comprobaciones.sql`, un guion de comprobaciones que se ejecuta en el proyecto Supabase en cuanto exista y que termina en `ROLLBACK`.
- **Parser elegido: `@libpg-query/parser`** (devDependency) en lugar de `libpg-query`. Es el mismo parser de Postgres 17 compilado a WASM, del mismo autor, pero la variante "completa" añade `parsePlPgSQL`, que valida los cuerpos de las funciones PL/pgSQL y de los bloques `DO` (el parser básico los trata como texto opaco, y ahí está casi toda la lógica). `scripts/validar-sql.mjs` recorre `supabase/**/*.sql`, parsea cada sentencia e informa de línea y columna; para PL/pgSQL informa de la función afectada. Comando: `npm run validar-sql`.
- Lo que el parser **no** detecta: columnas o funciones inexistentes, tipos incompatibles, permisos, comportamiento de triggers. Para eso están las comprobaciones.

## Esquema

- **`sin_tildes(text)`**: `unaccent()` no es `IMMUTABLE`, y un índice sobre una expresión lo exige. `public.sin_tildes` es un envoltorio SQL inmutable que llama a `extensions.unaccent('extensions.unaccent'::regdictionary, texto)` con el diccionario fijado. Se usa en el índice GIN de trigramas de `contactos` y en `buscar()`. Declararla inmutable es seguro porque el diccionario `unaccent` no se modifica.
- **Extensiones cualificadas**: todas las llamadas a `extensions.unaccent`, `extensions.gin_trgm_ops`, `extensions.crypt` van con esquema explícito, porque las funciones `security definer` fijan `search_path = public` y el esquema `extensions` no estaría en la ruta. Si un proyecto tuviera las extensiones en otro esquema habría que ajustarlo (anotado en `supabase/README.md`).
- **Índices adicionales** a los que exige la arquitectura: claves foráneas (`oportunidades.contacto_id`, `etapa_id`, `responsable_id`, `tareas.*_id`, `actividades.*`), `oportunidades(estado)`, `ganada_at`, `created_at`, un índice parcial en `tareas` para los recordatorios pendientes no vistos y otro parcial en `recordatorios_correo` para la cola. Son baratos y evitan recorridos completos en cascadas y en el panel.
- **`actividades.resultado`** lleva `CHECK` con los cinco valores del documento (o null). La arquitectura los lista en un comentario; hacerlo restricción evita valores inventados desde la importación.
- **`historial_etapas.usuario_id`** se rellena con `auth.uid()` solo si existe en `usuarios` (subconsulta) para que una operación del `service_role` no falle por clave foránea.

## Triggers y funciones

- **`security definer` en los triggers que escriben tablas sin política de escritura**: `registrar_historial_etapas` (historial_etapas), `sincronizar_recordatorio` (recordatorios_correo) y `actualizar_ultima_actividad` (un miembro registra actividad sobre contactos ajenos y el trigger debe poder tocar `contactos.ultima_actividad_at`). Sin esto la RLS bloquearía el trigger al ejecutarse con los permisos del usuario.
- **Estado de oportunidad en dos triggers**: `preparar_cambio_estado` (BEFORE INSERT/UPDATE: fija `ganada_at`/`perdida_at`, limpia motivo, detalle y fechas al reabrir) y `registrar_historial_etapas` (AFTER). En INSERT también completa las fechas que falten para poder importar oportunidades ya cerradas sin que salten los `CHECK`.
- **Bypass cuando `auth.uid()` es null** en `proteger_reasignacion` y `proteger_usuario`: si no hay usuario en sesión, el que opera es `service_role`, `postgres` o el SQL Editor (que ya saltan la RLS), y los scripts de administración (`crear-usuarios.mjs` fija roles) deben poder trabajar. Un usuario anónimo nunca llega ahí porque no tiene políticas de UPDATE.
- **`proteger_usuario`** además impide que el cambio deje el sistema sin ningún administrador activo (error `Debe quedar al menos un administrador activo`) y que un miembro cambie su propio correo (podría desincronizarlo de Auth).
- **`crear_usuario_desde_auth`** bloquea `usuarios` (`share row exclusive`) mientras decide si es el primer usuario, para que dos altas simultáneas no acaben ambas como admin. Hace `on conflict (id) do nothing` por si el perfil ya existía.
- **`sincronizar_recordatorio`** hace el upsert en dos pasos (`select` + `insert`/`update`) en lugar de `on conflict`, para que las reglas de rearme se lean de un vistazo. En UPDATE de tarea solo actúa si cambió algo que afecte al correo (hora, estado, título, vencimiento, responsable, contacto); marcar "visto" no toca la cola. Si la zona horaria de `configuracion` fuera inválida, cae a `America/Lima` en vez de impedir guardar la tarea.
- **`marcar_recordatorio` solo actúa sobre filas en `enviando`** y devuelve `boolean`. Así una confirmación tardía no pisa un recordatorio que el usuario reprogramó o canceló entre medias. La Edge Function traduce `false` a `actualizado: false` con aviso. Backoff tras error: `10 min × 2^(intentos−1)`; tope 5 intentos.
- **`reclamar_recordatorios`** es `language sql` (un solo `UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED) RETURNING *`), con el límite acotado a 1..200.
- **`mover_oportunidad`** devuelve la fila actualizada y lanza `42501` si el UPDATE no afecta filas (la RLS lo filtró o no existe). Rechaza etapas inactivas. No cambia el `estado`: reabrir se hace actualizando `estado` directamente.
- **`buscar(q)`** escapa `%`, `_` y `\` del texto, devuelve nada con texto vacío y ordena por fecha descendente. La condición sobre nombre y empresa usa exactamente la expresión del índice GIN; teléfono, correo y documento van en una segunda condición (sin índice; con pocos miles de contactos no importa).

## Permisos y realtime

- Políticas nombradas en español con el patrón `"tabla: acción quién"`, todas `to authenticated`. `anon` queda sin ningún privilegio sobre `public` (`revoke all ... from anon`): la app solo usa la clave anon para autenticarse.
- `recordatorios_correo`: RLS activa sin políticas y además `revoke all` a `anon` y `authenticated`; solo llegan a ella las funciones `security definer` y el `service_role`.
- `reclamar_recordatorios` y `marcar_recordatorio`: `revoke execute` a `public`, `anon` y `authenticated`; `grant` solo a `service_role`.
- Publicación realtime añadida con un bloque `DO` que comprueba `pg_publication_tables` antes de cada `alter publication`, para que reaplicar esa parte a mano no falle. `replica identity full` en las nueve tablas para que los eventos DELETE y UPDATE lleguen con la fila completa.

## Seed y usuarios

- `seed.sql` es idempotente por "tabla vacía" para los catálogos (no hay restricción única sobre `nombre`, a propósito: el cliente puede tener etapas con nombres parecidos) y por `on conflict (clave) do nothing` en `configuracion`. `url_app` queda en `https://crm.example.com` hasta tener el dominio real; se cambia desde Configuración > Valores.
- Los usuarios se crean con `scripts/crear-usuarios.mjs` (Auth Admin API con la clave de servicio, leída del entorno). Si el correo ya existe, reutiliza el usuario sin cambiar la contraseña. El rol se fija después en `usuarios`, porque el trigger solo hace admin al primero.

## Comprobaciones (`supabase/tests/comprobaciones.sql`)

- Crea dos usuarios de prueba insertando directamente en `auth.users` (con `extensions.crypt` para el hash) dentro de una transacción con `ROLLBACK`. Si el rol `postgres` del proyecto no pudiera insertar en `auth.users`, habría que crear los usuarios por el panel y adaptar el guion; es el único punto que depende de los permisos internos de Supabase.
- Simula la sesión de un miembro con `set_config('request.jwt.claims', ...)` + `set local role authenticated` para comprobar RLS y triggers de verdad, no solo la lógica.

## Pendiente de confirmar en el proyecto real

- Que `create extension ... with schema extensions` no choque con extensiones ya instaladas en otro esquema.
- Que el `postgres` del proyecto pueda crear el trigger sobre `auth.users` (es el patrón documentado por Supabase, debería).
- Sincronizar `usuarios.email` si el usuario cambia su correo en Auth: hoy no hay trigger de UPDATE en `auth.users`. Los usuarios los gestiona el desarrollador, así que no debería ocurrir; si hace falta se añade un `AFTER UPDATE OF email`.
