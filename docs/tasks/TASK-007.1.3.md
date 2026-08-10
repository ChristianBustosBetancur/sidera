# TASK-007.1.3 — Representación honesta de un componente sin materias modeladas

## Objetivo

Un componente sin agrupaciones modeladas (hoy, Libre Elección) se muestra en la Vista Plan como una frase gris al pie de su encabezado, mientras los demás componentes muestran una barra de progreso. Parece un hueco o un error, no un componente real del plan.

Esta tarea lo sustituye por una representación visual explícita de **"progreso no disponible"** — sin inventar progreso, sin porcentaje y sin que pueda leerse como 0 %.

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

## Estado actual (inspeccionado antes de escribir esta tarea)

En `apps/web/app/curriculum-view.tsx`, `ComponentSection` ya renderiza el encabezado completo para todo componente:

```
Componente
{component.name}
{component.requiredCredits} créditos requeridos
```

y a continuación bifurca:

```jsx
{componentGroupings.length > 0 ? (
  <> <ProgressBar ... /> {agrupaciones} </>
) : (
  <p className={styles.emptyGrouping}>Este componente no contiene agrupaciones de materias en el dataset.</p>
)}
```

`.emptyGrouping` es solo `color: var(--muted)`.

## Riesgo central del diseño

**Una pista de progreso vacía se lee como 0 %**, aunque no muestre ningún número. Ese es exactamente el mensaje falso a evitar: el estudiante puede tener créditos reales de Libre Elección que Sidera todavía no puede registrar.

Por eso la pista **no va vacía**: va **tramada a todo su ancho**, en tonos neutros. Es la convención de "dato no disponible" y se distingue de "cero" de un vistazo.

## Decisiones aprobadas

1. **Sustituir** la rama `else` actual (la frase de `.emptyGrouping`) por la representación nueva. **Prohibido** conservar la frase antigua junto a la tarjeta: sería decir lo mismo dos veces en el mismo bloque.
2. **Genérico, no específico de Libre Elección.** La condición sigue siendo `componentGroupings.length === 0`. **Prohibido** mencionar "Libre Elección" en el código, en las clases CSS o en los textos de esta representación: cualquier componente sin agrupaciones debe renderizarla igual.
3. **Pista tramada neutra:**
   - Ocupa el **ancho completo** de la barra, con la misma altura y radio que `.progressTrack`, para alinearse visualmente con las barras hermanas.
   - Tramado diagonal en tonos neutros/muted. Puede reutilizarse el patrón `repeating-linear-gradient` que ya existe en `.progressInProgress`, pero en gris y **sin ningún color de estado**.
   - **Sin animación**, ni de progreso ni de ningún otro tipo. Aun así, si por cualquier motivo se introdujera una transición, debe anularse en el bloque `@media (prefers-reduced-motion: reduce)` ya existente.
   - **Sin segmentos** de completado ni de en curso.
4. **Prohibido pasar por `progressBarPresentation`.** Generaría `"0 / 29 créditos · 0%"`, justo el texto que no debe aparecer.
5. **Prohibido pasar por `progressStageClass`.** Con 0 % devolvería `progressStageBlue`, es decir, una etapa EXP aplicada a un componente sin datos. **Ninguna clase `progressStage*` puede aplicarse** a esta representación.
6. **Contenido, exactamente esto y nada más:**
   - Badge compacto: **"Aún no modelado en Sidera"**
   - Explicación breve: **"Sidera todavía no tiene materias modeladas para este componente, por lo que su progreso no puede calcularse."**
   - **No repetir los créditos requeridos**: el encabezado del componente ya muestra `{requiredCredits} créditos requeridos` justo encima.
7. **Prohibido mostrar**: porcentaje, `0 / N`, `rawCredits`, `excessCredits`, etapas EXP, segmentos de completado/en curso, acciones, controles, o cualquier vía de ingreso manual de créditos.
8. **Nada interactivo.** La representación es puramente informativa: sin botones, sin enlaces, sin `onClick`, sin nada que sugiera que se puede marcar algo. El punto 6 del pedido prohíbe el ingreso manual y el diseño no debe insinuarlo.
9. **Accesibilidad**: la pista lleva un `aria-label` explícito de progreso no disponible (p. ej. *"Progreso no disponible: sin materias modeladas en Sidera"*), **no** el `aria-label` de porcentaje que usa `ProgressBar`. El badge y la explicación son texto visible real, no solo etiquetas ARIA.
10. **La nota global del hero no se toca.** `unmodeledComponentsNote` y su renderizado en `.progressCard` quedan **exactamente** como están: redacción, lógica y ubicación. Cumple una función distinta (explicar el techo del total) y ya fue validada.
11. **Sin cambios en `packages/**`** (motor, dominio, esquema, dataset), ni en `/grafo`. Sin dependencias nuevas. Sin cambios en el cálculo de créditos satisfechos ni en el resto de la Vista Plan.

## Alcance permitido

```
apps/web/app/curriculum-view.tsx        (sustituir la rama else de ComponentSection)
apps/web/app/curriculum-view.module.css (pista tramada neutra, badge, texto)
```

`apps/web/lib/curriculum-data.ts` **no debería necesitar cambios**: esto es presentación pura. Si Codex considera imprescindible un helper allí, puede añadirlo con su test, justificándolo en el resumen — pero **sin tocar** `unmodeledComponentsNote` (decisión 10).

Ningún otro archivo debe modificarse. En particular: nada bajo `packages/**`, `apps/web/app/graph-view.*`, `apps/web/lib/curriculum-graph.ts`, `apps/web/lib/trajectory*`, `apps/admin/**`, `tools/agent/**`, ni ningún `package.json`.

## Fuera de alcance

- Modificar la nota global del hero o `unmodeledComponentsNote` (decisión 10).
- Modelar materias o agrupaciones de Libre Elección; reasignar `excessCredits`; permitir ingreso manual de créditos.
- Cambios en la semántica de créditos satisfechos (TASK-007.0/007.1).
- TASK-007.2 (marcador de proyección, conteos), `/grafo`, bug móvil/tablet, `MIN_COMPONENT_CREDITS`.
- El hydration mismatch de `docs/KNOWN_ISSUES.md`.

## Tests

`apps/web` no tiene `jsdom` ni `@testing-library/react`, y no se van a añadir; no hay aserción posible sobre el DOM renderizado. Esta tarea es presentación pura y **no introduce lógica nueva testeable** si se implementa como se especifica.

Por tanto: **no se añaden tests nuevos**, y los **94 existentes deben seguir pasando sin modificarse**. Si Codex acabara introduciendo un helper puro en `apps/web/lib/`, debe acompañarlo de sus tests.

Verificable por revisión de código, no por test — `claude-review` y `codex-qa` deben comprobarlo explícitamente en el diff:
- que no se invoca `progressBarPresentation` ni `progressStageClass` en esta rama;
- que no aparece ninguna clase `progressStage*`;
- que no hay porcentaje, `0 / N`, ni elementos interactivos;
- que no se menciona "Libre Elección" en código, clases ni textos;
- que la nota del hero queda intacta.

## Criterios de aceptación

1. Un componente sin agrupaciones muestra: pista tramada neutra a ancho completo, badge "Aún no modelado en Sidera", y la explicación breve de la decisión 6.
2. La frase `"Este componente no contiene agrupaciones de materias en el dataset."` ya no aparece.
3. No se muestra porcentaje, `0 / N`, ni segmentos de completado/en curso.
4. No se invoca `progressBarPresentation` ni `progressStageClass`, y no se aplica ninguna clase `progressStage*`.
5. La pista no está vacía: el tramado la recorre completa, en tonos neutros, sin color de estado y sin animación.
6. La representación no contiene ningún elemento interactivo.
7. La pista tiene un `aria-label` explícito de progreso no disponible; badge y explicación son texto visible.
8. Los créditos requeridos no se repiten dentro de la representación.
9. Nada en el código, las clases ni los textos menciona "Libre Elección": la condición es `groupings.length === 0`.
10. La nota global del hero y `unmodeledComponentsNote` quedan sin cambios.
11. Los componentes con agrupaciones se renderizan exactamente igual que antes.
12. Cero cambios en `packages/**`, `/grafo` y dataset. Cero dependencias nuevas.
13. Los 94 tests existentes siguen pasando sin modificarse.
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
