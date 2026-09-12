# Arquitectura del CRM para la gestoría (Arequipa)

Este documento es el contrato de diseño. Todo el código debe ajustarse a él. Si algo aquí resulta imposible o contradictorio al implementarlo, se anota en `docs/DECISIONES.md` con el porqué y se elige la salida más simple que siga cumpliendo los 8 criterios de aceptación.

## 1. Qué construimos y para quién

CRM muy simple para un estudio contable de facturación electrónica en Arequipa (Perú). Hasta 5 usuarios con poca costumbre digital y mucha prisa. Móvil primero; el administrador usa además el tablero en escritorio.

Criterios de aceptación que revisará Kodarvia:

1. Crear un contacto y una oportunidad tarda menos de un minuto desde el celular.
2. Mover una oportunidad de etapa se refleja al instante para todos (menos de 3 s, sin recargar).
3. Perder una oportunidad exige motivo (validado en base de datos, no solo en la interfaz).
4. El recordatorio de una tarea queda programado y visible en la app para su responsable a la hora fijada. El correo lo envía Kodarvia leyendo nuestra cola.
5. Cada usuario edita solo lo suyo; el administrador edita todo. Todos ven todo.
6. La importación carga la hoja del cliente sin perder filas (toda fila no vacía acaba en el CRM, con informe).
7. La exportación a CSV respeta los filtros aplicados en pantalla.
8. Repositorio en GitHub con URL de previsualización funcionando.

Fuera de alcance: integraciones, automatizaciones de marketing, facturación, documentos adjuntos.

## 2. Stack

- Vite 7 + React 19 + TypeScript estricto. Alias `@/` → `src/`.
- Tailwind CSS v4 (plugin `@tailwindcss/vite`) + shadcn/ui (estilo por defecto, color base neutral). Componentes shadcn en `src/components/ui`.
- React Router 7 (modo declarativo, `BrowserRouter`).
- TanStack Query 5 para datos remotos. Persistencia de caché en localStorage solo para arranque rápido; la fuente de verdad es Supabase.
- supabase-js 2: Auth (correo y contraseña), Postgres con RLS, Realtime.
- dnd-kit (tablero en escritorio), papaparse + xlsx (importar y exportar), recharts (panel), date-fns + date-fns-tz (fechas), zod (validación), sonner (toasts), lucide-react (iconos).
- PWA instalable con vite-plugin-pwa (ya configurado en `vite.config.ts`).
- Hosting: Cloudflare Pages (SPA, archivo `public/_redirects` con `/* /index.html 200`). Vercel Hobby queda descartado por uso comercial.
- Pruebas: vitest para utilidades puras (teléfono, CSV, mapeo de importación, cálculo de embudo).

Idioma de la interfaz: español de Perú. Vocabulario: "celular" (no móvil), "computadora", "independiente" (no autónomo), "estudio contable", "oportunidad", "etapa", "responsable" (persona asignada), "administrador" (jefe que ve y edita todo). Moneda: soles, símbolo `S/`, dos decimales, separador de miles con coma (`S/ 1,250.00`). Zona horaria fija `America/Lima` leída de configuración, nunca del navegador.

## 3. Estructura de carpetas

```
src/
  main.tsx  App.tsx (router y proveedores)  index.css
  lib/
    supabase.ts            cliente supabase (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
    types.ts               tipos TS de todas las tablas y enums (espejo de la migración)
    fetchAll.ts            pagina .range() de 1000 en 1000 hasta traer todo
    api/                   una función por operación, tipadas; nada de supabase-js fuera de aquí
      contactos.ts oportunidades.ts tareas.ts actividades.ts catalogos.ts usuarios.ts buscar.ts importaciones.ts configuracion.ts
    utils/
      cn.ts fechas.ts (Lima) telefono.ts (normalizar +51) moneda.ts csv.ts (BOM, comillas, anti-fórmulas) texto.ts (sin tildes)
  hooks/
    useSesion.ts useUsuarioActual.ts (perfil + esAdmin) useRealtime.ts useEsMovil.ts useFiltrosURL.ts useCatalogos.ts useConfiguracion.ts
  components/
    ui/                    shadcn
    layout/                AppShell, BarraInferior, BotonMas (FAB), BarraLateral, Cabecera, RequiereSesion, RequiereAdmin
    comunes/               SelectorContacto, ChipsFecha, ChipsEtapa, AvatarUsuario, Importe, EnlaceTelefono, Vacio, Cargando, BotonExportar
  features/
    auth/        PaginaLogin
    hoy/         PaginaHoy (tareas vencidas, de hoy, próximas; recordatorios)
    contactos/   PaginaContactos, PaginaContacto, FormularioContacto (sheet), ListaContactos
    oportunidades/ PaginaOportunidades (lista por etapa en móvil, kanban en escritorio), PaginaOportunidad, FormularioOportunidad, Tablero, ModalPerder, ModalGanar, SheetMoverA
    tareas/      PaginaTareas, FormularioTarea
    actividades/ FormularioActividad (sheet de registro rápido), ListaActividades
    buscar/      PaginaBuscar
    panel/       PaginaPanel
    importar/    PaginaImportar (asistente)
    configuracion/ PaginaConfiguracion (etapas, motivos, orígenes, usuarios, valores por defecto)
    ayuda/       PaginaAyuda (guía de una página)
supabase/
  migrations/0001_init.sql   esquema, RLS, triggers, funciones, realtime
  seed.sql                   catálogos de ejemplo y configuración inicial
  functions/recordatorios/index.ts   Edge Function para Kodarvia (consulta y confirmación)
docs/
  ARQUITECTURA.md (este) DECISIONES.md CONTRATO-RECORDATORIOS.md GUIA.md ACEPTACION.md
scripts/
  crear-usuarios.mjs         crea los usuarios en Supabase Auth con la clave de servicio (la ejecuta el desarrollador)
public/
  _redirects favicon.svg icons/icon-192.png icons/icon-512.png logo.svg (provisional)
```

## 4. Modelo de datos (Postgres, esquema `public`)

Nombres en español, snake_case. Todos los `timestamptz` en UTC. Toda tabla de negocio lleva `created_at timestamptz default now()` y `updated_at` mantenido por trigger. Los `id` son `uuid default gen_random_uuid()`.

### usuarios
Perfil sobre `auth.users`. Se crea por trigger al registrarse un usuario en Auth. El primer usuario creado es `admin`.

```
id uuid pk references auth.users(id) on delete cascade
nombre text not null
email text not null unique
rol text not null default 'miembro' check (rol in ('admin','miembro'))
activo boolean not null default true
created_at, updated_at
```

### etapas (columnas del tablero, solo etapas abiertas)
```
id uuid pk, nombre text not null, orden int not null, color text not null default 'slate',
activa boolean not null default true, created_at, updated_at
```
Ganada y Perdida no son etapas: son `estado` de la oportunidad. No se borran etapas con historial; se desactivan.

### motivos_perdida
```
id uuid pk, nombre text not null, orden int not null, activo boolean not null default true, created_at, updated_at
```

### origenes (de dónde viene el contacto)
```
id uuid pk, nombre text not null, orden int not null, activo boolean not null default true, created_at, updated_at
```

### contactos
```
id uuid pk
nombre text not null
empresa text
doc_tipo text check (doc_tipo in ('DNI','RUC','CE'))
doc_numero text
telefono text            -- normalizado E.164 (+51987654321) cuando se puede
telefono_raw text        -- como llegó
email text
direccion text
origen_id uuid references origenes
responsable_id uuid not null references usuarios default auth.uid()
notas text
extra jsonb not null default '{}'      -- columnas de la hoja no mapeadas
importacion_id uuid references importaciones
fila_origen int
requiere_revision boolean not null default false
ultima_actividad_at timestamptz
created_by uuid references usuarios default auth.uid()
created_at, updated_at
```
Índices: `telefono`, `email`, `doc_numero`, `responsable_id`, y GIN trigram sobre `unaccent(nombre || ' ' || coalesce(empresa,''))`.

### oportunidades
```
id uuid pk
contacto_id uuid not null references contactos on delete cascade
titulo text not null
importe numeric(12,2) not null default 0
moneda char(3) not null default 'PEN'
etapa_id uuid not null references etapas     -- última etapa abierta; se conserva al ganar o perder
estado text not null default 'abierta' check (estado in ('abierta','ganada','perdida'))
posicion double precision not null default 0  -- orden dentro de la columna
responsable_id uuid not null references usuarios default auth.uid()
motivo_perdida_id uuid references motivos_perdida
detalle_perdida text
fecha_cierre_prevista date
ganada_at timestamptz
perdida_at timestamptz
created_by uuid references usuarios default auth.uid()
created_at, updated_at
check ((estado = 'perdida') = (motivo_perdida_id is not null))   -- criterio 3 en BD
check (estado <> 'ganada' or ganada_at is not null)
check (estado <> 'perdida' or perdida_at is not null)
```

### historial_etapas (base del embudo; lo escribe un trigger)
```
id bigint generated always as identity pk
oportunidad_id uuid not null references oportunidades on delete cascade
de_etapa_id uuid references etapas, a_etapa_id uuid references etapas
de_estado text, a_estado text not null
usuario_id uuid references usuarios
created_at timestamptz not null default now()
```
Trigger AFTER INSERT (fila inicial con `de_etapa_id` null) y AFTER UPDATE cuando cambian `etapa_id` o `estado`.

### tareas
```
id uuid pk
contacto_id uuid references contactos on delete cascade
oportunidad_id uuid references oportunidades on delete set null
titulo text not null
vence_at timestamptz not null
recordatorio_at timestamptz              -- por defecto igual a vence_at
responsable_id uuid not null references usuarios default auth.uid()
estado text not null default 'pendiente' check (estado in ('pendiente','hecha'))
hecha_at timestamptz
recordatorio_visto_at timestamptz
created_by uuid references usuarios default auth.uid()
created_at, updated_at
```

### recordatorios_correo (cola para Kodarvia; sin acceso desde el cliente)
```
id uuid pk
tarea_id uuid not null unique references tareas on delete cascade
usuario_id uuid not null references usuarios
email text not null
enviar_at timestamptz not null
enviar_local text not null           -- '2026-09-15 09:00 America/Lima', informativo
asunto text not null
cuerpo text not null
url text not null
estado text not null default 'pendiente' check (estado in ('pendiente','enviando','enviado','error','cancelado'))
intentos int not null default 0
bloqueado_hasta timestamptz
enviado_at timestamptz
ultimo_error text
created_at, updated_at
```
Trigger sobre `tareas`: al insertar o actualizar una tarea pendiente con `recordatorio_at`, upsert de la fila en estado `pendiente` (si ya estaba `enviado` y cambia la hora, se crea de nuevo como pendiente). Si la tarea pasa a `hecha` o pierde `recordatorio_at`, la fila pasa a `cancelado`.

### actividades
```
id uuid pk
contacto_id uuid not null references contactos on delete cascade
oportunidad_id uuid references oportunidades on delete set null
tipo text not null check (tipo in ('llamada','whatsapp','correo','reunion','nota'))
resultado text          -- 'contesto','no_contesto','volver_a_llamar','interesado','no_interesado' o null
nota text
ocurrio_at timestamptz not null default now()
usuario_id uuid not null references usuarios default auth.uid()
created_at
```
Trigger: actualiza `contactos.ultima_actividad_at`.

### importaciones
```
id uuid pk
archivo text not null, hoja text
mapeo jsonb not null default '{}'
total_filas int not null default 0, filas_no_vacias int not null default 0
creadas int not null default 0, fusionadas int not null default 0, para_revisar int not null default 0
informe jsonb not null default '[]'    -- [{fila, resultado:'creado'|'fusionado'|'revisar', motivo, contacto_id}]
usuario_id uuid not null references usuarios default auth.uid()
created_at
```

### configuracion
```
clave text pk, valor jsonb not null, updated_at
```
Claves: `timezone` ("America/Lima"), `moneda` ("PEN"), `hora_recordatorio` ("09:00"), `importe_default` (0), `nombre_empresa`, `titulo_oportunidad_default` ("Facturación electrónica"), `url_app` (para los enlaces de los correos).

## 5. Reglas en base de datos (triggers y funciones)

- `set_updated_at()` en todas las tablas con `updated_at`.
- `crear_usuario_desde_auth()` AFTER INSERT en `auth.users`: inserta en `usuarios` con `nombre` = `raw_user_meta_data->>'nombre'` o la parte local del correo; `rol = 'admin'` si la tabla está vacía.
- `es_admin()` `security definer stable`: devuelve si `auth.uid()` es admin activo.
- `proteger_reasignacion()` BEFORE UPDATE en contactos, oportunidades y tareas: si cambia `responsable_id` y el usuario no es admin, error `'Solo el administrador puede reasignar'`.
- `registrar_historial_etapas()` en oportunidades (ver arriba). Al pasar a `ganada` fija `ganada_at = now()` si es null; al pasar a `perdida`, `perdida_at`. Al volver a `abierta`, limpia `motivo_perdida_id`, `detalle_perdida`, `ganada_at`, `perdida_at`.
- `sincronizar_recordatorio()` en tareas (ver arriba). Construye `asunto` = `Recordatorio: {titulo}`, `cuerpo` con contacto, hora en Lima y enlace `{url_app}/tareas/{id}`.
- `actualizar_ultima_actividad()` en actividades.
- `mover_oportunidad(p_id uuid, p_etapa_id uuid, p_posicion double precision)`: actualiza etapa y posición en una transacción (el historial lo escribe el trigger).
- `buscar(q text)` `security invoker`: devuelve `(tipo text, id uuid, titulo text, subtitulo text, contacto_id uuid, fecha timestamptz)` uniendo contactos (nombre, empresa, teléfono, correo, documento), oportunidades (título), actividades (nota) y tareas (título), usando `unaccent(...) ilike unaccent('%q%')`, máximo 50 filas.
- `reclamar_recordatorios(p_limite int)` y `marcar_recordatorio(p_id uuid, p_estado text, p_error text)` `security definer`, ejecutables solo por `service_role` (revocar de `anon` y `authenticated`). Ver `docs/CONTRATO-RECORDATORIOS.md`.
- `recordatorios_pendientes_usuario()` vista o función: tareas pendientes del usuario actual con `recordatorio_at <= now()` y `recordatorio_visto_at is null`.

Extensiones: `pgcrypto`, `pg_trgm`, `unaccent`.

## 6. Permisos (RLS activo en todas las tablas)

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| usuarios | autenticado | (trigger) | propio (solo `nombre`) o admin | nadie |
| etapas, motivos_perdida, origenes, configuracion | autenticado | admin | admin | admin |
| contactos, oportunidades, tareas | autenticado | autenticado (`responsable_id` = self salvo admin) | `responsable_id = auth.uid()` o admin | idem |
| actividades | autenticado | autenticado (sobre cualquier contacto) | `usuario_id = auth.uid()` o admin | idem |
| historial_etapas | autenticado | (trigger) | nadie | nadie |
| importaciones | autenticado | admin | admin | admin |
| recordatorios_correo | nadie desde cliente | (trigger) | (funciones) | (funciones) |

"Lo suyo" = registros donde soy `responsable_id` (o `usuario_id` en actividades). Cualquier miembro puede registrar actividad y crear tareas sobre contactos ajenos (cubre vacaciones). Solo el admin reasigna, importa, configura catálogos y gestiona usuarios.

## 7. Tiempo real

`useRealtime()` en `AppShell`: un canal `postgres_changes` sobre `contactos`, `oportunidades`, `tareas`, `actividades`, `etapas`, `motivos_perdida`, `origenes`, `usuarios`, `configuracion`. Cada evento invalida las consultas de esa entidad (`queryClient.invalidateQueries({ queryKey: [tabla] })`). Respaldo: `refetchOnWindowFocus: true` y `refetchInterval: 30000` mientras el canal no esté `SUBSCRIBED`. Mover una tarjeta aplica actualización optimista y se revierte con toast si falla. Publicación realtime en la migración: `alter publication supabase_realtime add table ...`.

## 8. Claves de consulta (TanStack Query)

`['contactos', filtros]`, `['contactos', id]`, `['oportunidades', filtros]`, `['oportunidades', id]`, `['tareas', filtros]`, `['actividades', { contactoId }]`, `['etapas']`, `['motivos_perdida']`, `['origenes']`, `['usuarios']`, `['configuracion']`, `['buscar', q]`, `['historial_etapas', rango]`, `['importaciones']`. Invalidar por el primer elemento.

## 9. Navegación y pantallas

Móvil (menos de 768 px): barra inferior con **Hoy · Contactos · Oportunidades · Buscar · Más** y botón flotante **+** siempre visible. "Más" abre Panel, Tareas, Configuración (solo admin), Importar (solo admin), Ayuda, Cerrar sesión.
Escritorio: barra lateral con Hoy, Contactos, Oportunidades (tablero), Tareas, Panel, Buscar, Importar, Configuración, Ayuda.

Rutas: `/login`, `/` (Hoy), `/contactos`, `/contactos/:id`, `/oportunidades`, `/oportunidades/:id`, `/tareas`, `/tareas/:id` (abre la tarea en un sheet sobre la lista), `/buscar`, `/panel`, `/importar`, `/configuracion`, `/ayuda`. Todo menos `/login` exige sesión.

Botón **+** abre un sheet con seis botones grandes: **Llamada · WhatsApp · Reunión · Nota · Tarea · Nuevo contacto**. Los cuatro primeros abren `FormularioActividad` con ese tipo.

### Principios de velocidad (criterio 1)
- Un solo campo obligatorio por formulario: `nombre` en contacto; contacto en actividad; `titulo` en tarea (con valor por defecto).
- Valores por defecto: responsable = yo; origen = el último usado por mí (localStorage); etapa = la primera; importe = `importe_default`; título de oportunidad = `{nombre del contacto} – {titulo_oportunidad_default}`; hora de recordatorio = `hora_recordatorio`.
- Chips en vez de selectores: origen, tipo de actividad, resultado, fecha de tarea (**Hoy · Mañana · En 3 días · Próx. semana · Elegir**), etapa.
- `SelectorContacto`: muestra los 5 contactos recientes del usuario antes de escribir; autocompleta por nombre, teléfono, empresa o documento a partir de 2 letras; opción "Crear «Juan»" al final.
- Inputs de 16 px (evita zoom en iOS), `inputmode="tel"` y `"decimal"`, `enterkeyhint`, objetivos táctiles de 44 px o más. Botón Guardar en la cabecera y fijo abajo.
- Guardado optimista con toast "Guardado" y "Deshacer" (5 s) en mover etapa, completar tarea y perder.
- Sheets (drawer inferior) en móvil, diálogos en escritorio. Nunca dos modales apilados.
- Sesión persistente. La app arranca con la caché de la última sesión mientras refresca.

### Formulario de contacto (`FormularioContacto`)
Nombre (foco automático, aviso de posibles duplicados debajo mientras se escribe) · Teléfono · Origen (chips) · Responsable (solo admin puede cambiarlo) · "Más datos" colapsado: empresa, RUC/DNI, correo, dirección, notas · Bloque **Oportunidad** con interruptor activado por defecto: título autogenerado editable, importe con prefijo `S/`, etapa la primera. Guardar crea contacto y oportunidad en dos inserciones seguidas y abre la ficha.

### Formulario de actividad (`FormularioActividad`)
Contacto (`SelectorContacto`, obligatorio) · Oportunidad (automática: la única abierta; chips si hay varias; oculto si ninguna) · Tipo (chips, preseleccionado) · Resultado (chips opcionales) · Nota (2 líneas) · **Próximo paso** (chips de fecha; un toque crea la tarea "Llamar a {contacto}" a la hora por defecto asignada a mí con recordatorio) · Guardar. Al guardar, si el contacto queda sin tarea pendiente, el toast ofrece "Añadir próximo paso".

### Ficha de contacto (`PaginaContacto`)
Cabecera con nombre, empresa, chips de teléfono (`tel:`) y WhatsApp (`https://wa.me/51…`), correo, origen, responsable, indicador "sin seguimiento" si no tiene tarea pendiente. Acciones rápidas: Llamada · WhatsApp · Nota · Tarea. Pestañas o secciones: Oportunidades (con botón nueva), Tareas pendientes, Actividad (línea de tiempo con tipo, resultado, nota, usuario, hora en Lima). Editar (si es mío o soy admin).

### Oportunidades
- Móvil: chips de etapas con contador arriba (más "Ganadas" y "Perdidas"), lista de tarjetas de la etapa elegida. Tarjeta: contacto, título, importe, avatar del responsable, días en etapa, punto rojo si tarea vencida, punto ámbar si sin tarea pendiente. Botón **Mover a** abre sheet con etapas (la siguiente destacada) y al final **Ganada** y **Perdida**.
- Escritorio: tablero dnd-kit (`PointerSensor` distancia 5 px; `TouchSensor` con retardo 200 ms como extra). Columnas = etapas activas, con contador y suma `S/`. Dos zonas de soltar al final: **Ganada** (verde) y **Perdida** (rojo). Pie: "Cerradas este mes: N ganadas (S/ X) · M perdidas". Filtros arriba: responsable, origen, texto, sin seguimiento, con tarea vencida.
- Soltar en Perdida o elegir Perdida abre `ModalPerder`: motivo (obligatorio, lista de `motivos_perdida` activos) + detalle opcional; Cancelar devuelve la tarjeta. Ganar abre `ModalGanar` con el importe editable (prefijo `S/`) y confirmar.
- Detalle (`PaginaOportunidad`): stepper de etapas (tocar mueve), estado, importe, contacto (enlace), responsable, fecha prevista, tareas, actividad, historial de etapas, botones Ganar / Perder / Reabrir.

### Tareas y Hoy
- `PaginaHoy`: bloques **Vencidas**, **Hoy**, **Próximos 7 días**, cada tarea con contacto, hora en Lima, botones Hecha, Llamar, WhatsApp. Arriba, tarjeta de recordatorios activos (tareas con `recordatorio_at <= ahora` y no vistas) con botón "Visto". Filtro Mías / Todas (por defecto Mías; el admin ve Todas por defecto).
- Aviso a la hora fijada: `useRecordatorios()` consulta cada 30 s y escucha realtime; cuando un recordatorio vence mientras la app está abierta, muestra un toast persistente con la tarea y marca el badge de Hoy. Las tareas vencidas no vistas siguen listadas hasta marcarlas.
- `FormularioTarea`: título (por defecto "Llamar a {contacto}"), contacto (opcional), fecha (chips + selector), hora (por defecto `hora_recordatorio`), recordatorio (interruptor, por defecto activado a la misma hora), responsable (admin puede cambiar).
- `PaginaTareas`: lista con filtros (estado, responsable, rango de fechas, texto) y exportación.

### Búsqueda global
`PaginaBuscar`: campo con foco automático, resultados agrupados (Contactos, Oportunidades, Tareas, Actividades) desde `buscar(q)`, con debounce de 250 ms. La lupa de la cabecera lleva aquí.

### Panel (`PaginaPanel`)
Filtros: rango de fechas (por defecto últimos 6 meses) y responsable. Todo se calcula en el cliente a partir de `fetchAll` de oportunidades, tareas e historial del rango, con fechas en Lima.
- Tarjetas: Abiertas (n y S/), Ganado este mes (S/), Perdidas este mes, Tareas vencidas, Contactos sin seguimiento.
- Barras apiladas: oportunidades abiertas por etapa y responsable (n y S/).
- Barras: ganado por mes (suma de `importe` de oportunidades con `ganada_at` en el mes, hora Lima), últimos 6 o 12 meses.
- Embudo mensual: para el mes elegido, cohorte de oportunidades creadas en ese mes; por cada etapa en orden, cuántas la alcanzaron (según `historial_etapas`, alcance implícito: llegar a la etapa 3 cuenta también la 1 y la 2) y conversión etapa a etapa; al final Ganadas y Perdidas de la cohorte.
- Tabla: perdidas por motivo en el rango.
- Lista: tareas vencidas por responsable.

### Importación (`PaginaImportar`, solo admin)
Paso 1: subir `.xlsx`, `.xls` o `.csv`; elegir hoja si hay varias; detectar fila de cabecera (primera fila con 2 o más celdas de texto). Paso 2: mapeo de columnas con sugerencia automática por similitud (nombre, empresa, teléfono, correo, documento, origen, responsable, notas, dirección, etapa, importe, estado, título de oportunidad, fecha); las no mapeadas van a `extra`. Paso 3: previsualización con recuento: total, no vacías, se crearán, se fusionarán (duplicado por documento, teléfono normalizado o correo contra la base o dentro del archivo), para revisar (sin nombre ni teléfono ni correo; se importan igual con nombre "(Sin nombre) fila N" y `requiere_revision`). Valores de origen, etapa y responsable que no existen: chips para elegir a qué existente equivalen o crear (origen y etapa; responsable no se crea, se asigna al admin y se marca revisar). Paso 4: importar en lotes de 200; informe por fila descargable como CSV; fila en `importaciones`. Regla: cero filas descartadas. Botón "Deshacer esta importación" (borra contactos y oportunidades con ese `importacion_id`).

### Exportación (criterio 7)
`BotonExportar` en Contactos, Oportunidades (lista y tablero) y Tareas. Usa exactamente el mismo objeto de filtros que la lista (`useFiltrosURL`, filtros en la URL) y la misma función de consulta con `fetchAll`. CSV: UTF-8 con BOM, separador coma, CRLF, todo entre comillas, celdas que empiezan por `= + - @` con apóstrofo delante, fechas `dd/MM/yyyy HH:mm` en Lima, importes con punto decimal sin símbolo, nombres legibles (contacto, responsable, etapa, origen) en lugar de ids. Nombre de archivo `oportunidades_2026-09-12_1530.csv`. El botón muestra cuántas filas exportará. Móvil: descarga con `<a download>` y, si existe, `navigator.share`.

### Configuración (`PaginaConfiguracion`, solo admin)
Pestañas: **Etapas** (añadir, renombrar, reordenar con flechas, color, activar/desactivar; no se puede desactivar con oportunidades abiertas dentro) · **Motivos de pérdida** · **Orígenes** · **Usuarios** (lista, rol, activo; para crear usuarios se explica el script o el panel de Supabase) · **Valores** (nombre de la empresa, moneda, hora de recordatorio, importe por defecto, título de oportunidad por defecto, URL de la app).

### Ayuda (`PaginaAyuda`)
Guía de una página en la propia app, misma que `docs/GUIA.md`: cómo apuntar una llamada, crear contacto, mover etapa, perder con motivo, tareas y recordatorios, panel, importar, exportar, quién puede editar qué.

## 10. Contrato con Kodarvia para el correo (resumen)

La app deja cada recordatorio en `recordatorios_correo`. Kodarvia lo consume por uno de estos caminos (detalle en `docs/CONTRATO-RECORDATORIOS.md`):

1. Edge Function `recordatorios` (recomendado): `GET /functions/v1/recordatorios?limite=50` con cabecera `x-api-key` devuelve los pendientes vencidos y los bloquea 10 minutos; `POST /functions/v1/recordatorios/{id}` con `{ "estado": "enviado" | "error", "error": "..." }` confirma. La función usa la clave de servicio internamente; Kodarvia solo recibe la `x-api-key`.
2. Funciones SQL `reclamar_recordatorios(limite)` y `marcar_recordatorio(id, estado, error)` con la clave de servicio, si prefieren llamar a la API REST de Supabase.
3. Webhook saliente con `pg_cron` + `pg_net` a una URL suya (SQL preparado en el documento, desactivado hasta tener la URL).

Cada recordatorio lleva `email`, nombre del responsable, `asunto`, `cuerpo`, `url` y `enviar_local`. Idempotente por `tarea_id`.

## 11. Convenciones de código

- TypeScript estricto, sin `any`. Tipos de tablas en `src/lib/types.ts` (`Contacto`, `ContactoInsert`, `ContactoUpdate`, etc.).
- Todo acceso a datos en `src/lib/api/*`; los componentes usan hooks de TanStack Query definidos junto a cada feature (`useContactos`, `useCrearContacto`, ...).
- Nombres de archivos y componentes en español (`PaginaContactos.tsx`), hooks `useX`, utilidades en minúscula.
- Fechas: guardar UTC; mostrar y capturar con `America/Lima` a través de `src/lib/utils/fechas.ts` (`aLima`, `desdeLima`, `formatearFechaHora`, `hoyLima`). Nunca `new Date().toLocaleString()` sin zona.
- Errores: `toast.error` con mensaje en español; nunca fallar en silencio.
- Accesibilidad básica: labels en inputs, botones con texto o `aria-label`.
- Sin dependencias nuevas sin anotarlo en `docs/DECISIONES.md`.
- Commits pequeños en español, en imperativo: "Añade tablero de oportunidades".

## 12. Entorno de desarrollo

Node está en `~/.local/node/bin` (añadido a `~/.zshrc` y `~/.zshenv`). Comandos: `npm run dev`, `npm run build`, `npm run typecheck`, `npm test`. Variables en `.env.local` (ver `.env.example`). Sin `.env.local`, la app muestra una pantalla "Falta configurar Supabase" en lugar de romperse.
