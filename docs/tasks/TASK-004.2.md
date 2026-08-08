# TASK-004.2 — Obligatoriedad de materias

## Objetivo

Representar explícitamente en `VersionCourse` si una materia es obligatoria o electiva, como campo propio del curso — distinto de sus prerrequisitos (`RequirementExpression`), que gobiernan cuándo puede cursarse, no si es obligatoria para el plan.

Esta tarea es un prerrequisito de la incorporación de datos reales del Acuerdo 0018 de 2024 (UNAL Sede Medellín, Ciencias de la Computación): el modelo actual no puede representar fielmente la columna de obligatoriedad de ese acuerdo sin este campo.

## Contexto mínimo

- `docs/tasks/TASK-004.0.md` — precedente directo: mismo patrón de tarea (campo nuevo en una entidad de dominio + espejo en schema), ya cerrada e implementada.
- `packages/curriculum-domain/src/entities.ts` — definición actual de `VersionCourse`.
- `packages/curriculum-schema/src/entities.ts` — `versionCourseSchema` (`z.strictObject`), espejo estricto del tipo.
- `packages/curriculum-engine/src/evaluation.test.ts` y `packages/curriculum-engine/src/progress.test.ts` — cada uno construye fixtures de `VersionCourse` mediante un único helper local `versionCourse(...)`; ambos deben actualizarse para satisfacer el tipo, sin que esta tarea toque la lógica que prueban.
- `AGENTS.md` — reglas de alcance para Codex.
- Este documento (las decisiones de abajo son vinculantes).

## Decisiones aprobadas

Aprobadas por decisión humana. No se re-discuten ni se sustituyen por alternativas "mejores".

1. **Campo nuevo**: `VersionCourse.mandatory: boolean`. `true` = obligatoria, `false` = electiva. Refleja 1:1 la columna de obligatoriedad de la fuente curricular; no se deriva de ningún otro dato.
2. **Sin relación con `RequirementExpression`**: la obligatoriedad no es un requisito de acceso a la materia. Esta tarea no toca `requirements.ts`.
3. **Booleano simple, no enum**: se descarta explícitamente una variante con más estados (p. ej. `mandatory | elective_restricted | elective_free`). Si el Acuerdo 0018 resulta distinguir más de dos tipos de electividad al incorporar los datos reales, esa distinción se resuelve en la tarea del dataset, no aquí, y no reabre esta decisión salvo aprobación humana explícita.
4. **Campo obligatorio, no opcional**: toda `VersionCourse` válida declara `mandatory`. Sin valor por defecto implícito en el schema.
5. **Sin consumidores todavía**: ningún cambio de comportamiento en `evaluation.ts`, `state.ts` ni `progress.ts`. Esta tarea no filtra, no agrupa ni pondera nada por `mandatory`. Su primer consumidor será el dataset real de Ciencias de la Computación, en una tarea posterior.
6. **Fixtures existentes**: los helpers `versionCourse(...)` en `curriculum-schema/src/schema.test.ts`, `curriculum-engine/src/evaluation.test.ts` y `curriculum-engine/src/progress.test.ts` se actualizan para incluir `mandatory`, con valor `true` en todos los casos existentes — ninguna prueba actual depende de electividad, así que este valor preserva exactamente el comportamiento y las aserciones ya existentes. No se modifica ninguna aserción de esos archivos, solo la construcción del fixture.

Si alguna decisión resulta insuficiente para implementar algo, **pregunta antes de asumir**.

## Alcance permitido

- `packages/curriculum-domain/src/entities.ts`: añadir `mandatory: boolean` a `VersionCourse`.
- `packages/curriculum-schema/src/entities.ts`: añadir `mandatory: z.boolean()` a `versionCourseSchema`, en el mismo orden en que aparece en el tipo.
- `packages/curriculum-schema/src/schema.test.ts`: actualizar los fixtures de `VersionCourse` existentes para incluir `mandatory`, y añadir los casos de prueba nuevos descritos abajo.
- `packages/curriculum-engine/src/evaluation.test.ts`: actualizar únicamente el helper `versionCourse(...)` para incluir `mandatory: true`. Ninguna aserción de este archivo cambia.
- `packages/curriculum-engine/src/progress.test.ts`: actualizar únicamente el helper `versionCourse(...)` para incluir `mandatory: true`. Ninguna aserción de este archivo cambia.

Dependencia permitida: ninguna nueva.

## Fuera de alcance

- Cualquier lógica nueva que consuma `mandatory` (filtrado, agregación por obligatoriedad/electividad, cambios a `MIN_COMPONENT_CREDITS`, `MIN_GROUPING_CREDITS` o a `calculatePlanProgress`).
- Modificar `evaluation.ts`, `state.ts` o `progress.ts` (comportamiento). Solo se tocan sus archivos de prueba, y solo para actualizar el fixture.
- Modificar `requirements.ts` o cualquier `RequirementExpression`.
- Un enum con más de dos estados de obligatoriedad (decisión 3).
- El dataset real de Ciencias de la Computación (tarea posterior).
- `curriculum-validator`, `curriculum-snapshot`, `curriculum-importer`, `database`, `apps/web`, `apps/admin`.
- Refactors o renombrados no solicitados.
- TASK-004.3 o cualquier tarea posterior.

## Archivos permitidos

```
packages/curriculum-domain/src/entities.ts           (VersionCourse + mandatory)
packages/curriculum-schema/src/entities.ts            (versionCourseSchema + mandatory)
packages/curriculum-schema/src/schema.test.ts          (fixtures existentes + casos de prueba nuevos)
packages/curriculum-engine/src/evaluation.test.ts      (solo el helper versionCourse(...))
packages/curriculum-engine/src/progress.test.ts        (solo el helper versionCourse(...))
```

Ningún otro archivo debe modificarse.

## Contrato de entrada/salida esperado

`VersionCourse` (forma conceptual, no literal):

```ts
type VersionCourse = {
  id: VersionCourseId;
  planVersionId: PlanVersionId;
  courseId: CourseId;
  groupingId: GroupingId;
  academicCode: string;
  credits: number;
  mandatory: boolean; // nuevo
  requirements?: RequirementExpression;
};
```

`versionCourseSchema` valida `mandatory` como booleano y conserva sin cambios el resto de reglas ya existentes.

## Criterios de aceptación

- `VersionCourse.mandatory: boolean` existe en `curriculum-domain`.
- `versionCourseSchema` exige `mandatory` como booleano; rechaza ausente y valores no booleanos.
- Los fixtures actualizados en `evaluation.test.ts` y `progress.test.ts` no alteran ninguna aserción existente — todas las pruebas ya existentes en esos archivos siguen verificando exactamente lo mismo que antes.
- Ningún archivo fuera de los 5 listados en "Archivos permitidos" queda modificado.
- No se modificó `evaluation.ts`, `state.ts`, `progress.ts` ni `requirements.ts`.
- `curriculum-validator`, `curriculum-snapshot`, `curriculum-importer`, `database`, `apps/web`, `apps/admin` quedan sin cambios.
- La secuencia de validación se ejecuta sin errores.

## Casos de prueba requeridos

Como mínimo, en `packages/curriculum-schema/src/schema.test.ts`:

1. `VersionCourse` válida con `mandatory: true` → acepta.
2. `VersionCourse` válida con `mandatory: false` → acepta.
3. `mandatory` ausente → rechaza.
4. `mandatory` no booleano (p. ej. `"true"` como string) → rechaza.

Y, sin necesidad de casos nuevos, confirmar que la suite completa existente de `curriculum-schema` y `curriculum-engine` (incluidos `evaluation.test.ts` y `progress.test.ts`) sigue pasando sin cambios de aserción tras actualizar los fixtures.

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

La tarea termina cuando los criterios de aceptación se cumplen, los casos de prueba requeridos existen y pasan, y la secuencia de validación se ejecuta sin errores. Codex entrega el resumen indicado en `AGENTS.md` y se detiene, sin iniciar TASK-004.3 ni ninguna otra tarea.
