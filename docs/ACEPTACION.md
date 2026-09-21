# Plan de aceptación

Cómo se demuestra cada uno de los 8 criterios de Kodarvia, qué evidencia se prepara y qué interpretación se aplica. Se completa con enlaces a vídeos y capturas antes de la entrega.

Entorno de revisión: la URL pública en GitHub Pages (`https://jorgevnick-claudelover.github.io/crm-kodarvia/`). No hay backend, ni servidor, ni contraseñas: al entrar se elige con quién trabajar entre las cinco personas del estudio, que la app siembra sola la primera vez que se abre en ese navegador.

Esto cambia la forma de revisar, y conviene tenerlo claro antes de empezar:

- **Cada navegador es un CRM.** Lo que el revisor escriba en su computadora no lo verá en su celular, ni lo verá nadie más. No hay sincronización: no existe dónde sincronizar.
- **Para las comprobaciones "entre dos personas"** (criterios 2 y 5) se usan **dos pestañas o dos ventanas del mismo navegador**, cambiando de usuario en una de ellas. Es lo máximo que permite un CRM sin servidor, y es exactamente lo que se comprueba.
- **Para empezar de cero** en cualquier momento: Configuración → Datos → *Borrar datos de ejemplo*. En la misma pantalla está *Descargar copia*, que guarda todo en un archivo `.json`.

| Usuario de prueba | Rol | Uso en la revisión |
|---|---|---|
| Rosa Quispe Ccahuana | Administradora | Ve y edita todo, importa, configura |
| Lucía Vargas Salazar | Miembro | Vendedora A |
| Carlos Mamani Huanca | Miembro | Vendedor B |

## Criterio 1. Crear un contacto y una oportunidad tarda menos de un minuto desde el celular

**Interpretación.** Con la app abierta y sesión iniciada, desde la pantalla Hoy hasta ver la oportunidad en su etapa. Se mide la mediana de tres intentos.

**Procedimiento.** En un celular real: tocar **+**, **Nuevo contacto**, escribir nombre y celular, dejar el bloque Oportunidad activado (título e importe por defecto), **Guardar**. Cronómetro visible en pantalla.

**Evidencia.** Tres grabaciones de pantalla desde el celular con cronómetro. Lista de campos obligatorios: solo el nombre. Valores por defecto documentados en la guía.

**Riesgos cubiertos.** PWA instalable y sesión persistente para no perder el minuto en abrir; inputs de 16 px para que iOS no haga zoom; botón Guardar visible con el teclado abierto.

## Criterio 2. Mover una oportunidad de etapa se refleja al instante

**Interpretación.** Menos de 3 segundos, sin recargar, en las demás pestañas y ventanas del mismo navegador, tanto en el tablero como en la lista por etapa. **Lo que no se puede prometer:** con el CRM entero dentro del navegador no hay forma de propagar el cambio a otro equipo ni a otro navegador; son bases de datos separadas. Decirlo de otra manera sería mentir, y el propio cliente pidió que no hubiera servidor.

**Procedimiento.** Abrir la app en dos ventanas del mismo navegador, una junto a otra: la izquierda ancha (tablero de escritorio) y la derecha estrecha, por debajo de 768 px de ancho, para ver la lista por etapa del celular. Las dos en **Oportunidades**. En la ventana estrecha, tocar **Mover a** en una tarjeta y elegir otra etapa: la tarjeta salta de columna en la ventana ancha sin tocar nada. Repetir en sentido inverso arrastrando en el tablero y mirando la lista.

Variante con el celular real: abrir la URL en el celular y en la computadora. Se verá que **no** se propaga, porque son dos navegadores distintos; es el límite documentado arriba, no un fallo.

**Evidencia.** Vídeo con las dos ventanas y reloj visible. Nota técnica: la propagación va por el evento `storage` del navegador, unificado con el evento propio de la pestaña en `src/lib/almacen.ts`; `useRealtime()` agrupa las invalidaciones en 150 ms. Cubierto en `src/lib/almacen.test.ts` (detección de las tablas tocadas).

## Criterio 3. Perder una oportunidad exige motivo

**Interpretación.** Por todas las vías: arrastrar a Perdida, botón Perder en el detalle y Mover a → Perdida. La regla no vive en el formulario: la aplica la capa de datos antes de guardar, así que tampoco se puede saltar llamando a la API de la app.

**Procedimiento.** Intentar confirmar sin motivo (bloqueado), cancelar (la tarjeta vuelve), confirmar con motivo (aparece en la ficha, en el historial y en el panel de perdidas por motivo). Reabrir y volver a perder: pide motivo de nuevo. Prueba fuera de la interfaz: en las pruebas automatizadas, `apiOportunidades.actualizar(id, { estado: 'perdida' })` sin motivo lanza "Para dar una oportunidad por perdida tienes que elegir el motivo." y no escribe nada.

**Evidencia.** Vídeo. `validarOportunidad()` en `src/lib/reglas.ts`, con sus pruebas en `src/lib/reglas.test.ts` y `src/lib/api/datosLocales.test.ts`.

## Criterio 4. El recordatorio queda programado y visible en la app para su responsable a la hora fijada

**Interpretación.** Al crear una tarea con recordatorio, la hora queda guardada en la tarea (`recordatorio_at`, en `America/Lima`) y a esa hora la app avisa a su responsable: toast persistente si la tiene abierta, esté en la pantalla que esté, y bloque **Recordatorios** en Hoy hasta marcarlo **Visto**. **No hay correo ni cola**: el cliente pidió por escrito que bastara con dejarlo programado y visible en la interfaz, así que no se ha construido ningún mecanismo de servidor. Con la app cerrada no llega nada; al volver a entrar, el recordatorio vencido y no visto vuelve a avisar.

**Procedimiento.** Entrar como Vendedora A y crear una tarea para dentro de 2 minutos con **Avisarme** activado. Irse a **Contactos** (o a Panel, o a Oportunidades: sirve cualquiera) y quedarse ahí: a la hora exacta aparece el aviso con **Ver** y **Visto**. Cerrar la pestaña y volver a abrir la app: el aviso reaparece y la tarea sigue en el bloque Recordatorios de Hoy. Pulsar **Visto**: desaparece y no vuelve. Cambiar la hora de la tarea la reprograma; marcarla **Hecha** cancela el aviso. Cerrar sesión y entrar como Vendedor B en la misma ventana: no ve el aviso de A (al salir se descartan los avisos del anterior).

**Evidencia.** Vídeo con el reloj del sistema y la app en una pantalla distinta de Hoy. Nota técnica: `AvisoRecordatorios` se monta en `AppShell` (no en `PaginaHoy`) y programa un `setTimeout` para cada recordatorio que vence en las próximas 12 horas, de modo que salta a la hora exacta. Aviso al revisor: la hora se muestra siempre en Lima aunque el revisor esté en otro huso horario.

## Criterio 5. Cada usuario edita solo lo suyo; el administrador edita todo

**Interpretación.** "Lo suyo" = registros donde es responsable (o autor, en actividades). Todos ven todo. Cualquiera puede registrar actividad y crear tareas sobre contactos ajenos (cubre vacaciones). Solo el administrador reasigna, importa y configura. **Cómo se aplica ahora:** la comprobación no está solo en la pantalla, está en `src/lib/reglas.ts` y la ejecuta la capa de datos antes de escribir, así que tampoco se puede guardar algo ajeno saltándose el formulario. **Lo que no es:** una barrera de seguridad. Sin contraseñas y con la base de datos dentro del navegador, quien abra las herramientas de desarrollo puede editar el JSON a mano. Es una regla de trabajo entre cinco compañeros, y así hay que presentarla.

**Procedimiento.** Entrar como Vendedora A: editar un contacto propio (permitido); abrir un contacto de Vendedor B (se ve entero, sin botón de editar); abrir una tarea de B (se abre en solo lectura, sin Guardar y sin el círculo de "Hecha"); intentar reasignar el responsable (no se ofrece); intentar entrar en **Importar** o **Configuración** por su dirección directa (pantalla "Solo para el administrador"). Cambiar de usuario: **Cerrar sesión** (icono del pie de la barra lateral, o el menú Más en celular) y entrar como Rosa (administradora). Ahora sí edita los registros de A y de B, reasigna, importa y configura. Comprobar de paso lo que sí puede un miembro: registrar una actividad y crear una tarea sobre un contacto de otro.

**Evidencia.** Matriz de permisos en `docs/ARQUITECTURA.md` sección 6. `esAdmin`, `puedeEditar`, `exigirPuedeEditar` y `exigirAdmin` en `src/lib/reglas.ts`, con pruebas en `src/lib/reglas.test.ts` (bloque "permisos") que demuestran que el rechazo ocurre fuera de la interfaz. Vídeo cambiando de usuario en la misma ventana.

## Criterio 6. La importación carga la hoja del cliente sin perder filas

**Interpretación.** Toda fila no vacía de la hoja acaba en el CRM: creada, fusionada con un duplicado existente, o creada y marcada para revisar. Cero filas descartadas. El informe muestra `no vacías = creadas + fusionadas + para revisar`.

**Procedimiento.** Contar filas con datos en la hoja (N). Importar desde la app: subir, elegir hoja, mapear columnas, previsualizar, confirmar. Comprobar el informe y descargarlo. Buscar tres filas concretas en Contactos. Repetir con `fixtures/hoja-ejemplo.xlsx`, cuyo recuento esperado está en `fixtures/README.md`.

**Evidencia.** Hoja real importada en el entorno de entrega (con el informe). Hoja de ejemplo con recuento esperado y prueba automatizada del mapeo. Vídeo.

## Criterio 7. La exportación respeta los filtros aplicados

**Interpretación.** El CSV contiene exactamente las filas que la lista muestra con los filtros activos (responsable, etapa, origen, texto, fechas, estado), todas las páginas, con nombres legibles y fechas en Lima.

**Procedimiento.** En Oportunidades filtrar por responsable = A y etapa = Propuesta; anotar el recuento en pantalla; pulsar Exportar (el botón muestra cuántas filas exportará); abrir el CSV en Excel y en Google Sheets; contar filas. Repetir en Contactos y Tareas. Como A, exportar y comprobar que el CSV coincide con su lista.

**Evidencia.** Vídeo filtro → exportar → abrir. Nombre del archivo con fecha y hora. Pruebas unitarias de `src/lib/utils/csv.ts`.

## Criterio 8. Repositorio en GitHub con URL de previsualización funcionando

**Interpretación.** Repositorio con acceso para el equipo revisor, README completo, y URL pública que funciona en celular y computadora, sin errores en consola. La URL la sirve **GitHub Pages**, del propio GitHub, porque el cliente descartó los servicios propios del partner.

**Procedimiento.** Aceptar la invitación al repositorio, clonar y seguir el README: `npm install` y `npm run dev` deben bastar, sin configurar nada ni crear cuentas. Abrir la URL pública, elegir un usuario y recorrer las pantallas. **Recargar la página estando en `/crm-kodarvia/contactos`**: debe seguir funcionando (GitHub Pages no reescribe rutas, y por eso el build deja un `dist/404.html` copiado de `index.html`). Instalar la PWA desde el celular y comprobar que abre a pantalla completa. Volver a probar la URL una semana después: al ser un sitio estático no se pausa ni caduca.

**Evidencia.** Enlace al repositorio, enlace a la URL, workflow `.github/workflows/pages.yml` en verde, checklist de entrega (propietario del repositorio y de Pages; hoja importada; guía entregada).

## Fuera de los criterios pero que el revisor probará

Panel (oportunidades por etapa y responsable, tareas vencidas, ganado por mes, embudo mensual con conversión por etapa), búsqueda global, registro de actividad, guía de una página. Se incluyen en el vídeo de recorrido general.
