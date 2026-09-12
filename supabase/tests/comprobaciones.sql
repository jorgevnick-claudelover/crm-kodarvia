-- =============================================================================
-- CRM Gestoría · Comprobaciones manuales tras aplicar la migración
--
-- Cómo usarlo: pegar el archivo completo en el SQL Editor de Supabase (o
-- ejecutarlo con psql) DESPUÉS de 0001_init.sql. Todo ocurre dentro de una
-- transacción que termina en ROLLBACK: no deja rastro (ni los usuarios de
-- prueba, ni contactos, ni recordatorios).
--
-- Cada comprobación escribe "OK ..." con RAISE NOTICE. Si algo falla, la
-- transacción aborta con el mensaje "FALLO ..." y nada queda guardado.
-- En el SQL Editor los NOTICE se ven en la pestaña de resultados/logs; en psql
-- salen directamente en pantalla.
-- =============================================================================

begin;

do $$
declare
  v_admin_id    uuid := gen_random_uuid();
  v_miembro_id  uuid := gen_random_uuid();
  v_etapa1      uuid;
  v_etapa2      uuid;
  v_motivo      uuid;
  v_contacto    uuid;
  v_contacto2   uuid;
  v_oportunidad uuid;
  v_tarea       uuid;
  v_rec         public.recordatorios_correo;
  v_n           int;
  v_texto       text;
  v_ts          timestamptz;
  v_bool        boolean;
begin
  -- ---------------------------------------------------------------------------
  -- Preparación: dos usuarios de prueba en auth.users (el trigger crea el perfil)
  -- y catálogos propios para no depender del seed.
  -- ---------------------------------------------------------------------------
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (v_admin_id,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'prueba-admin-' || v_admin_id::text || '@ejemplo.pe', extensions.crypt('prueba', extensions.gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"nombre":"Admin Prueba"}'::jsonb, now(), now()),
    (v_miembro_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'prueba-miembro-' || v_miembro_id::text || '@ejemplo.pe', extensions.crypt('prueba', extensions.gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"nombre":"Miembro Prueba"}'::jsonb, now(), now());

  select count(*) into v_n from public.usuarios where id in (v_admin_id, v_miembro_id);
  if v_n <> 2 then
    raise exception 'FALLO: el trigger de auth.users no creó los perfiles (creados: %)', v_n;
  end if;
  raise notice 'OK 1. El trigger de auth.users crea el perfil en usuarios (nombre desde metadata)';

  -- Forzamos roles (auth.uid() es null aquí, así que el trigger de protección no aplica).
  update public.usuarios set rol = 'admin',   activo = true where id = v_admin_id;
  update public.usuarios set rol = 'miembro', activo = true where id = v_miembro_id;

  insert into public.etapas (nombre, orden, color) values ('Prueba etapa 1', 901, 'sky') returning id into v_etapa1;
  insert into public.etapas (nombre, orden, color) values ('Prueba etapa 2', 902, 'indigo') returning id into v_etapa2;
  insert into public.motivos_perdida (nombre, orden) values ('Prueba motivo', 901) returning id into v_motivo;

  insert into public.contactos (nombre, empresa, telefono, responsable_id, created_by)
  values ('Zoraida Quispe Prueba', 'Panadería Ñusta', '+51987654321', v_miembro_id, v_miembro_id)
  returning id into v_contacto;

  insert into public.contactos (nombre, responsable_id, created_by)
  values ('Contacto del admin Prueba', v_admin_id, v_admin_id)
  returning id into v_contacto2;

  -- ---------------------------------------------------------------------------
  -- 2. Perder sin motivo falla (criterio 3, en base de datos)
  -- ---------------------------------------------------------------------------
  begin
    insert into public.oportunidades (contacto_id, titulo, etapa_id, estado, responsable_id)
    values (v_contacto, 'Sin motivo', v_etapa1, 'perdida', v_miembro_id);
    raise exception 'FALLO: se insertó una oportunidad perdida sin motivo';
  exception
    when check_violation then
      raise notice 'OK 2. Insertar una oportunidad perdida sin motivo falla (%)', sqlerrm;
  end;

  -- ---------------------------------------------------------------------------
  -- 3. Historial: fila inicial al crear y fila al mover de etapa
  -- ---------------------------------------------------------------------------
  insert into public.oportunidades (contacto_id, titulo, etapa_id, responsable_id, created_by)
  values (v_contacto, 'Oportunidad de prueba', v_etapa1, v_miembro_id, v_miembro_id)
  returning id into v_oportunidad;

  select count(*) into v_n from public.historial_etapas where oportunidad_id = v_oportunidad;
  if v_n <> 1 then
    raise exception 'FALLO: al crear la oportunidad debería haber 1 fila de historial y hay %', v_n;
  end if;

  perform public.mover_oportunidad(v_oportunidad, v_etapa2, 10);

  select count(*) into v_n
    from public.historial_etapas
   where oportunidad_id = v_oportunidad and de_etapa_id = v_etapa1 and a_etapa_id = v_etapa2;
  if v_n <> 1 then
    raise exception 'FALLO: mover de etapa no escribió el historial esperado';
  end if;
  raise notice 'OK 3. Crear y mover una oportunidad escribe historial_etapas';

  -- ---------------------------------------------------------------------------
  -- 4. Ganar fija ganada_at; perder exige motivo y fija perdida_at; reabrir limpia
  -- ---------------------------------------------------------------------------
  update public.oportunidades set estado = 'ganada' where id = v_oportunidad;
  select ganada_at into v_ts from public.oportunidades where id = v_oportunidad;
  if v_ts is null then
    raise exception 'FALLO: al ganar no se fijó ganada_at';
  end if;

  update public.oportunidades set estado = 'perdida', motivo_perdida_id = v_motivo, detalle_perdida = 'Prueba'
   where id = v_oportunidad;
  select perdida_at into v_ts from public.oportunidades where id = v_oportunidad;
  if v_ts is null then
    raise exception 'FALLO: al perder no se fijó perdida_at';
  end if;

  update public.oportunidades set estado = 'abierta' where id = v_oportunidad;
  select count(*) into v_n
    from public.oportunidades
   where id = v_oportunidad
     and motivo_perdida_id is null and detalle_perdida is null and ganada_at is null and perdida_at is null;
  if v_n <> 1 then
    raise exception 'FALLO: al reabrir no se limpiaron motivo, detalle y fechas';
  end if;

  select count(*) into v_n from public.historial_etapas where oportunidad_id = v_oportunidad;
  if v_n <> 5 then
    raise exception 'FALLO: se esperaban 5 filas de historial (crear, mover, ganar, perder, reabrir) y hay %', v_n;
  end if;
  raise notice 'OK 4. Ganar, perder y reabrir mantienen fechas, motivo e historial';

  -- ---------------------------------------------------------------------------
  -- 5. Tarea con recordatorio -> fila pendiente en recordatorios_correo
  -- ---------------------------------------------------------------------------
  insert into public.tareas (contacto_id, oportunidad_id, titulo, vence_at, recordatorio_at, responsable_id, created_by)
  values (v_contacto, v_oportunidad, 'Llamar a Zoraida', now() - interval '1 minute', now() - interval '1 minute', v_miembro_id, v_miembro_id)
  returning id into v_tarea;

  select * into v_rec from public.recordatorios_correo where tarea_id = v_tarea;
  if not found then
    raise exception 'FALLO: crear una tarea con recordatorio no creó la fila en recordatorios_correo';
  end if;
  if v_rec.estado <> 'pendiente' or v_rec.intentos <> 0 then
    raise exception 'FALLO: la fila nueva debería estar pendiente con 0 intentos (estado %, intentos %)', v_rec.estado, v_rec.intentos;
  end if;
  if v_rec.email not like 'prueba-miembro-%' then
    raise exception 'FALLO: el correo del recordatorio no es el del responsable (%)', v_rec.email;
  end if;
  if v_rec.asunto <> 'Recordatorio: Llamar a Zoraida' then
    raise exception 'FALLO: asunto inesperado: %', v_rec.asunto;
  end if;
  if v_rec.enviar_local not like '____-__-__ __:__ America/Lima' then
    raise exception 'FALLO: enviar_local con formato inesperado: %', v_rec.enviar_local;
  end if;
  if v_rec.url not like '%/tareas/' || v_tarea::text then
    raise exception 'FALLO: url inesperada: %', v_rec.url;
  end if;
  if position('Zoraida Quispe Prueba (Panadería Ñusta)' in v_rec.cuerpo) = 0 then
    raise exception 'FALLO: el cuerpo no menciona al contacto: %', v_rec.cuerpo;
  end if;
  raise notice 'OK 5. Crear una tarea con recordatorio encola el correo (% -> %)', v_rec.email, v_rec.enviar_local;

  -- ---------------------------------------------------------------------------
  -- 6. Reclamar y confirmar (lo que hará Kodarvia)
  -- ---------------------------------------------------------------------------
  select count(*) into v_n from public.reclamar_recordatorios(10) r where r.tarea_id = v_tarea;
  if v_n <> 1 then
    raise exception 'FALLO: reclamar_recordatorios no devolvió el recordatorio vencido';
  end if;
  select * into v_rec from public.recordatorios_correo where tarea_id = v_tarea;
  if v_rec.estado <> 'enviando' or v_rec.intentos <> 1 or v_rec.bloqueado_hasta is null then
    raise exception 'FALLO: tras reclamar debería estar enviando, 1 intento y bloqueado (estado %, intentos %)', v_rec.estado, v_rec.intentos;
  end if;

  -- Reclamar de nuevo no lo devuelve (está bloqueado).
  select count(*) into v_n from public.reclamar_recordatorios(10) r where r.tarea_id = v_tarea;
  if v_n <> 0 then
    raise exception 'FALLO: un recordatorio en envío no debería reclamarse dos veces';
  end if;

  v_bool := public.marcar_recordatorio(v_rec.id, 'error', 'SMTP caído (prueba)');
  select * into v_rec from public.recordatorios_correo where tarea_id = v_tarea;
  if not v_bool or v_rec.estado <> 'error' or v_rec.ultimo_error is null or v_rec.bloqueado_hasta <= now() then
    raise exception 'FALLO: marcar error no dejó la fila en error con bloqueo';
  end if;

  -- Simulamos que pasó el bloqueo y reclamamos otra vez.
  update public.recordatorios_correo set bloqueado_hasta = now() - interval '1 second' where id = v_rec.id;
  select count(*) into v_n from public.reclamar_recordatorios(10) r where r.tarea_id = v_tarea;
  if v_n <> 1 then
    raise exception 'FALLO: un recordatorio en error con el bloqueo vencido debería reclamarse';
  end if;

  v_bool := public.marcar_recordatorio(v_rec.id, 'enviado');
  select * into v_rec from public.recordatorios_correo where tarea_id = v_tarea;
  if not v_bool or v_rec.estado <> 'enviado' or v_rec.enviado_at is null or v_rec.intentos <> 2 then
    raise exception 'FALLO: marcar enviado no dejó la fila como enviada (estado %, intentos %)', v_rec.estado, v_rec.intentos;
  end if;
  raise notice 'OK 6. reclamar_recordatorios y marcar_recordatorio (error, reintento, enviado) funcionan';

  -- ---------------------------------------------------------------------------
  -- 7. Cambiar la hora de una tarea ya enviada la vuelve a encolar; completarla la cancela
  -- ---------------------------------------------------------------------------
  update public.tareas set recordatorio_at = now() + interval '1 hour' where id = v_tarea;
  select * into v_rec from public.recordatorios_correo where tarea_id = v_tarea;
  if v_rec.estado <> 'pendiente' or v_rec.intentos <> 0 or v_rec.enviado_at is not null then
    raise exception 'FALLO: cambiar la hora de un recordatorio enviado debería dejarlo pendiente con 0 intentos';
  end if;

  update public.tareas set estado = 'hecha', hecha_at = now() where id = v_tarea;
  select * into v_rec from public.recordatorios_correo where tarea_id = v_tarea;
  if v_rec.estado <> 'cancelado' then
    raise exception 'FALLO: completar la tarea debería cancelar el recordatorio (estado %)', v_rec.estado;
  end if;

  -- Reabrir la tarea lo vuelve a programar.
  update public.tareas set estado = 'pendiente', hecha_at = null where id = v_tarea;
  select * into v_rec from public.recordatorios_correo where tarea_id = v_tarea;
  if v_rec.estado <> 'pendiente' then
    raise exception 'FALLO: reabrir la tarea debería volver a programar el recordatorio (estado %)', v_rec.estado;
  end if;

  -- Quitar el recordatorio lo cancela.
  update public.tareas set recordatorio_at = null where id = v_tarea;
  select * into v_rec from public.recordatorios_correo where tarea_id = v_tarea;
  if v_rec.estado <> 'cancelado' then
    raise exception 'FALLO: quitar recordatorio_at debería cancelar el recordatorio (estado %)', v_rec.estado;
  end if;
  raise notice 'OK 7. Completar, reabrir y quitar la hora sincronizan la cola';

  -- ---------------------------------------------------------------------------
  -- 8. Actividad -> ultima_actividad_at del contacto
  -- ---------------------------------------------------------------------------
  insert into public.actividades (contacto_id, oportunidad_id, tipo, resultado, nota, usuario_id)
  values (v_contacto, v_oportunidad, 'llamada', 'contesto', 'Interesada en facturación', v_miembro_id);
  select ultima_actividad_at into v_ts from public.contactos where id = v_contacto;
  if v_ts is null then
    raise exception 'FALLO: registrar una actividad no actualizó ultima_actividad_at';
  end if;
  raise notice 'OK 8. Registrar una actividad actualiza ultima_actividad_at';

  -- ---------------------------------------------------------------------------
  -- 9. buscar(): sin tildes ni mayúsculas, y con texto sin resultados
  -- ---------------------------------------------------------------------------
  select count(*) into v_n from public.buscar('x');
  raise notice 'OK 9a. buscar(''x'') se ejecuta y devuelve % filas', v_n;

  select count(*) into v_n from public.buscar('panaderia nusta') b where b.tipo = 'contacto' and b.id = v_contacto;
  if v_n <> 1 then
    raise exception 'FALLO: buscar(''panaderia nusta'') no encontró a "Panadería Ñusta" (sin tildes)';
  end if;
  select count(*) into v_n from public.buscar('FACTURACION') b where b.tipo = 'actividad';
  if v_n < 1 then
    raise exception 'FALLO: buscar(''FACTURACION'') no encontró la actividad';
  end if;
  select count(*) into v_n from public.buscar('987654321') b where b.tipo = 'contacto';
  if v_n < 1 then
    raise exception 'FALLO: buscar por teléfono no encontró el contacto';
  end if;
  select count(*) into v_n from public.buscar('');
  if v_n <> 0 then
    raise exception 'FALLO: buscar('''') debería devolver 0 filas';
  end if;
  raise notice 'OK 9b. buscar() ignora tildes y mayúsculas, busca por teléfono y devuelve nada con texto vacío';

  -- ---------------------------------------------------------------------------
  -- 10. Permisos: como miembro (RLS + triggers)
  -- ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_miembro_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  if auth.uid() is distinct from v_miembro_id then
    raise exception 'FALLO: no se pudo simular la sesión del miembro (auth.uid() = %)', auth.uid();
  end if;
  if public.es_admin() then
    raise exception 'FALLO: es_admin() devolvió true para un miembro';
  end if;

  -- 10a. Un miembro no puede reasignar su propio contacto.
  begin
    update public.contactos set responsable_id = v_admin_id where id = v_contacto;
    raise exception 'FALLO: un miembro pudo reasignar un contacto';
  exception
    when insufficient_privilege then
      raise notice 'OK 10a. Un miembro no puede reasignar (%)', sqlerrm;
  end;

  -- 10b. Un miembro no puede editar el contacto de otro (la RLS no afecta filas).
  update public.contactos set notas = 'intento' where id = v_contacto2;
  get diagnostics v_n = row_count;
  if v_n <> 0 then
    raise exception 'FALLO: un miembro editó el contacto de otro usuario';
  end if;
  -- ...pero sí lo ve.
  select count(*) into v_n from public.contactos where id = v_contacto2;
  if v_n <> 1 then
    raise exception 'FALLO: un miembro no ve el contacto de otro usuario';
  end if;
  raise notice 'OK 10b. Un miembro ve pero no edita los contactos ajenos';

  -- 10c. Un miembro sí registra actividad sobre un contacto ajeno.
  insert into public.actividades (contacto_id, tipo, nota) values (v_contacto2, 'nota', 'Nota sobre contacto ajeno');
  raise notice 'OK 10c. Un miembro registra actividad sobre contactos ajenos';

  -- 10d. Un miembro no puede crear una tarea a nombre de otro.
  begin
    insert into public.tareas (contacto_id, titulo, vence_at, responsable_id)
    values (v_contacto, 'Tarea ajena', now(), v_admin_id);
    raise exception 'FALLO: un miembro creó una tarea asignada a otro usuario';
  exception
    when insufficient_privilege then
      raise notice 'OK 10d. Un miembro no puede crear tareas a nombre de otro (RLS)';
  end;

  -- 10e. Un miembro no cambia su rol, pero sí su nombre.
  begin
    update public.usuarios set rol = 'admin' where id = v_miembro_id;
    raise exception 'FALLO: un miembro se hizo admin';
  exception
    when insufficient_privilege then
      raise notice 'OK 10e. Un miembro no puede cambiar su rol';
  end;
  update public.usuarios set nombre = 'Miembro Renombrado' where id = v_miembro_id;
  select nombre into v_texto from public.usuarios where id = v_miembro_id;
  if v_texto <> 'Miembro Renombrado' then
    raise exception 'FALLO: un miembro no pudo cambiar su nombre';
  end if;

  -- 10f. Un miembro no toca los catálogos.
  begin
    insert into public.etapas (nombre, orden) values ('Etapa intrusa', 999);
    raise exception 'FALLO: un miembro insertó una etapa';
  exception
    when insufficient_privilege then
      raise notice 'OK 10f. Un miembro no puede crear etapas (%)', sqlerrm;
  end;

  execute 'reset role';

  raise notice '---------------------------------------------------------------';
  raise notice 'Todas las comprobaciones pasaron. La transacción se revierte.';
end;
$$;

-- No dejamos nada: usuarios de prueba, catálogos y datos desaparecen.
rollback;
