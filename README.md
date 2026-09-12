# CRM Gestoría

CRM muy simple para un estudio contable de facturación electrónica en Arequipa (Perú): contactos, oportunidades por etapas, tareas con recordatorio, actividad, panel, importación desde Excel y exportación a CSV. Hasta 5 usuarios, celular primero, PWA instalable. Backend en Supabase (Auth, Postgres con RLS, Realtime). El diseño completo está en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

## Requisitos

- Node 20 o superior (en este Mac está en `~/.local/node/bin`; si `node` no se encuentra: `export PATH="$HOME/.local/node/bin:$PATH"`).
- Un proyecto en [Supabase](https://supabase.com) (plan gratuito sirve).
- Para desplegar: cuenta en Cloudflare Pages y el repositorio en GitHub.

## Instalar

```bash
npm install
cp .env.example .env.local   # y rellena las dos variables
npm run dev                  # http://localhost:5173
```

### `.env.local`

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Los valores están en Supabase › **Project Settings › API**. La clave `anon` es pública por diseño: la seguridad la dan las políticas RLS. Sin estas variables la app muestra la pantalla "Falta configurar Supabase" en lugar de romperse.

## Aplicar la migración en Supabase

Opción A (sin instalar nada): en el panel de Supabase abre **SQL Editor**, pega el contenido de `supabase/migrations/0001_init.sql` y ejecútalo; después pega y ejecuta `supabase/seed.sql` (catálogos de ejemplo y configuración inicial).

Opción B (con la CLI de Supabase):

```bash
npx supabase login
npx supabase link --project-ref xxxxxxxxxxxx
npx supabase db push
psql "$DATABASE_URL" -f supabase/seed.sql
```

La migración crea las tablas, los triggers, las funciones (`mover_oportunidad`, `buscar`, `recordatorios_pendientes_usuario`, …), las políticas RLS y la publicación realtime. Los recordatorios por correo los envía Kodarvia leyendo la cola `recordatorios_correo` según [`docs/CONTRATO-RECORDATORIOS.md`](docs/CONTRATO-RECORDATORIOS.md).

## Crear usuarios

Los usuarios se crean en Supabase Auth (correo y contraseña); un trigger crea su perfil en la tabla `usuarios`. **El primer usuario creado es el administrador.**

- Con el script (necesita la clave de servicio, que nunca va al cliente):

  ```bash
  SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/crear-usuarios.mjs
  ```

  Mira la cabecera de `scripts/crear-usuarios.mjs` para el formato de la lista de usuarios.
- O a mano en Supabase › **Authentication › Users › Add user** (marca "Auto confirm").

Después, el administrador puede cambiar nombre, rol y estado de cada usuario desde **Configuración › Usuarios** en la app.

## Desplegar en Cloudflare Pages

1. Sube el repositorio a GitHub.
2. En Cloudflare › **Workers & Pages › Create › Pages › Connect to Git**, elige el repositorio.
3. Configuración de build:
   - Framework preset: **None** (o Vite)
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Variables de entorno (Production y Preview): `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
5. Despliega. `public/_redirects` (`/* /index.html 200`) hace que las rutas de la SPA funcionen al recargar.
6. En Supabase › **Authentication › URL Configuration** añade la URL de Cloudflare como *Site URL* y en *Redirect URLs* (para "Olvidé mi contraseña"). En la app, **Configuración › Valores › URL de la app** debe apuntar a la misma URL: es la que llevan los correos de recordatorio.

Cada push a `main` genera un despliegue de producción y cada rama una URL de previsualización.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en http://localhost:5173 |
| `npm run typecheck` | Comprobación de tipos (obligatoria antes de dar algo por terminado) |
| `npm run build` | Typecheck + build de producción en `dist/` |
| `npm run preview` | Sirve `dist/` para probar la PWA |
| `npm test` | Pruebas con vitest (utilidades puras) |
| `npm run test:watch` | Pruebas en modo continuo |

## Estructura de carpetas

```
src/
  main.tsx  App.tsx (router, TanStack Query con caché en localStorage)  index.css
  lib/
    supabase.ts            cliente supabase + supabaseConfigurado
    types.ts               tipos de todas las tablas, enums y tipo Database
    fetchAll.ts            pagina .range() de 1000 en 1000
    api/                   todo el acceso a datos (contactos, oportunidades, tareas, actividades,
                           catalogos, usuarios, buscar, importaciones, configuracion, comun)
    utils/                 cn, fechas (America/Lima), telefono (+51), moneda (S/), csv, texto
  hooks/                   useSesion, useUsuarioActual, useRealtime, useEsMovil, useFiltrosURL,
                           useCatalogos, useConfiguracion, useDebounce
  components/
    ui/                    shadcn/ui (Base UI)
    layout/                AppShell, BarraInferior, BarraLateral, Cabecera, BotonMas,
                           RequiereSesion, RequiereAdmin, PantallaSinSupabase
    comunes/               SelectorContacto, ChipsFecha, ChipsSeleccion, AvatarUsuario, Importe,
                           EnlaceTelefono, Vacio, Cargando, BotonExportar, PanelFormulario
  features/                una carpeta por módulo: auth, hoy, contactos, oportunidades, tareas,
                           actividades, buscar, panel, importar, configuracion, ayuda
supabase/
  migrations/0001_init.sql  seed.sql  functions/recordatorios/
scripts/crear-usuarios.mjs
docs/                      ARQUITECTURA.md, DECISIONES.md, DECISIONES-APP.md, CONTRATO-RECORDATORIOS.md
public/                    _redirects, favicon.svg, logo.svg, icons/
```

Reglas de código: TypeScript estricto sin `any`; acceso a datos solo en `src/lib/api/*`; fechas siempre por `src/lib/utils/fechas.ts` (zona `America/Lima`); interfaz en español de Perú. Las decisiones que se desvían del diseño se anotan en `docs/DECISIONES.md` y `docs/DECISIONES-APP.md`.
