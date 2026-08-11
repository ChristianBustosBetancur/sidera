# TASK-006.4.3 — Restringir el bottom sheet a dispositivos táctiles

## Objetivo

Reparación mínima de una regresión introducida por TASK-006.4. El bottom sheet móvil/tablet se activa hoy por **ancho de viewport únicamente** (`@media (max-width: 72rem)`), pero la caja de scroll de altura fija del canvas se activa por **tipo de puntero** (`@media (hover: hover) and (pointer: fine)`). Las dos condiciones no son complementarias, así que una ventana de PC con ratón más estrecha que 1152 px CSS recibe **ambas** composiciones a la vez.

Esta tarea corrige exclusivamente esa condición. No cambia escalas, ni la composición táctil, ni desktop.

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

## Diagnóstico (verificado en el código antes de escribir esta tarea)

En `apps/web/app/graph-view.module.css` conviven dos reglas con condiciones de activación distintas:

- Línea 164 — `@media (hover: hover) and (pointer: fine)` da a `.graphRegion` una caja de scroll de altura fija: `height: min(88vh, 1200px)`, `min-height: 36rem`, `overflow: auto`. **No depende del ancho.**
- Línea 477 — `@media (max-width: 72rem)` convierte `.detailPanel` en bottom sheet `position: fixed` de 45vh. **No depende del puntero.**

TASK-006.4 asumió que `≤72rem` equivale a táctil. No lo es: 72rem = 1152 px CSS, y con escalado de Windows al 125 % un portátil de 1366 px físicos reporta 1092 px CSS. En esa banda el usuario recibe simultáneamente la caja de scroll de 88vh y un sheet fijo que tapa 45vh del viewport, dejando el grafo en una franja de ~43vh. Es la causa de que el grafo vuelva a sentirse "encerrado" pese a que el CSS de escritorio es idéntico, byte a byte, al aprobado en TASK-006.0.2.

Se comparó `graph-view.module.css` entre `17f79e2` (TASK-006.0.2) y `5d477f0`: por encima de 72rem no hay ninguna diferencia. **No hay regresión de True Open Canvas en desktop**; hay una condición de activación mal elegida en la capa móvil.

## Decisiones aprobadas

1. **La condición del bottom sheet pasa a ser el complemento lógico exacto de la regla de la línea 164.** El complemento de `(hover: hover) and (pointer: fine)` es `(hover: none) or (pointer: coarse)`. La media query queda:

   ```css
   @media (max-width: 72rem) and ((hover: none) or (pointer: coarse))
   ```

   Se eligió el complemento exacto sobre un `and (hover: none)` simple porque este último deja dos combinaciones descoordinadas (un dispositivo `hover:hover` + `pointer:coarse` no recibiría ni la caja de scroll ni el sheet; un dispositivo `hover:none` + `pointer:fine` recibiría el sheet sin la caja). Con el complemento exacto se restablece el invariante **caja de scroll de altura fija ⟺ composición desktop**, que es precisamente el que se rompió.

2. **Agrupación de Media Queries Level 4.** Los paréntesis anidados requieren Chrome 88+, Safari 14+, Firefox 74+. Si un navegador no soportara la agrupación, descarta el bloque entero y `.detailPanel` cae a su declaración base (bloque apilado bajo el canvas, con scroll de página) — el comportamiento anterior a TASK-006.4, degradación aceptable y no rota.

3. **Cambio de una sola media query.** El contenido del bloque (`.dimmed { opacity: 0.35 }`, `.detailPanel` fijo con `max-height: 45vh`, `min-height: 2.75rem` de los botones) no se toca en absoluto.

4. **No se toca la compactación de `≤47rem`.** El hueco de escala de la banda 47–72rem (columnas de 17rem + gap de 4.5rem en tablet) es un problema real y distinto, identificado en el diagnóstico, pero queda **fuera** de esta tarea por decisión humana explícita.

5. **No se toca `scrollbar-gutter`, `scrollbar-width` ni `min-height` de `.graphRegion`.** El borde visible que dibuja la barra de scroll en Chrome/Windows es un tema separado, aplazado por decisión humana explícita.

6. **No se toca `graph-view.tsx`.** Ningún manejador de eventos, ni `preventScroll`, ni `measureEdges`, ni el modo foco, ni la selección, ni el arrastre.

7. **El comportamiento táctil no cambia.** En un dispositivo táctil real (`hover: none` + `pointer: coarse`) la condición nueva evalúa exactamente igual que la anterior por debajo de 72rem: el sheet se conserva idéntico.

8. **Sin dependencias nuevas. Sin cambios en `packages/**`, en `apps/web/lib/curriculum-graph.ts`, ni en la Vista Plan.**

9. **Nada de la fase siguiente** (motivos visuales, barras EXP, "Mi Progreso", árbol de habilidades, 3D, hydration mismatch), igual que el resto de la serie 006.

## Alcance permitido

```
apps/web/app/graph-view.module.css    (una única media query, línea 477)
docs/tasks/TASK-006.4.3.md            (este documento)
```

Ningún otro archivo debe modificarse. En particular: nada bajo `packages/**`, `apps/web/lib/**`, `apps/web/app/graph-view.tsx`, `apps/web/app/curriculum-view.*`, `apps/web/app/layout.*`, `apps/web/app/globals.css`, `apps/admin/**`, `tools/agent/**`, ni ningún `package.json`.

## Fuera de alcance

- La compactación de columnas de la banda 47–72rem (decisión 4).
- `scrollbar-gutter`, `scrollbar-width`, `min-height`/`height` de `.graphRegion` (decisión 5).
- Cualquier cambio en `graph-view.tsx` (decisión 6).
- El salto de scroll al seleccionar materia en móvil/tablet — pendiente, tarea aparte.
- Revertir o modificar el overlay desktop de TASK-006.0.1 / TASK-006.4.1.
- `packages/**`, `curriculum-graph.ts`, Vista Plan, dataset, progreso EXP.
- El hydration mismatch de `docs/KNOWN_ISSUES.md`.
- Dependencias nuevas.

## Interacciones que deben seguir funcionando exactamente igual (verificación obligatoria)

- Desktop (>72rem): panel overlay `position: absolute` dentro de `.graphWorkspace`, sin cambios.
- Táctil ≤72rem: bottom sheet fijo de 45vh, `.dimmed` a 0.35, tap targets de 2.75rem — idénticos.
- PC con ratón y ventana ≤72rem: ya **no** recibe el sheet fijo; el panel vuelve a su declaración base apilada, y el canvas conserva su caja de scroll de 88vh sin nada que la tape.
- Click limpio, arrastre, modo foco y sus tres salidas (botón, `Escape`, click en zona vacía): intactos.
- Trayectoria compartida Plan ↔ Explorar, persistencia local, estados derivados.

## Criterios de aceptación

1. La media query de la línea 477 es exactamente `@media (max-width: 72rem) and ((hover: none) or (pointer: coarse))`.
2. El contenido de ese bloque es idéntico al anterior, declaración por declaración.
3. Ninguna otra regla de `graph-view.module.css` cambia — el diff del archivo es de una sola línea.
4. `graph-view.tsx` no se modifica.
5. El bloque `@media (min-width: 72.001rem)` (overlay desktop) queda intacto.
6. El bloque `@media (max-width: 47rem)` queda intacto (decisión 4).
7. `.graphRegion` conserva `background: transparent`, `border-radius: 0`, `box-shadow: none` y ningún `max-width` — True Open Canvas no se revierte.
8. Cero dependencias nuevas; cero cambios en `packages/**`, `curriculum-graph.ts` y Vista Plan.
9. Los tests existentes siguen pasando sin modificarlos.
10. Ningún archivo fuera de "Alcance permitido" queda modificado.
11. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pasan sin errores.

## Comandos de validación

```
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Condición exacta de terminación

La tarea termina cuando los criterios de aceptación se cumplen y la secuencia de validación se ejecuta sin errores. Se entrega el resumen indicado en `AGENTS.md` y se detiene, sin abordar el salto de scroll móvil ni ninguna tarea posterior.
