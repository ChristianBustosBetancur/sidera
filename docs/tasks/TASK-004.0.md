# TASK-004.0 — Créditos requeridos para completar el plan

## Objetivo

Representar explícitamente en `PlanVersion` el número de créditos que un estudiante debe completar para terminar esa versión del plan curricular, como campo propio del dominio — distinto de la suma de créditos de todas las `VersionCourse` ofrecidas (que puede incluir optativas o alternativas no obligatorias en su totalidad) y distinto del leaf `MIN_TOTAL_CREDITS` de `RequirementExpression` (que solo actúa como prerrequisito de una materia puntual, no como meta de graduación del plan).

Esta tarea es el prerrequisito de TASK-004.1 (progreso académico agregado), que quedó pausada porque no existía un denominador válido para calcular el porcentaje de avance sin asumir que "todas las materias del plan son obligatorias".

## Contexto mínimo

- `docs/tasks/TASK-003.md` — el engine ya existente; decisión 5 (los conteos de créditos cuentan solo materias `COMPLETED`) y el significado de `MIN_TOTAL_CREDITS` como leaf de requisito, no como meta de plan.
- `packages/curriculum-domain/src/entities.ts` — definición actual de `PlanVersion`.
- `packages/curriculum-domain/src/requirements.ts` — definición actual de `MinimumTotalCreditsRequirement` (`MIN_TOTAL_CREDITS`), para no confundirla con el campo nuevo.
- `packages/curriculum-schema/src/entities.ts` — `planVersionSchema` (`z.strictObject`), espejo estricto del tipo.
- `AGENTS.md` — reglas de alcance para Codex.
- Este documento (las decisiones de abajo son vinculantes).

## Decisiones aprobadas

Aprobadas por decisión humana. No se re-discuten ni se sustituyen por alternativas "mejores".

1. **Campo nuevo**: `PlanVersion.requiredCredits: number`. Representa los créditos mínimos que un estudiante debe completar para terminar esa `PlanVersion`. Es un dato propio del plan, no derivado de otra entidad.
2. **No es la suma de créditos de todas las `VersionCourse`** del plan. Un plan puede ofrecer más créditos en materias de los que exige completar (optativas, alternativas, pools de electivas). Esta tarea **no** valida ni relaciona `requiredCredits` con esa suma — si se necesita esa validación cruzada, es de `curriculum-validator`, en una tarea posterior.
3. **Sin relación con `MIN_TOTAL_CREDITS`** (leaf de `RequirementExpression`). Ese leaf gatea el acceso a una materia puntual (p. ej. "necesitas 60 créditos para cursar X") y puede aparecer varias veces con distintos umbrales dentro del mismo plan. `requiredCredits` es un único valor por `PlanVersion`: la meta de graduación. No se fusionan, no se deriva uno del otro, y esta tarea no toca `requirements.ts`.
4. **Campo obligatorio, no opcional**: toda `PlanVersion` válida declara `requiredCredits`. Sin valor por defecto implícito.
5. **Validación estructural mínima**: entero positivo (`z.number().int().positive()`). Sin límite superior. Sin validación cruzada con otras entidades en esta tarea.
6. **Sin consumidores todavía**: ningún paquete (`curriculum-engine`, `curriculum-validator`, `curriculum-snapshot`, `curriculum-importer`, `database`) ni ninguna app lee este campo en esta tarea. Su primer consumidor será TASK-004.1.

Si alguna decisión resulta insuficiente para implementar algo, **pregunta antes de asumir**.

## Alcance permitido

- `packages/curriculum-domain/src/entities.ts`: añadir `requiredCredits: number` a `PlanVersion`.
- `packages/curriculum-schema/src/entities.ts`: añadir `requiredCredits: z.number().int().positive()` a `planVersionSchema`, en el mismo orden en que aparece en el tipo.
- `packages/curriculum-schema/src/schema.test.ts`: actualizar los fixtures de `PlanVersion` ya existentes para incluir `requiredCredits`, y añadir los casos de prueba nuevos descritos abajo.

Dependencia permitida: ninguna nueva. Ningún cambio en `curriculum-engine`, `curriculum-validator`, `curriculum-snapshot`, `curriculum-importer`, `database`, `apps/web`, `apps/admin`.

## Fuera de alcance

- Cualquier consumo del campo: cálculo de progreso, validación cruzada contra la suma de créditos ofrecidos, UI. Eso es TASK-004.1 o tareas posteriores.
- Validar que `requiredCredits` sea alcanzable con las materias existentes del plan (`curriculum-validator`).
- Cambios en `MIN_TOTAL_CREDITS` o cualquier otro leaf de `RequirementExpression`.
- Cambios en `curriculum-engine`, `curriculum-validator`, `curriculum-snapshot`, `curriculum-importer`, `database`, `apps/web`, `apps/admin`.
- Migraciones de base de datos real (no existe persistencia real todavía).
- Refactors o renombrados no solicitados.
- TASK-004.1 o cualquier tarea posterior.

## Archivos permitidos

```
packages/curriculum-domain/src/entities.ts       (PlanVersion + requiredCredits)
packages/curriculum-schema/src/entities.ts       (planVersionSchema + requiredCredits)
packages/curriculum-schema/src/schema.test.ts    (fixtures existentes + casos de prueba nuevos)
```

Ningún otro archivo debe modificarse.

## Contrato de entrada/salida esperado

`PlanVersion` (forma conceptual, no literal — el orden exacto de campos queda a criterio de la implementación):

```ts
type PlanVersion = {
  id: PlanVersionId;
  curriculumPlanId: CurriculumPlanId;
  name: string;
  provenance: Provenance;
  lifecycle: Lifecycle;
  requiredCredits: number; // nuevo
};
```

`planVersionSchema` valida `requiredCredits` como entero positivo y conserva sin cambios el resto de reglas ya existentes (objeto estricto, rechazo de ancestros denormalizados como `academicProgramId` o `universityId`).

## Criterios de aceptación

- `PlanVersion.requiredCredits: number` existe en `curriculum-domain`.
- `planVersionSchema` exige `requiredCredits` como entero positivo; rechaza ausente, cero, negativo, decimal y no numérico.
- `planVersionSchema` sigue rechazando ancestros denormalizados (`academicProgramId`, `universityId`) igual que antes — sin regresión de comportamiento existente.
- Ningún archivo fuera de los tres listados en "Archivos permitidos" queda modificado.
- No se modificó `MIN_TOTAL_CREDITS` ni ningún otro leaf de `RequirementExpression`.
- `curriculum-engine`, `curriculum-validator`, `curriculum-snapshot`, `curriculum-importer`, `database`, `apps/web`, `apps/admin` quedan sin cambios.
- La secuencia de validación se ejecuta sin errores.

## Casos de prueba requeridos

Como mínimo, en `packages/curriculum-schema/src/schema.test.ts`:

1. `PlanVersion` válida con `requiredCredits` positivo → acepta.
2. `requiredCredits` ausente → rechaza.
3. `requiredCredits` igual a `0` → rechaza.
4. `requiredCredits` negativo → rechaza.
5. `requiredCredits` decimal (p. ej. `3.5`) → rechaza.
6. `requiredCredits` no numérico (string) → rechaza.
7. El caso existente "rechaza ancestros denormalizados" sigue pasando con `requiredCredits` presente en el fixture base.

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

La tarea termina cuando los criterios de aceptación se cumplen, los casos de prueba requeridos existen y pasan, y la secuencia de validación se ejecuta sin errores. Codex entrega el resumen indicado en `AGENTS.md` y se detiene, sin iniciar TASK-004.1 ni ninguna otra tarea.
