-- =============================================================================
-- CRM Gestoría (Arequipa) · Migración inicial
-- Esquema, reglas de negocio (triggers y funciones), permisos (RLS) y realtime.
-- Contrato de diseño: docs/ARQUITECTURA.md secciones 4 a 7.
-- Postgres 15+ (Supabase). Se aplica una sola vez sobre un proyecto vacío.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Extensiones
-- En Supabase las extensiones viven en el esquema "extensions"; por eso todas
-- las llamadas a unaccent() y a gin_trgm_ops van cualificadas.
-- -----------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm  with schema extensions;
create extension if not exists unaccent with schema extensions;

-- unaccent() no es IMMUTABLE (depende del diccionario), y un índice sobre una
-- expresión exige funciones inmutables. Este envoltorio fija el diccionario de
-- la extensión y se declara inmutable: el diccionario "unaccent" no cambia.
create or replace function public.sin_tildes(p_texto text)
returns text
language sql
immutable
strict
parallel safe
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, p_texto);
$$;

comment on function public.sin_tildes(text) is
  'Quita tildes y diacríticos (envoltorio inmutable de unaccent para índices y búsqueda).';

-- -----------------------------------------------------------------------------
-- 1. Funciones de apoyo genéricas
-- -----------------------------------------------------------------------------

-- Mantiene updated_at en cada UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Tablas
-- Orden respetando las claves foráneas.
-- -----------------------------------------------------------------------------

-- 2.1 usuarios: perfil sobre auth.users. Lo crea el trigger de auth.users.
create table public.usuarios (
  id          uuid primary key references auth.users (id) on delete cascade,
  nombre      text not null,
  email       text not null unique,
  rol         text not null default 'miembro' check (rol in ('admin', 'miembro')),
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.usuarios is 'Perfil de cada usuario de la app (espejo de auth.users). El primero creado es admin.';

-- 2.2 etapas: columnas del tablero (solo etapas abiertas; ganada/perdida son estado).
create table public.etapas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  orden       int not null,
  color       text not null default 'slate',
  activa      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.etapas is 'Etapas abiertas del embudo. No se borran si tienen historial: se desactivan.';

-- 2.3 motivos_perdida
create table public.motivos_perdida (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  orden       int not null,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2.4 origenes: de dónde viene el contacto.
create table public.origenes (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  orden       int not null,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2.5 importaciones: una fila por hoja importada (va antes de contactos por la FK).
create table public.importaciones (
  id               uuid primary key default gen_random_uuid(),
  archivo          text not null,
  hoja             text,
  mapeo            jsonb not null default '{}'::jsonb,
  total_filas      int not null default 0,
  filas_no_vacias  int not null default 0,
  creadas          int not null default 0,
  fusionadas       int not null default 0,
  para_revisar     int not null default 0,
  informe          jsonb not null default '[]'::jsonb,
  usuario_id       uuid not null references public.usuarios (id) default auth.uid(),
  created_at       timestamptz not null default now()
);

comment on column public.importaciones.informe is
  'Lista [{fila, resultado: creado|fusionado|revisar, motivo, contacto_id}] para el informe descargable.';

-- 2.6 contactos
create table public.contactos (
  id                   uuid primary key default gen_random_uuid(),
  nombre               text not null,
  empresa              text,
  doc_tipo             text check (doc_tipo in ('DNI', 'RUC', 'CE')),
  doc_numero           text,
  telefono             text,        -- normalizado E.164 (+51987654321) cuando se puede
  telefono_raw         text,        -- tal como llegó
  email                text,
  direccion            text,
  origen_id            uuid references public.origenes (id),
  responsable_id       uuid not null references public.usuarios (id) default auth.uid(),
  notas                text,
  extra                jsonb not null default '{}'::jsonb,   -- columnas de la hoja no mapeadas
  importacion_id       uuid references public.importaciones (id),
  fila_origen          int,
  requiere_revision    boolean not null default false,
  ultima_actividad_at  timestamptz,
  created_by           uuid references public.usuarios (id) default auth.uid(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index contactos_telefono_idx       on public.contactos (telefono);
create index contactos_email_idx          on public.contactos (email);
create index contactos_doc_numero_idx     on public.contactos (doc_numero);
create index contactos_responsable_id_idx on public.contactos (responsable_id);
create index contactos_importacion_id_idx on public.contactos (importacion_id);
create index contactos_origen_id_idx      on public.contactos (origen_id);
-- Búsqueda por nombre y empresa sin tildes (trigramas).
create index contactos_busqueda_trgm_idx on public.contactos
  using gin (public.sin_tildes(nombre || ' ' || coalesce(empresa, '')) extensions.gin_trgm_ops);

-- 2.7 oportunidades
create table public.oportunidades (
  id                     uuid primary key default gen_random_uuid(),
  contacto_id            uuid not null references public.contactos (id) on delete cascade,
  titulo                 text not null,
  importe                numeric(12, 2) not null default 0,
  moneda                 char(3) not null default 'PEN',
  etapa_id               uuid not null references public.etapas (id),   -- última etapa abierta; se conserva al cerrar
  estado                 text not null default 'abierta' check (estado in ('abierta', 'ganada', 'perdida')),
  posicion               double precision not null default 0,           -- orden dentro de la columna
  responsable_id         uuid not null references public.usuarios (id) default auth.uid(),
  motivo_perdida_id      uuid references public.motivos_perdida (id),
  detalle_perdida        text,
  fecha_cierre_prevista  date,
  ganada_at              timestamptz,
  perdida_at             timestamptz,
  created_by             uuid references public.usuarios (id) default auth.uid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  -- Criterio 3: perder exige motivo (y solo las perdidas lo llevan).
  constraint oportunidades_perdida_con_motivo check ((estado = 'perdida') = (motivo_perdida_id is not null)),
  constraint oportunidades_ganada_con_fecha   check (estado <> 'ganada'  or ganada_at  is not null),
  constraint oportunidades_perdida_con_fecha  check (estado <> 'perdida' or perdida_at is not null)
);

create index oportunidades_contacto_id_idx    on public.oportunidades (contacto_id);
create index oportunidades_etapa_id_idx       on public.oportunidades (etapa_id);
create index oportunidades_estado_idx         on public.oportunidades (estado);
create index oportunidades_responsable_id_idx on public.oportunidades (responsable_id);
create index oportunidades_ganada_at_idx      on public.oportunidades (ganada_at);
create index oportunidades_created_at_idx     on public.oportunidades (created_at);

-- 2.8 historial_etapas: base del embudo. Solo lo escribe el trigger.
create table public.historial_etapas (
  id              bigint generated always as identity primary key,
  oportunidad_id  uuid not null references public.oportunidades (id) on delete cascade,
  de_etapa_id     uuid references public.etapas (id),
  a_etapa_id      uuid references public.etapas (id),
  de_estado       text,
  a_estado        text not null,
  usuario_id      uuid references public.usuarios (id),
  created_at      timestamptz not null default now()
);

create index historial_etapas_oportunidad_id_idx on public.historial_etapas (oportunidad_id);
create index historial_etapas_created_at_idx     on public.historial_etapas (created_at);

-- 2.9 tareas
create table public.tareas (
  id                     uuid primary key default gen_random_uuid(),
  contacto_id            uuid references public.contactos (id) on delete cascade,
  oportunidad_id         uuid references public.oportunidades (id) on delete set null,
  titulo                 text not null,
  vence_at               timestamptz not null,
  recordatorio_at        timestamptz,      -- por defecto igual a vence_at (lo pone la app)
  responsable_id         uuid not null references public.usuarios (id) default auth.uid(),
  estado                 text not null default 'pendiente' check (estado in ('pendiente', 'hecha')),
  hecha_at               timestamptz,
  recordatorio_visto_at  timestamptz,
  created_by             uuid references public.usuarios (id) default auth.uid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index tareas_contacto_id_idx    on public.tareas (contacto_id);
create index tareas_oportunidad_id_idx on public.tareas (oportunidad_id);
create index tareas_responsable_id_idx on public.tareas (responsable_id);
create index tareas_vence_at_idx       on public.tareas (vence_at);
create index tareas_recordatorio_pendiente_idx on public.tareas (responsable_id, recordatorio_at)
  where estado = 'pendiente' and recordatorio_visto_at is null;

-- 2.10 recordatorios_correo: cola para Kodarvia. Sin acceso desde el cliente.
create table public.recordatorios_correo (
  id               uuid primary key default gen_random_uuid(),
  tarea_id         uuid not null unique references public.tareas (id) on delete cascade,
  usuario_id       uuid not null references public.usuarios (id),
  email            text not null,
  enviar_at        timestamptz not null,
  enviar_local     text not null,          -- '2026-09-15 09:00 America/Lima', informativo
  asunto           text not null,
  cuerpo           text not null,
  url              text not null,
  estado           text not null default 'pendiente'
                   check (estado in ('pendiente', 'enviando', 'enviado', 'error', 'cancelado')),
  intentos         int not null default 0,
  bloqueado_hasta  timestamptz,
  enviado_at       timestamptz,
  ultimo_error     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index recordatorios_correo_cola_idx on public.recordatorios_correo (enviar_at)
  where estado in ('pendiente', 'error');

comment on table public.recordatorios_correo is
  'Cola de correos de recordatorio que consume Kodarvia (ver docs/CONTRATO-RECORDATORIOS.md).';

-- 2.11 actividades
create table public.actividades (
  id              uuid primary key default gen_random_uuid(),
  contacto_id     uuid not null references public.contactos (id) on delete cascade,
  oportunidad_id  uuid references public.oportunidades (id) on delete set null,
  tipo            text not null check (tipo in ('llamada', 'whatsapp', 'correo', 'reunion', 'nota')),
  resultado       text check (resultado is null or resultado in
                    ('contesto', 'no_contesto', 'volver_a_llamar', 'interesado', 'no_interesado')),
  nota            text,
  ocurrio_at      timestamptz not null default now(),
  usuario_id      uuid not null references public.usuarios (id) default auth.uid(),
  created_at      timestamptz not null default now()
);

create index actividades_contacto_id_ocurrio_idx on public.actividades (contacto_id, ocurrio_at desc);
create index actividades_oportunidad_id_idx      on public.actividades (oportunidad_id);
create index actividades_usuario_id_idx          on public.actividades (usuario_id);

-- 2.12 configuracion: pares clave/valor (valor en jsonb).
create table public.configuracion (
  clave       text primary key,
  valor       jsonb not null,
  updated_at  timestamptz not null default now()
);

comment on table public.configuracion is
  'Claves: timezone, moneda, hora_recordatorio, importe_default, nombre_empresa, titulo_oportunidad_default, url_app.';

-- -----------------------------------------------------------------------------
-- 3. Triggers de updated_at
-- -----------------------------------------------------------------------------
create trigger usuarios_set_updated_at        before update on public.usuarios        for each row execute function public.set_updated_at();
create trigger etapas_set_updated_at          before update on public.etapas          for each row execute function public.set_updated_at();
create trigger motivos_perdida_set_updated_at before update on public.motivos_perdida for each row execute function public.set_updated_at();
create trigger origenes_set_updated_at        before update on public.origenes        for each row execute function public.set_updated_at();
create trigger contactos_set_updated_at       before update on public.contactos       for each row execute function public.set_updated_at();
create trigger oportunidades_set_updated_at   before update on public.oportunidades   for each row execute function public.set_updated_at();
create trigger tareas_set_updated_at          before update on public.tareas          for each row execute function public.set_updated_at();
create trigger recordatorios_correo_set_updated_at before update on public.recordatorios_correo for each row execute function public.set_updated_at();
create trigger configuracion_set_updated_at   before update on public.configuracion   for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Usuarios: alta automática desde Auth y protección de rol/activo
-- -----------------------------------------------------------------------------

-- Crea el perfil al registrarse un usuario en Auth. El primero es admin.
create or replace function public.crear_usuario_desde_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text;
  v_rol    text;
  v_email  text;
begin
  -- Evita que dos altas simultáneas acaben ambas como admin.
  lock table public.usuarios in share row exclusive mode;

  v_nombre := nullif(trim(coalesce(new.raw_user_meta_data ->> 'nombre', '')), '');
  if v_nombre is null then
    v_nombre := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
  end if;
  if v_nombre is null then
    v_nombre := 'Usuario';
  end if;

  v_email := coalesce(new.email, new.id::text || '@sin-correo.local');

  if exists (select 1 from public.usuarios) then
    v_rol := 'miembro';
  else
    v_rol := 'admin';
  end if;

  insert into public.usuarios (id, nombre, email, rol)
  values (new.id, v_nombre, v_email, v_rol)
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger crear_usuario_desde_auth
  after insert on auth.users
  for each row execute function public.crear_usuario_desde_auth();

-- ¿El usuario de la sesión es administrador activo?
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select u.rol = 'admin' and u.activo from public.usuarios u where u.id = auth.uid()),
    false
  );
$$;

comment on function public.es_admin() is 'Devuelve true si auth.uid() es un administrador activo.';

-- Un miembro solo puede cambiar su nombre; rol, activo y email los cambia el admin.
-- Siempre debe quedar al menos un administrador activo.
-- Cuando auth.uid() es null (service_role o SQL Editor) no se aplica: no hay usuario.
create or replace function public.proteger_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id <> old.id then
    raise exception 'No se puede cambiar el id de un usuario' using errcode = '42501';
  end if;

  if auth.uid() is not null and not public.es_admin() then
    if new.rol <> old.rol or new.activo <> old.activo or new.email <> old.email then
      raise exception 'Solo el administrador puede cambiar el rol, el estado o el correo de un usuario'
        using errcode = '42501';
    end if;
  end if;

  -- Si este cambio deja de ser admin activo, comprobar que queda otro.
  if (old.rol = 'admin' and old.activo) and not (new.rol = 'admin' and new.activo) then
    if not exists (
      select 1 from public.usuarios u
      where u.rol = 'admin' and u.activo and u.id <> old.id
    ) then
      raise exception 'Debe quedar al menos un administrador activo' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger usuarios_proteger
  before update on public.usuarios
  for each row execute function public.proteger_usuario();

-- -----------------------------------------------------------------------------
-- 5. Reasignación: solo el administrador cambia responsable_id
-- -----------------------------------------------------------------------------
create or replace function public.proteger_reasignacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.responsable_id is distinct from old.responsable_id
     and auth.uid() is not null           -- service_role / SQL Editor no tienen usuario
     and not public.es_admin() then
    raise exception 'Solo el administrador puede reasignar' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger contactos_proteger_reasignacion
  before update on public.contactos
  for each row execute function public.proteger_reasignacion();

create trigger oportunidades_proteger_reasignacion
  before update on public.oportunidades
  for each row execute function public.proteger_reasignacion();

create trigger tareas_proteger_reasignacion
  before update on public.tareas
  for each row execute function public.proteger_reasignacion();

-- -----------------------------------------------------------------------------
-- 6. Oportunidades: fechas de cierre e historial de etapas
-- -----------------------------------------------------------------------------

-- BEFORE INSERT/UPDATE: fija ganada_at / perdida_at al cambiar de estado y
-- limpia motivo, detalle y fechas al reabrir. En INSERT solo completa fechas
-- que falten (permite importar oportunidades ya cerradas).
create or replace function public.preparar_cambio_estado()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.estado = 'ganada' then
      new.ganada_at := coalesce(new.ganada_at, now());
    elsif new.estado = 'perdida' then
      new.perdida_at := coalesce(new.perdida_at, now());
    end if;
    return new;
  end if;

  if new.estado is distinct from old.estado then
    if new.estado = 'ganada' then
      new.ganada_at := coalesce(new.ganada_at, now());
      new.perdida_at := null;
      new.motivo_perdida_id := null;
      new.detalle_perdida := null;
    elsif new.estado = 'perdida' then
      new.perdida_at := coalesce(new.perdida_at, now());
      new.ganada_at := null;
    else -- vuelve a 'abierta'
      new.motivo_perdida_id := null;
      new.detalle_perdida := null;
      new.ganada_at := null;
      new.perdida_at := null;
    end if;
  end if;

  return new;
end;
$$;

create trigger oportunidades_preparar_cambio_estado
  before insert or update on public.oportunidades
  for each row execute function public.preparar_cambio_estado();

-- AFTER INSERT: fila inicial. AFTER UPDATE: fila si cambian etapa_id o estado.
-- security definer porque los usuarios no tienen INSERT sobre historial_etapas.
create or replace function public.registrar_historial_etapas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid;
begin
  select u.id into v_usuario from public.usuarios u where u.id = auth.uid();

  if tg_op = 'INSERT' then
    insert into public.historial_etapas (oportunidad_id, de_etapa_id, a_etapa_id, de_estado, a_estado, usuario_id)
    values (new.id, null, new.etapa_id, null, new.estado, v_usuario);
  elsif new.etapa_id is distinct from old.etapa_id or new.estado is distinct from old.estado then
    insert into public.historial_etapas (oportunidad_id, de_etapa_id, a_etapa_id, de_estado, a_estado, usuario_id)
    values (new.id, old.etapa_id, new.etapa_id, old.estado, new.estado, v_usuario);
  end if;

  return new;
end;
$$;

create trigger oportunidades_registrar_historial
  after insert or update on public.oportunidades
  for each row execute function public.registrar_historial_etapas();

-- Mueve una oportunidad de etapa y posición. security invoker: la RLS decide
-- si el usuario puede; si no puede, el UPDATE no afecta filas y se avisa.
create or replace function public.mover_oportunidad(p_id uuid, p_etapa_id uuid, p_posicion double precision)
returns public.oportunidades
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_fila public.oportunidades;
begin
  if not exists (select 1 from public.etapas e where e.id = p_etapa_id and e.activa) then
    raise exception 'La etapa no existe o está desactivada' using errcode = '23503';
  end if;

  update public.oportunidades
     set etapa_id = p_etapa_id,
         posicion = coalesce(p_posicion, 0)
   where id = p_id
  returning * into v_fila;

  if not found then
    raise exception 'No puedes mover esta oportunidad (no existe o no eres su responsable)'
      using errcode = '42501';
  end if;

  return v_fila;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Tareas: sincronización de la cola de recordatorios
-- -----------------------------------------------------------------------------
-- Al insertar o actualizar una tarea:
--   * pendiente con recordatorio_at  -> upsert de la fila en recordatorios_correo.
--       - nueva o cancelada           -> pendiente, intentos 0
--       - enviada y cambia la hora    -> vuelve a pendiente, intentos 0
--       - enviada y no cambia la hora -> se conserva (idempotente por tarea_id)
--       - error y cambia la hora      -> pendiente, intentos 0
--       - pendiente / error / enviando sin cambio de hora -> se actualizan textos
--   * hecha o sin recordatorio_at    -> la fila (si no estaba enviada) pasa a cancelado.
-- security definer porque los usuarios no tienen acceso a recordatorios_correo.
create or replace function public.sincronizar_recordatorio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz          text;
  v_url_app     text;
  v_url         text;
  v_email       text;
  v_nombre      text;
  v_contacto    text;
  v_enviar_loc  text;
  v_vence_loc   text;
  v_asunto      text;
  v_cuerpo      text;
  v_existente   public.recordatorios_correo;
  v_rearmar     boolean;
begin
  -- En UPDATE, solo actuar si cambió algo que afecte al recordatorio.
  if tg_op = 'UPDATE'
     and new.recordatorio_at is not distinct from old.recordatorio_at
     and new.estado         is not distinct from old.estado
     and new.titulo         is not distinct from old.titulo
     and new.vence_at       is not distinct from old.vence_at
     and new.responsable_id is not distinct from old.responsable_id
     and new.contacto_id    is not distinct from old.contacto_id then
    return new;
  end if;

  -- Tarea hecha o sin recordatorio: cancelar lo que esté en curso.
  if new.estado = 'hecha' or new.recordatorio_at is null then
    update public.recordatorios_correo
       set estado = 'cancelado',
           bloqueado_hasta = null
     where tarea_id = new.id
       and estado in ('pendiente', 'enviando', 'error');
    return new;
  end if;

  -- Datos para el correo.
  select coalesce(c.valor #>> '{}', 'America/Lima') into v_tz
    from public.configuracion c where c.clave = 'timezone';
  v_tz := coalesce(nullif(trim(v_tz), ''), 'America/Lima');

  select rtrim(coalesce(c.valor #>> '{}', ''), '/') into v_url_app
    from public.configuracion c where c.clave = 'url_app';
  v_url := coalesce(v_url_app, '') || '/tareas/' || new.id::text;

  select u.email, u.nombre into v_email, v_nombre
    from public.usuarios u where u.id = new.responsable_id;

  if v_email is null then
    -- Sin responsable válido no hay a quién avisar; no se encola nada.
    return new;
  end if;

  if new.contacto_id is not null then
    select c.nombre || coalesce(' (' || c.empresa || ')', '') into v_contacto
      from public.contactos c where c.id = new.contacto_id;
  end if;

  -- Si la zona horaria configurada no es válida, se usa America/Lima.
  begin
    v_enviar_loc := to_char(new.recordatorio_at at time zone v_tz, 'YYYY-MM-DD HH24:MI') || ' ' || v_tz;
    v_vence_loc  := to_char(new.vence_at at time zone v_tz, 'DD/MM/YYYY HH24:MI');
  exception when others then
    v_tz := 'America/Lima';
    v_enviar_loc := to_char(new.recordatorio_at at time zone v_tz, 'YYYY-MM-DD HH24:MI') || ' ' || v_tz;
    v_vence_loc  := to_char(new.vence_at at time zone v_tz, 'DD/MM/YYYY HH24:MI');
  end;

  v_asunto := 'Recordatorio: ' || new.titulo;
  v_cuerpo :=
    'Hola ' || v_nombre || ',' || E'\n\n' ||
    'Tienes una tarea pendiente: ' || new.titulo || E'\n' ||
    case when v_contacto is not null then 'Contacto: ' || v_contacto || E'\n' else '' end ||
    'Vence: ' || v_vence_loc || ' (hora de Lima)' || E'\n\n' ||
    'Abrir la tarea: ' || v_url || E'\n';

  select * into v_existente
    from public.recordatorios_correo r
   where r.tarea_id = new.id;

  if not found then
    insert into public.recordatorios_correo
      (tarea_id, usuario_id, email, enviar_at, enviar_local, asunto, cuerpo, url, estado, intentos)
    values
      (new.id, new.responsable_id, v_email, new.recordatorio_at, v_enviar_loc, v_asunto, v_cuerpo, v_url, 'pendiente', 0);
    return new;
  end if;

  -- Se rearma (pendiente, intentos 0) si estaba cancelada, o si ya se había
  -- enviado / fallado / estaba en envío y la hora cambió.
  v_rearmar := v_existente.estado = 'cancelado'
            or (v_existente.estado in ('enviado', 'error', 'enviando')
                and v_existente.enviar_at is distinct from new.recordatorio_at);

  update public.recordatorios_correo r
     set usuario_id      = new.responsable_id,
         email           = v_email,
         enviar_at       = new.recordatorio_at,
         enviar_local    = v_enviar_loc,
         asunto          = v_asunto,
         cuerpo          = v_cuerpo,
         url             = v_url,
         estado          = case when v_rearmar then 'pendiente' else r.estado end,
         intentos        = case when v_rearmar then 0 else r.intentos end,
         bloqueado_hasta = case when v_rearmar then null else r.bloqueado_hasta end,
         enviado_at      = case when v_rearmar then null else r.enviado_at end,
         ultimo_error    = case when v_rearmar then null else r.ultimo_error end
   where r.id = v_existente.id;

  return new;
end;
$$;

create trigger tareas_sincronizar_recordatorio
  after insert or update on public.tareas
  for each row execute function public.sincronizar_recordatorio();

-- Recordatorios vencidos y no vistos del usuario de la sesión (tarjeta de "Hoy").
create or replace function public.recordatorios_pendientes_usuario()
returns setof public.tareas
language sql
stable
security invoker
set search_path = public
as $$
  select t.*
    from public.tareas t
   where t.responsable_id = auth.uid()
     and t.estado = 'pendiente'
     and t.recordatorio_at is not null
     and t.recordatorio_at <= now()
     and t.recordatorio_visto_at is null
   order by t.recordatorio_at;
$$;

-- -----------------------------------------------------------------------------
-- 8. Actividades: última actividad del contacto
-- -----------------------------------------------------------------------------
-- Recalcula ultima_actividad_at del contacto afectado (y del anterior si la
-- actividad cambió de contacto o se borró). security definer porque un miembro
-- puede registrar actividad sobre contactos que no son suyos.
create or replace function public.actualizar_ultima_actividad()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    update public.contactos c
       set ultima_actividad_at = (select max(a.ocurrio_at) from public.actividades a where a.contacto_id = c.id)
     where c.id = new.contacto_id;
  end if;

  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.contacto_id is distinct from new.contacto_id) then
    update public.contactos c
       set ultima_actividad_at = (select max(a.ocurrio_at) from public.actividades a where a.contacto_id = c.id)
     where c.id = old.contacto_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger actividades_actualizar_ultima_actividad
  after insert or update or delete on public.actividades
  for each row execute function public.actualizar_ultima_actividad();

-- -----------------------------------------------------------------------------
-- 9. Búsqueda global
-- -----------------------------------------------------------------------------
-- Une contactos, oportunidades, tareas y actividades. Sin tildes, sin
-- distinguir mayúsculas. Máximo 50 filas, las más recientes primero.
create or replace function public.buscar(q text)
returns table (tipo text, id uuid, titulo text, subtitulo text, contacto_id uuid, fecha timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  with patron as (
    select '%' || replace(replace(replace(public.sin_tildes(trim(q)), '\', '\\'), '%', '\%'), '_', '\_') || '%' as p
     where trim(coalesce(q, '')) <> ''
  )
  select r.tipo, r.id, r.titulo, r.subtitulo, r.contacto_id, r.fecha
  from (
    select 'contacto'::text as tipo,
           c.id,
           c.nombre as titulo,
           concat_ws(' · ', c.empresa, c.telefono, c.email, c.doc_numero) as subtitulo,
           c.id as contacto_id,
           c.updated_at as fecha
      from public.contactos c
      cross join patron
     where public.sin_tildes(c.nombre || ' ' || coalesce(c.empresa, '')) ilike patron.p
        or public.sin_tildes(concat_ws(' ', c.telefono, c.telefono_raw, c.email, c.doc_numero)) ilike patron.p

    union all

    select 'oportunidad'::text,
           o.id,
           o.titulo,
           concat_ws(' · ', c.nombre, o.estado),
           o.contacto_id,
           o.updated_at
      from public.oportunidades o
      join public.contactos c on c.id = o.contacto_id
      cross join patron
     where public.sin_tildes(o.titulo) ilike patron.p

    union all

    select 'tarea'::text,
           t.id,
           t.titulo,
           concat_ws(' · ', c.nombre, t.estado),
           t.contacto_id,
           t.vence_at
      from public.tareas t
      left join public.contactos c on c.id = t.contacto_id
      cross join patron
     where public.sin_tildes(t.titulo) ilike patron.p

    union all

    select 'actividad'::text,
           a.id,
           left(a.nota, 120),
           concat_ws(' · ', c.nombre, a.tipo),
           a.contacto_id,
           a.ocurrio_at
      from public.actividades a
      join public.contactos c on c.id = a.contacto_id
      cross join patron
     where a.nota is not null
       and public.sin_tildes(a.nota) ilike patron.p
  ) r
  order by r.fecha desc nulls last
  limit 50;
$$;

-- -----------------------------------------------------------------------------
-- 10. Cola de recordatorios: funciones para Kodarvia (solo service_role)
-- -----------------------------------------------------------------------------

-- Reclama hasta p_limite recordatorios vencidos: los marca 'enviando',
-- suma un intento y los bloquea 10 minutos. Seguro con varios consumidores
-- (FOR UPDATE SKIP LOCKED). Máximo 5 intentos por recordatorio.
create or replace function public.reclamar_recordatorios(p_limite int default 50)
returns setof public.recordatorios_correo
language sql
security definer
set search_path = public
as $$
  update public.recordatorios_correo r
     set estado = 'enviando',
         intentos = r.intentos + 1,
         bloqueado_hasta = now() + interval '10 minutes'
   where r.id in (
     select c.id
       from public.recordatorios_correo c
      where c.estado in ('pendiente', 'error')
        and c.enviar_at <= now()
        and c.intentos < 5
        and (c.bloqueado_hasta is null or c.bloqueado_hasta < now())
      order by c.enviar_at
      limit least(greatest(coalesce(p_limite, 50), 1), 200)
      for update skip locked
   )
  returning r.*;
$$;

-- Confirma el resultado de un recordatorio reclamado.
--   'enviado' -> estado enviado, enviado_at = now().
--   'error'   -> estado error, guarda el mensaje y bloquea con espera creciente
--                (10, 20, 40, 80 min según intentos). Tras 5 intentos deja de
--                reclamarse.
-- Solo actúa sobre filas en estado 'enviando' (las reclamadas). Devuelve true
-- si actualizó la fila.
create or replace function public.marcar_recordatorio(p_id uuid, p_estado text, p_error text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_estado = 'enviado' then
    update public.recordatorios_correo
       set estado = 'enviado',
           enviado_at = now(),
           bloqueado_hasta = null,
           ultimo_error = null
     where id = p_id
       and estado = 'enviando';
  elsif p_estado = 'error' then
    update public.recordatorios_correo
       set estado = 'error',
           ultimo_error = left(coalesce(nullif(trim(p_error), ''), 'Error no especificado'), 2000),
           bloqueado_hasta = now() + (interval '10 minutes' * power(2, greatest(intentos - 1, 0)))
     where id = p_id
       and estado = 'enviando';
  else
    raise exception 'Estado no válido: % (usa enviado o error)', p_estado using errcode = '22023';
  end if;

  return found;
end;
$$;

-- Solo la clave de servicio puede llamar a estas dos funciones.
revoke execute on function public.reclamar_recordatorios(int) from public, anon, authenticated;
revoke execute on function public.marcar_recordatorio(uuid, text, text) from public, anon, authenticated;
grant execute on function public.reclamar_recordatorios(int) to service_role;
grant execute on function public.marcar_recordatorio(uuid, text, text) to service_role;

-- -----------------------------------------------------------------------------
-- 11. Permisos: grants y RLS (sección 6 de ARQUITECTURA.md)
-- -----------------------------------------------------------------------------

-- Grants de tabla. La RLS afina después; anon no toca nada.
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
revoke all on all tables in schema public from anon;
-- La cola es solo de las funciones (security definer) y del service_role.
revoke all on public.recordatorios_correo from anon, authenticated;

-- Funciones públicas para la app.
grant execute on function public.sin_tildes(text) to authenticated, anon;
grant execute on function public.es_admin() to authenticated;
grant execute on function public.mover_oportunidad(uuid, uuid, double precision) to authenticated;
grant execute on function public.buscar(text) to authenticated;
grant execute on function public.recordatorios_pendientes_usuario() to authenticated;

-- RLS activa en todas las tablas.
alter table public.usuarios             enable row level security;
alter table public.etapas               enable row level security;
alter table public.motivos_perdida      enable row level security;
alter table public.origenes             enable row level security;
alter table public.configuracion        enable row level security;
alter table public.contactos            enable row level security;
alter table public.oportunidades        enable row level security;
alter table public.tareas               enable row level security;
alter table public.actividades          enable row level security;
alter table public.historial_etapas     enable row level security;
alter table public.importaciones        enable row level security;
alter table public.recordatorios_correo enable row level security;   -- sin políticas: nadie desde el cliente

-- usuarios: todos ven; cada uno edita el suyo (el trigger limita a nombre) o el admin; nadie borra.
create policy "usuarios: ver todos"
  on public.usuarios for select to authenticated
  using (true);

create policy "usuarios: editar el propio o admin"
  on public.usuarios for update to authenticated
  using (id = auth.uid() or public.es_admin())
  with check (id = auth.uid() or public.es_admin());

-- Catálogos y configuración: todos ven, solo el admin cambia.
create policy "etapas: ver todos"
  on public.etapas for select to authenticated using (true);
create policy "etapas: crear solo admin"
  on public.etapas for insert to authenticated with check (public.es_admin());
create policy "etapas: editar solo admin"
  on public.etapas for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "etapas: borrar solo admin"
  on public.etapas for delete to authenticated using (public.es_admin());

create policy "motivos_perdida: ver todos"
  on public.motivos_perdida for select to authenticated using (true);
create policy "motivos_perdida: crear solo admin"
  on public.motivos_perdida for insert to authenticated with check (public.es_admin());
create policy "motivos_perdida: editar solo admin"
  on public.motivos_perdida for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "motivos_perdida: borrar solo admin"
  on public.motivos_perdida for delete to authenticated using (public.es_admin());

create policy "origenes: ver todos"
  on public.origenes for select to authenticated using (true);
create policy "origenes: crear solo admin"
  on public.origenes for insert to authenticated with check (public.es_admin());
create policy "origenes: editar solo admin"
  on public.origenes for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "origenes: borrar solo admin"
  on public.origenes for delete to authenticated using (public.es_admin());

create policy "configuracion: ver todos"
  on public.configuracion for select to authenticated using (true);
create policy "configuracion: crear solo admin"
  on public.configuracion for insert to authenticated with check (public.es_admin());
create policy "configuracion: editar solo admin"
  on public.configuracion for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "configuracion: borrar solo admin"
  on public.configuracion for delete to authenticated using (public.es_admin());

-- contactos, oportunidades, tareas: todos ven; crea cualquiera como responsable
-- de sí mismo (el admin, de quien sea); edita y borra el responsable o el admin.
create policy "contactos: ver todos"
  on public.contactos for select to authenticated using (true);
create policy "contactos: crear como responsable propio o admin"
  on public.contactos for insert to authenticated
  with check (responsable_id = auth.uid() or public.es_admin());
create policy "contactos: editar el responsable o admin"
  on public.contactos for update to authenticated
  using (responsable_id = auth.uid() or public.es_admin())
  with check (responsable_id = auth.uid() or public.es_admin());
create policy "contactos: borrar el responsable o admin"
  on public.contactos for delete to authenticated
  using (responsable_id = auth.uid() or public.es_admin());

create policy "oportunidades: ver todos"
  on public.oportunidades for select to authenticated using (true);
create policy "oportunidades: crear como responsable propio o admin"
  on public.oportunidades for insert to authenticated
  with check (responsable_id = auth.uid() or public.es_admin());
create policy "oportunidades: editar el responsable o admin"
  on public.oportunidades for update to authenticated
  using (responsable_id = auth.uid() or public.es_admin())
  with check (responsable_id = auth.uid() or public.es_admin());
create policy "oportunidades: borrar el responsable o admin"
  on public.oportunidades for delete to authenticated
  using (responsable_id = auth.uid() or public.es_admin());

create policy "tareas: ver todos"
  on public.tareas for select to authenticated using (true);
create policy "tareas: crear como responsable propio o admin"
  on public.tareas for insert to authenticated
  with check (responsable_id = auth.uid() or public.es_admin());
create policy "tareas: editar el responsable o admin"
  on public.tareas for update to authenticated
  using (responsable_id = auth.uid() or public.es_admin())
  with check (responsable_id = auth.uid() or public.es_admin());
create policy "tareas: borrar el responsable o admin"
  on public.tareas for delete to authenticated
  using (responsable_id = auth.uid() or public.es_admin());

-- actividades: todos ven; cualquiera registra (sobre cualquier contacto) a su
-- nombre; edita y borra el autor o el admin.
create policy "actividades: ver todos"
  on public.actividades for select to authenticated using (true);
create policy "actividades: registrar a nombre propio o admin"
  on public.actividades for insert to authenticated
  with check (usuario_id = auth.uid() or public.es_admin());
create policy "actividades: editar el autor o admin"
  on public.actividades for update to authenticated
  using (usuario_id = auth.uid() or public.es_admin())
  with check (usuario_id = auth.uid() or public.es_admin());
create policy "actividades: borrar el autor o admin"
  on public.actividades for delete to authenticated
  using (usuario_id = auth.uid() or public.es_admin());

-- historial_etapas: solo lectura; lo escribe el trigger.
create policy "historial_etapas: ver todos"
  on public.historial_etapas for select to authenticated using (true);

-- importaciones: todos ven; solo el admin importa.
create policy "importaciones: ver todos"
  on public.importaciones for select to authenticated using (true);
create policy "importaciones: crear solo admin"
  on public.importaciones for insert to authenticated with check (public.es_admin());
create policy "importaciones: editar solo admin"
  on public.importaciones for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "importaciones: borrar solo admin"
  on public.importaciones for delete to authenticated using (public.es_admin());

-- -----------------------------------------------------------------------------
-- 12. Tiempo real (sección 7)
-- -----------------------------------------------------------------------------
-- replica identity full: los eventos DELETE llegan con la fila completa y los
-- UPDATE con los valores anteriores.
alter table public.contactos       replica identity full;
alter table public.oportunidades   replica identity full;
alter table public.tareas          replica identity full;
alter table public.actividades     replica identity full;
alter table public.etapas          replica identity full;
alter table public.motivos_perdida replica identity full;
alter table public.origenes        replica identity full;
alter table public.usuarios        replica identity full;
alter table public.configuracion   replica identity full;

-- Se añaden a la publicación solo si no estaban (por si se reaplica a mano).
do $$
declare
  v_tabla text;
begin
  foreach v_tabla in array array[
    'contactos', 'oportunidades', 'tareas', 'actividades', 'etapas',
    'motivos_perdida', 'origenes', 'usuarios', 'configuracion'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_tabla
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_tabla);
    end if;
  end loop;
end;
$$;

-- Fin de la migración 0001.
