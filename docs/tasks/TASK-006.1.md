# TASK-006.1 — Progress EXP Bars en Vista Plan

## Objetivo

Añadir a la Vista Plan (`/`) una visualización compacta de progreso académico tipo "barra EXP" — compacta, sobria, sin dashboards ni gráficas — en tres niveles: **plan general**, **por componente**, y **por agrupación**. Reutiliza la lógica existente del engine; no duplica cálculo curricular en la UI.

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

## Reglas de progreso (no negociables)

1. Solo materias `COMPLETED` cuentan como créditos aprobados reales / afectan el porcentaje.
2. Materias `IN_PROGRESS` **no** incrementan el porcentaje de progreso aprobado.
3. `IN_PROGRESS` se muestra como progreso potencial/proyectado, **visualmente distinguible** de lo aprobado (no debe leerse como "ya aprobado").
4. Las barras visuales nunca superan el 100% de ancho.
5. Si los créditos completados superan el `requiredCredits` de un componente/agrupación, la barra se queda en 100% pero **el valor real de créditos completados se muestra sin truncar en el texto**.
6. No se implementa redistribución hacia Libre Elección en esta tarea.

## Contexto mínimo

- `packages/curriculum-engine/src/progress.ts` — `calculatePlanProgress(context, trajectory, requiredCredits): PlanProgressResult` (`completedCredits` real sin clamp, `ratio: Math.min(completedCredits/requiredCredits, 1)`, `diagnostics`). **No se modifica.**
- `apps/web/app/curriculum-view.tsx` — ya usa `calculatePlanProgress(evaluationContext, trajectory, planVersion.requiredCredits)` para el progreso general (sección `.progressCard`, con un `<progress>` nativo). Ya tiene `groupingsByComponentId` y `versionCoursesByGroupingId` a nivel de módulo, construidos desde `unalCs2024Official`.
- `apps/web/lib/curriculum-data.ts` — `evaluationContext`, `coursesById`, etc. Aquí vive el nuevo helper de agregación (ver decisiones).
- `apps/web/lib/trajectory.tsx` — `useTrajectory()` expone `trajectory: StudentTrajectory` (`completedVersionCourseIds`, `inProgressVersionCourseIds`). No se modifica.
- `vitest.config.mts` — su `include` ya cubre `apps/web/lib/**/*.test.ts` (desde TASK-005.9.1) — no hace falta tocarlo.

## Decisiones aprobadas

1. **`calculatePlanProgress` se reutiliza en los tres niveles** (plan, componente, agrupación) — nunca se reimplementa la suma de créditos completados ni el capado de `ratio`. Para componente/agrupación, se le pasa un `context` cuyo `versionCourses` está acotado al alcance correspondiente (los de esa agrupación, o la unión de los de todas las agrupaciones de ese componente) y el `requiredCredits` de ese nivel.
2. **Diagnostics de las llamadas acotadas son ruido esperado y deben ignorarse explícitamente.** Al pasar un `context.versionCourses` acotado a un componente/agrupación, `calculatePlanProgress` genera un `UnresolvedReferenceDiagnostic` por cada materia completada en la trayectoria que **no** pertenece a ese alcance (que es la mayoría — están completadas en otra agrupación, no son una referencia rota). **Esto no afecta `completedCredits` ni `ratio`, que son correctos.** Regla explícita: el campo `diagnostics` de estas llamadas acotadas **no se lee ni se muestra en ningún componente de UI** de esta tarea — se ignora por diseño. Esta reutilización de `calculatePlanProgress` fuera de su alcance original (todo el plan) se acepta **únicamente** para obtener `completedCredits` y `ratio`; no se interpreta ningún `diagnostic` derivado de ella como error real. No se cambia el engine para "limpiar" este ruido en esta tarea.
3. **Créditos en curso: helper mecánico nuevo en `apps/web/lib/curriculum-data.ts`** (p. ej. `sumInProgressCredits(versionCourses, trajectory): number`), estrictamente limitado a: identificar qué `VersionCourseId` del alcance dado están en `trajectory.inProgressVersionCourseIds`, y sumar sus `credits`. **Prohibido** que este helper evalúe requisitos, elegibilidad, blockers, graduación, o cualquier redistribución curricular — es un `filter` + `reduce` sobre números, nada más.
4. **Cálculo de alcance por componente**: derivar `versionCoursesByComponentId` (unión de `versionCoursesByGroupingId` de las agrupaciones de ese componente) a nivel de módulo en `curriculum-view.tsx`, siguiendo el mismo patrón ya usado para `groupingsByComponentId`/`versionCoursesByGroupingId`.
5. **Capado combinado de la barra (completado + en curso nunca > 100%)**:
   ```
   completedRatio = min(completedCredits / requiredCredits, 1)
   inProgressRatio = min(inProgressCredits / requiredCredits, 1 - completedRatio)
   ```
   El segmento "en curso" se recorta visualmente si el completado ya llena la barra, pero el **texto** que acompaña la barra siempre muestra el número real de créditos en curso, nunca lo oculta ni lo trunca (coherente con la regla 5 de progreso, aplicada también a en curso).
6. **Un solo componente de barra reutilizable** (p. ej. `ProgressBar`), usado en los tres niveles (plan, componente, agrupación), con estos elementos siempre visibles como texto (no solo `aria-label`): créditos completados / requeridos, porcentaje, y créditos en curso cuando existan (p. ej. "32 / 44 créditos · 73%" + "+4 créditos en curso"). El segmento "en curso" debe ser visualmente distinto del completado (no debe poder confundirse con "ya aprobado") — color/patrón distinto, no solo una diferencia sutil de tono.
7. **Componente Libre Elección (sin agrupaciones en el dataset) no muestra barra.** Se conserva el mensaje ya existente ("Este componente no contiene agrupaciones de materias en el dataset") en vez de una barra en 0/29 — mostrar 0% ahí sería engañoso, no solo incompleto, porque el dataset no modela esas materias, no porque el estudiante no tenga progreso real. **No inventar ni estimar progreso para Libre Elección de ninguna forma.**
8. **Progreso general del plan**: se actualiza la sección `.progressCard` existente para usar el mismo componente de barra, añadiendo el segmento/texto de créditos en curso que hoy no muestra (hoy solo muestra completado vía `<progress>` nativo). No se implementa proyección tipo "si apruebas todo tendrás X%" — fuera de alcance explícito.
9. **Diseño**: CSS puro, sin librerías, sin animaciones pesadas, sin gráficos circulares. Colores sobrios coherentes con la paleta existente (`--brand`, `--brand-soft`, `--muted`, etc. de `globals.css`/`curriculum-view.module.css`). Elemento(s) semánticos donde aplique; si se usa una construcción custom con `<div>`s para representar dos segmentos (completado + en curso), debe acompañarse de texto real visible (regla ya cubierta en decisión 6) y un `aria-label`/texto asociado que describa el estado completo, no solo el segmento completado.
10. **Responsive**: en móvil, las barras no deben aumentar significativamente la altura de cada sección de agrupación/componente ni producir overflow horizontal. Deben seguir siendo legibles a un ancho estrecho.
11. **Sin cambios en `packages/**`.** Si al implementar Codex encuentra que algo realmente requiere tocar el engine, debe **detenerse y reportarlo**, no hacerlo.
12. **Sin cambios en la Vista Explorar (`/grafo`)** ni en ningún archivo bajo `apps/web/app/graph-view.*` o `apps/web/lib/curriculum-graph.ts`.
13. **Sin dependencias nuevas.**

## Alcance permitido

```
apps/web/app/curriculum-view.tsx          (componente de barra, integración en plan/componente/agrupación, versionCoursesByComponentId)
apps/web/app/curriculum-view.module.css   (estilos de la barra)
apps/web/lib/curriculum-data.ts           (helper sumInProgressCredits u equivalente)
apps/web/lib/curriculum-data.test.ts      (nuevo — tests del helper; el include de vitest.config.mts ya lo cubre, no tocar ese archivo)
```

Ningún otro archivo debe modificarse. En particular: nada bajo `packages/**`, `apps/web/app/graph-view.*`, `apps/web/lib/curriculum-graph.ts`, `apps/admin/**`, `tools/agent/**`, `vitest.config.mts`, ni ningún `package.json`.

## Fuera de alcance

- "Mi Progreso" completo, proyección futura ("si apruebas todo..."), redistribución/overflow hacia Libre Elección (reglas 6 del pedido original).
- Motivos visuales flotantes, árbol de habilidades, aura, 3D.
- Cambios en la Vista Explorar (`/grafo`) o en el algoritmo del grafo.
- El hydration mismatch de `docs/KNOWN_ISSUES.md`.
- Cualquier cambio en `packages/curriculum-domain`, `curriculum-schema`, `curriculum-engine`, `curriculum-snapshot`.
- Mostrar o interpretar los `diagnostics` de las llamadas acotadas a `calculatePlanProgress` (decisión 2).
- Barra de progreso para el componente Libre Elección (decisión 7).

## Criterios de aceptación

1. Progreso del plan muestra créditos completados/requeridos, porcentaje, y créditos en curso por separado — estos últimos sin afectar el porcentaje.
2. Cada `Component` y cada `Grouping` con al menos una agrupación/materia en el dataset muestra su propia barra con los mismos criterios.
3. El componente Libre Elección (sin agrupaciones) no muestra una barra en 0% — conserva el mensaje de "sin datos" ya existente.
4. Ninguna barra supera visualmente el 100%, incluso si completado + en curso excede `requiredCredits` (fórmula de capado de la decisión 5).
5. El número real de créditos completados y en curso nunca se trunca en el texto, aunque supere `requiredCredits`.
6. Toda barra tiene el número/porcentaje como texto visible además del elemento visual.
7. El segmento "en curso" es visualmente distinguible del "completado" — no se puede confundir con aprobado.
8. Los `diagnostics` de las llamadas de `calculatePlanProgress` con alcance de componente/agrupación no se muestran en ninguna parte de la UI.
9. Responsive: sin overflow horizontal, sin aumento desproporcionado de altura por sección en móvil.
10. Cero cambios en cualquier archivo bajo `packages/**`.
11. Cero cambios en `apps/web/app/graph-view.*` o `apps/web/lib/curriculum-graph.ts`.
12. Cero dependencias nuevas en cualquier `package.json`.
13. El helper de créditos en curso está cubierto por tests de Vitest sin DOM: caso normal, caso con completado ya al 100% (segmento en curso recortado a 0 mostrando igual el número real en texto), caso de alcance vacío.
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

La tarea termina cuando los criterios de aceptación se cumplen y la secuencia de validación se ejecuta sin errores — o cuando Codex reporta explícitamente un blocker real que requeriría tocar `packages/**`, sin hacerlo por su cuenta. Codex entrega el resumen indicado en `AGENTS.md` y se detiene, sin iniciar ninguna tarea posterior.
