# Correos listos para enviar

Actualizados el 13 de septiembre de 2026, cuando el CRM ya está desplegado y funcionando. El enfoque cambia: en vez de pedir datos a ciegas, se enseña algo que funciona y se pide que lo prueben. Se contesta mucho más a un correo con un enlace que a uno con una lista de peticiones.

**Enlace de la app:** https://crm-kodarvia.jorgevnick.workers.dev
**Repositorio:** https://github.com/jorgevnick-claudelover/crm-kodarvia

Las contraseñas de prueba van por canal privado, nunca en el correo ni en este archivo.

---

## 1. A Kodarvia

**Asunto:** CRM gestoría Arequipa · funcionando, con enlace para revisar

Hola:

El CRM ya está desplegado y funcionando. Podéis entrar y probarlo:

**https://crm-kodarvia.jorgevnick.workers.dev**

Os paso por privado tres usuarios de prueba: un administrador y dos vendedores, para que veáis cómo cambian los permisos entre unos y otros. Dentro hay datos de ejemplo ya cargados.

El código está en https://github.com/jorgevnick-claudelover/crm-kodarvia. Decidme con qué usuario de GitHub quiere entrar quien vaya a revisar y le doy acceso.

He probado los ocho criterios contra la base de datos real y los cumple. Por si os ahorra trabajo, os resumo cómo comprobar los dos más delicados:

- **Que el cambio de etapa se vea al instante**: abrid la app en dos dispositivos con usuarios distintos, mirad el tablero en los dos y mover una tarjeta en uno. En el otro cambia sola, sin recargar.
- **Que el recordatorio salte a su hora**: cread una tarea para dentro de dos minutos con el aviso activado. Un detalle importante: **las horas se muestran siempre en hora de Lima**, que es la del cliente. Si revisáis desde España veréis siete horas de diferencia respecto a vuestro reloj, y es lo correcto.

**Lo que necesito de vosotros:**

1. **Cómo conectáis el correo de los recordatorios.** La app ya deja cada aviso preparado en una cola, con destinatario, asunto, cuerpo, enlace y hora. Solo hay que leerla y enviar. Os adjunto el documento con las tres formas de hacerlo; elegid la que os encaje y me adapto. Si ya tenéis un mecanismo estándar de otros encargos, decídmelo y lo cumplo.
2. **Vuestro parecer.** Si algo no os cuadra, prefiero saberlo ahora que en la entrega.
3. **Condiciones**: si el pago es a la aceptación, cuántas rondas de revisión incluye y de quién es el código al entregarlo.

Una aclaración sobre el stack. El portal indicaba React con localStorage. He construido con React y una base de datos compartida, porque con localStorage los datos no salen del navegador de cada persona: el cambio de etapa no lo verían los demás, los permisos por usuario no serían reales y vosotros no tendríais de dónde leer los recordatorios. Es el mismo React del encargo, sin coste añadido, y funcionando de verdad.

Quedo atento.

Un saludo

---

## 2. Al cliente (la gestoría)

**Asunto:** Su CRM ya está listo para probar

Estimados:

Ya pueden entrar y probar su CRM:

**https://crm-kodarvia.jorgevnick.workers.dev**

Les envío por privado los usuarios y contraseñas. Ábranlo **desde el celular**, que es como lo van a usar a diario. Si quieren, añádanlo a la pantalla de inicio: en la aplicación, en la sección Ayuda, viene explicado en tres pasos.

Ahora mismo tiene datos de ejemplo para que se vea cómo queda lleno. **Prueben con confianza y metan lo que quieran**: cuando carguemos su hoja real borramos todo lo de prueba y empezamos limpio.

Lo que les pediría que probaran, que es lo que usarán cada día:

1. Apuntar una llamada: el botón **+** de abajo a la derecha, luego Llamada. Debería llevarles unos veinte segundos.
2. Crear un contacto nuevo con su oportunidad, desde el mismo botón **+**.
3. Mover una oportunidad de etapa, con el botón **Mover a** de cada tarjeta.
4. Mirar la pantalla **Hoy** y el **Panel**.

**Y luego me cuentan.** Sobre todo tres cosas: qué les sobra, qué les falta y si alguna palabra no es la que ustedes usan. La aplicación habla de "oportunidades", "etapas" y "responsable", pero si en el estudio lo llaman de otra manera, se cambia.

**Para dejarlo definitivo necesito tres cosas suyas:**

1. **Su hoja de contactos actual**, con todas las columnas y todas las pestañas, en el Excel original. Pueden anonimizarla o cambiar los nombres si lo prefieren. Con veinte filas de muestra me vale para empezar; la completa la cargamos al final, de una vez y sin perder ninguna fila.
2. **Las etapas y los motivos de pérdida que usan hoy**, en orden y con el nombre exacto que ustedes les dan. Ahora hay unos de ejemplo que se cambian en dos minutos.
3. **El logotipo** en PNG o SVG, y el color de su marca si lo tienen.

Y tres preguntas rápidas que cambian cómo queda cada ficha:

- ¿Identifican a cada independiente por **RUC o DNI**? Si viene en la hoja lo uso para detectar repetidos, que es más fiable que el celular.
- ¿Quieren **WhatsApp** como tipo de contacto, junto a la llamada y la reunión?
- ¿A qué **hora** prefieren que el sistema les avise de las tareas del día? Por defecto está a las nueve de la mañana.

La hoja con datos reales, por favor envíenmela por un canal privado, no por un grupo.

Cualquier duda me dicen.

Saludos cordiales

---

## 3. Mensaje corto de recordatorio (si en tres días no contestan)

Buenas, ¿pudieron echarle un vistazo al CRM? Sobre todo me interesa saber si las etapas de ejemplo se parecen a las suyas, y si me pueden pasar la hoja de contactos aunque sea con veinte filas. Con eso lo dejo listo. Gracias.
