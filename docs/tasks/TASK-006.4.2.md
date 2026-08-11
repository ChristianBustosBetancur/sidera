# TASK-006.4.2 — Mobile/Tablet Selection Scroll Root-Cause Instrumentation

## Objetivo

**Tarea exclusivamente diagnóstica.** TASK-006.4 y TASK-006.4.1 no resolvieron el síntoma real: en celular y tablet, al tocar una materia la vista termina desplazada verticalmente y se pierde el contexto — pese a que el panel es `position: fixed`, el foco usa `preventScroll: true`, el sheet mide 45vh, y no hay backdrop ni bloqueo de scroll.

Esta tarea **no arregla nada**. Añade instrumentación temporal, solo de desarrollo, para obtener evidencia del navegador real: en qué momento exacto cambia la posición de scroll y qué evento/elemento lo provoca.

Cualquier intento de aplicar un fix dentro de esta tarea es un defecto de la tarea.

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

## Hallazgos de la inspección previa — las dos sospechas a distinguir

La instrumentación debe permitir distinguir **claramente** estas dos causas candidatas, encontradas leyendo el código:

### Sospecha 1 — foco nativo del `<button>` interno de la tarjeta

`GraphCourseCard` renderiza `<article onClick={onSelect}>` que **contiene** `<button className={styles.courseSelector}>` con el código y el nombre de la materia — la zona más probable de tap. Al tocarlo, el navegador **le da foco nativo**, y los navegadores desplazan a la vista el elemento que recibe foco. `preventScroll: true` **no aplica a este caso**: solo afecta a la llamada explícita `.focus()` sobre el panel de detalle, no al foco implícito generado por el propio tap.

**Cómo se distingue**: el primer delta de `window.scrollY` aparecería entre `pointerdown` y `click`, y `activeElement` sería `BUTTON.courseSelector`.

### Sospecha 2 — reflow y scroll anchoring por el montaje de "Salir del foco"

En `graph-view.tsx`, `{selectedId ? <button className={styles.exitFocusButton}>Salir del foco</button> : null}` se monta dentro de `.graphNavigation`, que está **encima del grafo en el flujo del documento**. `.graphNavigation` es `display: flex` sin `flex-wrap` (por tanto `nowrap`): en pantallas estrechas, dos botones compitiendo por el ancho pueden hacer que su texto pase a dos líneas, la fila crece de alto, y todo lo que está debajo se desplaza — momento en el que entra el scroll anchoring del navegador.

**Cómo se distingue**: el primer delta de `window.scrollY` aparecería entre `t1` y `rAF1`/`rAF2`, acompañado de un cambio en `document.documentElement.scrollHeight`.

Ninguna de las dos se asume verdadera. La instrumentación existe precisamente para decidir entre ellas (o revelar una tercera).

## Decisiones aprobadas

1. **Instrumentación en código, no snippet de DevTools.** Permite probar en dispositivo real sin depender de depuración remota por USB.
2. **Overlay visual en pantalla**, porque en un celular real `console.log` es invisible sin depuración remota. El overlay muestra las muestras capturadas en formato compacto y legible. También puede escribir en consola, pero la pantalla es el canal principal.
3. **Overlay `pointer-events: none`**, sin ningún elemento interactivo. **Sin botón de copiar** — un control interactivo podría robar el foco y contaminar exactamente lo que se está midiendo. El humano entrega los resultados por captura de pantalla.
4. **Solo en desarrollo.** Todo el código va detrás de un guard `process.env.NODE_ENV !== "production"`, que Next.js sustituye estáticamente, de modo que la instrumentación desaparece del build de producción.
5. **Solo en `≤72rem`**, comprobado con `matchMedia("(max-width: 72rem)")`. En desktop no se activa ni se renderiza nada.
6. **Una tanda de muestras por selección**, sin spam continuo. Cada nueva selección reemplaza la tanda anterior en el overlay.
7. **Momentos de muestreo obligatorios**, en este orden:
   - `pointerdown` (evento del gesto)
   - `pointerup` (evento del gesto)
   - `click` (evento del gesto)
   - `t0` — inmediatamente **antes** de cambiar `selectedId`
   - `t1` — inmediatamente **después** de cambiar `selectedId`
   - `rAF1` — primer `requestAnimationFrame`
   - `rAF2` — segundo `requestAnimationFrame`
   - `post-focus` — después de que el efecto existente enfoque el panel de detalle
8. **Campos obligatorios por muestra** (los que no apliquen en un momento dado se registran como ausentes, no se inventan):
   - `window.scrollY`
   - `window.innerHeight`
   - `window.visualViewport?.height`
   - `window.visualViewport?.offsetTop`
   - `document.documentElement.scrollHeight`
   - `rect.top` del nodo seleccionado
   - `rect.top` del `detailPanel`
   - `scrollTop` de `.graphRegion`
   - `document.activeElement` (tag + clase, en forma legible y corta)
9. **Prohibido alterar el comportamiento.** Está explícitamente prohibido añadir: `preventDefault`, `blur()`, `scrollTo`, `scrollIntoView`, guardar/restaurar scroll, cambios de CSS correctivos, cambios al modo foco, o cualquier modificación de la lógica de selección/arrastre existente. La instrumentación **solo lee**. Leer `getBoundingClientRect()`/`scrollY` fuerza cálculo de layout, lo cual es aceptable y no cambia comportamiento observable.
10. **Sin dependencias nuevas.**
11. **Sin cambios en `packages/**`, en `apps/web/lib/curriculum-graph.ts`, ni en la Vista Plan.**
12. **La corrección del panel desktop de TASK-006.4.1 se conserva intacta.** Este diagnóstico es exclusivamente sobre el movimiento vertical en `≤72rem`.
13. **Footprint mínimo y trivialmente reversible**: toda la lógica y el overlay viven en **un archivo nuevo**; los cambios en `graph-view.tsx` se limitan a lo imprescindible (import, una llamada en el `onSelect` de la tarjeta, y el render del overlay) y deben ir marcados con un comentario `// PROBE` en cada línea o bloque añadido, para poder localizarlos y retirarlos sin ambigüedad.

## Alcance permitido

```
apps/web/lib/selection-scroll-probe.tsx   (nuevo — captura de muestras + overlay visual)
apps/web/app/graph-view.tsx               (mínimo imprescindible, cada línea marcada con // PROBE)
```

El nombre y la ubicación exacta del archivo nuevo pueden variar dentro de `apps/web/lib/**` si encaja mejor con la convención existente, pero debe ser **un único** módulo.

Ningún otro archivo debe modificarse. En particular: nada bajo `packages/**`, `apps/web/app/graph-view.module.css` (esta tarea **no** toca CSS del grafo), `apps/web/app/curriculum-view.*`, `apps/web/app/layout.*`, `apps/admin/**`, `tools/agent/**`, ni ningún `package.json`.

## Fuera de alcance

- **Cualquier fix** para el problema de scroll — de las dos sospechas o de cualquier otra causa (decisión 9).
- `preventDefault`, `blur()`, `scrollTo`, `scrollIntoView`, guardar/restaurar scroll.
- Cambios de CSS correctivos de cualquier tipo.
- Cambios al modo foco, a la selección, al arrastre, al panel de detalle, o a `preventScroll`.
- Revertir o modificar la corrección del panel desktop de TASK-006.4.1.
- `packages/**`, `curriculum-graph.ts`, Vista Plan, dataset, progreso EXP.
- El hydration mismatch de `docs/KNOWN_ISSUES.md`.
- Dependencias nuevas.

## Criterios de aceptación

1. Existe un único módulo nuevo que contiene toda la captura de muestras y el overlay.
2. La instrumentación se ejecuta **solo** cuando `process.env.NODE_ENV !== "production"` **y** el viewport cumple `(max-width: 72rem)`.
3. Se capturan los ocho momentos de la decisión 7, identificados de forma legible en el overlay.
4. Cada muestra registra los campos de la decisión 8 (o los marca como ausentes cuando no apliquen).
5. El overlay es `pointer-events: none` y no contiene ningún elemento interactivo (sin botón de copiar).
6. Una nueva selección reemplaza la tanda anterior; no hay registro continuo ni spam.
7. El overlay permite distinguir las dos sospechas: es posible leer en qué momento aparece el primer delta de `window.scrollY`, si `activeElement` pasa a ser el botón interno de la tarjeta, y si `scrollHeight` cambia entre `t0` y `rAF2`.
8. No se añade ningún `preventDefault`, `blur()`, `scrollTo`, `scrollIntoView`, ni manipulación de scroll (decisión 9).
9. No se modifica ningún CSS del grafo, ni la lógica de selección, foco, arrastre o panel.
10. Los cambios en `graph-view.tsx` están marcados con `// PROBE` y son mínimos.
11. Cero dependencias nuevas; cero cambios en `packages/**`, `curriculum-graph.ts` y Vista Plan.
12. Los 72 tests existentes siguen pasando sin modificarlos.
13. Ningún archivo fuera de "Alcance permitido" queda modificado.
14. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pasan sin errores.

## Comandos de validación

```
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Condición exacta de terminación

La tarea termina cuando los criterios de aceptación se cumplen y la secuencia de validación se ejecuta sin errores. Codex entrega el resumen indicado en `AGENTS.md` y se detiene, **sin proponer ni aplicar ningún fix** para el problema de scroll y sin iniciar ninguna tarea posterior.
