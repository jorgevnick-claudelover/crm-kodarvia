# Correos con Kodarvia

**Repositorio:** https://github.com/jorgevnick-claudelover/crm-kodarvia
**Enlace de la app:** pendiente de GitHub Pages

---

## Mensaje a enviar ahora (21 de septiembre de 2026)

Explica por qué localStorage y el trabajo en equipo no encajan, sin discutir la decisión, y les deja elegir. Va acompañado de que la adaptación ya está en marcha, para que no parezca una excusa para no hacerlo.

**Asunto:** RE: CRM gestoría Arequipa · adaptación a localStorage y una consulta sobre los criterios 2 y 5

Hola:

Entendido. Ya estoy pasando la aplicación a React con localStorage, sin backend ni base de datos, y la entrega será el repositorio de GitHub con la previsualización en GitHub Pages, que es del propio GitHub y no un servicio mío.

También me queda claro lo de los recordatorios: si basta con que queden programados y visibles en la interfaz para su responsable, lo resuelvo dentro de la app y no preparo ninguna cola. Eso simplifica.

Antes de terminarlo quiero plantearos una cosa, porque afecta a dos de vuestros criterios de aceptación y prefiero que lo decidáis vosotros ahora y no descubrirlo en la revisión.

**Qué es localStorage.** Es el almacén que el navegador reserva para cada web, dentro del dispositivo. Los datos que guarda no salen de ese navegador: no viajan a ningún sitio, no hay nada que los sincronice y ningún otro dispositivo puede leerlos. Si Ana usa su celular y Luis el suyo, cada uno tiene su propia copia, separada e invisible para el otro. Lo que Ana cree no aparecerá nunca en el celular de Luis.

Eso choca con dos criterios:

**Criterio 2, «mover una oportunidad se refleja al instante para todos».** Puedo hacer que se refleje al instante entre pestañas y ventanas del mismo navegador, y lo voy a hacer. Entre dos dispositivos es imposible, porque no hay nada que los conecte.

**Criterio 5, «cada usuario edita solo lo suyo; el responsable edita todo».** La aplicación respetará la propiedad: cada contacto, oportunidad y tarea queda a nombre de quien la crea, los demás la ven pero no pueden editarla, y solo el administrador edita todo y reasigna. Lo que no puedo es verificar quién entra, porque no hay servidor que valide una contraseña: quedará un selector de usuario al inicio y cualquiera podrá elegir cualquier nombre. Es una simulación coherente, no una restricción real.

Dicho de otra forma: con localStorage el CRM funciona perfectamente como herramienta de una persona, o de varias que comparten el mismo equipo. Lo que no puede es ser una herramienta de equipo repartida entre cinco celulares, que es el problema que el briefing describe cuando habla de que los contactos se quedan en pausa cuando alguien se va de vacaciones.

**Tres salidas, y me adapto a la que digáis:**

1. **Entregar así, como demostración.** Es lo que estoy haciendo y lo tengo listo en pocos días. Acordamos por escrito que los criterios 2 y 5 se revisan en un mismo equipo con varias pestañas, y queda cerrado.
2. **Que el cliente lo use de verdad entre varias personas.** Entonces hace falta algún almacenamiento compartido. No tiene por qué ser mío ni suponeros coste: Lovable, que mencionáis como alternativa en el propio encargo, incorpora esa pieza de serie, y hay opciones gratuitas. La aplicación ya está construida para funcionar de las dos maneras, así que el cambio es de horas, no de días.
3. **Otra cosa que tengáis en mente** y que yo no esté viendo. Si es así, decídmelo y me adapto.

Sigo adelante con la primera mientras me respondéis, para no perder tiempo. Solo quería que la decisión fuera vuestra y estuviera dicha antes de la entrega.

Un saludo

---

## Pendiente de la gestoría, sin respuesta desde el 13 de septiembre

1. Su hoja de contactos actual, con todas las columnas y pestañas, en el Excel original. Puede venir anonimizada. Con veinte filas de muestra vale para empezar.
2. Las etapas y los motivos de pérdida que usan hoy, en orden y con su nombre exacto.
3. El logotipo en PNG o SVG, y el color de marca.

Y tres preguntas para ellos: si identifican a cada independiente por RUC o DNI, si quieren WhatsApp como tipo de contacto, y a qué hora prefieren el aviso de las tareas del día.
