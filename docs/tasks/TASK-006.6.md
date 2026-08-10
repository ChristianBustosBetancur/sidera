# TASK-006.6 — Proyección y conteos en el progreso del plan

## Objetivo

Hacer que el estudiante entienda de un vistazo su avance real y su avance **potencial** en la Vista Plan (`/`), añadiendo al progreso del plan:

1. una **proyección** ("si apruebo lo que tengo en curso"), marcada visualmente como potencial y nunca como logrado;
2. una **línea de conteos** de materias aprobadas y disponibles.

Compacto, dentro de la tarjeta de progreso que ya existe en el hero. **No es un dashboard**, no es una página nueva.

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

`docs/AGENT_REVIEW_POLICY.md`: hay aritmética con casos borde y riesgo real de comunicar mal el progreso académico → `claude-review` + `codex-qa`.

## Estado actual (inspeccionado antes de escribir esta tarea)

- `apps/web/app/curriculum-view.tsx` — `ProgressBar` se usa en **tres** niveles: plan (dentro de `.progressCard` en el hero), cada `ComponentSection`, cada `GroupingSection`. Consume `progressBarPresentation` de `apps/web/lib/curriculum-data.ts`.
- `progressBarPresentation({completedCredits, requiredCredits, completedRatio, inProgressCredits})` devuelve `completedPercent`, `completedRatio`, `inProgressRatio`, `completedText`, `inProgressText`, `ariaLabel`. Está cubierta por tests y **se reutiliza en los tres niveles**.
- `calculatePlanProgress` (engine) da `completedCredits`, `requiredCredits`, `ratio`. `sumInProgressCredits` (helper UI) da los créditos en curso.
- `useTrajectory()` ya expone `states: ReadonlyMap<VersionCourseId, DerivedCourseState>` memoizado por trayectoria — de ahí salen los conteos sin recalcular nada.
- Libre Elección no muestra barra (decisión de fidelidad de TASK-006.1). No cambia.

## Decisiones aprobadas

1. **Helper nuevo y separado para la proyección.** **Prohibido** extender o cambiar la firma de `progressBarPresentation`, porque se reutiliza en plan/componente/agrupación y la proyección solo aplica al plan. El helper nuevo vive en `apps/web/lib/curriculum-data.ts` (o módulo propio bajo `apps/web/lib/**`) y recibe números ya calculados.
2. **La proyección es aritmética de presentación, no lógica curricular.** Se calcula como `completedCredits + inProgressCredits` y su ratio como `(completedCredits + inProgressCredits) / requiredCredits`. Está **prohibido** que evalúe requisitos, anticipe desbloqueos, infiera graduación, considere Libre Elección normativa, o llame a `evaluateVersionCourseEligibility`/`collectBlockingEvaluations`. Es una suma.
3. **`COMPLETED` sigue siendo la única fuente del progreso real.** `IN_PROGRESS` no altera el porcentaje aprobado en ningún nivel, ni el `completedRatio`, ni el `completedText`. Solo participa en la proyección.
4. **La proyección se muestra únicamente a nivel plan.** Ni `ComponentSection` ni `GroupingSection` la muestran. Sus barras quedan exactamente como están hoy.
5. **Representación visual: marcador/muesca sobre la pista de la barra, no un tercer segmento relleno.** Debe leerse inequívocamente como "hasta aquí llegarías", no como progreso conseguido. Está prohibido representarla como un bloque sólido contiguo al segmento completado que pueda confundirse con avance real.
6. **Capado del marcador, no del texto.** La **posición visual** del marcador se capa al 100% de la pista. El **valor textual** proyectado puede superar `requiredCredits` y el 100% si los datos reales lo hacen — no se trunca ni se oculta. Misma regla ya vigente para créditos completados.
7. **Jerarquía visual**: el porcentaje real sigue siendo la cifra dominante (tamaño/peso mayor). La proyección es secundaria y va acompañada de una etiqueta explícita de potencial (p. ej. "proyectado"), nunca redactada como hecho consumado ("tendrás", "habrás aprobado").
8. **La distinción entre proyección y completado no puede depender solo del color** — debe apoyarse también en forma/posición (el marcador) y en el texto, coherente con el criterio ya aplicado a `IN_PROGRESS` en TASK-006.1.
9. **Línea de conteos**, con este contenido: materias aprobadas sobre el total del dataset, y materias disponibles ahora. Formato de referencia: `"12 de 60 materias aprobadas · 8 disponibles ahora"`.
   - **Aprobadas**: materias del dataset cuyo estado derivado es `COMPLETED`, contadas desde el `states` ya existente.
   - **Total**: `unalCs2024Official.versionCourses.length`.
   - **Disponibles**: materias cuyo estado derivado es `AVAILABLE`, desde el mismo `states`.
   - Se derivan de `states`, **no** se recalcula elegibilidad ni se llama al engine de nuevo.
10. **Accesibilidad**: el `aria-label` de la barra debe describir el estado completo incluyendo la proyección, sin que esta se anuncie como progreso logrado. La línea de conteos es texto visible real, no solo `aria-label`.
11. **Sin dependencias nuevas. Sin cambios en `packages/**`, en el dataset, en `/grafo`, ni en el tratamiento de Libre Elección.**
12. **`prefers-reduced-motion` respetado**: si el marcador tuviera cualquier transición, se anula en el bloque ya existente de ese media query.
13. **Compacto**: se integra en la `.progressCard` existente del hero. No se crean tarjetas, secciones, páginas ni gráficos nuevos.

## Alcance permitido

```
apps/web/lib/curriculum-data.ts        (helper nuevo de proyección; NO tocar progressBarPresentation)
apps/web/lib/curriculum-data.test.ts   (tests del helper nuevo)
apps/web/app/curriculum-view.tsx       (marcador + línea de proyección + línea de conteos, solo a nivel plan)
apps/web/app/curriculum-view.module.css
```

Ningún otro archivo debe modificarse. En particular: nada bajo `packages/**`, `apps/web/app/graph-view.*`, `apps/web/lib/curriculum-graph.ts`, `apps/web/lib/trajectory*`, `apps/admin/**`, `tools/agent/**`, ni ningún `package.json`.

## Fuera de alcance

- Modificar `progressBarPresentation` (decisión 1) o el comportamiento de las barras de componente/agrupación (decisión 4).
- Cualquier lógica curricular en la proyección: requisitos, desbloqueos, graduación, Libre Elección normativa (decisión 2).
- Cambios en `packages/curriculum-domain`, `curriculum-schema`, `curriculum-engine`, `curriculum-snapshot`.
- Barra de progreso para Libre Elección (sigue sin mostrarse).
- Skill tree, motivos visuales, aura, 3D, página "Mi Progreso" independiente.
- `/grafo` y el bug móvil/tablet de selección.
- El hydration mismatch de `docs/KNOWN_ISSUES.md`.

## Criterios de aceptación

1. El progreso del plan muestra una proyección con etiqueta explícita de potencial; el porcentaje real conserva mayor jerarquía visual.
2. La proyección se calcula solo como `completedCredits + inProgressCredits`; no consulta requisitos, elegibilidad, desbloqueos ni graduación.
3. `IN_PROGRESS` no altera el porcentaje aprobado en ningún nivel (plan, componente, agrupación).
4. La posición visual del marcador se capa al 100% de la pista; el valor textual proyectado no se trunca aunque supere `requiredCredits`.
5. La proyección aparece **solo** en el progreso del plan; componente y agrupación quedan visualmente idénticos a hoy.
6. La proyección se representa como marcador/muesca, distinguible de los segmentos de completado y en curso sin depender solo del color.
7. Existe una línea de conteos con materias aprobadas / total y disponibles ahora, derivada del `states` existente sin recalcular elegibilidad.
8. `progressBarPresentation` conserva su firma y comportamiento; sus tests actuales siguen pasando sin modificarse.
9. El `aria-label` de la barra del plan describe el estado incluyendo la proyección, sin presentarla como progreso logrado.
10. Cero cambios en `packages/**`, dataset, `/grafo` y Libre Elección.
11. Cero dependencias nuevas; `prefers-reduced-motion` respetado.
12. El helper nuevo está cubierto por tests de Vitest sin DOM: proyección normal, proyección que supera `requiredCredits` (marcador capado, texto real), proyección con cero créditos en curso, y alcance sin materias.
13. Los 72 tests existentes siguen pasando sin modificarlos.
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
