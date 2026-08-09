# TASK-006.0.2 — Alignment & Composition Polish para Vista Explorar

## Objetivo

TASK-006.0.1 logró que el canvas se sintiera abierto, pero introdujo un problema nuevo reportado en Chrome real: **dos sistemas de alineación distintos conviven en la misma página** — el header y la barra de controles están centrados dentro de un ancho fijo de `96rem`, mientras que el canvas ocupa prácticamente todo el viewport y sus materias del Nivel 0 arrancan casi pegadas al borde izquierdo de la ventana. Esta tarea unifica esa composición sin volver a encerrar el grafo.

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

## Diagnóstico (inspección hecha antes de escribir esta tarea)

Leído en `apps/web/app/graph-view.module.css` tras TASK-006.0.1:

- `.page { width: calc(100% - 1rem); margin: 0 auto; padding: 2rem 0 4rem; }` — padding **horizontal** prácticamente nulo (solo el `margin:auto` de un `calc(100% - 1rem)`, es decir ~0.5rem de hueco a cada lado). El contenido de `.page` empieza casi pegado al borde del viewport.
- `.header, .controls { width: min(100%, 96rem); margin-inline: auto; }` — estos dos, y por separado `.graphNavigation { width: min(100%, 96rem); margin: 0 auto 0.5rem; }`, se **auto-centran** dentro de una columna de `96rem`, independiente del ancho real de `.page`. En una pantalla más ancha que `96rem + 1rem`, esta columna queda centrada con huecos vacíos a los lados — un sistema de alineación propio, desconectado del canvas.
- `.graphWorkspace`/`.graphRegion` no tienen ancho ni padding-inline propios — simplemente llenan la caja de contenido de `.page`, que empieza casi en el borde real del viewport (el ~0.5rem de arriba). De ahí que el Nivel 0 arranque pegado a la izquierda.

**Causa raíz de "dos sistemas": `.page` no tiene padding horizontal real, y en su lugar cada bloque (header/controles/navegación) se auto-centra por separado dentro de `96rem`, mientras el canvas hereda directamente el borde casi sin padding de `.page`.** La corrección es dar a `.page` un padding horizontal responsivo real y compartido, y dejar que header/controles/navegación/canvas lo hereden todos por igual — un solo eje, no una columna centrada flotando sobre un fondo full-bleed.

## Decisiones aprobadas

1. **`.page` recibe un `padding-inline` responsivo real** que sustituye el hueco casi nulo actual — pequeño en móvil, moderadamente mayor en desktop. Usar `clamp()`, por ejemplo en el orden de `clamp(1rem, 4vw, 4rem)` (el valor exacto queda a criterio de Codex dentro de ese espíritu: mínimo cómodo en móvil, techo razonable para no crear un padding absurdo en monitores ultra-anchos). **No** debe ser un valor fijo grande igual en todos los tamaños (perdería la gradación pedida), ni debe colapsar a casi cero como hoy.
2. **`.header`, `.controls` y `.graphNavigation` dejan de auto-centrarse en su propia columna de `96rem`.** Se elimina el `width: min(100%, 96rem); margin-inline/margin: auto` que los hace flotar independientes del resto. Pasan a ser bloques normales que ocupan el ancho de contenido de `.page` (heredando su `padding-inline` de la decisión 1), igual que el canvas — así comparten el mismo eje/alineación izquierda-derecha que pide el humano.
3. **Si se quiere conservar un "ancho de lectura razonable" para el texto del header** (permitido explícitamente por el humano, no obligatorio), debe lograrse **sin volver a centrar el bloque completo ni desalinearlo del canvas** — por ejemplo, acotando el ancho de elementos internos de texto (`.header h1`, párrafos largos) con un `max-width` propio, mientras el contenedor del header en sí sigue alineado al mismo borde izquierdo que el canvas. No introducir una segunda columna centrada.
4. **El canvas (`.graphWorkspace`/`.graphRegion`) sigue sin `max-width` propio ni recuadro** — solo hereda el nuevo `padding-inline` de `.page` (decisión 1). Sigue siendo notablemente más ancho que en TASK-006.0 (antes del `120rem`), y sin ningún tratamiento de superficie (fondo/borde/sombra) que lo haga leerse como una caja — eso ya se resolvió en TASK-006.0.1 y **no se revierte**.
5. **El panel de detalle flotante (overlay, TASK-006.0.1) no cambia de mecanismo** — sigue siendo `position: absolute` anclado dentro de `.graphWorkspace` en desktop, y bloque apilado en pantallas medianas/móvil. Solo puede verse afectado por el nuevo padding-inline heredado del canvas (su posición `right`/`top`/`bottom` es relativa a `.graphWorkspace`, así que se mueve junto con el canvas de forma consistente, sin lógica nueva).
6. **`.canvas` (el contenedor interno con `padding: 1rem` alrededor de las columnas de materias) puede ajustarse levemente si hace falta**, pero el padding real que resuelve "el grafo empieza pegado al borde" es el de `.page` (decisión 1), no este — no usar el padding de `.canvas` como sustituto del padding-inline de la página.
7. **Nada de la interacción cambia.** Sin tocar `graph-view.tsx`, ningún manejador de eventos, `measureEdges`, el modo foco, el panel (contenido/lógica), la trayectoria, la persistencia. Es una tarea CSS-only sobre `apps/web/app/graph-view.module.css` — si al implementar Codex concluye que hace falta tocar `graph-view.tsx`, debe **detenerse y reportarlo** en vez de hacerlo.
8. **Responsive**: en móvil, el padding-inline debe seguir siendo pequeño (extremo inferior del `clamp` de la decisión 1); revisar que el bloque `@media (max-width: 47rem)` existente siga siendo coherente con el nuevo padding compartido (puede necesitar ajustes menores, p. ej. limpiar reglas que ya no apliquen tras quitar el `width:min(...)` de header/controles en ese breakpoint).
9. **Sin dependencias nuevas. Sin cambios en `packages/**`, en `curriculum-graph.ts`, ni en la Vista Plan.**
10. **Nada de la fase siguiente** (motivos visuales, barras EXP, Mi Progreso, hydration mismatch, 3D) — igual que las tareas anteriores de esta serie.

## Alcance permitido

```
apps/web/app/graph-view.module.css
```

`apps/web/app/graph-view.tsx` **no debería necesitar tocarse** (decisión 7). Si Codex concluye lo contrario, debe reportarlo explícitamente sin aplicarlo.

Ningún otro archivo debe modificarse.

## Fuera de alcance

- Cualquier cambio en `packages/curriculum-domain`, `curriculum-schema`, `curriculum-engine`, `curriculum-snapshot`, o en `apps/web/lib/curriculum-graph.ts`.
- Cualquier manejador de eventos de puntero/teclado/click existente.
- Contenido, orden o mecanismo del panel de detalle (overlay ya resuelto en TASK-006.0.1, no se revierte ni se rediseña).
- Volver a un `max-width` rígido tipo `96rem` para toda la página, o volver al recuadro/superficie de `.graphRegion` de antes de TASK-006.0.1.
- Reducir significativamente el ancho útil del canvas respecto al estado actual.
- Course Visual Motifs, barras EXP, "Mi Progreso", árbol de habilidades, aura, 3D, el árbol inmersivo final.
- Resolver o investigar el hydration mismatch de `docs/KNOWN_ISSUES.md`.
- Cambios en la Vista Plan (`/`).

## Interacciones que deben seguir funcionando exactamente igual (verificación obligatoria)

- Click limpio sobre una materia → selecciona → abre/actualiza el panel de detalle (overlay en desktop) → activa el resaltado de foco.
- Arrastre real → mueve el grafo → no selecciona accidentalmente; tras terminar, el siguiente click funciona de inmediato.
- Modo foco con sus tres salidas: botón, `Escape`, click en zona vacía.
- Trayectoria compartida Plan ↔ Explorar, persistencia local, estados derivados, explicaciones de bloqueo.
- Navegación táctil sin cambios.

## Criterios de aceptación

1. El canvas sigue sintiéndose abierto (sin `max-width` rígido, sin recuadro/superficie propia — TASK-006.0.1 no se revierte).
2. El grafo ya no arranca casi pegado al borde izquierdo del viewport: existe un padding horizontal real y visible antes del Nivel 0.
3. Header, barra de controles, controles de navegación del grafo, y el canvas comparten el mismo eje de alineación izquierda/derecha (mismo padding-inline heredado de `.page`) — ya no hay una columna centrada de `96rem` flotando sobre un fondo full-bleed.
4. El padding horizontal es notablemente menor en móvil que en desktop (verificable en los valores de `clamp()`/media queries).
5. El canvas conserva un ancho significativamente mayor que el estado previo a TASK-006.0 (antes del `120rem` fijo).
6. El panel de detalle overlay sigue funcionando exactamente igual que en TASK-006.0.1, en desktop y en pantallas medianas/móvil.
7. Click limpio, drag, modo foco (con sus tres salidas) y Escape siguen intactos.
8. Responsive sigue siendo usable en móvil y pantallas medianas.
9. Cero cambios en `packages/**`, en `curriculum-graph.ts`, y cero dependencias nuevas.
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

La tarea termina cuando los criterios de aceptación se cumplen y la secuencia de validación se ejecuta sin errores — o cuando Codex reporta explícitamente que hace falta tocar `graph-view.tsx` u otro archivo fuera de alcance, sin aplicarlo por su cuenta. Codex entrega el resumen indicado en `AGENTS.md`, describiendo explícitamente qué cambió en la composición/alineación frente al estado de TASK-006.0.1, y se detiene, sin iniciar ninguna tarea posterior.
