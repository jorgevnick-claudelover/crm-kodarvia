# Decisiones de implementación

Registro de desviaciones respecto a `docs/ARQUITECTURA.md` y de decisiones técnicas tomadas durante la construcción. Una línea por decisión, con fecha, qué se decidió y por qué.

- 2026-09-12 · Node 24 instalado en `~/.local/node` (sin sudo) porque el Mac no tenía Node ni Homebrew.
- 2026-09-12 · Se descarta react-hook-form: los formularios tienen un solo campo obligatorio y se resuelven con estado controlado y zod.
- 2026-09-12 · Supabase local no es posible (sin Docker); el esquema se prueba contra el proyecto Supabase en la nube cuando exista.
