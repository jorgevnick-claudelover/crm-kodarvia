-- =============================================================================
-- CRM Gestoría · Datos iniciales (catálogos de ejemplo y configuración)
-- Idempotente: cada catálogo solo se rellena si está vacío; la configuración
-- usa ON CONFLICT DO NOTHING. No crea usuarios (ver scripts/crear-usuarios.mjs).
-- Se ejecuta después de migrations/0001_init.sql.
-- =============================================================================

-- Etapas del embudo (el cliente las ajustará desde Configuración).
insert into public.etapas (nombre, orden, color)
select v.nombre, v.orden, v.color
  from (values
    ('Nuevo contacto',    1, 'sky'),
    ('Contactado',        2, 'indigo'),
    ('Reunión',           3, 'violet'),
    ('Propuesta enviada', 4, 'amber'),
    ('Negociación',       5, 'orange')
  ) as v (nombre, orden, color)
 where not exists (select 1 from public.etapas);

-- Motivos de pérdida.
insert into public.motivos_perdida (nombre, orden)
select v.nombre, v.orden
  from (values
    ('Precio',                  1),
    ('Sin respuesta',           2),
    ('Eligió otro proveedor',   3),
    ('No lo necesita ahora',    4),
    ('Fuera de zona',           5),
    ('Otro',                    6)
  ) as v (nombre, orden)
 where not exists (select 1 from public.motivos_perdida);

-- Orígenes de los contactos.
insert into public.origenes (nombre, orden)
select v.nombre, v.orden
  from (values
    ('Referido',         1),
    ('WhatsApp',         2),
    ('Redes sociales',   3),
    ('Web',              4),
    ('Llamada entrante', 5),
    ('Evento',           6),
    ('Otro',             7)
  ) as v (nombre, orden)
 where not exists (select 1 from public.origenes);

-- Configuración inicial (valores en jsonb).
insert into public.configuracion (clave, valor) values
  ('timezone',                   '"America/Lima"'::jsonb),
  ('moneda',                     '"PEN"'::jsonb),
  ('hora_recordatorio',          '"09:00"'::jsonb),
  ('importe_default',            '0'::jsonb),
  ('nombre_empresa',             '"Estudio contable"'::jsonb),
  ('titulo_oportunidad_default', '"Facturación electrónica"'::jsonb),
  ('url_app',                    '"https://crm.example.com"'::jsonb)
on conflict (clave) do nothing;
