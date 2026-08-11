# TASK-005.6 — Canvas navegable: más espacio y desplazamiento por arrastre

## Objetivo

Dar a la Vista Explorar (`/grafo`) un canvas con espacio real y navegación cómoda: un área alta y contenida en pantallas de ratón, con **desplazamiento por arrastre** ("agarrar y mover"), en lugar de la franja baja con scroll horizontal que hoy se lee como una tabla.

**Requisito no negociable de esta tarea**: en móvil/táctil, el canvas **no puede capturar el dedo** de forma que impida el scroll vertical normal de la página. Es el criterio que decide si esta tarea está bien hecha.

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

`docs/AGENT_REVIEW_POLICY.md`: "UI interactiva o compleja (estado, interacción, grafos, rendimiento)" → `claude-review` + `codex-qa`. `codex-qa` debe auditar **específicamente** el comportamiento táctil/responsive y el rendimiento del arrastre.

## Contexto mínimo

- `apps/web/app/graph-view.tsx` — la vista. Puntos relevantes: `canvasRef` (el contenedor medido), `measureEdges()` con `getBoundingClientRect()`, el `useLayoutEffect` con `ResizeObserver` y debounce de 120 ms, y el `onClick` de selección en `GraphCourseCard`.
- `apps/web/app/graph-view.module.css` — `.graphRegion` (hoy `overflow-x: auto`, sin altura fija) y `.canvas` (`position: relative; width: max-content`). El SVG de aristas (`.edges`) está **dentro** de `.canvas`, superpuesto a `.columns`.
- `docs/PERFORMANCE.md` — dispositivo de referencia de gama baja, sin animaciones en bucle, JS inicial limitado.
- `docs/tasks/TASK-005.2.md` — decisiones vigentes del grafo: SVG nativo, sin librerías de grafos ni de gestos, aristas directas, nomenclatura "Nivel del grafo".

## Decisiones aprobadas

1. **El desplazamiento se implementa moviendo el scroll del contenedor (`scrollLeft` / `scrollTop`), no con `transform: translate` sobre el contenido.** Razón concreta: `measureEdges()` calcula las posiciones de las aristas como diferencias entre el rect de un nodo y el rect de `.canvas`; como nodos y SVG viven dentro del mismo contenido desplazado, esas diferencias **no cambian al desplazar**. Con scroll no hay que re-medir nada. Cualquier solución que obligue a re-medir aristas durante el arrastre queda descartada por rendimiento.
2. **Prohibido re-medir aristas durante el desplazamiento.** No se añade ningún listener de `scroll` que llame a `measureEdges()`, ni medición por frame, ni `requestAnimationFrame` en bucle. El `ResizeObserver` con debounce que ya existe se conserva tal cual.
3. **Comportamiento por tipo de dispositivo, explícito y separado:**
   - **Ratón/lápiz** (`@media (hover: hover) and (pointer: fine)`): `.graphRegion` pasa a tener **altura contenida y alta** (del orden de `min(80vh, 900px)`, con un mínimo razonable) y `overflow: auto` en ambos ejes. Sobre esa área se activa el arrastre.
   - **Táctil / resto de dispositivos**: se **conserva exactamente el comportamiento actual** — `.graphRegion` sin altura fija, `overflow-x: auto`, y la página creciendo en vertical. El scroll vertical de la página es entonces scroll normal de página, imposible de capturar. El desplazamiento horizontal sigue siendo el scroll nativo del contenedor, que los navegadores ya resuelven bien (un gesto vertical va a la página, uno horizontal al contenedor).
4. **El arrastre solo se activa para punteros de ratón o lápiz.** En los manejadores de Pointer Events se comprueba `event.pointerType` y se ignora `"touch"` por completo: en táctil manda el scroll nativo. Está **prohibido** usar `touch-action: none` sobre el canvas o la región del grafo, y prohibido llamar a `preventDefault()` sobre eventos táctiles. Estas son las dos formas típicas de "atrapar el dedo" y ambas quedan vetadas.
5. **Arrastre con Pointer Events y captura correcta.** `pointerdown` inicia (solo botón principal), `pointermove` desplaza, `pointerup` / `pointercancel` terminan. Se usa `setPointerCapture` para que soltar fuera del contenedor no deje el arrastre pegado, y se libera siempre. Sin listeners globales en `window` que sobrevivan al desmontaje.
6. **Un arrastre no debe seleccionar una materia.** Hoy un click en la tarjeta la selecciona. Con arrastre activo hace falta un umbral: si el puntero se movió más de unos pocos píxeles (p. ej. 5) desde `pointerdown`, el `click` resultante **no** cambia la selección. Un click limpio, sin movimiento, sigue seleccionando exactamente como hoy.
7. **Feedback visual mínimo del arrastre**: cursor `grab` en reposo y `grabbing` mientras se arrastra, y supresión de la selección de texto durante el arrastre. Sin animaciones, sin inercia, sin "momentum scrolling" propio.
8. **Un solo control nuevo: "Volver al inicio"**, que devuelve el desplazamiento del contenedor a su origen (`scrollLeft = 0`, `scrollTop = 0`). Es el mínimo necesario para no perderse tras explorar. **No** se implementa zoom, ni "ajustar al contenido", ni minimapa: todo eso requiere escalado y queda fuera.
9. **Texto de ayuda visible solo donde aplica.** La indicación de arrastre ("Arrastra para explorar el grafo" o equivalente) solo se muestra en dispositivos de ratón/lápiz, con la misma media query de la decisión 3 — no se le dice a un usuario táctil que arrastre algo que en su dispositivo funciona por scroll.
10. **Sin zoom, sin gestos multitáctiles, sin librerías.** Nada de pinch-zoom, `hammer.js`, `react-zoom-pan-pinch`, `d3-zoom` ni equivalentes. Cero dependencias nuevas.
11. **Nada más cambia.** Mismos nodos (con sus tres botones, que se retiran en TASK-005.7), mismas aristas, mismo cálculo de niveles, mismo foco por selección, misma leyenda, misma trayectoria compartida. Esta tarea es navegación y espacio, nada más.
12. **Accesibilidad no se degrada.** El contenido del grafo sigue siendo alcanzable con teclado: la región desplazable debe poder recibir foco y desplazarse con teclado igual que cualquier contenedor con scroll (el scroll nativo ya lo permite si la región es enfocable). El arrastre es un **añadido**, nunca la única forma de navegar.
13. **Sin cambios en `packages/**` ni en la Vista Plan.**

## Alcance permitido

```
apps/web/app/graph-view.tsx           (arrastre, umbral de click, control "Volver al inicio", texto de ayuda)
apps/web/app/graph-view.module.css    (altura del canvas, overflow por media query, cursores, estilos del control)
```

Ningún otro archivo debe modificarse. En particular: ni `curriculum-view.tsx`, ni `apps/web/lib/**`, ni nada bajo `packages/**`, `apps/admin/**`, `tools/agent/**`, ni ningún `package.json`.

## Fuera de alcance

- Zoom, ajuste al contenido, minimapa, inercia (decisiones 8 y 10).
- Gestos multitáctiles de cualquier tipo (decisión 10).
- Simplificar los nodos o quitarles los botones (TASK-005.7).
- Panel de detalle (TASK-005.7), explicación de bloqueos (TASK-005.8), modo foco (TASK-005.9).
- Cambiar el algoritmo del grafo, los niveles derivados o el layout por columnas.
- Resolver o investigar el hydration mismatch de `docs/KNOWN_ISSUES.md` — **explícitamente prohibido**.
- Modificar `packages/curriculum-domain`, `curriculum-schema`, `curriculum-engine`, `curriculum-snapshot`.

## Criterios de aceptación

- En dispositivos de ratón/lápiz, la región del grafo tiene altura contenida y alta, y se puede recorrer arrastrando con el botón principal en ambos ejes.
- **En táctil, el scroll vertical de la página funciona con normalidad en cualquier punto del grafo.** No existe `touch-action: none` sobre la región ni sobre el canvas, no hay `preventDefault()` sobre eventos táctiles, y los manejadores de arrastre ignoran `pointerType === "touch"` (decisión 4).
- El desplazamiento se hace vía `scrollLeft`/`scrollTop`; no hay ningún listener de `scroll` que re-mida aristas, ni medición por frame (decisiones 1 y 2).
- Las aristas siguen alineadas con los nodos en cualquier posición de desplazamiento, sin recalcularlas al desplazar.
- Un arrastre que termina sobre una tarjeta **no** cambia la materia seleccionada; un click sin movimiento sí la selecciona, igual que hoy (decisión 6).
- Existe un control "Volver al inicio" que devuelve el desplazamiento al origen.
- El texto de ayuda sobre arrastre solo aparece en dispositivos de ratón/lápiz (decisión 9).
- Soltar el puntero fuera de la región no deja el arrastre activo (decisión 5), y no quedan listeners globales tras desmontar la vista.
- El resto de la vista es idéntico: nodos, botones, aristas, leyenda, niveles, foco por selección, trayectoria compartida.
- La Vista Plan (`/`) no cambia en absoluto.
- Cero dependencias nuevas en cualquier `package.json`.
- Ningún archivo fuera de "Alcance permitido" queda modificado.
- La secuencia de validación se ejecuta sin errores.

## Comandos de validación

```
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Condición exacta de terminación

La tarea termina cuando los criterios de aceptación se cumplen y la secuencia de validación se ejecuta sin errores. Codex entrega el resumen indicado en `AGENTS.md` y se detiene, sin iniciar TASK-005.7 ni ninguna otra tarea.
