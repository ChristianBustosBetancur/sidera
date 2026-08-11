# TASK-005.9.1 — Reparación: click sobre una materia ya no selecciona en el grafo

## Objetivo

Corregir una regresión funcional real, reportada por el humano en Chrome real después de TASK-005.6 → TASK-005.9: en `/grafo`, el pan/drag funciona y el grafo se visualiza bien, pero **el click normal sobre una tarjeta ya no selecciona la materia** — el panel de detalle no se abre/actualiza y, por tanto, tampoco se puede entrar al modo foco por click.

Esta tarea es exclusivamente una reparación acotada. No se amplía scope, no se rediseña el grafo, no se toca `curriculum-engine`/`curriculum-schema`/`curriculum-snapshot`, y no se implementa nada de la siguiente fase (Open Canvas, motivos flotantes, Progress & Insights).

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

## Diagnóstico (hallazgo ya identificado — punto de partida obligatorio, no una suposición)

Diagnosticado leyendo el código exacto introducido por TASK-005.6/005.7/005.9 en `apps/web/app/graph-view.tsx`. **No se pudo reproducir en un navegador real** (ni este agente ni Codex tienen acceso a uno en este entorno — limitación ya registrada como deuda de workflow), así que el diagnóstico se apoya en trazar la secuencia exacta de eventos contra el comportamiento documentado y bien conocido de la Pointer Events API, no en ejecución real. **Codex debe confirmar esta cadena de razonamiento contra el código antes de aplicar el fix, y el humano validará el resultado en Chrome real tras el HUMAN_GATE.**

Cadena de eventos para un click normal (sin arrastre real) sobre una tarjeta:

1. `pointerdown` ocurre sobre el `<article>` de `GraphCourseCard` (o el `<button className={styles.courseSelector}>` interior). El evento burbujea hasta `<section ref={graphRegionRef} onPointerDown={handlePointerDown}>` (línea ~349-354).
2. `handlePointerDown` (línea 215) pasa las comprobaciones de `pointerType`/`button` para un click de ratón normal, y ejecuta `event.currentTarget.setPointerCapture(event.pointerId)` (línea 233). **`event.currentTarget` aquí es la `<section>` (el elemento donde está el listener), no el `<article>`/`<button>` sobre el que realmente ocurrió el `pointerdown`.**
3. Con el pointer capturado por la `<section>`, la especificación de Pointer Events retarga a partir de ese momento **todos los eventos derivados de ese puntero — incluido el `click` sintetizado al soltar** — para que su `target` sea el elemento que tiene la captura (la `<section>`), no el elemento real bajo el cursor. Esto es un comportamiento documentado de `setPointerCapture`, no un bug del navegador, y es una causa frecuente y conocida de que "click deje de funcionar" en implementaciones de drag basadas en Pointer Events cuando la captura se toma sobre un contenedor en vez del elemento de origen del gesto.
4. Como consecuencia, en el `pointerup`/click resultante, el evento **ya no atraviesa el `<article>` ni el `<button>` interior** (no están en la ruta de propagación del evento retargeteado), así que **`onClick={onSelect}` del `<article>` (línea 80) y el `onClick` del botón interior (línea 86-89) nunca se ejecutan.**
5. En cambio, como `<section>` es ahora el propio `target` del click, sí se ejecuta el `onClick` de la `<section>` añadido en TASK-005.9 (línea 364-372) para "salir del foco al hacer click en zona vacía": `event.target.closest("article")` no encuentra nada (porque `event.target` es la propia `<section>`, no un descendiente), así que cae en la rama `setSelectedId(null)` — **limpiando la selección en vez de establecerla**, incluso cuando el click visual del usuario fue sobre una tarjeta.

Esto explica exactamente el síntoma reportado: pan/drag funciona (usa la captura para mover el scroll, que sigue funcionando bien), el grafo se ve bien, pero el click sobre una tarjeta no selecciona — y de hecho, si había algo seleccionado, un click sobre cualquier tarjeta lo deselecciona.

**Esto no ocurría antes de TASK-005.6** porque `setPointerCapture` no existía en el código; el `onClick` del `<article>` recibía el click de forma normal.

## Corrección requerida

1. **La captura del puntero debe tomarse (y liberarse) sobre el elemento real donde comenzó el gesto (`event.target`), no sobre el contenedor ancestro (`event.currentTarget`).** Esto hace que, cuando el gesto empieza sobre una tarjeta, el click siga targeteando esa tarjeta (preservando su `onClick` nativo) — y cuando empieza sobre el fondo/canvas vacío, el click siga targeteando ese fondo (preservando el comportamiento de "click en zona vacía sale del foco" de TASK-005.9, que debe seguir funcionando).
2. **La lógica de arrastre (lectura/escritura de `scrollLeft`/`scrollTop` en `handlePointerMove`) debe seguir funcionando exactamente igual.** Esa lectura/escritura usa `event.currentTarget`, que sigue siendo la `<section>` (el elemento donde está registrado el listener) independientemente de sobre qué elemento se tomó la captura — no depende de este fix y no debe cambiar.
3. **`dragStateRef` debe guardar una referencia consistente al elemento sobre el que se tomó la captura**, para que la liberación (`releasePointerCapture`) y la comprobación (`hasPointerCapture`) en `finishDrag` se hagan sobre ese mismo elemento, no sobre un supuesto implícito que ya no es correcto tras el cambio.
4. **El umbral de arrastre (`DRAG_THRESHOLD = 5`), la bandera `moved`, y `suppressNextClickRef` no cambian de semántica.** Un arrastre real (movimiento > umbral) debe seguir suprimiendo el click siguiente vía el `onClickCapture` ya existente (línea 358-363) — ese mecanismo no se toca, solo se corrige sobre qué elemento se captura el puntero.
5. **Después de terminar un arrastre real, el siguiente click limpio debe funcionar de inmediato** — sin estado colgado de una captura anterior. Verificar que `dragStateRef.current` se limpia a `null` y que no queda ninguna captura activa tras `pointerup`/`pointercancel`.
6. **La navegación táctil no cambia.** `handlePointerDown`/`handlePointerMove`/`finishDrag` ya ignoran `pointerType === "touch"` por completo (decisión ya vigente de TASK-005.6); esta reparación no debe tocar esa exclusión.
7. **Nada de lo demás cambia**: medición de aristas, niveles derivados, panel de detalle (TASK-005.7), explicaciones de bloqueo (TASK-005.8), Escape y las otras dos formas de salida del foco (TASK-005.9), trayectoria compartida (TASK-005.4), persistencia (TASK-005.5).

## Tests de interacción

**Restricción real de la estructura actual, verificada antes de escribir esta tarea**: `apps/web` no tiene hoy ninguna prueba (`vitest.config.mts` solo incluye `tests/**` y `packages/**/src/**`), no hay entorno `jsdom`/`happy-dom` configurado, y no hay `@testing-library/react` ni equivalente instalado. Añadir cualquiera de eso sería una dependencia nueva — fuera de alcance sin aprobación explícita, igual que en el resto de esta secuencia.

Por tanto, "tests de interacción razonables" en esta tarea significa:

- **Extraer la lógica pura de decisión click-vs-drag** (si el desplazamiento supera el umbral, si debe suprimirse el siguiente click dado el estado de arrastre) a funciones puras, testables sin DOM — por ejemplo en un módulo nuevo `apps/web/lib/pointer-gestures.ts` (o inline si resulta más simple, a discreción de Codex dentro del archivo de la vista, pero preferiblemente extraído para ser testable). Estas funciones no dependen de React ni de eventos reales del navegador: reciben números/booleanos y devuelven la decisión.
- **Cubrir con Vitest "de nodo"** (sin `jsdom`) esa lógica pura: umbral no superado → no se marca `moved`; umbral superado → se marca `moved`; con `moved=true` y `suppressClick=true` → debe suprimirse; con `moved=false` → no debe suprimirse.
- Para que Vitest recoja ese archivo, **extender el `include` de `vitest.config.mts` añadiendo `apps/web/lib/**/*.test.ts`** — es un cambio de configuración mecánico, no una dependencia nueva.
- **No se exige** (y no se debe intentar, dado que forzaría una dependencia nueva) una prueba de integración DOM que dispare `pointerdown`/`pointermove`/`pointerup`/`click` reales sobre los componentes React y verifique que `onSelect` se invoca. Si Codex encuentra una forma de cubrir esto sin ninguna dependencia nueva y sin tocar `vitest.config.mts` más allá del `include` de arriba, puede hacerlo; si no, se documenta como limitación en el resumen final, no se fuerza.

## Validación real (limitación de entorno conocida)

Ni este agente ni Codex tienen acceso a un navegador real en este entorno (deuda de workflow ya registrada en `docs/AGENT_REVIEW_POLICY.md`). La validación automática (`lint`/`typecheck`/`test`/`build`) y la revisión de código confirman que el fix es coherente con el diagnóstico, pero **la confirmación definitiva en Chrome real la hace el humano** después del `HUMAN_GATE`, exactamente como reportó el bug originalmente.

## Contexto mínimo

- `apps/web/app/graph-view.tsx` — todo el archivo, en particular `handlePointerDown`/`handlePointerMove`/`finishDrag` (líneas 215-269), `GraphCourseCard` (líneas 59-104, `onClick`/`onSelect`), la `<section>` del grafo con `onClickCapture`/`onClick` (líneas 349-372).
- `docs/tasks/TASK-005.6.md` — decisiones originales sobre el arrastre (scroll nativo, sin re-medición de aristas, umbral de 5px, exclusión táctil). Esta reparación no las revierte, solo corrige el elemento de captura.
- `docs/tasks/TASK-005.7.md`, `docs/tasks/TASK-005.9.md` — decisiones sobre el panel de detalle y el modo foco, que dependen de que la selección por click vuelva a funcionar.
- `vitest.config.mts` — `include` actual, a extender mínimamente (ver sección de tests).

## Alcance permitido

```
apps/web/app/graph-view.tsx           (corregir el elemento de captura del puntero; sin rediseñar nada más)
apps/web/lib/pointer-gestures.ts      (nuevo, opcional — lógica pura extraída para pruebas; solo si Codex la extrae)
apps/web/lib/pointer-gestures.test.ts (nuevo, opcional — pruebas de esa lógica pura)
vitest.config.mts                     (únicamente para extender `include` con `apps/web/lib/**/*.test.ts`, si se añade el archivo de pruebas de arriba)
```

Ningún otro archivo debe modificarse. En particular: nada bajo `packages/**` (dominio, esquema, engine, snapshot), `apps/admin/**`, `tools/agent/**`, ni ningún `package.json` (cero dependencias nuevas).

## Fuera de alcance

- Cualquier cambio en `packages/curriculum-domain`, `curriculum-schema`, `curriculum-engine`, `curriculum-snapshot`.
- Rediseño del grafo, del panel de detalle, del modo foco, de la medición de aristas o del layout por niveles.
- Cambiar el umbral de arrastre, el comportamiento táctil, o las tres formas de salida del modo foco (TASK-005.9) más allá de lo estrictamente necesario para que el click vuelva a funcionar.
- Open Canvas, motivos flotantes, Progress & Insights, o cualquier otra funcionalidad de la siguiente fase — **explícitamente prohibido en esta tarea**.
- Resolver o investigar el hydration mismatch de `docs/KNOWN_ISSUES.md`.
- Añadir `jsdom`, `happy-dom`, `@testing-library/react` o cualquier dependencia nueva de testing.
- Si al implementar Codex concluye que el diagnóstico de esta tarea es incorrecto (la causa raíz real es otra), **debe detenerse y reportarlo explícitamente** en vez de aplicar un fix distinto sin decisión humana — dado que el diagnóstico no pudo verificarse en un navegador real, esto es una posibilidad real a contemplar, no un formalismo.

## Criterios de aceptación

- Click limpio (sin movimiento por encima del umbral) sobre una tarjeta del grafo selecciona esa materia: abre/actualiza el panel de detalle y activa el resaltado de foco correspondiente — verificable leyendo el código de que la ruta de eventos del click ya no queda interceptada por la captura del puntero.
- Un arrastre real (movimiento por encima del umbral) sigue moviendo el grafo (scroll) y **no** selecciona accidentalmente la tarjeta sobre la que empezó el gesto.
- Tras terminar un arrastre real, el siguiente click limpio selecciona con normalidad de inmediato (sin estado de captura colgado).
- El click en zona vacía del grafo (fuera de cualquier tarjeta) sigue limpiando la selección/saliendo del foco (comportamiento de TASK-005.9 preservado).
- Escape, el botón "Salir del foco", el panel de detalle, la trayectoria compartida y la persistencia siguen funcionando exactamente igual que antes de esta reparación.
- La navegación táctil (scroll vertical de página, sin captura de gestos) no cambia.
- La lógica pura de decisión click-vs-drag, si se extrae, queda cubierta por pruebas de Vitest sin DOM ni dependencias nuevas.
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

La tarea termina cuando los criterios de aceptación se cumplen y la secuencia de validación se ejecuta sin errores — o cuando Codex reporta explícitamente que el diagnóstico de esta tarea no coincide con lo que encuentra en el código, sin aplicar un fix alternativo por su cuenta. Codex entrega el resumen indicado en `AGENTS.md`, incluyendo una descripción explícita y verificable del cambio exacto que corrige la causa raíz, y se detiene, sin iniciar ninguna tarea posterior.
