# TASK-006.0.1 — True Open Canvas para Vista Explorar

## Objetivo

TASK-006.0 amplió ancho/alto y suavizó el borde de `.graphRegion`, pero en Chrome real la sensación reportada por el humano sigue siendo "página → recuadro → grafo dentro". Esta tarea es una segunda iteración, más profunda en composición visual (no solo en parámetros de tamaño), para que la Vista Explorar se sienta como una superficie principal de la página, no como un widget contenido en una caja.

**Explícitamente prohibido** repetir el enfoque de TASK-006.0: no basta con volver a subir `max-width`, volver a subir `height`, o hacer el borde todavía más transparente. Hace falta cambiar qué se percibe como "un rectángulo" en la composición.

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

## Inspección previa y conclusión sobre JSX (hecha antes de escribir esta tarea)

Se inspeccionó `apps/web/app/graph-view.tsx` y el CSS resultante de TASK-006.0 para decidir si hace falta tocar la composición JSX, tal como autorizó el humano condicionalmente ("si para conseguir el layout se necesita, puedes proponerlo antes de implementarlo").

**Conclusión: no hace falta ningún cambio de JSX.** La causa principal de la sensación de "recuadro" no es el ancho total disponible (que TASK-006.0 ya amplió razonablemente) sino:

1. `.graphRegion` sigue teniendo tratamiento propio de superficie (fondo con tinte propio, `border-radius`, sombra interior) que lo distingue visualmente del fondo de la página, sea cual sea su ancho.
2. `.graphWorkspace` usa `display: grid` con dos columnas (`graphRegion` + `detailPanel`) **siempre que hay selección**, así que el canvas literalmente se reduce a una fracción del ancho disponible en vez de ocupar el espacio completo — esto es, en la práctica, la causa más fuerte de que se perciba como "un widget dentro de un layout", más que el `max-width` en sí.

`<section ref={graphRegionRef}>` y `<aside ref={detailPanelRef}>` ya son hermanos dentro de `.graphWorkspace` en el DOM actual — es la estructura correcta para lograr un panel flotante/overlay únicamente con CSS (`position: relative` en el contenedor, `position: absolute` en el panel), sin mover ni un elemento. Por eso esta tarea es **CSS-only**, tal como preferías.

## Decisiones aprobadas

1. **`.graphRegion` deja de tener superficie propia.** Fondo transparente (o exactamente `var(--paper)`, el mismo fondo del `<body>` — ver `apps/web/app/globals.css`), `border-radius: 0`, sin ningún `box-shadow`. El grafo se funde con el fondo general de la página (decisión 4 del pedido original). El `overflow`/scroll interno para pan/drag se conserva técnicamente (decisión 6 del pedido) — solo cambia su tratamiento visual, no su función.
2. **El panel de detalle se convierte en overlay flotante, solo en pantallas anchas** (mismo punto de corte que ya existe hoy, `72rem`, para no introducir un nuevo breakpoint): `.graphWorkspace` pasa de `display: grid` a `position: relative` en ese rango; `.graphRegion` ocupa el 100% del ancho de `.graphWorkspace` siempre, tenga o no selección activa (ya no se reduce cuando el panel aparece); `.detailPanel` pasa a `position: absolute`, anclado al borde derecho (`top`/`right`/`bottom` dentro de `.graphWorkspace`), con altura acotada a la del canvas y `overflow-y: auto` interno para su propio contenido si no cupiera completo. Esto responde directamente a "no debe reducir excesivamente el ancho del canvas" y "evaluar si puede ser overlay/sidebar" del pedido.
3. **El panel, al ser ahora un overlay sobre el canvas, sí puede (y debe) conservar una superficie diferenciada** (fondo suficientemente opaco para legibilidad, un borde o sombra sutil que lo distinga como capa flotante) — la decisión 5 de "evitar tratamientos que hagan reconocer un rectángulo" aplica a `.graphRegion` (el canvas), no al panel: un panel flotante necesita leerse como una capa distinta para ser legible sobre el grafo. Mantener su ancho ya definido (`minmax(19rem, 21rem)` aprox.) y su contenido/funcionalidad exactamente igual.
4. **En pantallas medianas y móvil (por debajo del punto de corte de `72rem`), el panel conserva su comportamiento actual de bloque apilado debajo del canvas** (no overlay) — el pedido lo pide explícitamente solo "en desktop", y en pantallas estrechas un panel flotante taparía demasiado grafo. No se introduce ningún drawer nuevo ni ninguna librería.
5. **Reducir el padding/margen exterior que queda entre el borde del viewport y el canvas.** `.page` ya usa `width: min(100% - 2rem, 120rem)` (gutter mínimo en la mayoría de anchos reales), pero puede ajustarse ligeramente más (p. ej. `100% - 1rem` o quitar el límite superior de `120rem` para el propio `.graphWorkspace`) si ayuda a que el canvas llegue más cerca del borde real del viewport, siempre que `.header`/`.controls` conserven su ancho de lectura actual (`min(100%, 96rem)`, ya independiente).
6. **`graphNavigation` (los controles "Volver al inicio", "Salir del foco", el hint de arrastre) puede integrarse de forma más discreta**, por ejemplo como una fila compacta que se superpone o convive visualmente con el borde superior del canvas en vez de ser una franja separada con su propio bloque — a discreción de Codex, siempre que seleccionar los controles y su función no cambien.
7. **La leyenda (`.controls`, con `.legend`) y el `.graphError` mantienen su tratamiento actual** (bloque con borde sutil) — no son el problema reportado; el pedido se centra en el canvas y el panel.
8. **`.canvas` (el contenedor real de las columnas/nodos, dentro de `.graphRegion`) puede reducir su `padding` si ayuda a que el contenido llegue más cerca del borde visual de la superficie**, pero sin quitarlo del todo si eso pegara los nodos exactamente al borde del contenedor con scroll.
9. **Nada de la interacción cambia.** `handlePointerDown`/`handlePointerMove`/`finishDrag`, el `onClickCapture`/`onClick` de la sección, el manejador de `Escape`, `relatedIds`, `measureEdges`, el contenido del panel de detalle — sin tocar. `measureEdges()` mide `nodeRefs`/`canvasRef` con `getBoundingClientRect()`, que sigue funcionando igual sea cual sea el tratamiento visual del contenedor — verificar que convertir el panel en overlay no cambia el ancho real de `.graphRegion` de forma que afecte esas mediciones de forma incorrecta (no debería, ya que antes también cambiaba de ancho al aparecer/desaparecer el panel vía grid, y `measureEdges` ya se recalcula con el `ResizeObserver` existente).
10. **Sin dependencias nuevas.** Solo CSS (position/overflow/tamaños), sin librerías de overlay/popover/portal.
11. **Sin cambios en `packages/**` ni en `apps/web/lib/curriculum-graph.ts`.** Sin cambios en la Vista Plan.
12. **Nada de la fase siguiente** (Course Visual Motifs, barras EXP, Mi Progreso, árbol de habilidades, aura, 3D, hydration mismatch) — igual que TASK-006.0.

## Alcance permitido

```
apps/web/app/graph-view.module.css    (todo el cambio: tratamiento de superficie, overlay del panel, ajustes de gutter)
```

`apps/web/app/graph-view.tsx` **no debería necesitar tocarse**, según la inspección de esta tarea (sección anterior). Si al implementar Codex concluye que sí hace falta un cambio mínimo de composición JSX para lograr el efecto pedido, **debe detenerse y reportarlo explícitamente en el resumen final, describiendo el cambio propuesto, sin aplicarlo por su cuenta** — igual que autorizó el humano ("puedes proponerlo antes de implementarlo").

Ningún otro archivo debe modificarse. En particular: nada bajo `packages/**`, `apps/web/lib/**`, `apps/web/app/curriculum-view.tsx`, `apps/web/app/curriculum-view.module.css`, `apps/admin/**`, `tools/agent/**`, ni ningún `package.json`.

## Fuera de alcance

- Cualquier cambio en `packages/curriculum-domain`, `curriculum-schema`, `curriculum-engine`, `curriculum-snapshot`.
- Cambios al algoritmo de `apps/web/lib/curriculum-graph.ts`.
- Cualquier manejador de eventos de puntero/teclado/click existente (decisión 9).
- Contenido, orden o funcionalidad del panel de detalle — solo su posicionamiento/tratamiento visual (decisión 3).
- Un drawer nuevo, animaciones de entrada/salida complejas, o cualquier librería de overlay/popover.
- Course Visual Motifs, barras EXP, "Mi Progreso", árbol de habilidades, aura, 3D.
- El árbol inmersivo final.
- Resolver o investigar el hydration mismatch de `docs/KNOWN_ISSUES.md`.
- Cambios en la Vista Plan (`/`).

## Interacciones que deben seguir funcionando exactamente igual (verificación obligatoria)

- Click limpio sobre una materia → selecciona → abre/actualiza el panel de detalle (ahora flotante en desktop) → activa el resaltado de foco.
- Arrastre real (ratón, por encima del umbral) → mueve el grafo → no selecciona accidentalmente.
- Tras terminar un arrastre real, el siguiente click limpio selecciona de inmediato.
- Modo foco: vecinos directos sin atenuar, resto atenuado; salida por botón, `Escape`, y click en zona vacía.
- Trayectoria compartida Plan ↔ Explorar, persistencia local, estados derivados, explicaciones de bloqueo.
- Navegación táctil sin cambios.
- El panel de detalle sigue siendo legible y usable como overlay (texto con contraste suficiente sobre su propio fondo, no sobre el grafo directamente).

## Criterios de aceptación

1. `.graphRegion` no tiene fondo con tinte propio distinguible del fondo de la página, ni `border-radius`, ni `box-shadow` — se funde visualmente con el fondo general.
2. En desktop (por encima de `72rem`), el canvas ocupa el 100% del ancho de `.graphWorkspace` **incluso con el panel de detalle abierto** — ya no se reduce a una columna de grid.
3. El panel de detalle, en desktop, se muestra como una capa flotante sobre el canvas (no como una columna que le resta ancho), permanece legible, y no reduce el ancho real del canvas subyacente.
4. En pantallas medianas/móvil (`≤72rem`), el panel conserva el comportamiento de bloque apilado ya existente, sin overlay.
5. Pan/drag, click limpio + modo foco, y las tres salidas del foco siguen funcionando exactamente igual (ver sección de interacciones).
6. `measureEdges`/la posición de las aristas sigue siendo correcta con el panel abierto y cerrado.
7. Cero cambios en cualquier archivo bajo `packages/**` o en `curriculum-graph.ts`.
8. Cero dependencias nuevas.
9. Si Codex determina que hace falta un cambio de JSX, lo reporta explícitamente sin aplicarlo, en vez de modificar `graph-view.tsx` sin autorización.
10. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pasan sin errores.
11. Ningún archivo fuera de "Alcance permitido" queda modificado (salvo el reporte de la decisión 9, no una modificación).
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

La tarea termina cuando los criterios de aceptación se cumplen y la secuencia de validación se ejecuta sin errores — o cuando Codex reporta explícitamente que hace falta un cambio de JSX no incluido en el alcance permitido, sin aplicarlo por su cuenta. Codex entrega el resumen indicado en `AGENTS.md`, describiendo explícitamente qué cambió visualmente frente al estado de TASK-006.0, y se detiene, sin iniciar ninguna tarea posterior.
