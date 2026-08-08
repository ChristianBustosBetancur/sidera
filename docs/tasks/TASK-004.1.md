# TASK-004.1 — Progreso académico agregado por créditos

## Objetivo

Calcular, en `curriculum-engine`, el progreso agregado de un estudiante hacia completar una `PlanVersion`, expresado como razón de créditos completados sobre los créditos requeridos para esa versión del plan (`PlanVersion.requiredCredits`, ver `docs/tasks/TASK-004.0.md`, ya cerrada).

Esta tarea no proyecta el futuro (semestres o créditos restantes): calcula el progreso actual, un único número derivado de la trayectoria del estudiante.

## Contexto mínimo

- `docs/tasks/TASK-004.0.md` — define `PlanVersion.requiredCredits`, cerrada e implementada.
- `docs/tasks/TASK-003.md` — el engine ya existente; decisión 4 (`curriculum-engine` no depende de `PlanVersion`, solo de `PlanVersionId`) y decisión 5 (los conteos de créditos cuentan solo materias `COMPLETED`).
- `packages/curriculum-engine/src/types.ts` — `CurriculumEvaluationContext`, `StudentTrajectory`, `UnresolvedReferenceDiagnostic` existentes.
- `packages/curriculum-engine/src/evaluation.ts` y `state.ts` — patrones existentes de pureza, determinismo y diagnóstico sin excepciones, a replicar, no a modificar.
- `AGENTS.md` — reglas de alcance para Codex.
- Este documento (las decisiones de abajo son vinculantes).

## Decisiones aprobadas

Aprobadas por decisión humana. No se re-discuten ni se sustituyen por alternativas "mejores".

1. **Progreso principal por créditos**: `ratio = completedCredits / requiredCredits`.
2. **Denominador**: `requiredCredits` se recibe como **parámetro explícito de tipo `number`**, no como parte de `CurriculumEvaluationContext`. `curriculum-engine` sigue sin depender de `PlanVersion` (decisión 4 de TASK-003, no se reabre). El valor que el caller pasa corresponde a `PlanVersion.requiredCredits`, pero eso es responsabilidad de quien invoque la función, fuera de esta tarea.
3. **Numerador**: suma de `credits` de los `VersionCourse` presentes en `context.versionCourses` cuyo `id` está en `trajectory.completedVersionCourseIds`.
4. **`IN_PROGRESS` no aporta**: las materias en `trajectory.inProgressVersionCourseIds` nunca contribuyen a `completedCredits`, ni total ni parcialmente. Mismo criterio que TASK-003, decisión 5.
5. **Clamping del ratio**: `ratio` se limita a un máximo de `1`, incluso si el estudiante completó más créditos de los requeridos (electivas extra). `completedCredits` se expone también **sin limitar** (crudo) en el resultado, para no perder esa información.
6. **Referencias no resueltas**: un id en `completedVersionCourseIds` que no existe en `context.versionCourses` **no lanza**. No aporta créditos al numerador. Se reporta reutilizando el tipo `UnresolvedReferenceDiagnostic` ya existente en `types.ts` (`referenceType: "VERSION_COURSE"`), en un array `diagnostics` del resultado. Mismo patrón que TASK-003, decisión 9.
7. **Sin proyección de graduación**: sin estimación de créditos o semestres restantes. Fuera de alcance.
8. **Sin desglose por `Component` o `Grouping`**: esta tarea calcula únicamente el progreso agregado total del plan. Un desglose por componente es candidato a tarea posterior, no esta.
9. **Pureza**: función pura, determinista, sin I/O, sin `Date.now()`, sin aleatoriedad, sin dependencias externas de runtime nuevas, con orden estable de `diagnostics` (nunca dependiente del orden de iteración de un `Set`/`Map`). Mismo principio que TASK-003, decisión 13.
10. **Sin validación estructural de `requiredCredits`**: el engine asume que `requiredCredits` es un entero positivo válido (ya garantizado por `planVersionSchema`, TASK-004.0). No se duplica esa validación aquí, ni se añade guarda especial de división por cero — ese caso no es alcanzable con datos válidos según el contrato de entrada.
11. **Sin tocar `curriculum-domain` de nuevo**, salvo que durante la implementación aparezca un blocker real que lo requiera — en cuyo caso Codex se detiene y reporta en vez de modificarlo por su cuenta.

Si alguna decisión resulta insuficiente para implementar algo, **pregunta antes de asumir**.

## Alcance permitido

En `packages/curriculum-engine` únicamente:

- Nueva función pura de cálculo de progreso agregado por créditos (nombre sugerido: `calculatePlanProgress`; el nombre exacto queda a criterio de la implementación).
- Nuevo(s) tipo(s) de resultado en `types.ts` (p. ej. `PlanProgressResult`), añadidos **sin modificar** ningún tipo ya existente en ese archivo.
- Reexport de la función y los tipos nuevos desde `index.ts`.
- Pruebas Vitest para la función nueva.

Dependencia permitida: ninguna nueva. Sin dependencia de `PlanVersion` ni de ningún otro paquete.

## Fuera de alcance

- Modificar `evaluation.ts` o `state.ts`.
- Modificar cualquier tipo ya existente en `types.ts` (`CurriculumEvaluationContext`, `StudentTrajectory`, `UnresolvedReferenceDiagnostic`, etc.) — solo se permite **añadir** tipos nuevos.
- Modificar `curriculum-domain`, `curriculum-schema`, `curriculum-validator`, `curriculum-snapshot`, `curriculum-importer`, `database`.
- `apps/web`, `apps/admin`, cualquier interfaz.
- Proyección de graduación, estimación de semestres o periodos restantes.
- Desglose de progreso por `Component` o `Grouping`.
- Validar que `requiredCredits` sea alcanzable con los créditos ofrecidos por el plan (`curriculum-validator`).
- Refactors o renombrados no solicitados en archivos existentes.
- TASK-004.2 o cualquier tarea posterior.

## Archivos permitidos

```
packages/curriculum-engine/src/progress.ts        (nuevo — implementación)
packages/curriculum-engine/src/progress.test.ts   (nuevo — pruebas)
packages/curriculum-engine/src/types.ts           (solo añadir tipos nuevos; sin tocar los existentes)
packages/curriculum-engine/src/index.ts           (solo añadir exports nuevos)
```

Ningún otro archivo debe modificarse.

## Contrato de entrada/salida esperado

Forma conceptual, no literal — los nombres exactos quedan a criterio de la implementación siempre que respeten las decisiones de arriba.

**Entrada**

- `context: CurriculumEvaluationContext` (ya existente, sin cambios).
- `trajectory: StudentTrajectory` (ya existente, sin cambios).
- `requiredCredits: number` (nuevo parámetro explícito; corresponde a `PlanVersion.requiredCredits`, entero positivo asumido válido).

**Salida**

```ts
type PlanProgressResult = {
  completedCredits: number; // suma cruda de créditos COMPLETED, sin limitar
  requiredCredits: number;  // eco del parámetro de entrada
  ratio: number;             // completedCredits / requiredCredits, limitado a máximo 1
  diagnostics: readonly UnresolvedReferenceDiagnostic[]; // ids completados no encontrados en el contexto
};
```

## Criterios de aceptación

- La función es pura, determinista, sin I/O, sin dependencias externas de runtime nuevas.
- `ratio` nunca supera `1`, incluso si `completedCredits > requiredCredits`.
- `completedCredits` no está limitado — refleja la suma real, incluso si supera `requiredCredits`.
- Los cursos `IN_PROGRESS` nunca contribuyen a `completedCredits`.
- `completedVersionCourseIds` vacío produce `completedCredits = 0` y `ratio = 0`, sin diagnósticos.
- Un id en `completedVersionCourseIds` ausente de `context.versionCourses` no lanza, no aporta créditos, y genera un diagnóstico `UNRESOLVED_REFERENCE` con `referenceType: "VERSION_COURSE"`.
- Dos llamadas con la misma entrada devuelven resultados idénticos, incluido el orden de `diagnostics`.
- No se modificó `evaluation.ts`, `state.ts`, ni ningún tipo ya existente en `types.ts`.
- No se modificó `curriculum-domain`, `curriculum-schema`, `curriculum-validator`, `curriculum-snapshot`, `curriculum-importer`, `database`, ni ninguna app.
- La secuencia de validación se ejecuta sin errores.

## Casos de prueba requeridos

Como mínimo:

1. Sin materias completadas (`completedVersionCourseIds` vacío) → `completedCredits = 0`, `ratio = 0`, sin diagnósticos.
2. Progreso parcial (p. ej. 30 de 120 créditos requeridos) → `ratio = 0.25` exacto.
3. Progreso exacto al 100% (`completedCredits === requiredCredits`) → `ratio = 1`.
4. Progreso que excede `requiredCredits` (electivas extra completadas) → `completedCredits` crudo mayor que `requiredCredits`, pero `ratio` limitado exactamente a `1`.
5. Materias `IN_PROGRESS` presentes en la trayectoria no contribuyen a `completedCredits` (comparación explícita con y sin esas materias en `inProgressVersionCourseIds`).
6. Un id en `completedVersionCourseIds` no presente en `context.versionCourses` → no lanza, diagnóstico `UNRESOLVED_REFERENCE`, no aporta créditos; el resto de materias completadas sí se suman con normalidad.
7. Múltiples ids no resueltos → múltiples diagnósticos, en orden estable.
8. Determinismo: dos ejecuciones sobre la misma entrada devuelven estructuras idénticas.

Todos los datos de prueba deben ser ficticios y mínimos.

## Comandos de validación

```
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Condición exacta de terminación

La tarea termina cuando los criterios de aceptación se cumplen, los casos de prueba requeridos existen y pasan, y la secuencia de validación se ejecuta sin errores. Codex entrega el resumen indicado en `AGENTS.md` y se detiene, sin iniciar TASK-004.2 ni ninguna otra tarea.
