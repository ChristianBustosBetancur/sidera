# TASK-007.2 — Proyección y conteos sobre créditos satisfechos

## Objetivo

Retomar la especificación visual de TASK-006.6 —proyección "si apruebas lo actual", marcador en la barra y línea de conteos— **rehecha sobre la aritmética correcta** de TASK-007.0/007.1.

La implementación original de TASK-006.6 se descartó sin commitear porque se apoyaba en sumas de créditos **raw**: era doblemente incorrecta. Su diseño visual sigue siendo válido; lo que cambia es la fuente de los números.

Ámbito: **solo la tarjeta de progreso global del plan**. Componentes y agrupaciones no cambian.

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

## Estado actual (inspeccionado antes de escribir esta tarea)

- `ProgressBar` en `curriculum-view.tsx` es **compartido por los tres niveles** (plan, componente, agrupación). Renderiza `.progressText` + `.progressTrack` con dos segmentos.
- `satisfiedProgressBarArguments(progress, required)` ya devuelve `inProgressCredits = max(projectedSatisfiedCredits − satisfiedCredits, 0)`.
- `progressBarPresentation` ya produce `"+N créditos en curso"` cuando ese valor es `> 0`, y `undefined` cuando es `0`.

**Consecuencia: el punto 2 del pedido (créditos en curso que realmente aportan) ya está implementado y funcionando.** Esta tarea lo conserva sin tocarlo; añade proyección, marcador y conteos.

- `useTrajectory()` expone `states: ReadonlyMap<VersionCourseId, DerivedCourseState>`, memoizado. De ahí salen los conteos sin recalcular nada.
- El motor entrega `projectedSatisfiedCredits` por alcance, ya consciente del cupo optativo (un único `min` sobre `COMPLETED ∪ IN_PROGRESS`).

## Decisiones aprobadas

1. **Helper nuevo y separado para la proyección**, en `apps/web/lib/curriculum-data.ts`. **Prohibido** modificar `progressBarPresentation` ni `satisfiedProgressBarArguments`: los usan los tres niveles y la proyección es exclusiva del plan.

   Recibe `{ satisfiedCredits, projectedSatisfiedCredits, requiredCredits }` y devuelve `undefined` o un objeto con, al menos: créditos proyectados, porcentaje proyectado, `markerRatio`, texto y `ariaLabel`.

2. **La proyección es aritmética de presentación sobre valores del motor.** Se calcula a partir de `projectedSatisfiedCredits`, que el motor ya produce respetando cupos. **Prohibido** que la UI recalcule proyección sumando créditos, consulte requisitos, anticipe desbloqueos, evalúe graduación, reasigne `excessCredits` o invente Libre Elección.

3. **Cuando `projectedSatisfiedCredits === satisfiedCredits`, el helper devuelve `undefined`** y **no se renderiza ni la línea de proyección ni el marcador**. Nada de "+0" ni de una muesca pegada al borde del segmento completado, que sería ruido visual sin información. Con `inProgressCredits === 0`, `progressBarPresentation` ya omite además el texto de "en curso": la tarjeta degrada limpiamente a exactamente lo que muestra hoy.

4. **Jerarquía visual**: el progreso real conserva la cifra dominante (`.progressText strong`, `1.1rem`). La línea de proyección es secundaria, en tono `--muted` y tamaño menor.

5. **Textos:**
   - Real (sin cambios, ya existente): `"{satisfied} / {required} créditos · {percent}%"`
   - En curso (sin cambios, ya existente): `"+{N} créditos en curso"`
   - Proyección (nuevo): `"Proyectado si apruebas lo actual: {projected}/{required} ({projectedPercent}%)"`
   - Conteos (nuevo): `"{X} de {total} materias aprobadas · {Y} disponibles ahora"`

   La redacción de la proyección debe expresar **potencial**, nunca hecho consumado.

6. **Marcador de proyección en la barra:**
   - `markerRatio = min(projectedSatisfiedCredits / requiredCredits, 1)` — **la posición visual se capa al 100 %**.
   - El **valor textual no se capa**: si los créditos proyectados superaran el requerido, el texto muestra la cifra real.
   - Es una **muesca/marcador**, no un tercer segmento relleno contiguo al completado. Debe distinguirse por **forma y posición**, no solo por color, y no poder confundirse con progreso conseguido.
   - Se posiciona sobre la pista sin alterar el ancho de los segmentos existentes.

7. **Conteos derivados de `states`**, sin recalcular elegibilidad ni llamar al motor de nuevo:
   - aprobadas = entradas con estado `COMPLETED`
   - disponibles = entradas con estado `AVAILABLE`
   - total = tamaño del mapa `states`

   **Prohibido** escribir `60` a mano.

8. **Solo en el plan.** Ni `ComponentSection` ni `GroupingSection` muestran proyección, marcador ni conteos. Sus barras quedan idénticas. La forma natural es una **prop opcional** en `ProgressBar` que solo la tarjeta del plan proporciona.

9. **Libre Elección sin cambios**: la nota del hero (`unmodeledComponentsNote`) y la representación de "progreso no disponible" de TASK-007.1.3 quedan **exactamente como están**. Un componente sin agrupaciones aporta `0` tanto a `satisfiedCredits` como a `projectedSatisfiedCredits`, así que **no se proyectan** los 29 créditos no modelados. Prohibido intentar estimarlos.

10. **`COMPLETED` sigue siendo la única fuente del progreso real.** `IN_PROGRESS` solo afecta la proyección; no altera `satisfiedCredits`, ni el porcentaje real, ni la etapa cromática.

11. **Etapas cromáticas**: siguen derivando del porcentaje **satisfecho**, no del proyectado. Una proyección alta no puede pintar la barra de dorado.

12. **Accesibilidad**: cuando exista proyección, el `aria-label` de la pista debe describir también el estado proyectado, sin presentarlo como logrado. La línea de conteos es texto visible real.

13. **`prefers-reduced-motion`**: si el marcador tuviera cualquier transición, se anula en el bloque ya existente.

14. **Sin cambios en `packages/**`, `/grafo`, dataset, ni en la semántica de créditos satisfechos.** Sin dependencias nuevas.

## Alcance permitido

```
apps/web/lib/curriculum-data.ts        (helper de proyección + helper de conteos)
apps/web/lib/curriculum-data.test.ts   (tests de ambos helpers)
apps/web/app/curriculum-view.tsx       (prop opcional en ProgressBar; proyección y conteos solo en la tarjeta del plan)
apps/web/app/curriculum-view.module.css (marcador, línea de proyección, línea de conteos)
```

Ningún otro archivo debe modificarse. En particular: nada bajo `packages/**`, `apps/web/app/graph-view.*`, `apps/web/lib/curriculum-graph.ts`, `apps/web/lib/trajectory*`, `apps/admin/**`, `tools/agent/**`, ni ningún `package.json`.

## Fuera de alcance

- Modificar `progressBarPresentation`, `satisfiedProgressBarArguments` o `unmodeledComponentsNote`.
- Cambiar la semántica de créditos satisfechos (TASK-007.0/007.1) o el motor.
- Proyección en componentes o agrupaciones.
- Estimar, modelar o proyectar Libre Elección.
- Anticipar desbloqueos, evaluar graduación, reasignar excedentes.
- `/grafo`, bug móvil/tablet, `MIN_COMPONENT_CREDITS`, dataset, dominio, esquema.
- El hydration mismatch de `docs/KNOWN_ISSUES.md`.

## Tests

`apps/web` no tiene `jsdom` ni `@testing-library/react`, y no se añaden; no hay aserción sobre DOM renderizado. Además, los hechos de **motor** que aparecen en el pedido —una optativa en curso con el cupo lleno aporta 0; con cupo disponible aporta lo que quepa; una obligatoria en curso aporta completa— **ya están probados en TASK-007.0** y no se reprueban aquí.

Lo que esta tarea debe demostrar es que **la presentación consume correctamente esos números**:

1. `projected > satisfied` → devuelve proyección con créditos, porcentaje y texto correctos.
2. **`projected === satisfied` → devuelve `undefined`** (sin proyección ni marcador).
3. **`markerRatio` capado a 1** cuando `projected > required`, mientras el texto conserva la cifra real sin truncar.
4. **`projected >= satisfied`** se sostiene en las fixtures usadas (invariante que el motor garantiza).
5. Conteos: dado un `states` de fixture, aprobadas = `COMPLETED`, disponibles = `AVAILABLE`, total = tamaño del mapa; **el total no está escrito a mano**.
6. Conteos con mapa vacío → `0 de 0`, sin excepción.
7. **Libre Elección no afecta la proyección**: fixture con un componente sin agrupaciones → aporta `0` a satisfecho y a proyectado; el helper no lo estima.

Los 94 tests existentes deben seguir pasando sin modificarse.

Verificable por revisión de código, no por test — `claude-review` y `codex-qa` deben comprobarlo en el diff: que la proyección y los conteos **no** aparecen en `ComponentSection` ni `GroupingSection`; que la etapa cromática sigue derivando de `satisfied`; que no hay `60` escrito a mano.

## Criterios de aceptación

1. La tarjeta del plan muestra el progreso real como cifra dominante, sin cambios respecto a hoy.
2. Muestra la proyección con etiqueta explícita de potencial, en jerarquía secundaria.
3. Muestra un marcador de proyección en la barra, distinguible por forma y posición, que no puede leerse como progreso conseguido.
4. La posición del marcador se capa al 100 %; el texto proyectado no se trunca aunque supere el requerido.
5. Con `projected === satisfied` no se renderiza proyección, ni marcador, ni texto de "+0".
6. Muestra la línea de conteos derivada de `states`, sin números escritos a mano.
7. La proyección se calcula solo desde `projectedSatisfiedCredits` del motor; no evalúa requisitos, desbloqueos, graduación ni excedentes.
8. Proyección, marcador y conteos aparecen **solo** en el plan; componentes y agrupaciones quedan visualmente idénticos.
9. Las etapas cromáticas siguen derivando del porcentaje satisfecho.
10. La nota del hero y la representación de componente no modelado quedan sin cambios; Libre Elección no se proyecta.
11. `progressBarPresentation` y `satisfiedProgressBarArguments` conservan firma y comportamiento; sus tests actuales pasan sin modificarse.
12. Cero cambios en `packages/**`, `/grafo` y dataset. Cero dependencias nuevas.
13. Los 94 tests existentes siguen pasando; los helpers nuevos están cubiertos.
14. Ningún archivo fuera de "Alcance permitido" queda modificado.
15. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pasan sin errores.

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
