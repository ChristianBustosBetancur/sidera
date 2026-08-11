# TASK-006.5 — El documento asume el scroll vertical del grafo

## Objetivo

En escritorio, `.graphRegion` es hoy una ventana de altura fija con `overflow: auto`, lo que crea una **barra de scroll vertical interna** dentro del grafo. El grafo se lee como un widget con su propia ventana, no como una superficie de la página. Esta tarea traslada el scroll vertical al documento: la página crece hasta la altura del grafo y se recorre con el scroll normal del navegador.

El scroll/pan **horizontal** sigue siendo del contenedor. Solo cambia el eje vertical.

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

## Reversión deliberada de TASK-005.6 (decisión 3)

Esta tarea **revierte a propósito** una decisión aprobada. Queda registrado para que no se lea como una regresión ni se "corrija" en el futuro.

`docs/tasks/TASK-005.6.md`, decisión 3, estableció un reparto por tipo de dispositivo: en ratón/lápiz, `.graphRegion` tendría *"altura contenida y alta"* con `overflow: auto`; en táctil, sin altura fija y con la página creciendo en vertical. Era coherente con el objetivo de aquel momento — sacar al grafo de "la franja baja con scroll horizontal que se lee como una tabla".

**Ahora preferimos una superficie vertical integrada al documento, porque encaja mejor con la dirección True Open Canvas** establecida en TASK-006.0.1 y TASK-006.0.2. Aquella serie quitó a `.graphRegion` el fondo, el borde y la sombra para que dejara de leerse como una caja; la altura fija con `overflow: auto` sobrevivió a esa limpieza y sigue dibujando el rectángulo — literalmente, con la barra de scroll. Un canvas que se funde con el fondo pero mantiene su propia ventana de scroll es una contradicción interna.

La decisión 1 de TASK-005.6 (pan por `scrollLeft`/`scrollTop` en lugar de `transform`, para no re-medir aristas) **no se revierte**: sigue vigente para el eje horizontal, y el eje vertical pasa a mover el scroll del documento, que tampoco obliga a re-medir. La decisión 2 (prohibido re-medir aristas durante el desplazamiento) **sigue vigente sin cambios**.

## Diagnóstico (verificado en el código antes de escribir esta tarea)

- `apps/web/app/graph-view.module.css`, bloque `@media (hover: hover) and (pointer: fine)`: `.graphRegion { height: min(88vh, 1200px); min-height: 36rem; overflow: auto; cursor: grab; }`. Origen: `17ca3d5` (TASK-005.6), ampliado en `1ae1250` (TASK-006.0).
- Regla base de `.graphRegion`: `width: 100%; max-width: 100%; overflow-x: auto; overscroll-behavior-inline: contain;` sin altura. Es la que ya usa la rama táctil y la que debe gobernar tras esta tarea.
- Dimensiones reales del dataset: 60 materias, 73 aristas, 6 niveles, columna más alta de 17 nodos. Con `min-height: 6.5rem` por tarjeta y `gap: 1rem`, el bloque del grafo mide ~2.100 px frente a una ventana de ~950 px. De ahí que la barra interna esté siempre presente.
- **`measureEdges()` no depende del `overflow`.** Calcula posiciones como diferencias entre `getBoundingClientRect()` del nodo y de `.canvas`; ambos están dentro del mismo contenido desplazado, así que la resta es invariante ante el scroll de cualquier ancestro. El `ResizeObserver` observa `.canvas`, cuya altura no cambia por este motivo.
- **`overflow-x: auto` + `overflow-y: visible` es imposible.** Por CSS Overflow Level 3, si un eje es `visible` y el otro no, el `visible` se computa a `auto`. No hay que intentarlo: con `height: auto` el elemento crece hasta su contenido, no hay desbordamiento vertical, y el `auto` computado queda inerte sin dibujar barra.
- Dependen hoy del scroll vertical interno, y por tanto hay que adaptarlos: `handlePointerMove` (`currentTarget.scrollTop`), el botón "Volver al inicio" (`graphRegion.scrollTop = 0`), y `.detailPanel` en desktop (`max-height: calc(100% - 1.5rem)` relativo a un workspace que hoy mide 88vh).

## Decisiones aprobadas

1. **Núcleo — se elimina la ventana vertical interna en escritorio.** En el bloque `@media (hover: hover) and (pointer: fine)`, `.graphRegion` pierde `height`, `min-height` y `overflow: auto`. Conserva `cursor: grab`. La regla base aporta `overflow-x: auto`, que se mantiene intacta. El documento pasa a ser el responsable del scroll vertical. `.dragHint { display: block }` y `.graphRegion.dragging` no cambian.

2. **Panel de detalle en escritorio — `position: fixed`, solo CSS.** Dentro de `@media (min-width: 72.001rem)`, `.detailPanel` pasa de `position: absolute` a `position: fixed`, anclado al viewport, de modo que permanezca visible mientras se recorre el grafo verticalmente. Requisitos:
   - Compacto y flotante sobre el viewport, anclado al borde derecho, con una separación coherente con el gutter de `.page` (`clamp(1rem, 4vw, 4rem)`).
   - `max-height` relativo al viewport (del orden de `min(70vh, …)`; el valor exacto queda a criterio de Codex dentro de ese espíritu).
   - `overflow-y: auto` para que tenga scroll interno **únicamente** si su contenido realmente lo necesita — no una altura fija que fuerce barra siempre.
   - Conserva su ancho actual (`clamp(19rem, 19vw, 21rem)`), su padding, su superficie (fondo, borde, sombra) y toda su interacción.
   - **Prohibido** cambiar el JSX para conseguir `position: sticky`. La decisión humana es explícita: CSS puro.
   - `z-index` suficiente para quedar sobre el canvas. El badge de preview (`z-index: 10`, `pointer-events: none`, abajo-izquierda) no interfiere, pero conviene no quedar por debajo de él.

3. **Pan vertical — mueve el documento.** En `handlePointerDown`, además del `scrollLeft` de la región, se guarda la posición vertical del documento (`window.scrollY`). En `handlePointerMove`:
   - **horizontal**: se mantiene exactamente como hoy, `event.currentTarget.scrollLeft = dragState.scrollLeft - deltaX`.
   - **vertical**: se sustituye `event.currentTarget.scrollTop = …` por un desplazamiento inmediato del documento (`window.scrollTo(0, startScrollY - deltaY)` o equivalente).
   - **Inmediato, sin `behavior: "smooth"`**, sin `requestAnimationFrame`, sin animación por frame, sin inercia.
   - **Sin re-medir aristas durante el arrastre** y sin añadir ningún listener de `scroll` (TASK-005.6, decisión 2, sigue vigente).
   - `event.pointerType === "touch"` sigue saliendo antes de tocar nada, igual que hoy.

4. **La distinción arrastre/click no se toca.** `DRAG_THRESHOLD`, `hasExceededDragThreshold`, `shouldSuppressClick`, `suppressNextClickRef`, `setPointerCapture`/`releasePointerCapture`, `onClickCapture`, `finishDrag` y el `onClick` de la sección quedan **exactamente** como están. Un arrastre real sigue sin seleccionar; un click limpio sigue seleccionando.

5. **"Volver al inicio" se adapta al nuevo modelo.** Sigue haciendo `graphRegion.scrollLeft = 0` y, en vertical, devuelve la vista de forma **perceptible al comienzo de la superficie del grafo** — no necesariamente al inicio absoluto de la página. Se calcula a partir de la posición de `.graphRegion` en el documento (p. ej. `rect.top + window.scrollY`, con un pequeño margen superior si mejora la lectura). Inmediato, sin scroll suave. El `graphRegion.scrollTop = 0` actual, que pasaría a ser un no-op, se retira.

6. **Móvil/tablet no se toca.** El bloque `@media (max-width: 72rem) and ((hover: none) or (pointer: coarse))` (bottom sheet) y el bloque `@media (max-width: 47rem)` (compactación) quedan **idénticos**. En dispositivos táctiles el comportamiento ya era el de scroll de página; esta tarea no lo altera.

7. **True Open Canvas no se revierte.** `.graphRegion` conserva `background: transparent`, `border-radius: 0`, `box-shadow: none` y ningún `max-width`. El `padding-inline` responsivo de `.page` no cambia.

8. **La barra de scroll horizontal queda como está, a propósito.** Al crecer el bloque, la barra horizontal de `.graphRegion` quedará al pie de toda la superficie del grafo, fuera de pantalla salvo que se baje del todo. **Esta tarea no lo resuelve**, por decisión humana explícita: el arrastre horizontal permite explorar sin depender de ella. Queda registrado como posible mejora posterior (ver "Mejora posterior identificada").

9. **Sin dependencias nuevas.** Sin librerías de scroll, gestos, overlay o virtualización.

10. **Nada de la fase siguiente**: motivos visuales, barras EXP, "Mi Progreso", árbol de habilidades, aura, 3D, y el hydration mismatch de `docs/KNOWN_ISSUES.md`.

## Alcance permitido

```
apps/web/app/graph-view.module.css   (decisiones 1, 2, 6, 7)
apps/web/app/graph-view.tsx          (decisiones 3, 5 — solo pan vertical y "Volver al inicio")
```

Ningún otro archivo debe modificarse. En particular: nada bajo `packages/**`, `apps/web/lib/**`, `apps/web/app/curriculum-view.*`, `apps/web/app/layout.*`, `apps/web/app/globals.css`, `apps/admin/**`, `tools/agent/**`, ni ningún `package.json`.

## Fuera de alcance

- El comportamiento móvil/tablet `≤72rem` y la compactación `≤47rem` (decisión 6).
- La posición de la barra de scroll horizontal (decisión 8).
- `position: sticky` para el panel, o cualquier cambio de JSX que lo habilite (decisión 2).
- Contenido, orden, ancho o funcionalidad del panel de detalle — solo su mecanismo de posicionamiento.
- El algoritmo del grafo, los niveles derivados, los nodos, las aristas y el dataset.
- `packages/**`, `apps/web/lib/curriculum-graph.ts`, Vista Plan, progreso EXP, explicaciones de bloqueo, trayectoria compartida y su persistencia.
- Zoom, minimapa, ajuste al contenido, inercia, virtualización.
- El hydration mismatch de `docs/KNOWN_ISSUES.md`.

## Interacciones que deben seguir funcionando exactamente igual (verificación obligatoria)

- Click limpio sobre una materia → selecciona → abre/actualiza el panel → activa el modo foco.
- Arrastre real con ratón → mueve el grafo en **ambos** ejes → no selecciona accidentalmente.
- Tras terminar un arrastre real, el siguiente click limpio selecciona de inmediato.
- Modo foco con sus tres salidas: botón "Salir del foco", `Escape`, y click en zona vacía.
- Trayectoria compartida Plan ↔ Explorar, persistencia local, estados derivados, explicaciones de bloqueo.
- Navegación táctil sin cambios.
- El panel de detalle sigue siendo legible y usable, y su contenido no cambia.

## Criterios de aceptación

1. En el bloque `@media (hover: hover) and (pointer: fine)`, `.graphRegion` **no** declara `height`, `min-height` ni `overflow`. Conserva `cursor: grab`.
2. La regla base de `.graphRegion` conserva `overflow-x: auto` y `overscroll-behavior-inline: contain`, sin altura declarada.
3. En escritorio no aparece ninguna barra de scroll **vertical** interna en el grafo; el scroll vertical de la página es el del documento.
4. El scroll y el arrastre **horizontales** del grafo siguen funcionando.
5. `.detailPanel` en `@media (min-width: 72.001rem)` usa `position: fixed`, con `max-height` expresado en unidades de viewport y `overflow-y: auto`; conserva `width: clamp(19rem, 19vw, 21rem)`, su padding y su tratamiento de superficie.
6. Con el panel abierto, al desplazarse verticalmente por el grafo el panel **permanece visible** en pantalla.
7. El panel solo muestra barra de scroll interna cuando su contenido excede su `max-height`; con contenido corto no la muestra.
8. `handlePointerDown` guarda la posición vertical del documento; `handlePointerMove` desplaza el documento en vertical de forma inmediata y ya no asigna `scrollTop` a la región.
9. No se usa `behavior: "smooth"`, ni `requestAnimationFrame`, ni ningún bucle de animación en el arrastre.
10. No se añade ningún listener de `scroll`, ni se llama a `measureEdges()` durante el arrastre.
11. Las aristas siguen alineadas con sus nodos tras desplazamiento vertical, horizontal, y con el panel abierto y cerrado.
12. `DRAG_THRESHOLD`, `hasExceededDragThreshold`, `shouldSuppressClick`, `suppressNextClickRef`, la captura de puntero, `onClickCapture`, `finishDrag` y el `onClick` de la sección quedan sin cambios funcionales.
13. `handlePointerMove` y `finishDrag` siguen saliendo antes para `pointerType === "touch"`; no se añade `touch-action: none` ni `preventDefault()` sobre eventos táctiles.
14. "Volver al inicio" pone `scrollLeft = 0` y devuelve la vista de forma perceptible al comienzo de la superficie del grafo, sin scroll suave.
15. Los bloques `@media (max-width: 72rem) and ((hover: none) or (pointer: coarse))` y `@media (max-width: 47rem)` quedan **byte a byte idénticos**.
16. `.graphRegion` conserva `background: transparent`, `border-radius: 0`, `box-shadow: none` y ningún `max-width`.
17. Cero cambios en `packages/**`, `apps/web/lib/**` y Vista Plan; cero dependencias nuevas.
18. Los 72 tests existentes siguen pasando sin modificarlos.
19. Ningún archivo fuera de "Alcance permitido" queda modificado.
20. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pasan sin errores.

## Mejora posterior identificada (no se implementa aquí)

Al crecer verticalmente la superficie del grafo, la barra de scroll horizontal de `.graphRegion` queda al pie del bloque completo, fuera de la pantalla salvo que se baje hasta el final. El arrastre horizontal cubre la necesidad, pero una iteración futura podría evaluar dejar los controles de navegación del grafo (`.graphNavigation`) en `position: sticky`, o cualquier otra forma de mantener accesible la navegación horizontal sin reintroducir una ventana de scroll interna. **No se aborda en esta tarea** (decisión 8).

## Comandos de validación

```
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Condición exacta de terminación

La tarea termina cuando los criterios de aceptación se cumplen y la secuencia de validación se ejecuta sin errores. Codex entrega el resumen indicado en `AGENTS.md`, describiendo explícitamente qué cambió frente al estado anterior en el eje vertical, y se detiene, sin abordar la barra horizontal ni ninguna tarea posterior.
