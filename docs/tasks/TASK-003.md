# TASK-003 — Primer motor de evaluación curricular

## Objetivo

Implementar en `curriculum-engine` la evaluación pura de `RequirementExpression` contra una trayectoria mínima del estudiante, dentro de una única `PlanVersion`: determinar si una materia puede cursarse y explicar, de forma estructurada, qué requisitos faltan.

## Contexto mínimo

- `docs/tasks/TASK-002.md` — modelo estructural ya cerrado (entidades, hojas y combinadores).
- `packages/curriculum-domain/src/` — tipos existentes; son la entrada del engine.
- `AGENTS.md` — reglas de alcance para Codex.
- Este documento (las decisiones semánticas de abajo son vinculantes).

## Decisiones semánticas obligatorias

Aprobadas. No se re-discuten ni se sustituyen por alternativas "mejores".

1. **`COURSE_COMPLETED_OR_CONCURRENT`**: satisfecho si la materia referenciada está `COMPLETED` **o** `IN_PROGRESS`. Sin semántica de "planeada para el mismo periodo", sin elegibilidad recursiva entre correquisitos.
2. **`COURSE_COMPLETED`**: satisfecho solo si la materia referenciada está `COMPLETED`.
3. **Trayectoria**: `StudentTrajectory` vive en `curriculum-engine` (no en `curriculum-domain`), referencia `VersionCourseId` y contiene al menos `completedVersionCourseIds` e `inProgressVersionCourseIds`. Sin historial, notas, periodos ni homologaciones.
4. **Contexto de evaluación**: `CurriculumEvaluationContext` se define en `curriculum-engine` y contiene los datos de una `PlanVersion` necesarios para evaluar (`VersionCourse`, `Grouping`, `Component`). El caller pasa colecciones simples; el engine puede construir índices internos puros y deterministas. No se crea `PlanVersionGraph` en `curriculum-domain` ni se depende de `curriculum-snapshot`.
5. **Créditos y conteos**: `MIN_TOTAL_CREDITS`, `MIN_COMPONENT_CREDITS`, `MIN_GROUPING_CREDITS` y `MIN_GROUPING_COURSES` cuentan **solo materias `COMPLETED`**. Las `IN_PROGRESS` no aportan.
6. **`MIN_GROUPING_COURSES`**: cuenta `VersionCourse` `COMPLETED` pertenecientes a la `Grouping` referenciada. La materia evaluada nunca cuenta para satisfacer sus propios requisitos.
7. **Elegibilidad y estado derivado son funciones separadas.** El helper de estado deriva `COMPLETED` | `IN_PROGRESS` | `AVAILABLE` | `BLOCKED`:
   - `COMPLETED` si está en `completedVersionCourseIds`.
   - `IN_PROGRESS` si está en `inProgressVersionCourseIds` y no está completed.
   - `AVAILABLE` si no está completed ni in progress y sus requisitos están satisfechos.
   - `BLOCKED` en caso contrario.

   Estos estados nunca se persisten.
8. **Razones de bloqueo**: la representación principal es un **árbol de evaluación** que refleja la estructura original de la expresión. Cada nodo incluye al menos: tipo de nodo/requisito, `satisfied`, hijos evaluados cuando corresponda, e información diagnóstica mínima. Puede existir un helper secundario que aplane los requisitos incumplidos, pero debe preservar semántica suficiente para no convertir un `ANY` en "faltan todos". La lista plana **no** es la representación principal.
9. **Referencias inexistentes** (`VersionCourseId`, `ComponentId`, `GroupingId` no presentes en el contexto): el engine **no lanza**. Devuelve un diagnóstico estructurado `UNRESOLVED_REFERENCE`, considera ese requisito **no satisfecho** y permanece determinista. La integridad referencial completa corresponde a `curriculum-validator`.
10. **`AT_LEAST`**: cuenta hijos directos satisfechos. `AT_LEAST(1)` ≡ `ANY`; umbral igual al número de hijos ≡ `ALL`. Un umbral mayor que `children.length` produce resultado no satisfecho **y** diagnóstico, sin lanzar.
11. **Expresiones vacías** (aunque el esquema normalmente las impida): `ALL []` → `satisfied = true`; `ANY []` → `false`; `AT_LEAST []` → `false`. En los tres casos se emite además un diagnóstico de estructura inválida.
12. **Ámbito**: todo conteo ocurre dentro de la misma `PlanVersion`. TASK-003 no cruza versiones.
13. **Pureza**: funciones puras, deterministas, sin I/O, sin `Date.now()`, sin aleatoriedad, sin dependencias externas de runtime, con orden estable de resultados y diagnósticos (nunca dependiente del orden de iteración de un `Set`/`Map`).

Si alguna decisión resulta insuficiente para implementar algo, **pregunta antes de asumir**.

## Alcance permitido

En `packages/curriculum-engine` únicamente:

- `StudentTrajectory` y `CurriculumEvaluationContext` (tipos).
- Evaluación de `RequirementExpression` produciendo un árbol de evaluación.
- Helper puro de estado derivado (`COMPLETED` / `IN_PROGRESS` / `AVAILABLE` / `BLOCKED`) para una `VersionCourse`.
- Helper secundario opcional para aplanar requisitos incumplidos conservando el contexto de `ANY` / `AT_LEAST`.
- Diagnósticos estructurados (`UNRESOLVED_REFERENCE`, umbral inválido, expresión vacía).
- Pruebas Vitest en `packages/curriculum-engine/src/**/*.test.ts`.

Dependencia permitida: `@curriculum-universe/curriculum-domain` (solo tipos). Ninguna dependencia externa de runtime, tampoco Zod.

## Fuera de alcance

- Modificar `curriculum-domain` o `curriculum-schema` (si algo parece faltar allí, **pregunta**; no lo añadas).
- Progreso académico agregado, porcentajes de avance, proyección de grado.
- Simulación de semestre, planificación de periodos, inscripción conjunta.
- Elegibilidad recursiva entre correquisitos.
- Homologaciones, equivalencias, cruce entre versiones de plan.
- Persistencia de estados derivados.
- `curriculum-validator`, `curriculum-snapshot`, `curriculum-importer`, `database`.
- Base de datos, APIs, frontend, despliegue, datos curriculares reales.
- Optimización de rendimiento no solicitada, caches o memoización.
- Refactors no solicitados y cambios de nombre.
- TASK-004 o cualquier tarea posterior.

## Archivos permitidos

```
packages/curriculum-engine/src/**        (implementación + pruebas)
packages/curriculum-engine/package.json  (dependencia de tipos a curriculum-domain)
pnpm-lock.yaml                           (solo si la dependencia de workspace lo requiere)
```

Ningún otro archivo debe modificarse.

## Contratos de entrada/salida esperados

Forma conceptual, no literal — los nombres exactos de campos quedan a criterio de la implementación siempre que respeten estas decisiones:

**Entrada**

- `CurriculumEvaluationContext`: colecciones de `VersionCourse`, `Grouping` y `Component` de una única `PlanVersion`.
- `StudentTrajectory`: `completedVersionCourseIds` e `inProgressVersionCourseIds`.
- El `VersionCourseId` a evaluar, o la `RequirementExpression` directamente.

**Salida**

- Un **nodo de evaluación** por cada nodo de la expresión original, con: tipo, `satisfied`, hijos evaluados (para `ALL` / `ANY` / `AT_LEAST`) y diagnóstico mínimo.
- Para las hojas de conteo, el diagnóstico debe permitir explicar la brecha (por ejemplo: requerido vs. obtenido).
- Diagnósticos posibles: referencia no resuelta, umbral inválido, expresión vacía.
- El helper de estado devuelve uno de los cuatro estados y, cuando el estado es `BLOCKED`, permite acceder al árbol de evaluación correspondiente.

Una materia sin requisitos (`requirements` ausente) se considera satisfecha.

## Criterios de aceptación

- `curriculum-engine` no tiene dependencias externas de runtime; solo tipos de `curriculum-domain`.
- Evaluar dos veces la misma entrada produce resultados idénticos, incluido el orden de hijos y diagnósticos.
- El contrato defensivo del engine se limita exactamente a estos tres casos, en los que ninguna función lanza excepción: referencias no resueltas, expresiones vacías, y `AT_LEAST` con `threshold` mayor que el número de hijos. La validación de estructuras arbitrariamente inválidas pertenece a `curriculum-schema` y **no** debe duplicarse dentro del engine.
- Los seis tipos de hoja y los tres combinadores están cubiertos.
- Elegibilidad y estado derivado son funciones distintas; el estado no se almacena en ninguna entidad.
- El árbol de evaluación es la salida principal; cualquier vista plana es un helper secundario.
- No se modificó `curriculum-domain` ni `curriculum-schema`.
- La secuencia de validación se ejecuta sin errores.

## Casos de prueba requeridos

Como mínimo:

1. Materia sin requisitos → `AVAILABLE`.
2. `COURSE_COMPLETED` satisfecho con la materia completada; no satisfecho si solo está `IN_PROGRESS`.
3. `COURSE_COMPLETED_OR_CONCURRENT` satisfecho tanto con `COMPLETED` como con `IN_PROGRESS`; no satisfecho si no aparece en la trayectoria.
4. `ALL` con un hijo incumplido → no satisfecho, y el árbol identifica exactamente cuál falta.
5. `ANY` con un hijo cumplido → satisfecho; el helper plano **no** reporta los otros hijos como faltantes obligatorios.
6. `AT_LEAST` con 2 de 3 hijos satisfechos: `threshold` 2 → satisfecho; `threshold` 3 → no satisfecho; `threshold` 4 (mayor que el número de hijos) → no satisfecho **con** diagnóstico, sin lanzar.
7. `MIN_TOTAL_CREDITS`: las materias `IN_PROGRESS` no aportan créditos.
8. `MIN_COMPONENT_CREDITS`: solo cuentan las materias cuya `Grouping` pertenece al `Component` referenciado.
9. `MIN_GROUPING_CREDITS` y `MIN_GROUPING_COURSES`: solo cuentan materias `COMPLETED` de esa `Grouping`; la propia materia evaluada no cuenta para sus propios requisitos.
10. Referencia inexistente (`VersionCourseId`, `ComponentId` y `GroupingId`): diagnóstico `UNRESOLVED_REFERENCE`, requisito no satisfecho, sin excepción.
11. `ALL []` → satisfecho con diagnóstico de estructura inválida; `ANY []` y `AT_LEAST []` → no satisfechos con el mismo tipo de diagnóstico.
12. Los cuatro estados derivados se producen correctamente, con la precedencia `COMPLETED` sobre `IN_PROGRESS`.
13. Determinismo: dos ejecuciones sobre la misma entrada devuelven estructuras idénticas.

Todos los datos de prueba deben ser ficticios y mínimos.

## Comandos de validación

```
pnpm install
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

## Condición exacta de terminación

La tarea termina cuando los criterios de aceptación se cumplen, los casos de prueba requeridos existen y pasan, y la secuencia de validación se ejecuta sin errores. Al terminar, Codex debe entregar el resumen indicado en `AGENTS.md` y detenerse, sin iniciar TASK-004 ni ninguna otra tarea.
