# TASK-006.0 — Open Canvas Layout para Vista Explorar

## Objetivo

Cambiar la **presentación visual** de `/grafo` para que el grafo se sienta como el espacio principal de la vista — una superficie de exploración abierta — en vez de un visor encerrado dentro de una tarjeta con borde duro. Es una mejora de framing/espacio/estética, **no** un rediseño de la interacción ni del algoritmo del grafo.

Hoy `/grafo` se lee como: página → recuadro con borde y fondo (`.graphRegion`) → grafo dentro. El objetivo es que se lea como: página → el grafo ES el espacio.

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

`docs/AGENT_REVIEW_POLICY.md`: "UI interactiva o compleja (estado, interacción, grafos, rendimiento)" → `claude-review` + `codex-qa`. Aunque el cambio es mayormente visual, toca la misma región donde vive la interacción de pan/drag/foco, así que corresponde la misma fila (no la de "UI simple").

## Contexto mínimo — inspección ya hecha, punto de partida

Leído antes de escribir esta tarea:

- `apps/web/app/graph-view.module.css`:
  - `.page { width: min(100% - 2rem, 96rem); ... }` — el ancho máximo de **toda** la página de `/grafo` (compartido por header, controles y el propio grafo). Este archivo es el módulo CSS exclusivo de `graph-view.tsx`; cambiarlo **no afecta** a `/` (que usa su propio módulo, `curriculum-view.module.css`, con su propia clase `.page`).
  - `.graphRegion { max-width: 100%; overflow-x: auto; background: #ecefe9; border: 1px solid #cbd2cc; border-radius: 0.75rem; }` — el recuadro con borde duro y fondo que genera la sensación de "widget embebido". En pantallas de ratón/lápiz (`@media (hover: hover) and (pointer: fine)`) además fija `height: min(80vh, 900px)`.
  - `.graphWorkspace { display: grid; grid-template-columns: minmax(0, 1fr) minmax(18rem, 22rem); gap: 1rem; }` — el grid que coloca `.graphRegion` junto al `.detailPanel` cuando hay selección; sin selección, `.graphRegion:only-child` ocupa las dos columnas.
  - `.detailPanel { padding: 1rem; background: var(--surface); border: 1px solid var(--line); border-radius: 0.75rem; box-shadow: ...; }` — otro recuadro con borde, visualmente equivalente en peso al de `.graphRegion`, lo que genera la sensación de "tarjeta junto a tarjeta".
  - `@media (max-width: 47rem)` — en móvil, `.graphWorkspace` pasa a una sola columna y `.detailPanel` se apila debajo (`grid-row: 2`); `.graphRegion` no tiene altura fija (usa el patrón de scroll de página existente desde TASK-005.6).
- `apps/web/app/graph-view.tsx` — la `<section ref={graphRegionRef}>` (línea ~349) es el contenedor técnico real: recibe `onPointerDown`/`onPointerMove`/`onPointerUp`/`onPointerCancel`/`onClickCapture`/`onClick`, y es el elemento sobre el que se mide todo (`canvasRef` dentro de él, `measureEdges()` usa `canvasRef.current.getBoundingClientRect()`). **Este elemento debe seguir existiendo y siguiendo siendo el mismo contenedor de la interacción** — el "marco visual" a suavizar es su presentación CSS, no su rol técnico.
- `docs/tasks/TASK-005.6.md`, `TASK-005.7.md`, `TASK-005.9.md`, `TASK-005.9.1.md` — decisiones vigentes de la interacción actual (arrastre por Pointer Events, panel de detalle, modo foco, captura de puntero sobre `event.target`). Esta tarea **no las revierte ni las reabre**.

## Decisiones aprobadas

1. **Es un cambio de CSS y, como mucho, de envoltorios de presentación — no de lógica.** `handlePointerDown`, `handlePointerMove`, `finishDrag`, el `onClickCapture`/`onClick` de la sección, el manejador de `Escape`, `relatedIds`, `measureEdges`, y todo el contenido/lógica del panel de detalle (requisitos, `blockingReasons`, controles de trayectoria) **no se tocan**. Si tocarlos pareciera necesario para lograr el efecto visual pedido, **detente y repórtalo** en vez de hacerlo.
2. **Más ancho**: el ancho máximo efectivo de la superficie del grafo debe ampliarse perceptiblemente más allá del límite actual de `96rem` compartido con el resto de la página. Puede lograrse ampliando el `max-width` específico de `.graphWorkspace`/`.graphRegion` dentro de este mismo módulo CSS (recuerda: no afecta a `/`), sin necesidad de técnicas de "full-bleed" con márgenes negativos salvo que Codex lo considere claramente más simple y no rompa el layout del header/controles.
3. **Más alto**: en pantallas de ratón/lápiz, la altura del área de exploración debe seguir relacionada con el viewport (`vh`) pero notablemente más generosa que hoy — el usuario debe percibir que "el grafo llena la pantalla", no que cabe en una ventana pequeña. El límite superior en píxeles absolutos (hoy `900px`) puede ampliarse o eliminarse si CSS puro lo permite sin causar un canvas absurdamente alto en monitores muy grandes.
4. **Suavizar o eliminar el borde/fondo duro de `.graphRegion`.** El objetivo es que deje de leerse como una caja con borde definido. Alternativas aceptables (a discreción de Codex, priorizando simplicidad): quitar el `border` sólido y sustituirlo por algo mucho más sutil (p. ej. un `box-shadow` muy suave, o nada), reducir o quitar el `border-radius`, atenuar el `background` a algo casi imperceptible o quitarlo. **Se permite conservar un fondo sutil** si ayuda a distinguir la superficie de exploración del resto de la página (pedido explícito del humano) — la clave es "sutil", no "sin ningún tipo de distinción".
5. **El contenedor técnico de scroll/pan (`.graphRegion`, la `<section>` con los manejadores de puntero) sigue existiendo y siendo el mismo elemento.** No se elimina, no se reemplaza por otro mecanismo de scroll/desplazamiento, no se le quita `overflow`/`tabIndex`/los manejadores de eventos. Solo cambia su apariencia.
6. **El panel de detalle se conserva funcionalmente idéntico**, pero su presentación puede mejorar para que no se sienta como "otra tarjeta pegada al canvas": se permite ajustar su fondo, borde, sombra, espaciado interno y tipografía, y su posicionamiento (p. ej. hacerlo sentir más como un panel lateral estable, con más separación visual del canvas — con margen/espacio real entre ambos, no solo el `gap` del grid actual) — pero **sin** cambiar qué información muestra, en qué orden, ni cómo funcionan sus controles.
7. **Cuando el panel de detalle aparece, el grafo no debe sentirse "comprimido".** Si es necesario, ajustar las proporciones del grid (`minmax` de las columnas) para que el canvas conserve un ancho cómodo incluso con el panel visible, especialmente en pantallas medianas.
8. **Controles compactos.** Los controles existentes ("Volver al inicio", "Salir del foco", el texto de ayuda de arrastre, la leyenda) pueden reordenarse o reestilizarse para ocupar menos espacio visual y dejar más protagonismo al grafo, pero ninguno se elimina ni cambia de función.
9. **Responsive**:
   - **Desktop**: máximo aprovechamiento de ancho, canvas amplio, panel lateral cómodo (decisión 2, 3, 7).
   - **Pantallas medianas**: verificar explícitamente que el panel no deje al canvas con un ancho incómodamente estrecho — si el grid actual de dos columnas no se comporta bien ahí, ajustar los `minmax`/breakpoints, sin introducir un sistema de layout nuevo.
   - **Móvil**: se conserva el patrón ya existente (una columna, panel apilado/tipo bloque inferior) — solo se permite pulir su presentación visual, no rediseñar su estructura.
10. **Sin dependencias nuevas.** Solo CSS, layout nativo (grid/flexbox), y el SVG/transforms ya existentes. Nada de librerías de canvas, de grafos, WebGL, ni animaciones más allá de transiciones cortas ya usadas en el resto de la vista.
11. **Sin cambios en `packages/**` ni en `apps/web/lib/curriculum-graph.ts`** (algoritmo del grafo). Sin cambios en la Vista Plan (`curriculum-view.tsx`/`curriculum-view.module.css`).
12. **Nada de la fase siguiente**: sin Course Visual Motifs, símbolos flotantes, barras EXP, "Mi Progreso", proyección de créditos, árbol de habilidades, aura, hojas, partículas, 3D. Sin tocar el hydration mismatch de `docs/KNOWN_ISSUES.md`.

## Alcance permitido

```
apps/web/app/graph-view.module.css    (cambio principal: framing, ancho, alto, panel, responsive)
apps/web/app/graph-view.tsx           (SOLO si hace falta un className/wrapper puramente presentacional; PROHIBIDO tocar cualquier manejador de eventos, estado, o lógica existente)
```

Ningún otro archivo debe modificarse. En particular: nada bajo `packages/**`, `apps/web/lib/**`, `apps/web/app/curriculum-view.tsx`, `apps/web/app/curriculum-view.module.css`, `apps/admin/**`, `tools/agent/**`, ni ningún `package.json`.

## Fuera de alcance

- Course Visual Motifs, símbolos flotantes, barras EXP, resumen "Mi Progreso", proyección de créditos, Libre Elección, árbol de habilidades, aura, hojas, partículas, 3D.
- Cualquier cambio en `packages/curriculum-domain`, `curriculum-schema`, `curriculum-engine`, `curriculum-snapshot`.
- Cambios al algoritmo de `apps/web/lib/curriculum-graph.ts` (niveles derivados, aristas).
- Cambiar cualquier manejador de eventos de puntero/teclado/click existente (decisión 1) — esta tarea es visual.
- Cambiar el contenido, orden o funcionalidad del panel de detalle (decisión 6) — solo su presentación.
- El árbol inmersivo final.
- Resolver o investigar el hydration mismatch de `docs/KNOWN_ISSUES.md`.
- Cambios en la Vista Plan (`/`).

## Interacciones que deben seguir funcionando exactamente igual (verificación obligatoria, no solo suposición)

- Click limpio sobre una materia → selecciona → abre/actualiza el panel de detalle → activa el resaltado de foco.
- Arrastre real (ratón, por encima del umbral) → mueve el grafo (scroll) → no selecciona accidentalmente la tarjeta de origen.
- Tras terminar un arrastre real, el siguiente click limpio selecciona de inmediato.
- Modo foco: materia seleccionada + vecinos directos sin atenuar, resto atenuado; salida por botón, por `Escape`, y por click en zona vacía del grafo.
- Trayectoria compartida Plan ↔ Explorar, persistencia local, estados derivados, explicaciones de bloqueo (`blockingReasons`) — todo sin cambios de comportamiento.
- Navegación táctil: scroll vertical de página normal en cualquier punto del grafo.

## Criterios de aceptación

1. `/grafo` deja de sentirse como un visor pequeño encerrado dentro de una tarjeta — verificable por la ausencia (o gran suavización) del borde/fondo duro de `.graphRegion` frente al estado anterior.
2. El grafo utiliza perceptiblemente más ancho disponible que antes (verificable comparando los valores de `max-width` antes/después).
3. La altura de la superficie de exploración (en pantallas de ratón/lápiz) es notablemente mayor que antes en relación al viewport.
4. Con el panel de detalle visible, el canvas conserva un ancho cómodo — no se siente comprimido en pantallas medianas ni grandes.
5. Pan/drag sigue funcionando exactamente igual (ver sección de interacciones).
6. Click limpio + modo foco siguen funcionando exactamente igual (ver sección de interacciones).
7. Cero cambios en cualquier archivo bajo `packages/**` o en `curriculum-graph.ts`.
8. Cero dependencias nuevas en cualquier `package.json`.
9. La vista sigue siendo usable en móvil (panel apilado, scroll de página normal) y en pantallas medianas (canvas no comprimido).
10. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pasan sin errores.
11. Ningún archivo fuera de "Alcance permitido" queda modificado.
12. La Vista Plan (`/`) no cambia en absoluto.

## Comandos de validación

```
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Condición exacta de terminación

La tarea termina cuando los criterios de aceptación se cumplen y la secuencia de validación se ejecuta sin errores — o cuando Codex reporta explícitamente que lograr el efecto visual pedido requeriría tocar lógica de interacción fuera del alcance permitido, sin hacerlo por su cuenta. Codex entrega el resumen indicado en `AGENTS.md`, describiendo explícitamente qué cambió visualmente (framing, ancho, alto, panel, responsive), y se detiene, sin iniciar ninguna tarea posterior.
