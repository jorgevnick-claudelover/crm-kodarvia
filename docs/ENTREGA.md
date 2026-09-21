# Lista de comprobación de entrega

Se marca cada punto antes de enviar la entrega a Kodarvia. Fecha límite: 3 de octubre de 2026.

> **Pendiente de repasar tras el cambio de encargo del 21/09/2026.** Los puntos que hablan de Supabase, de Cloudflare, de crear usuarios con un script o de la cola de recordatorios ya no aplican: no hay backend, el hosting es GitHub Pages y los cinco usuarios vienen con los datos de ejemplo. Lo que sí hay que comprobar está en `docs/ACEPTACION.md`.

## Cuentas y propiedad

- [ ] Decidido con Kodarvia y el cliente en qué cuentas viven el repositorio, Supabase y Cloudflare Pages (ver PREGUNTAS.md).
- [x] Repositorio en GitHub: https://github.com/jorgevnick-claudelover/crm-kodarvia (2026-09-13). Falta dar acceso al equipo revisor de Kodarvia.
- [x] Proyecto Supabase `crm-gestoria`, plan Free, región São Paulo (2026-09-13).
- [x] GitHub Pages publicando desde el repositorio (21/09/2026). URL pública: https://jorgevnick-claudelover.github.io/crm-kodarvia/ · Cloudflare y Supabase quedan fuera de uso tras la exigencia de Kodarvia.
- [ ] Anotado quién paga hosting y base de datos tras la entrega (hoy todo es gratuito).

## Base de datos

- [x] `supabase/migrations/0001_init.sql` aplicado sin errores (2026-09-13).
- [x] `supabase/seed.sql` aplicado.
- [x] `supabase/tests/comprobaciones.sql` ejecutado, 17 comprobaciones en verde.
- [ ] `configuracion.url_app` actualizado con la URL real de la app (para los enlaces de los correos).
- [ ] Etapas, motivos de pérdida y orígenes sustituidos por los reales del cliente desde Configuración.
- [ ] Ping programado para que el proyecto Free no se pause (ver `supabase/README.md`) y copia de seguridad probada una vez.

## Usuarios

- [ ] Usuarios reales creados con `scripts/crear-usuarios.mjs` (hasta 5) y el administrador marcado como `admin`.
- [x] Usuarios de prueba creados: admin@ejemplo.pe, ana@ejemplo.pe, luis@ejemplo.pe. Falta enviar las contraseñas a Kodarvia por canal privado.
- [ ] Cada persona ha iniciado sesión al menos una vez desde su celular y ha instalado la app en la pantalla de inicio.

## Integración con Kodarvia (correo)

- [ ] `docs/CONTRATO-RECORDATORIOS.md` enviado a Kodarvia y opción elegida (Edge Function, RPC o webhook).
- [ ] Edge Function `recordatorios` desplegada y secreto `KODARVIA_API_KEY` fijado (si eligen esa opción).
- [ ] Prueba conjunta: una tarea con recordatorio aparece en la cola y Kodarvia la marca como enviada.

## Datos

- [ ] Hoja real del cliente recibida por canal privado (no está en el repositorio).
- [ ] Importación realizada desde la app y el informe muestra `no vacías = creadas + fusionadas + para revisar`.
- [ ] Filas marcadas para revisar repasadas con el cliente.
- [ ] Datos de ejemplo borrados antes de la importación real (o entorno de pruebas separado).

## Evidencia de aceptación (docs/ACEPTACION.md)

- [ ] Vídeo del criterio 1 desde un celular con cronómetro (mediana de tres intentos por debajo de un minuto).
- [ ] Vídeo del criterio 2 con dos dispositivos y reloj visible.
- [ ] Vídeo del criterio 3 por todas las vías (arrastrar, Mover a, botón Perder).
- [ ] Vídeo del criterio 4 con la hora de Lima visible y captura de la fila en la cola.
- [ ] Vídeo del criterio 5 con dos sesiones (miembro y administrador).
- [ ] Vídeo del criterio 6 con la hoja real y el informe.
- [ ] Vídeo del criterio 7 filtro → exportar → abrir en Excel.
- [ ] URL de previsualización comprobada en celular y computadora, sin errores en consola.

## Documentación

- [ ] README.md al día (instalación, variables, despliegue).
- [ ] Guía de uso de una página entregada (`docs/GUIA.md` y pantalla Ayuda en la app).
- [ ] Contrato de recordatorios entregado.
- [ ] Ficha del proyecto en el Segundo Cerebro actualizada con decisiones, fechas y aprendizajes.

## Verificación de los criterios contra la base real (2026-09-13)

Hecha con datos reales en Supabase y con la app desplegada, no sobre el papel.

| # | Criterio | Cómo se comprobó | Estado |
|---|---|---|---|
| 1 | Menos de un minuto | Contacto + oportunidad en 25,8 s cronometrados | ✅ |
| 2 | Al instante para todos | Segunda sesión actualizada en menos de 3 s sin recargar | ✅ |
| 3 | Perder exige motivo | La API devuelve 400 con `oportunidades_perdida_con_motivo` | ✅ |
| 4 | Recordatorio a su hora | 09:31 Lima guardado como 14:31 UTC, avisó puntual en otra pantalla | ✅ |
| 5 | Cada uno edita lo suyo | Sesión real de Ana: 0 filas modificadas al editar lo ajeno, 403 al crear etapa | ✅ |
| 6 | Sin perder filas | 20 no vacías, 0 descartadas, 11 creadas, 1 fusionada, 8 para revisar | ✅ |
| 7 | Exportación con filtros | Pantalla 19 = botón CSV(19) = 19 filas, con BOM y fechas de Lima | ✅ |
| 8 | Repo y URL funcionando | 20 commits en GitHub, URL pública sirviendo la app y hablando con Supabase | ✅ |

Pendiente de la entrega: dar acceso al revisor de Kodarvia, enviarle las contraseñas de prueba, importar la hoja real del cliente y grabar los vídeos de evidencia.
