# TASK-005.7 — Nodos simplificados y panel de detalle en la Vista Explorar

## Objetivo

Simplificar las tarjetas del grafo (`/grafo`) a lo esencial para lectura rápida, y mover toda la información detallada — incluyendo los controles de trayectoria — a un **panel de detalle** que aparece al seleccionar una materia.

Hoy cada nodo del grafo muestra código, nombre, créditos, obligatoriedad, estado, la lista completa de requisitos y **tres botones de trayectoria** (`Sin marcar` / `En curso` / `Completada`), lo que hace los nodos altos y pesados de leer en un grafo de 60 materias. Esta tarea reduce el nodo a lo mínimo y traslada el resto a un panel dedicado.

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

`docs/AGENT_REVIEW_POLICY.md`: "UI interactiva o compleja (estado, interacción, grafos, rendimiento)" → `claude-review` + `codex-qa`.

## Contexto mínimo

- `apps/web/app/graph-view.tsx` — `GraphCourseCard` (nodo actual, con `.actions` y los tres botones), `GraphView` (selección vía `selectedId`, `relatedIds`, `markCourse` ahora importado de `useTrajectory()`).
- `apps/web/lib/trajectory.tsx` — `useTrajectory()` expone `trajectory`, `states`, `markCourse`. Es la única fuente de trayectoria (TASK-005.4); este panel debe usarla tal cual, sin estado propio.
- `apps/web/lib/curriculum-data.ts` — `coursesById`, `requirementLines`, `courseReference`.
- `docs/tasks/TASK-005.6.md` — la región del grafo ahora tiene arrastre por puntero (`onPointerDown`/`onClickCapture` con supresión de click tras arrastre) montado en `.graphRegion`; el panel de detalle debe convivir con eso sin romper la selección por click.
- `apps/web/app/graph-view.module.css` — estilos actuales de `.courseCard`, `.actions`, `.requirements`.

## Decisiones aprobadas

1. **El nodo del grafo queda reducido a**: código de materia, nombre, créditos, obligatoria/electiva, y la insignia de estado. **Se retira del nodo**: la lista de requisitos (`.requirements`) y los tres botones de trayectoria (`.actions`). Seleccionar sigue siendo click/tap sobre la tarjeta, igual que hoy.
2. **Panel de detalle nuevo**, que aparece cuando `selectedId !== null` y muestra la materia seleccionada: nombre completo, código, créditos, obligatoria/electiva, estado actual, y la lista de requisitos (reutilizando `requirementLines`, igual texto que hoy).
3. **El panel es quien aloja los controles de trayectoria**, con el mismo comportamiento que tenían los tres botones en el nodo (mismos estados `UNMARKED`/`IN_PROGRESS`/`COMPLETED`, mismo `disabled` cuando la materia está `BLOCKED`, misma llamada a `markCourse` de `useTrajectory()`). Es la trayectoria compartida real: marcar desde aquí actualiza también la Vista Plan.
4. **Colocación responsiva del panel, sin librería nueva**: panel lateral (a un costado del grafo) en pantallas anchas, y panel inferior o superpuesto en pantallas estrechas — con CSS (media query), no JavaScript de layout. Debe quedar visible sin tapar permanentemente la región del grafo en pantallas grandes.
5. **Cierre explícito del panel**: un control de cierre visible (botón "Cerrar" o "×") que limpia `selectedId` a `null`. Volver a hacer click sobre la misma materia también deselecciona (comportamiento ya existente, se conserva).
6. **Sin auto-selección al cargar.** Igual que hoy: sin materia seleccionada al entrar a `/grafo`, no hay panel visible.
7. **El foco visual existente (`relatedIds`, atenuado del resto) no cambia de comportamiento en esta tarea.** Sigue funcionando exactamente igual sobre los nodos ya simplificados. El modo foco explícito (atenuar fuertemente + salida por Escape) es TASK-005.9, no esta.
8. **Convivencia con el arrastre de TASK-005.6**: la selección debe seguir bloqueada tras un arrastre (el `onClickCapture` que suprime el click ya existente debe seguir funcionando sin cambios de comportamiento). El panel se abre/cierra únicamente por click limpio o por su propio botón de cierre — nunca como efecto secundario de arrastrar.
9. **Accesibilidad del panel**: al abrirse debe ser alcanzable y anunciable (p. ej. `role="dialog"` no modal o una región con `aria-label` claro, foco inicial gestionable sin atrapar el teclado de forma agresiva). No hace falta un modal bloqueante — el grafo debe seguir interactuable si el panel es lateral.
10. **Sin cambios en la Vista Plan** (`curriculum-view.tsx`). Sus tarjetas conservan sus tres botones tal cual — unificar su presentación con la del grafo no es parte de esta tarea.
11. **Sin dependencias nuevas.** Sin librerías de panel/drawer/modal.
12. **Sin cambios en `packages/**`.**

## Alcance permitido

```
apps/web/app/graph-view.tsx           (simplificar GraphCourseCard, añadir el panel de detalle y su estado de apertura/cierre)
apps/web/app/graph-view.module.css    (estilos del nodo reducido y del panel)
```

Ningún otro archivo debe modificarse. En particular: ni `curriculum-view.tsx` (decisión 10), ni `apps/web/lib/**`, ni nada bajo `packages/**`, `apps/admin/**`, `tools/agent/**`, ni ningún `package.json`.

## Fuera de alcance

- Modo foco explícito con atenuación fuerte y salida por Escape (TASK-005.9).
- Explicación legible de bloqueos ("te faltan N créditos") — es TASK-005.8; el panel de esta tarea muestra los requisitos con el mismo texto que ya produce `requirementLines`, sin traducir razones de bloqueo todavía.
- Unificar la Vista Plan con este patrón de panel (decisión 10).
- Zoom, minimapa, cambios al arrastre de TASK-005.6 más allá de la convivencia descrita (decisión 8).
- Resolver o investigar el hydration mismatch de `docs/KNOWN_ISSUES.md` — **explícitamente prohibido**.
- Modificar `packages/curriculum-domain`, `curriculum-schema`, `curriculum-engine`, `curriculum-snapshot`.

## Criterios de aceptación

- Los nodos del grafo muestran solo código, nombre, créditos, obligatoria/electiva y estado; ya no contienen la lista de requisitos ni los tres botones de trayectoria.
- Seleccionar una materia abre un panel de detalle con su información completa, incluida la lista de requisitos con el mismo texto de hoy.
- El panel contiene los controles de trayectoria (`Sin marcar`/`En curso`/`Completada`), deshabilitados igual que antes cuando la materia está `BLOCKED`, y actualizan la trayectoria compartida (`useTrajectory().markCourse`) — verificable porque el cambio se refleja también en `/`.
- El panel tiene un cierre explícito, y volver a click sobre la misma materia también lo cierra.
- El panel se adapta de forma responsiva (lateral en pantallas anchas, inferior/superpuesto en estrechas) usando solo CSS.
- Un arrastre sobre el grafo no abre el panel; solo un click limpio o la interacción directa con el panel lo hacen.
- El foco por `relatedIds` (atenuar el resto al seleccionar) sigue funcionando igual que hoy.
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

La tarea termina cuando los criterios de aceptación se cumplen y la secuencia de validación se ejecuta sin errores. Codex entrega el resumen indicado en `AGENTS.md` y se detiene, sin iniciar TASK-005.8 ni ninguna otra tarea.
