# TASK-004.3 — Créditos exigidos por Componente y Agrupación

## Objetivo

Representar explícitamente en `Component` y en `Grouping` los créditos exigidos por el plan en cada uno, tal como los declara el Acuerdo 0018 de 2024 — un dato normativo propio de cada Componente/Agrupación, no derivable sumando los créditos de las materias que contienen (una Agrupación puede ofrecer más créditos en electivas de los que exige completar).

Esta tarea es un segundo prerrequisito, junto con TASK-004.2 (ya cerrada), para poder incorporar fielmente el plan oficial de Ciencias de la Computación (Acuerdo 0018 de 2024) como dato real en Sidera.

## Contexto mínimo

- `docs/tasks/TASK-004.0.md` — precedente directo: mismo patrón (`PlanVersion.requiredCredits`, no derivable de la suma de materias), ya cerrada e implementada.
- `docs/tasks/TASK-004.2.md` — precedente inmediato (`VersionCourse.mandatory`), mismo patrón de tarea, ya cerrada e implementada.
- `packages/curriculum-domain/src/entities.ts` — definición actual de `Component` y `Grouping`.
- `packages/curriculum-schema/src/entities.ts` — `componentSchema` y `groupingSchema` (`z.strictObject`), espejo estricto de los tipos.
- `AGENTS.md` — reglas de alcance para Codex.
- Este documento (las decisiones de abajo son vinculantes).

## Decisiones aprobadas

Aprobadas por decisión humana. No se re-discuten ni se sustituyen por alternativas "mejores".

1. **Campos nuevos**: `Component.requiredCredits: number` y `Grouping.requiredCredits: number`. Representan los créditos que el plan exige completar dentro de ese Componente/Agrupación — el mismo concepto que `PlanVersion.requiredCredits` (TASK-004.0), aplicado a los dos niveles intermedios de la jerarquía.
2. **Solo el total, sin desglose obligatorios/optativos**: no se añade ningún campo para la porción "obligatorios" ni "optativos" que declara el Acuerdo dentro de cada Agrupación. La porción obligatoria será, en el futuro, verificable sumando los `VersionCourse` con `mandatory: true` de esa `Grouping` una vez cargado el catálogo real de materias (tarea posterior); la porción optativa queda implícita como la diferencia, sin campo dedicado. Esta tarea no implementa esa verificación ni ese cálculo.
3. **No es la suma de créditos de las materias de esa Agrupación/Componente**: igual razón que TASK-004.0 — puede haber más créditos ofrecidos en electivas de los exigidos. Esta tarea no valida ni relaciona `requiredCredits` con esa suma; esa validación cruzada, si se necesita, es de `curriculum-validator`, en una tarea posterior.
4. **Sin relación con `MIN_COMPONENT_CREDITS` / `MIN_GROUPING_CREDITS`** (leaves de `RequirementExpression`, ver `packages/curriculum-domain/src/requirements.ts`). Esos leaves gatean el acceso a una materia puntual (p. ej. "necesitas 44 créditos en Matemáticas para cursar X") y son atributos de un requisito, no del propio `Component`/`Grouping`. `Component.requiredCredits` y `Grouping.requiredCredits` son la meta de graduación de ese nivel del plan, no un gate de acceso a otra materia. No se fusionan, no se deriva uno del otro, y esta tarea no toca `requirements.ts`.
5. **Campos obligatorios, no opcionales**: todo `Component` y toda `Grouping` válidos declaran `requiredCredits`. Sin valor por defecto implícito.
6. **Validación estructural mínima**: entero positivo (`z.number().int().positive()`) en ambos, mismo patrón que `PlanVersion.requiredCredits`. Sin límite superior. Sin validación cruzada entre niveles (que la suma de `Grouping.requiredCredits` de un `Component` coincida con `Component.requiredCredits`, o que la suma de `Component.requiredCredits` de una `PlanVersion` coincida con `PlanVersion.requiredCredits`) — esa aritmética de consistencia, si se necesita, es de `curriculum-validator`, en una tarea posterior.
7. **Sin consumidores todavía**: ningún paquete (`curriculum-engine`, `curriculum-validator`, `curriculum-snapshot`, `curriculum-importer`, `database`) ni ninguna app lee estos campos en esta tarea.
8. **`curriculum-engine/src/evaluation.test.ts` construye fixtures completos de `Component` y `Grouping`** (dentro de `createContext()`), a diferencia de `progress.test.ts`, que usa arrays vacíos. Esos dos literales de `Component` y los dos de `Grouping` deben actualizarse para incluir `requiredCredits`, **únicamente añadiendo ese campo a los literales ya existentes** — sin cambiar ninguna aserción (`expect(...)`) ni ninguna lógica de ese archivo. No es un cambio de comportamiento, es la misma corrección mecánica que TASK-004.2 ya hizo ahí con `mandatory` en `VersionCourse`.

Si alguna decisión resulta insuficiente para implementar algo, **pregunta antes de asumir**.

## Alcance permitido

- `packages/curriculum-domain/src/entities.ts`: añadir `requiredCredits: number` a `Component` y a `Grouping`.
- `packages/curriculum-schema/src/entities.ts`: añadir `requiredCredits: z.number().int().positive()` a `componentSchema` y a `groupingSchema`, en el mismo orden en que aparece en cada tipo.
- `packages/curriculum-schema/src/schema.test.ts`: actualizar los fixtures de `Component` y `Grouping` ya existentes para incluir `requiredCredits`, y añadir los casos de prueba nuevos descritos abajo.
- `packages/curriculum-engine/src/evaluation.test.ts`: **únicamente** añadir `requiredCredits` a los literales de `Component` y `Grouping` ya existentes dentro de `createContext()` (decisión 8). Ninguna otra línea de este archivo debe cambiar: ni aserciones, ni lógica, ni otros fixtures.

Dependencia permitida: ninguna nueva. Ningún cambio en `curriculum-validator`, `curriculum-snapshot`, `curriculum-importer`, `database`, `apps/web`, `apps/admin`. Ningún cambio en `curriculum-engine` más allá del ajuste puntual de fixture descrito arriba — no se toca `evaluation.ts`, `state.ts`, `progress.ts`, `progress.test.ts` ni `types.ts`.

## Fuera de alcance

- Cualquier consumo de estos campos: verificación de progreso por componente/agrupación, validación cruzada de sumas entre niveles, UI. Eso es una tarea posterior.
- Campos de desglose obligatorios/optativos (decisión 2).
- Cambios en `MIN_COMPONENT_CREDITS`, `MIN_GROUPING_CREDITS` o cualquier otro leaf de `RequirementExpression`.
- Cualquier cambio en `evaluation.ts`, `state.ts`, `progress.ts`, `progress.test.ts` o `types.ts` de `curriculum-engine`. En `evaluation.test.ts`, cualquier cambio que no sea añadir `requiredCredits` a los literales existentes de `Component`/`Grouping` (decisión 8) — en particular, ninguna aserción se modifica.
- Cambios en `curriculum-validator`, `curriculum-snapshot`, `curriculum-importer`, `database`, `apps/web`, `apps/admin`.
- El dataset real de Ciencias de la Computación (tarea posterior, formalmente TASK-004.4).
- Refactors o renombrados no solicitados.
- TASK-004.4 o cualquier tarea posterior.

## Archivos permitidos

```
packages/curriculum-domain/src/entities.ts           (Component + Grouping + requiredCredits)
packages/curriculum-schema/src/entities.ts            (componentSchema + groupingSchema + requiredCredits)
packages/curriculum-schema/src/schema.test.ts          (fixtures existentes + casos de prueba nuevos)
packages/curriculum-engine/src/evaluation.test.ts      (solo requiredCredits en los literales de Component/Grouping ya existentes)
```

Ningún otro archivo debe modificarse.

## Contrato de entrada/salida esperado

Forma conceptual, no literal — el orden exacto de campos queda a criterio de la implementación:

```ts
type Component = {
  id: ComponentId;
  planVersionId: PlanVersionId;
  name: string;
  requiredCredits: number; // nuevo
};

type Grouping = {
  id: GroupingId;
  componentId: ComponentId;
  name: string;
  requiredCredits: number; // nuevo
};
```

`componentSchema` y `groupingSchema` validan `requiredCredits` como entero positivo, y conservan sin cambios el resto de reglas ya existentes.

## Criterios de aceptación

- `Component.requiredCredits: number` y `Grouping.requiredCredits: number` existen en `curriculum-domain`.
- `componentSchema` y `groupingSchema` exigen `requiredCredits` como entero positivo; rechazan ausente, cero, negativo, decimal y no numérico, en ambos tipos.
- `curriculum-engine/src/evaluation.test.ts` sigue compilando y su suite completa sigue pasando, con exactamente las mismas aserciones que antes de esta tarea — el único cambio es la presencia de `requiredCredits` en sus fixtures de `Component`/`Grouping`.
- Ningún archivo fuera de los cuatro listados en "Archivos permitidos" queda modificado.
- No se modificó `MIN_COMPONENT_CREDITS`, `MIN_GROUPING_CREDITS` ni ningún otro leaf de `RequirementExpression`.
- No se modificó `evaluation.ts`, `state.ts`, `progress.ts`, `progress.test.ts` ni `types.ts`.
- `curriculum-validator`, `curriculum-snapshot`, `curriculum-importer`, `database`, `apps/web`, `apps/admin` quedan sin cambios.
- La secuencia de validación se ejecuta sin errores.

## Casos de prueba requeridos

Como mínimo, en `packages/curriculum-schema/src/schema.test.ts`, para **cada uno** de `Component` y `Grouping` por separado:

1. Entidad válida con `requiredCredits` positivo → acepta.
2. `requiredCredits` ausente → rechaza.
3. `requiredCredits` igual a `0` → rechaza.
4. `requiredCredits` negativo → rechaza.
5. `requiredCredits` decimal (p. ej. `3.5`) → rechaza.
6. `requiredCredits` no numérico (string) → rechaza.

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

La tarea termina cuando los criterios de aceptación se cumplen, los casos de prueba requeridos existen y pasan, y la secuencia de validación se ejecuta sin errores. Codex entrega el resumen indicado en `AGENTS.md` y se detiene, sin iniciar TASK-004.4 ni ninguna otra tarea.
