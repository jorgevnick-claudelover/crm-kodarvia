# Correo para Kodarvia

Un solo correo, dirigido a Kodarvia, que es quien hace de intermediario con la gestoría. Enseña la app funcionando, pide lo que falta del cliente y pide su opinión.

**Enlace de la app:** https://crm-kodarvia.jorgevnick.workers.dev
**Repositorio:** https://github.com/jorgevnick-claudelover/crm-kodarvia

Las contraseñas de prueba van por canal privado, nunca dentro del correo.

---

**Asunto:** CRM gestoría Arequipa · ya funciona, faltan los datos del cliente

Hola:

El CRM ya está terminado y desplegado. Toda la estructura funciona y se puede probar ahora mismo:

**https://crm-kodarvia.jorgevnick.workers.dev**

Os mando por privado tres usuarios de prueba: un administrador y dos vendedores, para que veáis cómo cambian los permisos entre unos y otros. Dentro hay datos de ejemplo cargados para que se vea lleno.

Está todo lo del encargo: fichas de contacto, oportunidades en tablero con arrastrar y soltar, motivo obligatorio al perder, tareas con recordatorio, registro de actividad, búsqueda global, panel con embudo mensual, importación desde Excel y exportación a CSV respetando los filtros. Y la guía de uso está dentro de la propia app, en la sección Ayuda.

He comprobado los ocho criterios de aceptación contra la base de datos real. Dos apuntes por si os ahorran trabajo al revisar:

- **El cambio de etapa se ve al instante**: abridlo en dos dispositivos con usuarios distintos, mirad el tablero en los dos y mover una tarjeta en uno. En el otro cambia sola, sin recargar.
- **Las horas son siempre de Lima**, que es la del cliente. Si revisáis desde España veréis siete horas de diferencia con vuestro reloj, y es lo correcto. Lo digo porque es fácil dar por fallado el criterio del recordatorio si no se tiene en cuenta.

## Lo que falta, y es cosa del cliente

Solo quedan detalles de contenido. Si se lo podéis pedir a la gestoría, lo dejo cerrado en cuanto llegue:

1. **Su hoja de contactos actual**, con todas las columnas y todas las pestañas, en el Excel original. Puede venir anonimizada o con los nombres cambiados. Con veinte filas de muestra me vale para empezar; la completa la cargo al final, de una vez y sin perder ninguna fila.
2. **Las etapas y los motivos de pérdida que usan hoy**, en orden y con el nombre exacto que ellos les dan. Ahora hay unos de ejemplo que se cambian en dos minutos desde la propia app.
3. **El logotipo** en PNG o SVG, y el color de su marca si lo tienen.

Y tres preguntas cortas para ellos, que cambian cómo queda cada ficha:

- ¿Identifican a cada independiente por **RUC o DNI**? Si viene en la hoja lo uso para detectar repetidos, que es más fiable que el celular.
- ¿Quieren **WhatsApp** como tipo de contacto, junto a la llamada y la reunión?
- ¿A qué **hora** prefieren el aviso de las tareas del día? Por defecto está a las nueve de la mañana.

Si les podéis dar también el enlace para que lo prueben desde el celular, mejor: que metan lo que quieran con confianza, porque al cargar su hoja real se borra todo lo de prueba y se empieza limpio. Lo que más me interesa saber de ellos es qué les sobra, qué les falta y si alguna palabra no es la que usan en el estudio.

## Lo que necesito de vosotros

1. **Cómo conectáis el correo de los recordatorios.** La app ya deja cada aviso preparado en una cola, con destinatario, asunto, cuerpo, enlace y hora. Solo hay que leerla y enviar. Os adjunto el documento con las tres formas de hacerlo; elegid la que os encaje y me adapto. Si ya tenéis un mecanismo estándar de otros encargos, decídmelo y lo cumplo.
2. **Acceso al repositorio**: decidme el usuario de GitHub de quien vaya a revisar y le doy permiso.
3. **Vuestra opinión.** Si algo no os cuadra, prefiero saberlo ahora que en la entrega.
4. **Condiciones**: si el pago es a la aceptación, cuántas rondas de revisión incluye y de quién es el código al entregarlo.

Una aclaración sobre el stack. El portal indicaba React con localStorage. He construido con React y una base de datos compartida, porque con localStorage los datos no salen del navegador de cada persona: el cambio de etapa no lo verían los demás, los permisos por usuario no serían reales y vosotros no tendríais de dónde leer los recordatorios. Es el mismo React del encargo, sin coste añadido, y funcionando de verdad.

Quedo atento a lo que me digáis.

Un saludo

---

## Recordatorio corto, si en tres días no contestan

Buenas, ¿pudisteis ver el CRM? Sobre todo me interesa que la gestoría me pase su hoja de contactos aunque sea con veinte filas, y la lista de etapas y motivos de pérdida que usan. Con eso lo dejo cerrado. Gracias.
