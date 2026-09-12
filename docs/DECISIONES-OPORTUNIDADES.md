# Decisiones del módulo de oportunidades (fase 2)

Complementa `docs/DECISIONES.md`. Una línea por decisión.

- 2026-09-12 · Consultas de apoyo del tablero en un archivo nuevo `src/lib/api/oportunidadesTablero.ts` (`cerradasEsteMes`, `ultimoCambioEtapa`) para no tocar `oportunidades.ts` de la fase 1 mientras otros módulos trabajan en paralelo.
- 2026-09-12 · "N días en etapa" se calcula desde el último registro de `historial_etapas` de cada oportunidad abierta (clave `['historial_etapas','ultimo', ids]`, la invalida realtime al cambiar `oportunidades`); si no hay historial, desde `updated_at`.
- 2026-09-12 · Puntos rojo (tarea vencida) y ámbar (sin tarea pendiente) salen de `resumenTareasPendientes()` cacheado en `['tareas','resumen-oportunidades']` como arrays (no `Set`) para que la caché persistida en localStorage no los corrompa.
- 2026-09-12 · Tablero: la tarjeta arrastrada no se reordena "en vivo" entre columnas; se resalta la columna destino y al soltar se calcula la posición fraccionaria (`calcularPosicionDestino`) con `mover_oportunidad` optimista y rollback. Soltar en Ganada/Perdida no escribe nada hasta confirmar en el modal.
- 2026-09-12 · En computadora, si el filtro `estado` es `ganada` o `perdida` (enlaces del pie "Cerradas este mes"), la página muestra la lista por etapa en vez del tablero: el tablero solo tiene sentido para abiertas.
- 2026-09-12 · Exportación: en la lista de celular se exporta la etapa que se ve (si no hay `etapaId` en la URL se usa la primera etapa, igual que la pantalla); en el tablero, todas las abiertas con los filtros.
- 2026-09-12 · Mover desde el detalle (stepper) o desde "Mover a" conserva `posicion` (detalle) o va al final de la columna destino (lista); solo el arrastre del tablero calcula posición entre vecinas.
- 2026-09-12 · Pruebas de componente sin `@testing-library/react` (no está instalada y añadirla tocaría `package.json` compartido): se monta con `react-dom/client` + `act` en jsdom (`ModalPerder.test.tsx`, `Paginas.test.tsx`).
