# Decisiones de la base de la app (src/, public/, README.md)

Complementa `docs/DECISIONES.md` con las decisiones tomadas al construir la base de la app en la fase 1. Una línea por decisión, con fecha, qué se decidió y por qué.

## Dependencias

- 2026-09-12 · `shadcn@latest init -d` instaló el estilo por defecto actual, **base-nova** (`@base-ui/react` en vez de Radix). Se conserva: es el "estilo por defecto" que pide ARQUITECTURA.md §2. Diferencias prácticas: los disparadores usan `render={<Link />}` + `nativeButton={false}` en vez de `asChild`; `onOpenChange(open, detalles)`; el Drawer es de Base UI (no vaul). Dependencias añadidas por el CLI: `@base-ui/react`, `shadcn` (aporta `shadcn/tailwind.css`), `tw-animate-css`, `cmdk`.
- 2026-09-12 · Se quitan las dependencias sobrantes que añadió el CLI: `cn` (sustituida por `src/lib/utils/cn.ts` con clsx + tailwind-merge, que ya estaban), `next-themes` (no hay modo oscuro; el Toaster se fija en `theme="light"`), `libpg-query` y `@fontsource-variable/geist` (≈100 KB de fuente innecesarios en celulares con datos limitados; se usa la fuente del sistema).
- 2026-09-12 · Añadidas `@tanstack/react-query-persist-client` y `@tanstack/query-sync-storage-persister` (misma versión 5.x que react-query) para arrancar con la caché de la última sesión en localStorage (`crm.cache`, 24 h, `buster` = `VERSION_CACHE` en `App.tsx`). Se excluyen de la persistencia `['buscar', …]` y el autocompletado `['contactos','rapido', …]`.

## Estructura y convenciones

- 2026-09-12 · `src/lib/utils.ts` reexporta `cn` desde `src/lib/utils/cn.ts`: shadcn importa `@/lib/utils` y el resto del código `@/lib/utils/cn`. Ambos funcionan.
- 2026-09-12 · `src/lib/types.ts` define además un tipo `Database` (Tables/Functions) para que `supabase.from(...)` y `rpc(...)` queden tipados. Las relaciones (`Relationships: []`) no se declaran: los joins se tipan con `.overrideTypes<XConRelaciones[], { merge: false }>()` y las constantes `SELECT_*` de cada módulo de `src/lib/api`. Los tipos de fila son `type` (no `interface`) porque supabase-js exige que sean asignables a `Record<string, unknown>`.
- 2026-09-12 · Los joins usan pistas por columna (`usuarios!responsable_id`) y no por nombre de constraint, para no depender de cómo la migración nombre las FK. `contactos` tiene dos FK a `usuarios` (`responsable_id`, `created_by`), así que la pista es obligatoria.
- 2026-09-12 · `src/lib/api/comun.ts` (no previsto en ARQUITECTURA.md) concentra `lanzarSi` (traduce errores de supabase a español), `exigir`, `escaparIlike`, `rangoLima`, `uidActual` y la interfaz `ConsultaFiltrable` que usan las funciones `aplicarFiltros*`.
- 2026-09-12 · Filtros "sin seguimiento" y "con tarea vencida": PostgREST no permite `NOT EXISTS`, así que `contextoFiltros*` hace una consulta previa a `tareas` pendientes (hasta 5000) y aplica `not('id','in',(…))` / `or('contacto_id.in.(…)')`. Con el volumen de un estudio de 5 personas es más que suficiente. "Sin seguimiento" en oportunidades = ni el contacto ni la oportunidad tienen tarea pendiente.
- 2026-09-12 · El texto de búsqueda en oportunidades se aplica al título y, mediante una consulta previa a contactos (máx. 500 ids), a nombre/empresa/teléfono/correo/documento del contacto.
- 2026-09-12 · `FiltrosTareas` incluye `contactoId` y `oportunidadId` opcionales (además de los pedidos) para reutilizar `listar` en las fichas.
- 2026-09-12 · `desde`/`hasta` de los filtros son días 'yyyy-MM-dd' en Lima y se convierten a instantes UTC con `desdeLima`/`finDeDiaLima`. En contactos y oportunidades filtran `created_at`; en tareas `vence_at`.
- 2026-09-12 · Teléfonos: `normalizarTelefonoPE` reconoce celulares (9 dígitos empezando por 9), Lima (1 + 7 dígitos) y códigos de área de 2 dígitos + 6 dígitos, con o sin 0 nacional y prefijos 51/+51/0051. Un fijo sin código de área (6 o 7 dígitos sueltos) devuelve null: se guarda tal cual en `telefono` y `telefono_raw` para no perder el dato. Si la app se usara solo en Arequipa se podría asumir el 54 por defecto.
- 2026-09-12 · `descargarCSV` usa `navigator.share` con archivo solo en pantallas menores de 768 px o táctiles y cuando `canShare({ files })` lo permite; si el usuario cancela la hoja de compartir no se descarga nada; ante cualquier otro fallo cae a `<a download>`.
- 2026-09-12 · `nombreArchivoExportacion` añade `_filtrado` al nombre cuando hay algún filtro activo (`oportunidades_2026-09-12_1530_filtrado.csv`).
- 2026-09-12 · Realtime: un solo canal `crm-cambios`; las invalidaciones se agrupan en 150 ms para no lanzar cientos de refetch durante una importación. Además de la tabla, se invalidan claves derivadas (`buscar`, `historial_etapas`, `recordatorios`). El estado del canal se expone en el objeto `realtime` (fuera de React) y el `QueryClient` usa `refetchInterval: () => realtime.conectado ? false : 30000` como respaldo.
- 2026-09-12 · `useFiltrosURL` solo escribe en la URL los valores distintos del default y usa `replace: true` para no llenar el historial. Los booleanos se serializan como `1`.
- 2026-09-12 · `PanelFormulario` (en `components/comunes`) encapsula "drawer en celular, diálogo en computadora" para que todos los formularios de la fase 2 lo compartan. `EnConstruccion` es el marcador de las páginas provisionales.
- 2026-09-12 · `BotonMas` cierra el menú y espera 120 ms antes de abrir el formulario, para no apilar dos modales. En computadora se muestra como botón "Nuevo" en la cabecera; en celular como botón flotante.
- 2026-09-12 · Paleta: primario = verde de marca `#0f766e` (teal-700) sobre la base neutral de shadcn; inputs a 16 px por debajo de 768 px para evitar el zoom de iOS.
- 2026-09-12 · `RequiereSesion` guarda la ruta de origen en `state.desde` y `PaginaLogin` vuelve a ella tras entrar.
- 2026-09-12 · `deshacer(importacionId)` borra los contactos con ese `importacion_id` (oportunidades, tareas y actividades caen en cascada) y después la fila de `importaciones`.
- 2026-09-12 · Iconos PWA generados con `qlmanage -t -s 512` a partir de `public/favicon.svg` (sin dependencias nuevas).
