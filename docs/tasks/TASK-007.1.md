# TASK-007.1 — Consumir créditos satisfechos en Vista Plan

## Objetivo

Migrar el progreso académico de la Vista Plan (`/`) de créditos **raw** a créditos **satisfechos**, usando la API que TASK-007.0 añadió a `curriculum-engine`.

Hoy los tres niveles llaman a `calculatePlanProgress` con contextos acotados, que suma créditos completados sin respetar los cupos obligatorio/optativo del Acuerdo 0018. Consecuencia real: Matemáticas con 36 créditos obligatorios y 8 optativos se muestra como **44/44 · 100 %** —con acabado dorado de "rama dominada"— cuando curricularmente son **40/44**.

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

## Estado actual (inspeccionado antes de escribir esta tarea)

- `apps/web/app/curriculum-view.tsx` llama a `calculatePlanProgress` **tres veces** con contextos acotados: una en `CurriculumView` (plan), una en `ComponentSection`, una en `GroupingSection`. Cada llamada re-suma cursos crudos desde cero — el origen del sobreconteo.
- `sumInProgressCredits` (helper de UI) suma créditos en curso en bruto, sin cupo.
- `progressBarPresentation({completedCredits, requiredCredits, completedRatio, inProgressCredits})` produce textos, ratios y `ariaLabel`. **Su firma sirve tal cual** para valores satisfechos; no necesita cambiar.
- `progressStageClass(completedPercent)` vive dentro de `curriculum-view.tsx`, no está exportada y hoy no es testeable.
- Libre Elección no muestra barra (no tiene agrupaciones); conserva el mensaje "Este componente no contiene agrupaciones de materias en el dataset".

## API disponible (TASK-007.0, ya en `main` de la rama)

```ts
calculateSatisfiedPlanProgress(context, trajectory, requiredCredits): SatisfiedPlanProgressResult
```

Devuelve **el árbol completo en una sola llamada**:

```ts
SatisfiedPlanProgressResult = CreditProgress & {
  planVersionId; requiredCredits;
  components: readonly ComponentCreditProgress[];   // cada uno con .groupings[]
  diagnostics: readonly SatisfiedCreditProgressDiagnostic[];
}
CreditProgress = { rawCredits; satisfiedCredits; excessCredits; projectedSatisfiedCredits }
```

## Decisiones aprobadas

1. **Una sola llamada al motor**, en `CurriculumView`, memoizada por `trajectory`. Los resultados se distribuyen hacia `ComponentSection` y `GroupingSection` por props, buscando por `componentId` / `groupingId`. **Prohibido** seguir llamando a `calculatePlanProgress` (ni a la API nueva) por componente o por agrupación: la propagación correcta ya la hace el motor, y volver a calcular por nivel reintroduce el bug.
2. **Numerador y porcentaje = `satisfiedCredits`** en los tres niveles. El porcentaje es `satisfiedCredits / requiredCredits`. Nunca se muestran numeradores mayores que el requerido (p. ej. `56/44`), porque a nivel agrupación `satisfied ≤ requiredCredits` está garantizado por construcción.
3. **Componentes y plan usan la agregación del motor**, no una suma propia. El exceso de una agrupación no puede inflar su componente ni el plan.
4. **`IN_PROGRESS` usa la proyección del motor.** El valor a mostrar como "en curso" es la contribución marginal, ya consciente del cupo:
   ```
   enCursoSatisfecho = projectedSatisfiedCredits − satisfiedCredits
   ```
   **Prohibido** usar `sumInProgressCredits` (suma bruta) para alimentar las barras: consumiría cupo ya consumido y volvería a sobrecontar. Esta es la única forma correcta sin rehacer TASK-006.6, que sigue fuera de alcance.

   Consecuencia esperada y aceptada: si el cupo optativo de una agrupación ya está lleno, una optativa en curso mostrará `+0` en esa agrupación. Es correcto — no aporta al requisito.
5. **`progressBarPresentation` no cambia de firma.** Se le pasan valores satisfechos: `completedCredits = satisfiedCredits`, `completedRatio = satisfiedCredits / requiredCredits`, `inProgressCredits = enCursoSatisfecho`. Sus tests actuales siguen pasando sin modificarse.
6. **Las etapas cromáticas se basan en el porcentaje satisfecho.** `progressStageClass` recibe el porcentaje derivado de `satisfiedCredits`. **Una agrupación con obligatorias pendientes no puede alcanzar la etapa `progressStageMastered`**, porque su `satisfied` no llega a `requiredCredits`.
7. **Nota de Libre Elección**, compacta, cerca del progreso global del plan. Texto de referencia:
   > "29 créditos de Libre Elección aún no están modelados en Sidera."

   **El número se deriva**, no se escribe a mano: suma de `requiredCredits` de los componentes sin agrupaciones modeladas. Hardcodearlo repetiría el hallazgo de fidelidad que `codex-data-audit` marcó en TASK-005.3.

   **Redacción**: debe leerse como **limitación del modelado de Sidera**, no como déficit del estudiante. Prohibido redactarlo como "te faltan 29 créditos" o equivalente.
8. **No se muestran `rawCredits` ni `excessCredits` al usuario.** Quedan disponibles en el motor para tareas futuras. No aparecen en ningún texto, badge ni `aria-label` de esta tarea.
9. **Los `diagnostics` del resultado no se muestran en la UI.** Con el dataset oficial vienen vacíos (verificado en TASK-007.0). No se renderizan ni se convierten en avisos en esta tarea.
10. **`sumInProgressCredits`**: si tras la migración queda sin uso, se elimina junto con sus tests, y el resumen debe indicarlo. Si sigue teniendo algún uso legítimo, se conserva. No se deja código muerto sin reportarlo.
11. **Sin cambios visuales más allá de lo que la corrección exige**: mismas barras, mismos segmentos, misma jerarquía, más la nota del punto 7. **TASK-006.6 (marcador de proyección, línea de conteos) sigue fuera de alcance.**
12. **Sin cambios en `packages/**`.** Si algo pareciera faltar en el motor, **detente y reporta**. Sin dependencias nuevas.

## Alcance permitido

```
apps/web/app/curriculum-view.tsx        (llamada única al motor, distribución por props, nota de Libre Elección)
apps/web/app/curriculum-view.module.css (estilo mínimo de la nota)
apps/web/lib/curriculum-data.ts         (helpers puros nuevos; posible retirada de sumInProgressCredits)
apps/web/lib/curriculum-data.test.ts    (tests de los helpers puros)
```

Ningún otro archivo debe modificarse. En particular: nada bajo `packages/**`, `apps/web/app/graph-view.*`, `apps/web/lib/curriculum-graph.ts`, `apps/web/lib/trajectory*`, `apps/admin/**`, `tools/agent/**`, ni ningún `package.json`.

## Fuera de alcance

- `/grafo` y el bug móvil/tablet de selección.
- `MIN_COMPONENT_CREDITS` / `evaluateMinimumComponentCredits` y el resto de `evaluation.ts`.
- Libre Elección normativa: no se modelan materias, no se infiere progreso, no se reasignan excedentes.
- Dataset, `curriculum-domain`, `curriculum-schema`, `curriculum-snapshot`.
- TASK-006.6: marcador de proyección, línea de conteos aprobadas/disponibles.
- Mostrar `raw`/`excess`/diagnósticos al usuario.
- El hydration mismatch de `docs/KNOWN_ISSUES.md`.

## Tests

**Limitación real de la estructura actual** (misma que TASK-005.9.1 y TASK-006.4): `apps/web` no tiene `jsdom` ni `@testing-library/react`, y no se van a añadir. No es posible aserción sobre el DOM renderizado.

Además, los hechos curriculares que listaste —Matemáticas 40/44, exceso que no infla Fundamentación, Sistemas de Cómputo topado en 6, Computación Aplicada topada en 7— **ya están probados a nivel motor en TASK-007.0** (87 tests). Reprobarlos aquí sería redundante. Lo que esta tarea debe demostrar es que **la UI consume `satisfied` y no `raw`**.

Por tanto:

- **Extraer a `apps/web/lib/` las funciones puras de presentación** que hoy no son testeables, en particular la que deriva la clase de etapa a partir del porcentaje, y la que traduce un `CreditProgress` del motor a los argumentos de `progressBarPresentation`.
- **Cubrir con Vitest sin DOM**:
  1. Fixture tipo Matemáticas (`satisfied=40`, `required=44`, `raw=44`) → numerador **40**, porcentaje **91 %**, y etapa **distinta** de `progressStageMastered`.
  2. Fixture con `satisfied === requiredCredits` → etapa `progressStageMastered`.
  3. `enCursoSatisfecho = projected − satisfied`, incluyendo el caso de cupo lleno → `0`.
  4. La derivación del número de la nota de Libre Elección: componentes sin agrupaciones → suma de sus `requiredCredits`; con el dataset oficial, **29**.
  5. Ningún helper de presentación expone `rawCredits` ni `excessCredits`.
- **Verificable por revisión de código, no por test**: la presencia y redacción de la nota, y que no queden llamadas a `calculatePlanProgress` por nivel. `claude-review` y `codex-qa` deben comprobarlo explícitamente en el diff.

Los tests existentes deben seguir pasando; si se retira `sumInProgressCredits` (decisión 10), sus tests se retiran con él y el resumen lo indica.

## Criterios de aceptación

1. `CurriculumView` hace **una sola** llamada a `calculateSatisfiedPlanProgress`, memoizada por `trajectory`, y distribuye los resultados por props.
2. No queda ninguna llamada a `calculatePlanProgress` (ni a la API nueva) dentro de `ComponentSection` ni `GroupingSection`.
3. Agrupaciones, componentes y plan muestran `satisfiedCredits` como numerador y `satisfied / required` como porcentaje.
4. Ninguna barra puede mostrar un numerador mayor que su `requiredCredits`.
5. El exceso de una agrupación no incrementa su componente ni el plan.
6. El segmento y el texto de "en curso" usan `projectedSatisfiedCredits − satisfiedCredits`, no una suma bruta.
7. Las etapas cromáticas derivan del porcentaje satisfecho; una agrupación con obligatorias pendientes nunca alcanza `progressStageMastered`.
8. Existe una nota compacta junto al progreso del plan que comunica los créditos de Libre Elección no modelados, con el número **derivado**, redactada como limitación de Sidera y no como déficit del estudiante.
9. No se muestran `rawCredits`, `excessCredits` ni diagnósticos en la UI.
10. `progressBarPresentation` conserva firma y comportamiento; sus tests actuales pasan sin modificarse.
11. Cero cambios en `packages/**`, `/grafo` y dataset. Cero dependencias nuevas.
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

La tarea termina cuando los criterios de aceptación se cumplen y la secuencia de validación se ejecuta sin errores — o cuando Codex reporta explícitamente que necesita tocar `packages/**`, sin hacerlo por su cuenta. Codex entrega el resumen indicado en `AGENTS.md`, indicando si `sumInProgressCredits` fue retirado, y se detiene, sin iniciar ninguna tarea posterior.
