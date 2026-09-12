# Hoja de ejemplo para probar la importación

`hoja-ejemplo.xlsx` (y su copia `hoja-ejemplo.csv`) imita una hoja real de la gestoría con los problemas habituales. Se regenera con `node scripts/generar-hoja-ejemplo.mjs`.

## Qué contiene la pestaña "Contactos"

- Fila 1: título ("Clientes y prospectos 2026"). La cabecera real está en la **fila 2**.
- 22 filas de datos (filas 3 a 24), de las cuales **20 no están vacías** y 2 están completamente vacías.
- Teléfonos en todos los formatos: número de Excel (`987654321`), `+51 987 111 222`, `51-955444333`, `0051987123123`, con espacios (`9 5 5 1 2 3 4 5 6`), fijo de Arequipa (`054-123456`, `(054) 654321`), dos números en una celda (`944222111 / 987000111`).
- Importes como número (`120`), como texto con símbolo (`S/ 150`, `S/ 320.00`) y con coma de miles (`1,200`).
- Fechas como texto `dd/mm/yyyy`, como ISO `2026-08-15`, como fecha de Excel (serial 45871) y vacías.
- Tildes y eñes (`Ñahui`, `Huamán`, `Núñez`), un nombre con espacios sobrantes (`  Roberto Salas  `), un nombre en mayúsculas.
- Etapas que no coinciden con las del sistema: `Primer contacto`, `Cerrado ganado`, `Perdido` (además de las que sí coinciden).
- Vendedores: `Ana`, `Luis Q.`, `Carmen` (ya no trabaja: no existirá como usuario) y vacío.
- Origen `Facebook` (no existe en el catálogo; debería mapearse a "Redes sociales" o crearse).
- Un duplicado exacto (Juan Pérez Quispe, dos veces) y un casi duplicado (mismo celular, nombre en mayúsculas sin tildes).
- Dos contactos que comparten celular (Diego Ramos y Valeria Cruz) pero son personas distintas: la fusión por teléfono debe avisar, no fusionar en silencio si el nombre es claramente distinto.
- Una fila solo con nombre (Elena Vilca), una fila solo con observaciones (sin nombre, teléfono ni correo) y una fila de **TOTAL** al final.
- Pestaña "Notas" que no debe importarse.

## Recuento esperado tras importar (interpretación estricta del criterio 6)

- Filas no vacías: **20**.
- Ninguna fila descartada: `creadas + fusionadas + para revisar = 20`.
- Fusionadas: la fila duplicada exacta de Juan Pérez (1) y la de "JUAN PEREZ QUISPE" con el mismo celular (1) → **2** fusionadas con el primer Juan Pérez. Si el importador decide no fusionar el casi duplicado, debe crearlo marcado para revisar; en ningún caso desaparece.
- Para revisar: la fila solo con observaciones, la fila TOTAL, Elena Vilca (sin teléfono ni correo), Ricardo Flores (vendedora inexistente) y Valeria Cruz (celular repetido con otro nombre) → al menos **5**, según las reglas que aplique el importador. Se importan igual.
- Creadas: el resto.
- Oportunidades: si se mapean las columnas Etapa y Monto, cada fila con etapa crea una oportunidad; `Cerrado ganado` → estado ganada, `Perdido` → estado perdida con motivo "Otro" o "Importado sin motivo" y marcada para revisar; las etapas desconocidas se mapean en el asistente a una existente o se crean.

El informe descargable debe listar, fila a fila, qué pasó con cada una y por qué.
