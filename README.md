# CRM Gestoría

CRM muy simple para un estudio contable de facturación electrónica en Arequipa (Perú): contactos, oportunidades por etapas, tareas con recordatorio, actividad, panel, importación desde Excel y exportación a CSV. Hasta 5 usuarios, celular primero, PWA instalable.

**No hay backend.** Toda la lógica y todos los datos viven en el navegador: React más una única clave de `localStorage`. No hay servidor, ni base de datos, ni variables de entorno que rellenar. El diseño completo está en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

## Requisitos

- Node 20 o superior (en este Mac está en `~/.local/node/bin`; si `node` no se encuentra: `export PATH="$HOME/.local/node/bin:$PATH"`).
- Nada más. No hace falta cuenta en ningún servicio para trabajar en local.

## Instalar y arrancar

```bash
npm install
npm run dev     # http://localhost:5173/crm-kodarvia/
```

La primera vez que se abre, la app siembra sola sus datos de partida: las 5 etapas del tablero, los 6 motivos de pérdida, los 7 orígenes, los valores por defecto del estudio y las 5 personas del equipo. No hay contraseñas: en la pantalla de entrada se elige con quién trabajar y se entra de un toque.

## Dónde viven los datos

Todo el CRM se guarda en la clave `crm.datos` de `localStorage`, como un único objeto JSON. De ahí salen varias consecuencias que conviene tener claras:

- **Por navegador y por equipo.** Dos computadoras, o dos navegadores en la misma computadora, llevan dos CRM independientes. No hay sincronización posible sin servidor.
- **Entre pestañas sí.** Lo que se guarda en una pestaña aparece al instante en las demás pestañas y ventanas del mismo navegador (evento `storage`).
- **Cabe unos 5 MB**, el límite habitual de `localStorage`. La app avisa y se niega a guardar antes de llegar al tope, para no perder datos a medias.
- **En modo incógnito** funciona igual durante la sesión, pero al cerrar la ventana se pierde todo.

### Copia de seguridad y borrar los datos de ejemplo

En la app, **Configuración → Datos** (solo el administrador):

- **Descargar copia**: baja todo el CRM como un archivo `.json`. Es la única red de seguridad que existe; conviene hacerlo de vez en cuando.
- **Restaurar copia**: vuelve a cargar uno de esos archivos y reemplaza lo que haya en este navegador.
- **Borrar datos de ejemplo**: deja el CRM como recién instalado. Se borra todo lo creado y vuelven las etapas, los motivos, los orígenes y las cinco personas del estudio.

A mano, lo mismo se consigue borrando la clave `crm.datos` desde las herramientas del navegador (Application → Local Storage) y recargando.

## Desplegar en GitHub Pages

El repositorio es `jorgevnick-claudelover/crm-kodarvia` y la app se publica en
`https://jorgevnick-claudelover.github.io/crm-kodarvia/`. Como no hay backend, el despliegue es solo
subir `dist/` a un hosting estático.

1. En GitHub › **Settings › Pages › Build and deployment**, elige **GitHub Actions** como *Source*.
2. Empuja a `localstorage` o a `main`: [`.github/workflows/pages.yml`](.github/workflows/pages.yml)
   pasa las pruebas, construye y publica con las acciones oficiales
   (`configure-pages`, `upload-pages-artifact`, `deploy-pages`).

Dos detalles del build que hacen falta para que esto funcione bajo un subdirectorio:

- `vite.config.ts` fija `base: '/crm-kodarvia/'`, y el router recibe ese mismo prefijo como `basename`.
- GitHub Pages no sabe reescribir rutas a `index.html`, así que al recargar en `/crm-kodarvia/contactos`
  devolvería un 404. Su convención es servir `404.html` en esos casos: el build copia `index.html`
  a `dist/404.html` y la app arranca igual, leyendo la URL real.

Para publicarlo en otro sitio (o en otro repositorio) basta cambiar `BASE` en `vite.config.ts`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en http://localhost:5173/crm-kodarvia/ |
| `npm run typecheck` | Comprobación de tipos (obligatoria antes de dar algo por terminado) |
| `npm run build` | Typecheck + build de producción en `dist/` (incluye `404.html`) |
| `npm run preview` | Sirve `dist/` para probar la PWA |
| `npm test` | Pruebas con vitest |
| `npm run test:watch` | Pruebas en modo continuo |

## Estructura de carpetas

```
src/
  main.tsx  App.tsx (router con basename, TanStack Query con caché en localStorage)  index.css
  lib/
    almacen.ts             la base de datos: leer() / escribir() sobre la clave crm.datos
    semilla.ts             datos de partida (catálogos, configuración y las 5 personas)
    reglas.ts              las reglas de negocio que antes imponía Postgres, como funciones puras
    sesion.ts              quién trabaja ahora (clave crm.usuario), sin contraseñas
    types.ts               tipos de todas las tablas y enums
    api/                   todo el acceso a datos (contactos, oportunidades, tareas, actividades,
                           catalogos, usuarios, buscar, importaciones, configuracion, comun)
    utils/                 cn, fechas (America/Lima), telefono (+51), moneda (S/), csv, texto
  hooks/                   useSesion, useUsuarioActual, useRealtime, useEsMovil, useFiltrosURL,
                           useCatalogos, useConfiguracion, useDebounce
  components/
    ui/                    shadcn/ui (Base UI)
    layout/                AppShell, BarraInferior, BarraLateral, Cabecera, BotonMas,
                           RequiereSesion, RequiereAdmin
    comunes/               SelectorContacto, ChipsFecha, ChipsSeleccion, AvatarUsuario, Importe,
                           EnlaceTelefono, Vacio, Cargando, BotonExportar, PanelFormulario
  features/                una carpeta por módulo: auth, hoy, contactos, oportunidades, tareas,
                           actividades, buscar, panel, importar, configuracion, ayuda
docs/                      ARQUITECTURA.md, ACEPTACION.md, DECISIONES*.md, GUIA.md
public/                    favicon.svg, logo.svg, icons/
```

Reglas de código: TypeScript estricto sin `any`; acceso a datos solo en `src/lib/api/*`, que a su vez solo habla con `src/lib/almacen.ts`; fechas siempre por `src/lib/utils/fechas.ts` (zona `America/Lima`); interfaz en español de Perú. Las decisiones que se desvían del diseño se anotan en `docs/DECISIONES.md` y `docs/DECISIONES-APP.md`.
