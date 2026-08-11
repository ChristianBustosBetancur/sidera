# TASK-006.4.1 — Graph Detail Panel UX Repair

## Objetivo

Reparación acotada del panel de detalle de `/grafo` tras probar TASK-006.4 en desktop y celular real:

1. **Desktop**: el panel flotante ocupa casi todo el alto del canvas aunque su contenido use un tercio, leyéndose como una columna blanca pesada.
2. **Móvil/tablet**: al seleccionar una materia se sigue perdiendo la sensación de contexto — el sheet tapa la materia tocada y el resto del grafo visible queda casi invisible por la atenuación del modo foco.

Es una tarea **exclusivamente de CSS**, sobre un solo archivo.

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

## Diagnóstico (verificado en el código, aprobado por el humano)

### Desktop — causa certera

`apps/web/app/graph-view.module.css`, bloque `@media (min-width: 72.001rem)`:

```css
.detailPanel {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  bottom: 0.75rem;   /* ← causa */
  overflow-y: auto;
}
```

En un elemento `position: absolute`, declarar **`top` y `bottom` simultáneamente** lo estira entre ambos anclajes: la altura deja de depender del contenido y pasa a ser "alto del contenedor menos los offsets". Como `.graphWorkspace` en desktop es tan alto como `.graphRegion` (`height: min(88vh, 1200px)`), el panel siempre mide ~88vh independientemente de cuánto contenido tenga.

### Móvil — el scroll NO se está moviendo

Se descartaron una a una, con evidencia en el código, las causas de cambio de scroll:

- **`focus()`**: ya corregido con `preventScroll: true` en TASK-006.4.
- **Reflow al montar el panel**: descartado — a `≤72rem` es `position: fixed`, fuera del flujo; no altera la altura del documento.
- **`position: fixed` roto por un ancestro con `transform`**: descartado — no existe ningún `transform`/`filter`/`will-change` en `graph-view.module.css`, `globals.css` ni `layout.module.css` (solo `text-transform`, que no crea contexto de apilamiento).
- **El botón "Salir del foco" ensancha la barra y empuja el grafo**: descartado — `.graphNavigation` es `display: flex` sin `flex-wrap`, por lo que es `nowrap` y no puede saltar de línea.
- **Cambios de clase al seleccionar**: descartado — `.dimmed` es solo `opacity` y `.selected` es solo `box-shadow`; ninguno afecta el layout.
- **`scrollIntoView` / anchors**: no existen en el código.
- **Scroll anchoring del navegador**: sin cambio de altura del documento no hay nada que reanclar.

**Conclusión**: TASK-006.4 sí corrigió el salto de scroll real. Lo que queda es un problema de **percepción de contexto**, con dos causas concretas:

- **(a)** El sheet ocupa 55vh desde abajo y suele tapar justo la materia que el usuario acaba de tocar (la gente desplaza para dejar la tarjeta de interés en la mitad inferior de la pantalla), eliminando su ancla visual.
- **(b)** El modo foco atenúa todo lo no relacionado a `opacity: 0.1` (intensificado en TASK-005.9), así que el ~45vh visible sobre el sheet queda lleno de tarjetas casi invisibles — se percibe como "una gran zona sin contexto útil" aunque la posición de scroll sea exactamente la misma.

## Decisiones aprobadas

1. **Desktop (`>72rem`)**: eliminar `bottom: 0.75rem` del `.detailPanel`, conservar `top: 0.75rem` y `right: 0.75rem` tal cual, añadir `max-height: calc(100% - 1.5rem)` y conservar `overflow-y: auto`. Resultado: la altura pasa a depender del contenido, con un tope de seguridad, y el scroll interno solo actúa si el contenido realmente supera ese tope.
2. **No cambiar el ancho ni la interacción desktop.** `width: clamp(19rem, 19vw, 21rem)`, `z-index`, fondo, borde, sombra y `border-radius` se conservan sin tocar.
3. **Móvil/tablet (`≤72rem`)**: reducir el `max-height` del bottom sheet de `55vh` a **`45vh`**, dejando más grafo visible por encima.
4. **Móvil/tablet (`≤72rem`)**: subir la opacidad de `.dimmed` de `0.1` a **`0.35`**, **únicamente dentro de ese breakpoint**. Desktop conserva `0.1` sin cambios. Así el grafo circundante sigue siendo contexto legible en vez de una zona en blanco, manteniendo un contraste claro con las tarjetas no atenuadas.
5. **Sin scroll automático de ningún tipo.** Está explícitamente prohibido añadir `scrollIntoView`, desplazar la materia seleccionada a la zona visible, o cualquier manipulación de `scrollTop`/`scrollLeft` con este fin. El scroll no es el problema (ver diagnóstico) y moverlo iría en contra de lo pedido.
6. **Sin JS nuevo de ningún tipo.** Nada de guardar/restaurar la posición de scroll, nada de observers, nada de manejadores nuevos. `apps/web/app/graph-view.tsx` **no se toca** — `focus({ preventScroll: true })` ya está aplicado y sigue siendo correcto.
7. **Sin backdrop, sin bloqueo del scroll del body, sin librerías** — se mantienen las decisiones ya vigentes de TASK-006.4.
8. **Toda la interacción se conserva sin cambios**: selección por tap/click limpio, modo foco y sus tres salidas (botón, `Escape`, click en zona vacía), explicaciones de bloqueo, controles de trayectoria dentro del panel, trayectoria compartida, persistencia local, y el pan por arrastre.
9. **Sin cambios en `packages/**`, en `apps/web/lib/curriculum-graph.ts`, ni en la Vista Plan.**

## Alcance permitido

```
apps/web/app/graph-view.module.css
```

**Un único archivo.** Ningún otro debe modificarse — en particular `apps/web/app/graph-view.tsx` (decisión 6), nada bajo `packages/**` o `apps/web/lib/**`, ni `curriculum-view.*`, `apps/admin/**`, `tools/agent/**`, ni ningún `package.json`.

## Fuera de alcance

- Cualquier cambio en `apps/web/app/graph-view.tsx` (decisión 6).
- Scroll automático, `scrollIntoView`, o manipulación de scroll por JS (decisión 5).
- Backdrop, body scroll lock, librerías de bottom sheet o de gestos (decisión 7).
- Cambios al algoritmo del grafo, a los niveles derivados, o al dataset.
- `packages/curriculum-domain`, `curriculum-schema`, `curriculum-engine`, `curriculum-snapshot`.
- Vista Plan, progreso EXP, motivos visuales, árbol de habilidades, aura, 3D.
- El hydration mismatch de `docs/KNOWN_ISSUES.md`.
- Configuración de Vercel o despliegue.

## Criterios de aceptación

1. En desktop (`>72rem`), `.detailPanel` ya no declara `bottom`; declara `max-height: calc(100% - 1.5rem)` y conserva `top: 0.75rem`, `right: 0.75rem` y `overflow-y: auto`.
2. En desktop, la altura del panel depende de su contenido: con contenido corto el panel es corto, y el scroll interno solo aparece si el contenido supera el `max-height`.
3. El ancho del panel desktop y el resto de su presentación (fondo, borde, sombra, radio, `z-index`) quedan sin cambios.
4. En `≤72rem`, el bottom sheet tiene `max-height: 45vh`.
5. En `≤72rem`, `.dimmed` usa `opacity: 0.35`; fuera de ese breakpoint sigue siendo `0.1`.
6. No se añade ningún scroll automático ni manipulación de scroll por JS.
7. `apps/web/app/graph-view.tsx` queda sin modificar.
8. No hay backdrop, ni bloqueo del scroll del body, ni dependencias nuevas.
9. Selección, modo foco con sus tres salidas, blockers, trayectoria, persistencia y pan siguen funcionando exactamente igual.
10. Cero cambios en `packages/**`, en `curriculum-graph.ts`, y en la Vista Plan.
11. Los 72 tests existentes siguen pasando sin modificarlos.
12. Ningún archivo fuera de "Alcance permitido" queda modificado.
13. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pasan sin errores.

## Comandos de validación

```
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Condición exacta de terminación

La tarea termina cuando los criterios de aceptación se cumplen y la secuencia de validación se ejecuta sin errores. Codex entrega el resumen indicado en `AGENTS.md` y se detiene, sin iniciar ninguna tarea posterior.
