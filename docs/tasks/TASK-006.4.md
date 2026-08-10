# TASK-006.4 — Mobile Graph UX

## Objetivo

Dar a `/grafo` una experiencia móvil/tablet deliberada, corrigiendo dos problemas reportados tras probar en celular real:

1. **Salto de scroll al seleccionar una materia**: la página se desplaza hasta el final, el panel ocupa mucho espacio, y al cerrarlo el usuario queda abajo y debe hacer scroll manual para reencontrar el grafo.
2. **Escala/densidad excesiva en móvil**: los nodos ocupan demasiado espacio, se ve poco contexto simultáneo, y la vista se siente como un desktop reducido.

Desktop (`>72rem`) debe quedar **prácticamente intacto**.

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

`docs/AGENT_REVIEW_POLICY.md`: "UI interactiva o compleja (estado, interacción, grafos, rendimiento)" → `claude-review` + `codex-qa`. `codex-qa` debe auditar **específicamente** comportamiento móvil/táctil, tap targets, y que el panel no intercepte gestos fuera de su superficie.

## Diagnóstico (verificado en el código antes de escribir esta tarea)

**Causa exacta del salto de scroll** — `apps/web/app/graph-view.tsx` líneas 173-174:

```js
useEffect(() => {
  if (selectedId) detailPanelRef.current?.focus();
}, [selectedId]);
```

`HTMLElement.focus()` **desplaza el elemento a la vista por defecto**. En móvil/tablet (`≤72rem`), `.graphWorkspace` es un grid de una sola columna y `.detailPanel` se renderiza apilado **debajo** del grafo (fila 2), así que enfocarlo arrastra la página entera hasta abajo. En desktop (`>72rem`) el mismo panel es `position: absolute` **dentro** de `.graphWorkspace`, superpuesto al canvas y ya visible, por lo que enfocarlo no produce desplazamiento perceptible. Eso explica por qué el problema es exclusivamente móvil/tablet y por qué desktop se siente bien.

**Estructura móvil actual relevante**:
- `.graphRegion` en móvil **no tiene altura fija** (solo `overflow-x: auto`); el scroll vertical es scroll de página — decisión deliberada de TASK-005.6 para no capturar el dedo del usuario. **Esto no se toca.**
- Breakpoints existentes: `@media (min-width: 72.001rem)` (overlay desktop), `@media (max-width: 47rem)` (ajustes móviles), `@media (max-width: 22rem)`.
- Escala móvil actual (`≤47rem`): `.levelColumn` 15rem, `.columns` gap 3.5rem. Fuera de media query: `.courseCard` min-height 6.5rem + padding 0.8rem, `.canvas` padding 1rem, `.nodes` gap 1rem.

## Decisiones aprobadas

1. **`focus({ preventScroll: true })`** en el efecto de la línea 173. Conserva el movimiento de foco (lectores de pantalla, teclado) y elimina el desplazamiento automático. Es el fix de la causa raíz del problema 1.
2. **Bottom sheet en `≤72rem`** (móvil **y** tablet — ambos sufren hoy el mismo salto). `.detailPanel` pasa a `position: fixed`, anclado al borde inferior del viewport (`inset: auto 0 0 0`), con `max-height: 55vh` y `overflow-y: auto` para su propio contenido. **CSS puro**: `position: fixed` escapa del flujo sin importar dónde esté el `<aside>` en el DOM, así que **no se mueve ni un elemento del JSX** para lograrlo.
3. **Sin backdrop/scrim.** Un overlay a pantalla completa interceptaría gestos fuera de la superficie del panel, que es exactamente lo que hay que evitar. El sheet solo ocupa (y solo intercepta en) su propio rectángulo.
4. **Sin bloqueo del scroll del body** detrás del sheet. Nada de JS para guardar/restaurar posición de scroll — es una fuente clásica de saltos, justo el problema que esta tarea corrige. Con el panel abierto, el usuario puede seguir desplazando la página/grafo detrás, lo que refuerza el contexto en vez de perderlo.
5. **`z-index` del sheet suficiente para quedar sobre el grafo**, y por encima del badge de preview (TASK-006.2, `z-index: 10`, `position: fixed` abajo-izquierda). El badge es `pointer-events: none`, así que no interfiere; solo hay que asegurar que el sheet quede visualmente encima.
6. **Cambios de escala solo en `≤47rem`** (no en tablet). Valores de referencia (ajustables por Codex dentro de ese espíritu, priorizando legibilidad):
   - `.levelColumn` ancho/flex-basis: 15rem → ~11.5rem
   - `.columns` gap: 3.5rem → ~2.25rem
   - `.courseCard` min-height: 6.5rem → ~5rem
   - `.courseCard` padding: 0.8rem → ~0.6rem
   - `.canvas` padding: 1rem → ~0.75rem
   - `.nodes` gap: 1rem → ~0.75rem

   **Restricción dura**: la tarjeta completa (`<article>`) es el tap target de selección y debe permanecer holgadamente por encima de 44px de alto. Nada de texto ilegible, nada de tarjetas minúsculas, nada que obligue a zoom manual.
7. **Las aristas se remiden solas.** `measureEdges()` usa `getBoundingClientRect()` y ya hay un `ResizeObserver` con debounce (TASK-005.2/005.6). Cambiar tamaños en CSS no requiere ningún cambio de JS de medición — **prohibido** añadir listeners o mediciones nuevas por este motivo.
8. **Cero cambios al algoritmo del grafo.** `apps/web/lib/curriculum-graph.ts`, los niveles derivados, las aristas y su semántica no se tocan. No se reorganiza nada académicamente.
9. **Desktop (`>72rem`) queda prácticamente intacto**: el bloque `@media (min-width: 72.001rem)` con el panel overlay absoluto no se modifica. El único cambio que le afecta es `preventScroll: true`, que en desktop es un no-op perceptible (el panel ya está en vista).
10. **Interacción preservada sin excepciones**: selección por click/tap limpio, modo foco y sus tres salidas (botón, `Escape`, click en zona vacía), explicaciones de bloqueo, controles de trayectoria dentro del panel, trayectoria compartida Plan ↔ Explorar, persistencia local, y el pan por arrastre de TASK-005.6 (que sigue ignorando `pointerType === "touch"`).
11. **Sin pinch-to-zoom**, sin librerías de gestos, sin librerías de bottom sheet, sin animaciones JS por frame, sin observers nuevos. Solo CSS (`position`, `max-height`, `overflow`, `transform`, transiciones ligeras).
12. **Rotación de pantalla**: al ser `max-height: 55vh` (unidad relativa al viewport) y `position: fixed`, el sheet se readapta solo al rotar, sin JS. No se añade ningún manejo especial de `orientationchange`.
13. **Sin dependencias nuevas. Sin cambios en `packages/**`.**

## Alcance permitido

```
apps/web/app/graph-view.tsx           (únicamente: focus({ preventScroll: true }) en el efecto existente — ningún otro cambio de lógica ni de JSX)
apps/web/app/graph-view.module.css    (bottom sheet ≤72rem + escala móvil ≤47rem)
```

Ningún otro archivo debe modificarse. En particular: nada bajo `packages/**`, `apps/web/lib/**`, `apps/web/app/curriculum-view.*`, `apps/web/app/layout.*`, `apps/admin/**`, `tools/agent/**`, ni ningún `package.json`.

## Fuera de alcance

- Progreso EXP, motivos visuales, árbol de habilidades, aura, 3D.
- Dataset, `curriculum-engine`, `curriculum-schema`, `curriculum-snapshot`, Libre Elección.
- El hydration mismatch de `docs/KNOWN_ISSUES.md`.
- Backend, cuentas de usuario, configuración de Vercel.
- Pinch-to-zoom o cualquier gesto multitáctil nuevo (decisión 11).
- Bloquear el scroll del body, backdrop, o cualquier JS de gestión de scroll (decisiones 3 y 4).
- Cambios al algoritmo del grafo o a los niveles derivados (decisión 8).
- Cambios estructurales del JSX para lograr el sheet (decisión 2 — es CSS puro).

## Tests

**No se añaden tests nuevos, deliberadamente.** El cambio es CSS más una opción de `focus()`; sin `jsdom`/`@testing-library` (que se acordó no añadir, ver TASK-005.9.1) no es posible verificar posición de scroll ni layout, y escribir tests que no comprueben eso sería decorativo. La verificación real es: revisión de código por `claude-review` + `codex-qa`, y prueba manual del humano en celular real.

**Los 72 tests existentes deben seguir pasando sin ninguna modificación**, como prueba de no-regresión.

## Criterios de aceptación

1. Seleccionar una materia en móvil/tablet **no cambia la posición de scroll de la página** (`preventScroll: true` aplicado).
2. En `≤72rem`, el panel de detalle se muestra como sheet fijo anclado abajo, superpuesto al grafo, con `max-height: 55vh` y scroll interno propio — dejando el grafo visible en la parte superior.
3. Cerrar el panel revela exactamente el contexto de grafo que estaba detrás, sin necesidad de scroll manual.
4. No existe backdrop/scrim; el panel solo intercepta interacción dentro de su propia superficie.
5. No se bloquea ni se manipula el scroll del body por JS en ningún momento.
6. Los controles de trayectoria funcionan dentro del sheet y siguen actualizando la trayectoria compartida.
7. En `≤47rem`, los nodos y el canvas son perceptiblemente más compactos que antes (valores de la decisión 6), permitiendo ver más contexto simultáneo.
8. Las tarjetas siguen siendo legibles y su alto sigue holgadamente por encima de 44px como tap target.
9. Las aristas siguen alineadas con los nodos tras el cambio de escala, sin añadir ninguna medición ni listener nuevo.
10. Desktop (`>72rem`) mantiene el panel overlay absoluto y el resto de su layout sin cambios respecto al estado actual.
11. Selección, modo foco (con sus tres salidas), blockers, trayectoria, persistencia y pan por arrastre siguen funcionando exactamente igual.
12. Cero cambios en `packages/**` y en `apps/web/lib/curriculum-graph.ts`.
13. Cero dependencias nuevas en cualquier `package.json`.
14. Los 72 tests existentes siguen pasando sin modificarlos.
15. Ningún archivo fuera de "Alcance permitido" queda modificado.
16. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pasan sin errores.

## Comandos de validación

```
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Condición exacta de terminación

La tarea termina cuando los criterios de aceptación se cumplen y la secuencia de validación se ejecuta sin errores. Codex entrega el resumen indicado en `AGENTS.md`, describiendo explícitamente qué cambió en el comportamiento del panel móvil/tablet y qué valores de escala aplicó en `≤47rem`, y se detiene, sin iniciar ninguna tarea posterior.
