# Arquitectura del CRM para la gestoría (Arequipa)

Este documento es el contrato de diseño. Todo el código debe ajustarse a él. Si algo aquí resulta imposible o contradictorio al implementarlo, se anota en `docs/DECISIONES.md` con el porqué y se elige la salida más simple que siga cumpliendo los 8 criterios de aceptación.

> **Cambio de encargo, 21/09/2026.** Kodarvia exige por escrito React con `localStorage` y **sin backend ni base de datos real**: "la lógica y los datos deben resolverse en el frontend simulado". Las secciones 2, 4, 5, 6, 7 y 10 están reescritas a ese modelo; el resto (pantallas, navegación, convenciones) no cambia, porque la interfaz es la misma. La decisión y sus consecuencias, en `docs/DECISIONES.md` (2026-09-21); cómo se comprueba cada criterio ahora, en `docs/ACEPTACION.md`.

## 1. Qué construimos y para quién

CRM muy simple para un estudio contable de facturación electrónica en Arequipa (Perú). Hasta 5 usuarios con poca costumbre digital y mucha prisa. Móvil primero; el administrador usa además el tablero en escritorio.

Criterios de aceptación que revisará Kodarvia:

1. Crear un contacto y una oportunidad tarda menos de un minuto desde el celular.
2. Mover una oportunidad de etapa se refleja al instante (menos de 3 s, sin recargar) **en las demás pestañas y ventanas del mismo navegador**. Sin servidor no hay forma de propagarlo a otro equipo.
3. Perder una oportunidad exige motivo, **validado fuera de la interfaz**: la regla vive en `src/lib/reglas.ts` (`validarOportunidad`) y la aplica la capa de datos, así que tampoco se puede guardar saltándose el formulario.
4. El recordatorio de una tarea queda programado y visible en la app para su responsable a la hora fijada. **No hay correo ni cola**: el aviso vive dentro de la app (instrucción escrita del cliente).
5. Cada usuario edita solo lo suyo; el administrador edita todo. Todos ven todo. **Se elige usuario sin contraseña**: es una regla de la interfaz, no una barrera de seguridad.
6. La importación carga la hoja del cliente sin perder filas (toda fila no vacía acaba en el CRM, con informe).
7. La exportación a CSV respeta los filtros aplicados en pantalla.
8. Repositorio en GitHub con URL de previsualización funcionando.

Fuera de alcance: integraciones, automatizaciones de marketing, facturación, documentos adjuntos.

## 2. Stack

- Vite 7 + React 19 + TypeScript estricto. Alias `@/` → `src/`.
- Tailwind CSS v4 (plugin `@tailwindcss/vite`) + shadcn/ui (estilo por defecto, color base neutral). Componentes shadcn en `src/components/ui`.
- React Router 7 (modo declarativo, `BrowserRouter`).
- TanStack Query 5 como capa de estado. Persistencia de caché en `localStorage` (clave `crm.cache`) solo para arranque rápido; la fuente de verdad es el almacén local.
- **Sin backend.** Toda la base de datos es un objeto JSON en la clave `crm.datos` de `localStorage`, gestionado por `src/lib/almacen.ts`. Las reglas de negocio que antes imponía Postgres son funciones puras en `src/lib/reglas.ts`, y los datos de partida los siembra `src/lib/semilla.ts`. La sesión (quién trabaja ahora, sin contraseña) vive en `src/lib/sesion.ts`, clave `crm.usuario`.
- dnd-kit (tablero en escritorio), papaparse + xlsx (importar y exportar), recharts (panel), date-fns + date-fns-tz (fechas), zod (validación), sonner (toasts), lucide-react (iconos).
- PWA instalable con vite-plugin-pwa (ya configurado en `vite.config.ts`).
- Hosting: GitHub Pages, bajo `/crm-kodarvia/` (`base` en `vite.config.ts`, `basename` en el router y `dist/404.html` copiado de `index.html` para que recargar una ruta funcione). Workflow en `.github/workflows/pages.yml`.
- Pruebas: vitest para las utilidades puras (teléfono, CSV, mapeo de importación, cálculo de embudo), para las reglas de negocio (`reglas.test.ts`), para el almacén (`almacen.test.ts`) y para la capa de datos sobre él (`datosLocales.test.ts`).

Idioma de la interfaz: español de Perú. Vocabulario: "celular" (no móvil), "computadora", "independiente" (no autónomo), "estudio contable", "oportunidad", "etapa", "responsable" (persona asignada), "administrador" (jefe que ve y edita todo). Moneda: soles, símbolo `S/`, dos decimales, separador de miles con coma (`S/ 1,250.00`). Zona horaria fija `America/Lima` leída de configuración, nunca del navegador.

## 3. Estructura de carpetas

```
src/
  main.tsx  App.tsx (router y proveedores)  index.css
  lib/
    almacen.ts             la base de datos: leer() / escribir() sobre la clave crm.datos
    semilla.ts             datos de partida (catálogos, configuración, las 5 personas)
    reglas.ts              las reglas de negocio, como funciones puras
    sesion.ts              quién trabaja ahora (clave crm.usuario), sin contraseñas
    types.ts               tipos TS de todas las tablas y enums
    api/                   una función por operación, tipadas; nada toca el almacén fuera de aquí
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
docs/
  ARQUITECTURA.md (este) DECISIONES.md GUIA.md ACEPTACION.md
scripts/
  generar-hoja-ejemplo.mjs   regenera fixtures/hoja-ejemplo.xlsx para probar la importación
.github/workflows/
  ci.yml (tipos, pruebas, build)  pages.yml (construye y publica en GitHub Pages)
public/
  favicon.svg icons/icon-192.png icons/icon-512.png logo.svg (provisional)
```

## 4. Modelo de datos (el objeto de `crm.datos`)

El almacén guarda un solo objeto JSON: `{ version, usuarios, etapas, motivos_perdida, origenes, contactos, oportunidades, historial_etapas, tareas, actividades, importaciones, configuracion }`. Cada clave es un array de filas (`configuracion` es un objeto clave → valor). Lo que antes eran tablas de Postgres son esos arrays, con los **mismos nombres de columna**, que es lo que permite que los 99 componentes no cambien.

Se conserva la notación SQL de abajo porque describe la forma de cada fila con precisión, pero hay que leerla así:

- No hay claves foráneas ni `on delete cascade`: los borrados en cadena los hace a mano la capa de datos (`src/lib/api/*`).
- No hay `default now()` ni `default gen_random_uuid()`: los pone la capa de datos con `ahora()` y `nuevoId()` de `src/lib/almacen.ts`.
- No hay triggers: lo que hacían está en `src/lib/reglas.ts` (sección 5).
- Los `timestamptz` siguen siendo instantes UTC en ISO (`"2026-09-21T14:00:00.000Z"`); se muestran y se capturan en `America/Lima` (sección 11).
- Los ids siguen siendo uuid, ahora generados con `crypto.randomUUID()`. Los de la semilla son fijos, para que sobrevivan a una recarga y a las pruebas.

Tamaño: `localStorage` da unos 5 MB. El almacén avisa y se niega a guardar al pasar del 80 %, antes de que el navegador corte a mitad de una escritura.

### usuarios
Los cinco del estudio vienen en la semilla, con ids fijos y sin contraseña. No hay alta: en Configuración → Usuarios se cambian rol y `activo`, y en la pantalla de entrada se elige con quién trabajar.

```
id uuid pk
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
responsable_id uuid not null references usuarios   -- lo pone la capa de datos con el usuario en sesión
notas text
extra jsonb not null default '{}'      -- columnas de la hoja no mapeadas
importacion_id uuid references importaciones
fila_origen int
requiere_revision boolean not null default false
ultima_actividad_at timestamptz
created_by uuid references usuarios   -- lo pone la capa de datos con el usuario en sesión
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
responsable_id uuid not null references usuarios   -- lo pone la capa de datos con el usuario en sesión
motivo_perdida_id uuid references motivos_perdida
detalle_perdida text
fecha_cierre_prevista date
ganada_at timestamptz
perdida_at timestamptz
created_by uuid references usuarios   -- lo pone la capa de datos con el usuario en sesión
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
responsable_id uuid not null references usuarios   -- lo pone la capa de datos con el usuario en sesión
estado text not null default 'pendiente' check (estado in ('pendiente','hecha'))
hecha_at timestamptz
recordatorio_visto_at timestamptz
created_by uuid references usuarios   -- lo pone la capa de datos con el usuario en sesión
created_at, updated_at
```

### actividades
```
id uuid pk
contacto_id uuid not null references contactos on delete cascade
oportunidad_id uuid references oportunidades on delete set null
tipo text not null check (tipo in ('llamada','whatsapp','correo','reunion','nota'))
resultado text          -- 'contesto','no_contesto','volver_a_llamar','interesado','no_interesado' o null
nota text
ocurrio_at timestamptz not null default now()
usuario_id uuid not null references usuarios   -- lo pone la capa de datos con el usuario en sesión
created_at
```
Al insertar, mover o borrar una actividad, la capa de datos recalcula `contactos.ultima_actividad_at` con `ultimaActividad()` de `reglas.ts`.

### importaciones
```
id uuid pk
archivo text not null, hoja text
mapeo jsonb not null default '{}'
total_filas int not null default 0, filas_no_vacias int not null default 0
creadas int not null default 0, fusionadas int not null default 0, para_revisar int not null default 0
informe jsonb not null default '[]'    -- [{fila, resultado:'creado'|'fusionado'|'revisar', motivo, contacto_id}]
usuario_id uuid not null references usuarios   -- lo pone la capa de datos con el usuario en sesión
created_at
```

### configuracion
```
clave text pk, valor jsonb not null, updated_at
```
Claves: `timezone` ("America/Lima"), `moneda` ("PEN"), `hora_recordatorio` ("09:00"), `importe_default` (0), `nombre_empresa`, `titulo_oportunidad_default` ("Facturación electrónica"), `url_app` (la dirección pública de la app).

## 5. Reglas de negocio (`src/lib/reglas.ts`)

Lo que antes garantizaban las restricciones, los triggers y las funciones de Postgres son ahora funciones **puras** (admiten un `momento` opcional en lugar de llamar al reloj) que lanzan `ErrorRegla` con el mensaje en español listo para `toast.error`. Las aplica `src/lib/api/*` dentro de `escribir()`, nunca los componentes. Ninguna regla se ha perdido:

| Antes, en Postgres | Ahora, en `reglas.ts` |
|---|---|
| `set_updated_at()` | `marcarActualizado(fila, momento?)`, ya incorporado en `prepararOportunidadActualizada` y `prepararTarea` |
| restricciones `oportunidades_perdida_con_motivo`, `_ganada_con_fecha`, `_perdida_con_fecha` | `validarOportunidad()` — criterio 3: no se guarda `perdida` sin motivo, ni motivo sin estar perdida |
| trigger `preparar_cambio_estado` | `prepararOportunidadNueva()` (alta: completa `ganada_at`/`perdida_at` que falten) y `prepararOportunidadActualizada()` (cambio de estado: fija la fecha y, al reabrir, limpia motivo, detalle y fechas) |
| trigger `registrar_historial_etapas` | `historialAlCrear()`, `historialAlActualizar()` (devuelve fila solo si cambia etapa o estado, o `null`) y `siguienteIdHistorial()` en lugar del `generated always as identity`. El embudo del panel depende de esto |
| trigger `actualizar_ultima_actividad` | `ultimaActividad(actividades, contactoId)`: el `max(ocurrio_at)` del contacto, o `null` si se borró la última |
| trigger `proteger_reasignacion` | `exigirReasignacion()` → "Solo el administrador puede reasignar el responsable." |
| trigger `proteger_usuario` | `validarCambioUsuario()`: no se cambia el id, un miembro no toca rol/activo/email ni edita a otro, y siempre queda al menos un administrador activo |
| función `mover_oportunidad` | `exigirEtapaActiva()` → "La etapa no existe o está desactivada." |
| función `buscar(q)` con `unaccent` | `src/lib/api/buscar.ts` filtra los arrays con `sinTildes()` de `src/lib/utils/texto.ts`; sigue devolviendo 50 filas como máximo |
| políticas RLS (sección 6) | `esAdmin()`, `puedeEditar()`, `exigirPuedeEditar()`, `exigirAdmin()` |
| trigger `crear_usuario_desde_auth` | ya no aplica: los cinco usuarios vienen en `src/lib/semilla.ts` |
| cola `recordatorios_correo` y trigger `sincronizar_recordatorio` | **no se reimplementan**, por instrucción escrita del cliente (sección 10) |

Añadido aquí aunque antes lo hacía la app y no la base: `prepararTarea()` fija `hecha_at` al marcar una tarea hecha y lo limpia al devolverla a pendiente.

**Hasta dónde llega esto.** Son reglas de la aplicación, no barreras de seguridad: se cumplen para todo lo que pase por `src/lib/api/*` —que es todo lo que hace la interfaz—, pero quien abra las herramientas del navegador puede editar `crm.datos` a mano. Con el CRM entero dentro del navegador de cada persona no hay forma de evitarlo, y conviene decirlo en vez de aparentar lo contrario.

## 6. Permisos (comprobados en el cliente)

Mismas reglas de siempre, ahora en `reglas.ts` en vez de en políticas RLS. `auth.uid()` pasa a ser `idUsuarioActual()` de `src/lib/sesion.ts`.

| Tabla | Leer | Crear | Editar | Borrar |
|---|---|---|---|---|
| usuarios | todos | nadie (vienen en la semilla) | propio `nombre`, o admin; siempre queda un admin activo | nadie |
| etapas, motivos_perdida, origenes, configuracion | todos | admin | admin | admin |
| contactos, oportunidades, tareas | todos | todos (`responsable_id` = uno mismo salvo admin) | responsable o admin | responsable o admin |
| actividades | todos | todos (sobre cualquier contacto) | autor (`usuario_id`) o admin | autor o admin |
| historial_etapas | todos | lo escribe la capa de datos | nadie | nadie |
| importaciones | todos | admin | admin | admin |

"Lo suyo" = registros donde soy `responsable_id` (o `usuario_id` en actividades). Cualquier miembro puede registrar actividad y crear tareas sobre contactos ajenos (cubre vacaciones). Solo el admin reasigna, importa, configura catálogos y gestiona usuarios.

La interfaz esconde lo que no se puede hacer (`FilaTarea`, `FormularioTarea`, `ListaPorEtapa`, `PaginaContacto`…) y la capa de datos lo vuelve a comprobar antes de escribir, así que no hay forma de guardar algo ajeno desde la app. La advertencia del final de la sección 5 sigue valiendo: no es seguridad, es disciplina.

## 7. Tiempo real (entre pestañas del mismo navegador)

`useRealtime()` en `AppShell` mantiene su firma y sus exports (`TABLAS_REALTIME`, `realtime`, `EstadoCanal`, `EstadoRealtime`), pero ya no hay canal `postgres_changes`: se suscribe al almacén con `suscribirse()`.

`src/lib/almacen.ts` unifica dos fuentes en un solo evento:

- **Esta pestaña**: `escribir()` compara el JSON de cada tabla antes y después y emite un `CustomEvent("crm:cambio")` con las tablas que cambiaron de verdad. Da igual que el mutador reemplace el array o toque una fila por dentro.
- **Las demás pestañas y ventanas del mismo navegador**: el evento nativo `storage`. Las tablas se deducen comparando el JSON recibido con la caché, así que la invalidación es igual de precisa.

`useRealtime()` agrupa las invalidaciones en 150 ms e invalida `['<tabla>']` más las claves derivadas (`buscar`, `historial_etapas`, `recordatorios`). `realtime.conectado` queda en `true` mientras el hook está montado, así que el `refetchInterval` de respaldo de 30 s no se activa. Mover una tarjeta aplica actualización optimista y se revierte con toast si falla.

**Alcance real.** Pestañas y ventanas del mismo navegador, en el mismo equipo. Entre dos celulares distintos, o entre dos navegadores del mismo equipo, no hay propagación posible sin servidor: son dos CRM independientes. El criterio 2 se comprueba con dos pestañas (`docs/ACEPTACION.md`).

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
Filtros: rango de fechas (por defecto últimos 6 meses) y responsable. Todo se calcula a partir de las listas completas de oportunidades, tareas e historial del rango (`listarTodo`), con fechas en Lima.
- Tarjetas: Abiertas (n y S/), Ganado este mes (S/), Perdidas este mes, Tareas vencidas, Contactos sin seguimiento.
- Barras apiladas: oportunidades abiertas por etapa y responsable (n y S/).
- Barras: ganado por mes (suma de `importe` de oportunidades con `ganada_at` en el mes, hora Lima), últimos 6 o 12 meses.
- Embudo mensual: para el mes elegido, cohorte de oportunidades creadas en ese mes; por cada etapa en orden, cuántas la alcanzaron (según `historial_etapas`, alcance implícito: llegar a la etapa 3 cuenta también la 1 y la 2) y conversión etapa a etapa; al final Ganadas y Perdidas de la cohorte.
- Tabla: perdidas por motivo en el rango.
- Lista: tareas vencidas por responsable.

### Importación (`PaginaImportar`, solo admin)
Paso 1: subir `.xlsx`, `.xls` o `.csv`; elegir hoja si hay varias; detectar fila de cabecera (primera fila con 2 o más celdas de texto). Paso 2: mapeo de columnas con sugerencia automática por similitud (nombre, empresa, teléfono, correo, documento, origen, responsable, notas, dirección, etapa, importe, estado, título de oportunidad, fecha); las no mapeadas van a `extra`. Paso 3: previsualización con recuento: total, no vacías, se crearán, se fusionarán (duplicado por documento, teléfono normalizado o correo contra la base o dentro del archivo), para revisar (sin nombre ni teléfono ni correo; se importan igual con nombre "(Sin nombre) fila N" y `requiere_revision`). Valores de origen, etapa y responsable que no existen: chips para elegir a qué existente equivalen o crear (origen y etapa; responsable no se crea, se asigna al admin y se marca revisar). Paso 4: importar en lotes de 200; informe por fila descargable como CSV; fila en `importaciones`. Regla: cero filas descartadas. Botón "Deshacer esta importación" (borra contactos y oportunidades con ese `importacion_id`).

### Exportación (criterio 7)
`BotonExportar` en Contactos, Oportunidades (lista y tablero) y Tareas. Usa exactamente el mismo objeto de filtros que la lista (`useFiltrosURL`, filtros en la URL) y la misma función de consulta (`listarTodo`). CSV: UTF-8 con BOM, separador coma, CRLF, todo entre comillas, celdas que empiezan por `= + - @` con apóstrofo delante, fechas `dd/MM/yyyy HH:mm` en Lima, importes con punto decimal sin símbolo, nombres legibles (contacto, responsable, etapa, origen) en lugar de ids. Nombre de archivo `oportunidades_2026-09-12_1530.csv`. El botón muestra cuántas filas exportará. Móvil: descarga con `<a download>` y, si existe, `navigator.share`.

### Configuración (`PaginaConfiguracion`, solo admin)
Pestañas: **Etapas** (añadir, renombrar, reordenar con flechas, color, activar/desactivar; no se puede desactivar con oportunidades abiertas dentro) · **Motivos de pérdida** · **Orígenes** · **Usuarios** (lista, rol, activo; no hay alta: las cinco personas vienen en la semilla) · **Valores** (nombre de la empresa, moneda, hora de recordatorio, importe por defecto, título de oportunidad por defecto, URL de la app) · **Datos** (cuánto ocupan, descargar y restaurar una copia de seguridad, borrar los datos de ejemplo).

### Ayuda (`PaginaAyuda`)
Guía de una página en la propia app, misma que `docs/GUIA.md`: cómo apuntar una llamada, crear contacto, mover etapa, perder con motivo, tareas y recordatorios, panel, importar, exportar, quién puede editar qué.

## 10. Recordatorios (sin correo ni cola)

Kodarvia lo pidió por escrito: no hace falta preparar colas ni mecanismos de servidor; basta con que el recordatorio quede programado y visible en la interfaz para su responsable. Así que la cola `recordatorios_correo`, el trigger `sincronizar_recordatorio`, la Edge Function y `docs/CONTRATO-RECORDATORIOS.md` desaparecen.

Lo que queda, que es lo que la app ya hacía por su cuenta:

- La hora se guarda en `tareas.recordatorio_at`, con el valor por defecto de `configuracion.hora_recordatorio`.
- `AvisoRecordatorios` se monta en `AppShell`, no en `PaginaHoy`, así que el aviso salta **en cualquier pantalla**. Programa un `setTimeout` por cada recordatorio que vence dentro de las próximas 12 horas (`proximosAvisos()`), de modo que aparece a la hora exacta y no cuando toque el siguiente sondeo.
- Es un toast persistente (`duration: Infinity`) con **Ver** y **Visto**. Al marcar visto se escribe `recordatorio_visto_at` y no vuelve a salir.
- Con la app cerrada y vuelta a abrir, los recordatorios vencidos y no vistos avisan de nuevo (`listarRecordatoriosPendientes`) y siguen listados en el bloque **Recordatorios** de Hoy.
- Al cerrar sesión, `olvidarAvisos()` vacía el registro de avisos mostrados para que no se arrastren al siguiente usuario.

Lo que no se puede prometer y no se promete: con la app cerrada no llega nada, ni correo, ni notificación del sistema.

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

Node está en `~/.local/node/bin` (añadido a `~/.zshrc` y `~/.zshenv`). Comandos: `npm run dev`, `npm run build`, `npm run typecheck`, `npm test`. No hay variables de entorno ni servicios que configurar: `npm install && npm run dev` y la app siembra sola sus datos de partida en http://localhost:5173/crm-kodarvia/.
