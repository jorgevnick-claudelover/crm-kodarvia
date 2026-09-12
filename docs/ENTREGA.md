# Lista de comprobación de entrega

Se marca cada punto antes de enviar la entrega a Kodarvia. Fecha límite: 3 de octubre de 2026.

## Cuentas y propiedad

- [ ] Decidido con Kodarvia y el cliente en qué cuentas viven el repositorio, Supabase y Cloudflare Pages (ver PREGUNTAS.md).
- [ ] Repositorio en GitHub creado desde esta carpeta (`git remote add origin ... && git push -u origin main`) y con acceso para el equipo revisor de Kodarvia.
- [ ] Proyecto Supabase creado (plan Free, región `sa-east-1` o `us-east-1`).
- [ ] Proyecto de Cloudflare Pages conectado al repositorio: comando `npm run build`, carpeta `dist`, variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- [ ] Anotado quién paga hosting y base de datos tras la entrega (hoy todo es gratuito).

## Base de datos

- [ ] `supabase/migrations/0001_init.sql` aplicado en el SQL Editor sin errores.
- [ ] `supabase/seed.sql` aplicado (etapas, motivos, orígenes y configuración de ejemplo).
- [ ] `supabase/tests/comprobaciones.sql` ejecutado y todas las comprobaciones en verde.
- [ ] `configuracion.url_app` actualizado con la URL real de la app (para los enlaces de los correos).
- [ ] Etapas, motivos de pérdida y orígenes sustituidos por los reales del cliente desde Configuración.
- [ ] Ping programado para que el proyecto Free no se pause (ver `supabase/README.md`) y copia de seguridad probada una vez.

## Usuarios

- [ ] Usuarios reales creados con `scripts/crear-usuarios.mjs` (hasta 5) y el administrador marcado como `admin`.
- [ ] Usuarios de prueba para la revisión (admin, dos miembros) creados y sus contraseñas enviadas a Kodarvia por canal privado.
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
