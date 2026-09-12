# CRM Gestoría (encargo Kodarvia)

CRM sencillo para un estudio contable de Arequipa: 5 usuarios, móvil primero, Supabase como backend. El diseño completo está en `docs/ARQUITECTURA.md` y es de obligada lectura antes de tocar código. Las decisiones que se desvíen de él van a `docs/DECISIONES.md`.

## Comandos

Node está instalado en `~/.local/node/bin`. Si `node` no se encuentra, ejecuta `export PATH="$HOME/.local/node/bin:$PATH"` antes.

- `npm run dev` — servidor de desarrollo en http://localhost:5173
- `npm run typecheck` — comprobación de tipos (obligatoria antes de dar algo por terminado)
- `npm run build` — typecheck + build de producción
- `npm test` — vitest

## Reglas rápidas

- Español de Perú en toda la interfaz: celular, computadora, independiente, estudio contable. Moneda `S/`. Zona horaria fija `America/Lima` desde `src/lib/utils/fechas.ts`.
- Acceso a datos solo en `src/lib/api/*`; componentes con hooks de TanStack Query. Claves de consulta: primer elemento = nombre de tabla.
- Un campo obligatorio por formulario, valores por defecto, chips en vez de selectores. El criterio 1 (menos de un minuto en el celular) manda.
- Nada de `any`. Nada de fechas sin zona. Nada de dependencias nuevas sin anotarlo.
- Los criterios de aceptación son 8 y están en `docs/ARQUITECTURA.md` sección 1. Si dudas, elige lo que un revisor con dos celulares pueda comprobar.
- Sin `.env.local` la app no puede hablar con Supabase: no des por probado nada que requiera datos hasta tener el proyecto Supabase.
