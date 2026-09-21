/**
 * Contenido de la guía de una página. Mismo texto que `docs/GUIA.md`: si se cambia aquí,
 * se cambia allí. Trato de usted, español de Perú, sin jerga: los nombres de botones son
 * exactamente los que aparecen en la app.
 */
import {
  BarChart3,
  BellRing,
  CalendarCheck,
  Download,
  Laptop,
  MoveRight,
  Phone,
  Search,
  ShieldCheck,
  Smartphone,
  Trophy,
  Upload,
  UserPlus,
  type LucideIcon,
} from "lucide-react"

export interface BloquePasos {
  titulo: string
  pasos: string[]
}

export interface DefinicionAyuda {
  termino: string
  texto: string
}

export interface SeccionAyuda {
  id: string
  titulo: string
  icono: LucideIcon
  /** Dos o tres frases, nada más. */
  texto: string
  /** Pasos numerados. */
  pasos?: string[]
  /** Pasos separados por situación (celular / computadora, iPhone / Android). */
  bloques?: BloquePasos[]
  /** Lista de "qué significa cada cosa", una frase por línea. */
  definiciones?: DefinicionAyuda[]
  /** Frase final destacada. */
  nota?: string
}

export const SECCIONES: SeccionAyuda[] = [
  {
    id: "llamada",
    titulo: "Apuntar una llamada en 20 segundos",
    icono: Phone,
    texto:
      "Acaba de colgar: apúntelo antes de olvidarlo. Desde cualquier pantalla del celular, el botón + azul está siempre abajo a la derecha.",
    pasos: [
      "Toque + y luego Llamada (o WhatsApp, Reunión o Nota).",
      "Escriba dos letras del nombre del contacto y elíjalo de la lista.",
      "Toque el Resultado que corresponda y escriba una Nota corta si hace falta.",
      "En Próximo paso toque Hoy, Mañana, En 3 días o Próx. semana: la tarea «Llamar a…» se crea sola.",
      "Toque Guardar.",
    ],
    nota: "En la computadora el mismo botón está arriba a la derecha y se llama Nuevo.",
  },
  {
    id: "contacto",
    titulo: "Crear un contacto y su oportunidad",
    icono: UserPlus,
    texto:
      "El contacto y su oportunidad se crean en el mismo formulario, de una sola vez. Lo único obligatorio es el nombre; todo lo demás puede quedar en blanco.",
    pasos: [
      "Toque + y luego Nuevo contacto.",
      "Escriba el Nombre y el Celular, y toque el chip del Origen.",
      "Si necesita empresa, RUC, correo o dirección, abra Más datos.",
      "Deje activado Crear oportunidad: el título, el importe y la etapa ya vienen puestos y se pueden cambiar.",
      "Toque Guardar. Se abre la ficha del contacto, ya con su oportunidad.",
    ],
  },
  {
    id: "mover",
    titulo: "Mover de etapa",
    icono: MoveRight,
    texto:
      "La oportunidad avanza por etapas hasta cerrarse. El cambio se ve al instante en las demás pestañas y ventanas abiertas en esta misma computadora o celular.",
    bloques: [
      {
        titulo: "En el celular",
        pasos: [
          "Entre en Oportunidades y toque el chip de la etapa que quiere ver.",
          "En la tarjeta toque Mover a.",
          "Elija la etapa: la siguiente aparece destacada arriba.",
        ],
      },
      {
        titulo: "En la computadora",
        pasos: [
          "Entre en Oportunidades: verá el tablero por columnas.",
          "Arrastre la tarjeta a la columna de la otra etapa y suéltela.",
        ],
      },
    ],
    nota: "Al mover sale el aviso «Movida a …» con Deshacer durante 5 segundos, por si se equivocó.",
  },
  {
    id: "ganar-perder",
    titulo: "Ganar y perder",
    icono: Trophy,
    texto:
      "Ganada y Perdida no son etapas: son el final de la oportunidad. Están al final del sheet Mover a, en los botones Ganar y Perder de la oportunidad y, en la computadora, en las dos zonas de debajo del tablero.",
    pasos: [
      "Para ganar: confirme el Importe final y toque Confirmar ganada.",
      "Para perder: elija un Motivo y, si quiere, escriba un Detalle. Luego toque Confirmar pérdida.",
      "Si se cerró por error, abra la oportunidad y toque Reabrir.",
    ],
    nota: "El motivo es obligatorio: sin motivo no se guarda. Así el Panel puede decirle por qué se pierde el trabajo y no solo cuánto.",
  },
  {
    id: "tareas",
    titulo: "Tareas y recordatorios",
    icono: BellRing,
    texto:
      "Una tarea es el próximo paso con un contacto: un título, una fecha y una hora. Todo contacto debería tener una.",
    pasos: [
      "Toque + y luego Tarea, o créela desde Próximo paso al apuntar una llamada.",
      "Elija la fecha con los chips y ajuste la Hora.",
      "Deje activado Avisarme.",
    ],
    nota: "A la hora fijada, con la app abierta, el aviso sale esté donde esté dentro del CRM. Si la tenía cerrada, el recordatorio le espera al volver a entrar y en Hoy aparece el bloque Recordatorios con los botones Visto y Hecha. No se envía ningún correo: el aviso vive dentro de la app.",
  },
  {
    id: "hoy",
    titulo: "La pantalla Hoy",
    icono: CalendarCheck,
    texto:
      "Es la pantalla con la que arranca la app y lo primero que conviene mirar cada mañana. Reúne sus tareas en tres bloques: Vencidas, Hoy y Próximos 7 días.",
    pasos: [
      "Arriba, los chips Mías y Todas cambian lo que ve.",
      "Toque Hecha para cerrar una tarea; se puede Deshacer.",
      "Llamar y WhatsApp abren el teléfono con el número ya puesto.",
    ],
  },
  {
    id: "buscar",
    titulo: "Buscar",
    icono: Search,
    texto:
      "Busca a la vez en contactos, oportunidades, tareas y actividades. Sirve el nombre, el celular, la empresa, el RUC o un trozo de una nota.",
    pasos: [
      "Toque Buscar en la barra de abajo, o la lupa de la cabecera.",
      "Escriba desde dos letras; los resultados van saliendo solos.",
      "Los resultados llegan agrupados en Contactos, Oportunidades, Tareas y Actividades.",
    ],
    nota: "Muestra los 50 más recientes: si son muchos, añada una palabra más.",
  },
  {
    id: "panel",
    titulo: "El Panel",
    icono: BarChart3,
    texto:
      "Resume el estado del estudio en cinco números, con gráficos debajo. Arriba se elige el Periodo y el Responsable, y todo lo demás se recalcula.",
    definiciones: [
      { termino: "Abiertas", texto: "Cuántas oportunidades siguen vivas y cuánto suman en S/." },
      { termino: "Ganado este mes", texto: "Cuánto se cerró a favor este mes, en S/." },
      { termino: "Perdidas este mes", texto: "Cuántas oportunidades se dieron por perdidas este mes." },
      { termino: "Tareas vencidas", texto: "Tareas pendientes cuya hora ya pasó." },
      { termino: "Sin seguimiento", texto: "Contactos que no tienen ninguna tarea pendiente." },
    ],
    nota: "Debajo: Abiertas por etapa y responsable, Ganado por mes, Embudo del mes, Perdidas por motivo y Tareas vencidas por responsable.",
  },
  {
    id: "importar",
    titulo: "Importar la hoja",
    icono: Upload,
    texto:
      "Sube la hoja de Excel o el CSV del estudio al CRM. Solo la ve el administrador y son cuatro pasos; nada se guarda hasta el último.",
    pasos: [
      "Archivo: arrastre el .xlsx, .xls o .csv y elija la pestaña si hay varias.",
      "Mapeo: revise a qué campo va cada columna de la hoja.",
      "Revisar: mire cuántas filas se crearán, cuántas se fusionan con un contacto que ya existe y cuántas quedan para revisar.",
      "Importar: al terminar puede descargar el informe fila por fila.",
    ],
    nota: "No se pierde ninguna fila: las que llegan sin nombre entran igual, marcadas para revisar. Si algo salió mal, use Deshacer esta importación.",
  },
  {
    id: "exportar",
    titulo: "Exportar respetando los filtros",
    icono: Download,
    texto:
      "El botón Exportar (en el celular, CSV) está en Contactos, Oportunidades y Tareas. Saca exactamente lo que muestra la pantalla, no toda la base.",
    pasos: [
      "Deje puestos los filtros que le interesan.",
      "Toque Exportar: entre paréntesis le dice cuántas filas salieron.",
      "Se descarga un archivo CSV que Excel abre con las tildes y los soles bien puestos.",
    ],
  },
  {
    id: "permisos",
    titulo: "Quién puede editar qué",
    icono: ShieldCheck,
    texto:
      "Todos ven todo. Cada persona edita lo suyo, es decir los contactos, oportunidades y tareas de los que es responsable.",
    pasos: [
      "Cualquiera puede apuntar una actividad o crear una tarea sobre un contacto de otro; así se cubren las vacaciones.",
      "Solo el administrador cambia el responsable, importa la hoja y entra en Configuración.",
      "Si intenta editar algo que no es suyo, la app lo avisa y no se pierde nada.",
    ],
  },
  {
    id: "datos",
    titulo: "Dónde se guardan los datos",
    icono: Laptop,
    texto:
      "El CRM guarda todo dentro del navegador de esta computadora o de este celular. No hay servidor detrás: nada viaja a internet y nada se comparte solo con sus compañeros.",
    pasos: [
      "Lo que escribe aquí se ve al instante en las demás pestañas y ventanas abiertas en este mismo equipo.",
      "Dos equipos distintos llevan dos CRM distintos: para pasar la información hay que exportarla y volver a cargarla.",
      "El administrador tiene en Configuración → Datos el botón Descargar copia; hágalo de vez en cuando.",
    ],
    nota: "Si borra los datos de navegación del equipo, se borra también el CRM. La copia descargada es la única forma de recuperarlo.",
  },
  {
    id: "instalar",
    titulo: "Instalar la app en el celular",
    icono: Smartphone,
    texto:
      "Conviene tenerla como un icono más en la pantalla de inicio: se abre sola, a pantalla completa y sin escribir la dirección.",
    bloques: [
      {
        titulo: "iPhone (Safari)",
        pasos: [
          "Abra la app en Safari.",
          "Toque Compartir, el cuadrado con la flecha hacia arriba.",
          "Baje y toque Añadir a pantalla de inicio, y luego Añadir.",
        ],
      },
      {
        titulo: "Android (Chrome)",
        pasos: [
          "Abra la app en Chrome.",
          "Toque los tres puntos de arriba a la derecha.",
          "Toque Añadir a pantalla de inicio, y luego Instalar.",
        ],
      },
    ],
  },
]
