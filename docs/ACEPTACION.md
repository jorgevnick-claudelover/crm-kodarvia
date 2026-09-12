# Plan de aceptación

Cómo se demuestra cada uno de los 8 criterios de Kodarvia, qué evidencia se prepara y qué interpretación se aplica. Se completa con enlaces a vídeos y capturas antes de la entrega.

Entorno de revisión: URL de previsualización en Cloudflare Pages, proyecto Supabase con la migración aplicada, tres usuarios de prueba (un administrador y dos miembros) y datos de ejemplo cargados. Las contraseñas de prueba se entregan por canal privado, nunca en este documento.

| Usuario de prueba | Rol | Uso en la revisión |
|---|---|---|
| admin@ejemplo.pe | Administrador | Ve y edita todo, importa, configura |
| ana@ejemplo.pe | Miembro | Vendedora A |
| luis@ejemplo.pe | Miembro | Vendedor B |

## Criterio 1. Crear un contacto y una oportunidad tarda menos de un minuto desde el celular

**Interpretación.** Con la app abierta y sesión iniciada, desde la pantalla Hoy hasta ver la oportunidad en su etapa. Se mide la mediana de tres intentos.

**Procedimiento.** En un celular real: tocar **+**, **Nuevo contacto**, escribir nombre y celular, dejar el bloque Oportunidad activado (título e importe por defecto), **Guardar**. Cronómetro visible en pantalla.

**Evidencia.** Tres grabaciones de pantalla desde el celular con cronómetro. Lista de campos obligatorios: solo el nombre. Valores por defecto documentados en la guía.

**Riesgos cubiertos.** PWA instalable y sesión persistente para no perder el minuto en abrir; inputs de 16 px para que iOS no haga zoom; botón Guardar visible con el teclado abierto.

## Criterio 2. Mover una oportunidad de etapa se refleja al instante para todos

**Interpretación.** Menos de 3 segundos, sin recargar, en cualquier otro dispositivo con sesión iniciada, en el tablero y en la lista.

**Procedimiento.** Vendedora A en el celular mueve una tarjeta con **Mover a**; el administrador mira el tablero en la computadora sin tocar nada. Repetir en sentido inverso arrastrando en escritorio y mirando el celular.

**Evidencia.** Vídeo con pantalla dividida (computadora y celular) y reloj visible. Nota técnica: canal Realtime de Supabase con respaldo de refresco cada 30 s.

## Criterio 3. Perder una oportunidad exige motivo

**Interpretación.** Por todas las vías: arrastrar a Perdida, botón Perder en el detalle, Mover a → Perdida, y también por API directa.

**Procedimiento.** Intentar confirmar sin motivo (bloqueado), cancelar (la tarjeta vuelve), confirmar con motivo (aparece en la ficha, en el historial y en el panel de perdidas por motivo). Reabrir y volver a perder: pide motivo de nuevo. Prueba en base de datos: `update oportunidades set estado='perdida'` sin motivo devuelve error por la restricción `check`.

**Evidencia.** Vídeo. Restricción en `supabase/migrations/0001_init.sql`. Bloque de `supabase/tests/comprobaciones.sql`.

## Criterio 4. El recordatorio queda programado y visible en la app para su responsable a la hora fijada

**Interpretación.** Al crear una tarea con recordatorio, existe una fila en la cola `recordatorios_correo` con la hora correcta en `America/Lima`, y a esa hora la app muestra el aviso al responsable (toast persistente si está abierta; tarjeta de recordatorios en Hoy hasta marcarlo visto). El envío del correo lo conecta Kodarvia con `docs/CONTRATO-RECORDATORIOS.md`.

**Procedimiento.** Vendedora A crea una tarea para dentro de 2 minutos con recordatorio. Permanece en otra pantalla: a la hora aparece el aviso. Cierra y reabre: sigue en Hoy hasta pulsar Visto. Vendedor B no ve el aviso. En Supabase, la fila de la cola muestra `enviar_local` con la hora de Lima. Cambiar la hora de la tarea reprograma; completar la tarea cancela.

**Evidencia.** Vídeo con reloj del sistema. Captura de la fila en la cola. Contrato de recordatorios entregado a Kodarvia. Aviso al revisor: la hora se muestra siempre en Lima aunque el revisor esté en otro huso horario.

## Criterio 5. Cada usuario edita solo lo suyo; el administrador edita todo

**Interpretación.** "Lo suyo" = registros donde es responsable. Todos ven todo. Cualquiera puede registrar actividad y crear tareas sobre contactos ajenos (cubre vacaciones). Solo el administrador reasigna, importa y configura. Se aplica en base de datos (RLS), no solo en pantalla.

**Procedimiento.** Como A: editar un contacto propio (permitido), abrir un contacto de B (sin botón editar; un `update` directo con su sesión devuelve cero filas), intentar reasignar (error), intentar entrar en Importar o Configuración (bloqueado). Como administrador: editar registros de A y B, reasignar, importar, configurar.

**Evidencia.** Matriz de permisos en `docs/ARQUITECTURA.md` sección 6. Políticas RLS en la migración. Vídeo con dos sesiones. Captura de la respuesta de la API con la sesión de A.

## Criterio 6. La importación carga la hoja del cliente sin perder filas

**Interpretación.** Toda fila no vacía de la hoja acaba en el CRM: creada, fusionada con un duplicado existente, o creada y marcada para revisar. Cero filas descartadas. El informe muestra `no vacías = creadas + fusionadas + para revisar`.

**Procedimiento.** Contar filas con datos en la hoja (N). Importar desde la app: subir, elegir hoja, mapear columnas, previsualizar, confirmar. Comprobar el informe y descargarlo. Buscar tres filas concretas en Contactos. Repetir con `fixtures/hoja-ejemplo.xlsx`, cuyo recuento esperado está en `fixtures/README.md`.

**Evidencia.** Hoja real importada en el entorno de entrega (con el informe). Hoja de ejemplo con recuento esperado y prueba automatizada del mapeo. Vídeo.

## Criterio 7. La exportación respeta los filtros aplicados

**Interpretación.** El CSV contiene exactamente las filas que la lista muestra con los filtros activos (responsable, etapa, origen, texto, fechas, estado), todas las páginas, con nombres legibles y fechas en Lima.

**Procedimiento.** En Oportunidades filtrar por responsable = A y etapa = Propuesta; anotar el recuento en pantalla; pulsar Exportar (el botón muestra cuántas filas exportará); abrir el CSV en Excel y en Google Sheets; contar filas. Repetir en Contactos y Tareas. Como A, exportar y comprobar que el CSV coincide con su lista.

**Evidencia.** Vídeo filtro → exportar → abrir. Nombre del archivo con fecha y hora. Pruebas unitarias de `src/lib/utils/csv.ts`.

## Criterio 8. Repositorio en GitHub con URL de previsualización funcionando

**Interpretación.** Repositorio con acceso para el equipo revisor, README completo, URL pública en Cloudflare Pages que funciona en celular y computadora, sin errores en consola, con los usuarios de prueba creados.

**Procedimiento.** Aceptar la invitación al repositorio, clonar, seguir el README (`npm install`, `.env.local`, `npm run build`). Abrir la URL, iniciar sesión, recorrer las pantallas. Volver a probar la URL una semana después (el proyecto Supabase Free se pausa tras 7 días sin uso: hay un ping programado, ver `supabase/README.md`).

**Evidencia.** Enlace al repositorio, enlace a la URL, checklist de entrega (propietario del repositorio, del hosting y de Supabase; usuarios creados; hoja importada; guía entregada).

## Fuera de los criterios pero que el revisor probará

Panel (oportunidades por etapa y responsable, tareas vencidas, ganado por mes, embudo mensual con conversión por etapa), búsqueda global, registro de actividad, guía de una página. Se incluyen en el vídeo de recorrido general.
