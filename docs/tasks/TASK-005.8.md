# TASK-005.8 — Explicación legible de por qué una materia está bloqueada

## Objetivo

Cuando una materia está `BLOCKED`, mostrar **por qué** en lenguaje claro — qué falta exactamente ("Te falta aprobar Álgebra Lineal", "22/34 créditos en Fundamentación, te faltan 12") — en vez de solo la insignia de estado. Se usa en el panel de detalle de la Vista Explorar (TASK-005.7) y en la tarjeta de materia de la Vista Plan.

**Hallazgo verificado antes de escribir esta tarea**: el motor ya expone todo lo necesario. `deriveVersionCourseState` devuelve `eligibility.requirementEvaluation` cuando el estado es `BLOCKED`; `collectBlockingEvaluations()` (en `packages/curriculum-engine/src/evaluation.ts`) ya recorre ese árbol y devuelve exactamente los nodos incumplidos, respetando la semántica de `ANY`/`AT_LEAST` (no baja hasta las hojas de un nodo que solo necesitaba una alternativa cualquiera); y `CreditRequirementEvaluation`/`GroupingCoursesRequirementEvaluation` ya traen `required`/`actual`. **Esta tarea es traducción de datos a texto en `apps/web`, sin ninguna extensión del motor.**

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

`docs/AGENT_REVIEW_POLICY.md`: "UI interactiva o compleja" → `claude-review` + `codex-qa`. No aplica la fila de `curriculum-engine`: no se toca ningún paquete de dominio.

## Contexto mínimo

- `packages/curriculum-engine/src/evaluation.ts` — `collectBlockingEvaluations(evaluation: RequirementEvaluationNode): readonly RequirementEvaluationNode[]`. No se modifica.
- `packages/curriculum-engine/src/types.ts` — formas exactas: `CourseRequirementEvaluation` (`type: "COURSE_COMPLETED" | "COURSE_COMPLETED_OR_CONCURRENT"`, `versionCourseId`), `CreditRequirementEvaluation` (`type: "MIN_TOTAL_CREDITS" | "MIN_COMPONENT_CREDITS" | "MIN_GROUPING_CREDITS"`, `required`, `actual`, `componentId?`, `groupingId?`), `GroupingCoursesRequirementEvaluation` (`type: "MIN_GROUPING_COURSES"`, `groupingId`, `required`, `actual`), `CompositeRequirementEvaluation` (`type: "ALL" | "ANY" | "AT_LEAST"`, `children`). Todos con `satisfied: boolean`.
- `packages/curriculum-engine/src/index.ts` — `deriveVersionCourseState(versionCourseId, context, trajectory)`: devuelve `{ state: "BLOCKED", eligibility }` con `eligibility.requirementEvaluation` como raíz del árbol de arriba, cuando aplica.
- `apps/web/lib/curriculum-data.ts` — `courseReference(versionCourseId)`, `componentsById`, `groupingsById`. Precedente de cómo `requirementLines()` ya traduce `RequirementExpression` (la forma *declarada*, no la *evaluada*) a texto — esta tarea hace lo mismo pero sobre el árbol de **evaluación**, que además sabe cuáles ramas están realmente incumplidas.
- `apps/web/app/graph-view.tsx` — el panel de detalle de TASK-005.7, sección "Requisitos" (hoy usa `requirementLines` sobre `versionCourse.requirements`, la forma declarada — se mantiene para materias no bloqueadas; para `BLOCKED` se añade la explicación nueva).
- `apps/web/app/curriculum-view.tsx` — `CourseCard`, hoy solo muestra `requirementLines` + insignia de estado; ahí se añade la misma explicación cuando el estado es `BLOCKED`.

## Decisiones aprobadas

1. **Nuevo helper compartido `blockingReasons(evaluation: RequirementEvaluationNode): string[]`**, en `apps/web/lib/curriculum-data.ts` (o un módulo nuevo bajo `apps/web/lib/**` si se prefiere separar). Recibe la raíz de `eligibility.requirementEvaluation` y usa `collectBlockingEvaluations()` del engine para obtener los nodos incumplidos; traduce cada uno a una línea de texto:
   - `COURSE_COMPLETED` no satisfecho → `"Te falta aprobar {código} {nombre}"` (usar `courseReference`).
   - `COURSE_COMPLETED_OR_CONCURRENT` no satisfecho → `"Te falta cursar (o aprobar) {código} {nombre}"`.
   - `MIN_TOTAL_CREDITS` no satisfecho → `"{actual}/{required} créditos aprobados en el plan, te faltan {required - actual}"`.
   - `MIN_COMPONENT_CREDITS` no satisfecho → `"{actual}/{required} créditos aprobados en {nombre del componente}, te faltan {required - actual}"` (usar `componentsById`; si no se resuelve, usar el mismo texto de respaldo que ya usa `requirementLines`).
   - `MIN_GROUPING_CREDITS` no satisfecho → equivalente con `groupingsById`.
   - `MIN_GROUPING_COURSES` no satisfecho → `"{actual}/{required} materias aprobadas en {nombre de la agrupación}, te faltan {required - actual}"`.
   - Un nodo `ANY`/`AT_LEAST` no satisfecho que `collectBlockingEvaluations` devuelve **sin bajar a sus hijos** (porque cualquiera de sus alternativas basta) se traduce como una sola línea que dice que falta satisfacer alguna de sus alternativas, listándolas de forma compacta (reutilizando la traducción de cada hijo, sin recursión adicional del motor — es texto, no lógica nueva).
2. **`required - actual` nunca se muestra negativo.** Si por cualquier motivo `actual > required` en un nodo que igualmente aparece como no satisfecho (no debería ocurrir dado el contrato del motor, pero el texto debe ser defensivo), se usa `Math.max(required - actual, 0)`.
3. **Si `eligibility.requirementEvaluation` no existe** (una materia `BLOCKED` sin evaluación de requisitos — caso ya contemplado por el tipo `VersionCourseEligibilityEvaluation`), se muestra un texto genérico neutro ("No cumple los requisitos actuales del plan") en vez de fallar o mostrar una lista vacía sin explicación.
4. **Los diagnósticos (`UnresolvedReferenceDiagnostic`, etc.) no se traducen en esta tarea.** Son casos de datos inconsistentes, no de progreso del estudiante; están fuera de alcance. Si `blockingReasons` los encuentra, los ignora para el texto (no rompe, no los traduce).
5. **Se muestra únicamente cuando el estado derivado es `BLOCKED`.** Para `AVAILABLE`, `IN_PROGRESS`, `COMPLETED` no cambia nada de lo que ya se muestra.
6. **Convivencia con `requirementLines` existente**: `requirementLines` (la lista declarativa de prerrequisitos/correquisitos/umbrales) se conserva tal cual, sin quitarla ni fusionarla. La explicación nueva se añade como sección adicional ("Por qué está bloqueada" o equivalente) solo cuando se cumple la decisión 5 — no sustituye a la lista de requisitos, la complementa.
7. **Aplica en ambas vistas**: el panel de detalle de `/grafo` (TASK-005.7) y la tarjeta de `/`. Mismo helper, mismo texto, para no divergir entre vistas.
8. **Sin cambios en `packages/**`.** Si al implementar resultara que algo del motor realmente falta, **detente y repórtalo** — no lo agregues por tu cuenta; el hallazgo de esta tarea es que no debería hacer falta.
9. **Sin cambios visuales más allá de la nueva sección de texto.** Sin iconos nuevos, sin colores nuevos, sin animaciones.
10. **Sin dependencias nuevas.**

## Alcance permitido

```
apps/web/lib/curriculum-data.ts      (nuevo helper blockingReasons, o el módulo que se prefiera bajo apps/web/lib/**)
apps/web/app/graph-view.tsx          (mostrar blockingReasons en el panel de detalle cuando el estado es BLOCKED)
apps/web/app/curriculum-view.tsx     (mostrar blockingReasons en CourseCard cuando el estado es BLOCKED)
apps/web/app/*.module.css            (estilo mínimo necesario para la nueva sección de texto)
```

Ningún otro archivo debe modificarse. En particular: nada bajo `packages/**` (decisión 8), `apps/admin/**`, `tools/agent/**`, ni ningún `package.json`.

## Fuera de alcance

- Cualquier cambio en `packages/curriculum-engine` o en cualquier otro paquete de `packages/**` — si algo pareciera faltar, **detente y pregunta** (decisión 8).
- Traducir diagnósticos de datos inconsistentes (decisión 4).
- Modo foco (TASK-005.9).
- Rediseño visual de las tarjetas o del panel más allá de la sección nueva.
- Resolver o investigar el hydration mismatch de `docs/KNOWN_ISSUES.md` — **explícitamente prohibido**.

## Criterios de aceptación

- Existe un único helper compartido `blockingReasons` (o nombre equivalente) usado por ambas vistas, que consume `collectBlockingEvaluations` del engine real — sin reimplementar su recorrido ni su lógica de `ANY`/`AT_LEAST`.
- Una materia `BLOCKED` muestra, en ambas vistas, texto legible que explica qué le falta, siguiendo las traducciones de la decisión 1.
- Los umbrales de crédito y de cantidad de materias muestran el número exacto que falta (`required - actual`, nunca negativo).
- Una materia `AVAILABLE`, `IN_PROGRESS` o `COMPLETED` no muestra esta sección nueva.
- El caso sin `requirementEvaluation` muestra el texto genérico de la decisión 3, sin excepción ni lista vacía silenciosa.
- `requirementLines` sigue mostrándose igual que antes; la nueva sección es adicional, no un reemplazo.
- Cero cambios en cualquier archivo bajo `packages/**`.
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

La tarea termina cuando los criterios de aceptación se cumplen y la secuencia de validación se ejecuta sin errores, **o** cuando se reporta explícitamente que el motor necesita una extensión real (contradiciendo el hallazgo de esta tarea) — sin implementarla por su cuenta. Codex entrega el resumen indicado en `AGENTS.md` y se detiene, sin iniciar TASK-005.9 ni ninguna otra tarea.
