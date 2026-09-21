# CRM Gestoría (encargo Kodarvia)

CRM sencillo para un estudio contable de Arequipa: 5 usuarios, móvil primero, **sin backend**: React y una sola clave de `localStorage`. El diseño completo está en `docs/ARQUITECTURA.md` y es de obligada lectura antes de tocar código. Las decisiones que se desvíen de él van a `docs/DECISIONES.md`.

## Comandos

Node está instalado en `~/.local/node/bin`. Si `node` no se encuentra, ejecuta `export PATH="$HOME/.local/node/bin:$PATH"` antes.

- `npm run dev` — servidor de desarrollo en http://localhost:5173/crm-kodarvia/ (la app cuelga de esa base porque se publica en GitHub Pages)
- `npm run typecheck` — comprobación de tipos (obligatoria antes de dar algo por terminado)
- `npm run build` — typecheck + build de producción
- `npm test` — vitest

## Reglas rápidas

- Español de Perú en toda la interfaz: celular, computadora, independiente, estudio contable. Moneda `S/`. Zona horaria fija `America/Lima` desde `src/lib/utils/fechas.ts`.
- Acceso a datos solo en `src/lib/api/*`, y esa capa solo habla con `src/lib/almacen.ts`: `leer()` para consultar (el objeto es de SOLO LECTURA) y `escribir(mutador)` para modificar. Nunca toques `localStorage` directamente. Componentes con hooks de TanStack Query; claves de consulta: primer elemento = nombre de tabla.
- Las reglas que antes imponía Postgres (restricciones, triggers, RLS) viven en `src/lib/reglas.ts` como funciones puras. Si añades una regla de negocio, va ahí, no repartida por los componentes.
- Un campo obligatorio por formulario, valores por defecto, chips en vez de selectores. El criterio 1 (menos de un minuto en el celular) manda.
- Nada de `any`. Nada de fechas sin zona. Nada de dependencias nuevas sin anotarlo.
- Los criterios de aceptación son 8 y están en `docs/ARQUITECTURA.md` sección 1; cómo se comprueban ahora, en `docs/ACEPTACION.md`. Si dudas, elige lo que un revisor pueda comprobar con dos pestañas abiertas en el mismo navegador.
- No hay servidor ni variables de entorno: `npm install && npm run dev` y la app siembra sola sus datos de partida. Se prueba de verdad en el navegador.
- Límites que hay que respetar al prometer cosas: los cambios se propagan entre pestañas del mismo navegador, no entre equipos; no hay contraseñas (selector de usuario); los recordatorios avisan dentro de la app, nunca por correo. Ver `docs/DECISIONES.md`, 2026-09-21.
