# Preguntas para arrancar el CRM

Fecha: 12 de septiembre de 2026. Entrega prevista: 3 de octubre de 2026.

Las marcadas con ★ bloquean alguna parte de la entrega. El resto se pueden responder más adelante, pero cuanto antes mejor.

> **Actualización del 21/09/2026.** Kodarvia respondió por escrito a varias de estas: React con `localStorage` y sin backend, los recordatorios basta con dejarlos programados y visibles en la app, y el proyecto vive en GitHub (se publica en GitHub Pages). Eso deja sin objeto las preguntas sobre el envío de los recordatorios, sobre Supabase y sobre el hosting. Ver `docs/DECISIONES.md`, entradas del 2026-09-21.

---

## A Kodarvia

### Recordatorios por correo (criterio 4)

1. ★ ¿Cómo van a conectar el envío de correos? Propongo tres opciones y me adapto a la que prefieran:
   - **Endpoint de consulta**: yo expongo una URL protegida con una clave que ustedes llaman cada minuto; devuelve los recordatorios pendientes y ustedes confirman cuáles enviaron.
   - **Webhook**: ustedes me dan una URL y yo la llamo a la hora fijada con los datos del recordatorio (firmado).
   - **Mecanismo estándar suyo**: si ya tienen uno que usan en otros encargos, díganme cómo funciona y lo cumplo.
2. ★ ¿Qué datos necesitan en cada recordatorio? Propongo: correo del responsable, nombre del responsable, título de la tarea, nombre del contacto, hora del recordatorio en hora de Lima, enlace directo a la tarea.
3. ¿Un correo por recordatorio a la hora fijada, o un resumen diario?
4. ¿Qué acceso necesitarán después de la entrega para mantener la conexión? (Les daré una clave específica de integración, no la clave maestra de la base de datos.)

### Entrega y revisión (criterio 8)

5. ★ ¿Basta con el repositorio en GitHub más la URL de previsualización, o exigen el proyecto transferido en Lovable? Si es Lovable, ¿en qué cuenta y quién paga el plan de pago que hace falta para publicar?
6. ★ ¿En qué cuentas debe nacer el proyecto (GitHub, Supabase, hosting)? ¿Las suyas, las del cliente o las mías y luego se transfieren? ¿Quién paga hosting y base de datos después de la entrega? (Hoy todo cabe en planes gratuitos.)
7. ¿Quién acepta la entrega: ustedes, el cliente o ambos? ¿Cuántas rondas de revisión incluye el encargo?
8. ¿Desde qué país o zona horaria revisarán? Los recordatorios se muestran en hora de Lima y quiero que el revisor lo sepa.
9. ¿La URL de previsualización será la que use el cliente en producción, o quieren una URL de pruebas aparte con datos de ejemplo?

### Condiciones

10. ¿El pago de 125 € se hace a la aceptación? ¿Qué pasa si el cliente tarda en entregar la hoja o las etapas y eso retrasa la revisión?
11. ¿De quién es el código entregado y con qué licencia? ¿Pueden reutilizarlo para otros clientes?
12. ¿Hay garantía o soporte después de la aceptación? Si sí, ¿cuánto tiempo y qué incluye?

### Interpretación de los criterios

13. Para "se refleja al instante para todos" (criterio 2): ¿aceptan que el cambio aparezca en los demás dispositivos en menos de 2 o 3 segundos sin recargar?
14. Para "sin perder filas" (criterio 6): propongo que toda fila no vacía de la hoja acabe en el CRM, aunque le falten datos (queda marcada para revisar), y que el importador entregue un informe con el recuento. ¿De acuerdo?
15. Para "importación inicial": ¿basta con que yo cargue la hoja una vez, o quieren que el cliente pueda repetir la importación desde la app?

---

## Al cliente (la gestoría)

### Lo que necesito que me envíen ★

1. ★ La hoja de contactos actual anonimizada, con **todas** las columnas y todas las pestañas, en su formato original (Excel, Google Sheets). Con 20 filas de ejemplo me basta para empezar; la completa la cargo al final.
2. ★ La lista de etapas que usan hoy, en orden, tal como las nombran.
3. ★ La lista de motivos de pérdida que usan hoy.
4. ★ El logotipo (PNG o SVG) y, si tienen, el color principal de la marca.
5. ★ Nombre y correo de las personas que usarán el CRM (hasta 5) y quién es el responsable que ve y edita todo.

### Sobre la hoja

6. ¿Cada fila es un contacto o una oportunidad? ¿Un mismo contacto puede aparecer en varias filas?
7. ¿Tienen columna de RUC o DNI? Si sí, la uso para detectar duplicados; es más fiable que el teléfono.
8. ¿Cómo escriben los teléfonos? (¿con +51, solo 9 dígitos, varios en una celda?)
9. ¿Hay colores, negritas o comentarios en la hoja que signifiquen algo (por ejemplo, rojo = perdido)?

### Sobre cómo trabajan

10. ¿Qué es una "oportunidad" para ustedes? ¿El alta de un nuevo cliente de facturación electrónica, un servicio adicional, o las dos cosas?
11. ¿Qué pasa con el contacto cuando ganan? ¿Pasa a ser "cliente activo"? ¿Registran bajas?
12. ¿"Ganado por mes" son las altas nuevas del mes o la cuota mensual que facturan?
13. ¿Hay un importe típico (por ejemplo, la cuota mensual) que pueda venir puesto por defecto al crear una oportunidad? ¿Siempre en soles?
14. ¿Registran WhatsApp como un tipo de contacto distinto de la llamada? ¿Y como origen de nuevos contactos?
15. ¿Cómo llegan los contactos nuevos hoy? (recomendación, redes, web, referido de otro cliente, etc.) Los uso como lista de orígenes.
16. ¿A qué hora quieren por defecto el recordatorio de una tarea (por ejemplo, 9:00)? ¿Quieren que al apuntar una llamada se proponga siempre una próxima tarea?
17. ¿Leen el correo a diario? Si viven en WhatsApp, el recordatorio por correo puede pasar desapercibido; conviene saberlo.

### Sobre permisos

18. ¿Todos ven todos los contactos y oportunidades (solo lectura), y cada uno edita únicamente los suyos? Es lo que propongo, así cuando alguien está de vacaciones otro puede ver su cartera.
19. ¿Cualquiera puede apuntar una llamada o crear una tarea sobre un contacto de un compañero?
20. ¿Solo el responsable puede reasignar contactos, importar, exportar todo y cambiar las etapas?

### Sobre dispositivos y uso

21. ¿Qué celulares usa el equipo (iPhone o Android) y con qué navegador?
22. ¿Tienen datos móviles estables cuando están fuera de la oficina?
23. ¿El tablero en escritorio es para la computadora del responsable o para un monitor fijo en la oficina?
24. ¿Cómo prefieren entrar: correo y contraseña que crea el responsable, o un enlace que llega por correo?
25. ¿Qué palabras usan ustedes: "oportunidad" o "prospecto"? ¿"celular"? ¿"independiente" o "autónomo"? Quiero que la app hable como ustedes.

### Datos personales

26. ¿La gestoría tiene inscrito su banco de datos personales ante la Autoridad de Protección de Datos (Ley 29733)? Los datos se alojarán en servidores fuera de Perú; conviene tenerlo claro y documentado.
27. ¿Por qué canal privado me envían la hoja real cuando toque cargarla? (No debe ir por el repositorio ni por chat público.)
