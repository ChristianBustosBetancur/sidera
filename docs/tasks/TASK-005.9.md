# TASK-005.9 — Modo foco explícito en la Vista Explorar

## Objetivo

Añadir un **modo foco** explícito a la Vista Explorar (`/grafo`), construido sobre el resaltado por selección que ya existe (`relatedIds`, atenuar el resto): cuando está activo, atenúa fuertemente todo lo no relacionado con la materia seleccionada, con una salida clara. Un único modo — no "Resaltar" y "Aislar" como opciones separadas.

Hoy seleccionar una materia ya atenúa el resto (`opacity: 0.3` vía `.dimmed`/`.edgeDimmed`, decisión 7 de TASK-005.2). Esta tarea introduce un modo **más fuerte** y **explícito** de foco, con su propia entrada/salida, en vez de cambiar el comportamiento por defecto de la selección.

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

`docs/AGENT_REVIEW_POLICY.md`: "UI interactiva o compleja (estado, interacción, grafos, rendimiento)" → `claude-review` + `codex-qa`.

## Contexto mínimo

- `apps/web/app/graph-view.tsx` — `selectedId`, `relatedIds` (memo de vecinos **directos** — de los que depende y los que dependen de ella, ya calculado), `GraphCourseCard` con prop `dimmed`, las aristas con `.edgeDimmed`/`.edgeFocused`. El panel de detalle de TASK-005.7 y las explicaciones de bloqueo de TASK-005.8 ya existen y no cambian.
- `apps/web/app/graph-view.module.css` — `.dimmed { opacity: 0.3; }`, `.edgeDimmed { opacity: 0.1; }`. La región del grafo ya tiene arrastre por puntero (TASK-005.6) montado con `tabIndex={0}`.
- `docs/PERFORMANCE.md` — sin animaciones en bucle, transiciones cortas, dispositivo de gama baja como referencia.

## Decisiones aprobadas

1. **Alcance del foco: vecinos directos, no cadena transitiva completa.** Reutiliza exactamente el `relatedIds` que ya existe — no se calcula ningún cierre transitivo nuevo. Ampliarlo a la cadena completa queda explícitamente fuera de esta tarea; se evaluará después si aporta valor.
2. **Atenuar, no ocultar.** El resto del grafo se atenúa fuertemente (opacidad reducida, más que el `0.3` actual de la selección simple — p. ej. en el rango `0.08`–`0.12`, similar a como ya se atenúan las aristas), pero nunca se desmonta ni dejan de ocupar su espacio en el layout. La estructura general y la posición de todo sigue siendo visible, aunque tenue — se conserva la referencia espacial y el grafo no "salta".
3. **Un solo modo, sin variantes.** No se implementan dos modos ("Resaltar" vs "Aislar") ni un selector entre ellos. Existe una única transición: sin foco → foco activo → sin foco.
4. **Cómo se activa**: seleccionar una materia (click/tap sobre su tarjeta, comportamiento ya existente) activa el foco sobre esa materia y sus vecinos directos — es una intensificación del resaltado ya existente al seleccionar, no una acción separada. No hace falta un botón adicional para "entrar" en foco.
5. **Cómo se sale — las tres formas deben funcionar:**
   - Click en cualquier zona vacía del grafo (fuera de una tarjeta) limpia la selección y sale del foco.
   - Un botón visible "Salir del foco" (o equivalente), visible solo cuando el foco está activo.
   - Tecla `Escape`, con el foco del teclado en cualquier parte de la región del grafo o del panel de detalle.

   Volver a hacer click sobre la misma materia ya seleccionada también sale (comportamiento existente, se conserva).
6. **Transiciones cortas de opacidad, sin animación en bucle**, reutilizando el patrón `transition: opacity 120ms ease` que ya existe en `.courseCard`. Respeta `@media (prefers-reduced-motion: reduce)` como ya hace el CSS actual.
7. **Convivencia con el arrastre de TASK-005.6**: activar/salir del foco es exclusivamente por click limpio (no arrastre) o por las otras dos formas de salida — el `onClickCapture` que suprime el click tras arrastrar (ya existente) sigue aplicando sin cambios.
8. **Convivencia con el panel de detalle de TASK-005.7**: el panel sigue abriéndose junto con el foco (misma condición `selectedId !== null`). Salir del foco por cualquiera de las tres vías también cierra el panel — son el mismo estado (`selectedId`), no dos estados independientes.
9. **Sin cambios en el cálculo de niveles, aristas o layout.** Esta tarea es exclusivamente presentación del foco ya existente, más fuerte y con salida explícita.
10. **Sin dependencias nuevas ni cambios en `packages/**`.**
11. **Sin cambios en la Vista Plan.**

## Alcance permitido

```
apps/web/app/graph-view.tsx           (intensificar el resaltado existente, click en zona vacía, botón de salida, manejo de Escape)
apps/web/app/graph-view.module.css    (opacidad más fuerte para el modo foco, estilos del botón de salida)
```

Ningún otro archivo debe modificarse. En particular: ni `curriculum-view.tsx` (decisión 11), ni `apps/web/lib/**`, ni nada bajo `packages/**`, `apps/admin/**`, `tools/agent/**`, ni ningún `package.json`.

## Fuera de alcance

- Cadena transitiva completa como alcance del foco (decisión 1).
- Dos modos separados de resaltado/aislamiento (decisión 3).
- Ocultar nodos o aristas en vez de atenuarlos (decisión 2).
- Zoom, animaciones más allá de la transición de opacidad ya existente.
- Cambios a la Vista Plan, al panel de detalle (contenido) o a las explicaciones de bloqueo — solo se toca la intensidad/salida del foco.
- Resolver o investigar el hydration mismatch de `docs/KNOWN_ISSUES.md` — **explícitamente prohibido**.
- Modificar `packages/curriculum-domain`, `curriculum-schema`, `curriculum-engine`, `curriculum-snapshot`.

## Criterios de aceptación

- Seleccionar una materia atenúa fuertemente el resto del grafo (nodos y aristas no relacionados), manteniendo únicamente los vecinos directos (`relatedIds` existente) sin atenuar.
- Nada se oculta ni se desmonta: todo el grafo sigue ocupando su espacio, solo cambia la opacidad (decisión 2).
- Existen las tres formas de salida (decisión 5) y las tres funcionan: click en zona vacía, botón "Salir del foco", tecla `Escape`.
- Salir del foco por cualquier vía también cierra el panel de detalle (mismo estado `selectedId`).
- Un arrastre no activa ni desactiva el foco por sí mismo (convivencia con TASK-005.6 preservada).
- Las transiciones son cortas, sin bucle, y respetan `prefers-reduced-motion`.
- No existe ningún control ni texto que sugiera un segundo modo de foco.
- La Vista Plan no cambia en absoluto.
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

La tarea termina cuando los criterios de aceptación se cumplen y la secuencia de validación se ejecuta sin errores. Codex entrega el resumen indicado en `AGENTS.md` y se detiene, sin iniciar ninguna tarea posterior. Esta es la última tarea de la secuencia TASK-005.4 → TASK-005.9; al terminar, el runner no debe iniciar ninguna otra TASK.
