# TASK-004.4 — Dataset oficial: Ciencias de la Computación (Acuerdo 0018 de 2024)

## Objetivo

Incorporar en `packages/curriculum-snapshot` el primer dataset curado y trazable del plan oficial de Ciencias de la Computación, Universidad Nacional de Colombia, Sede Medellín — basado **únicamente** en el Acuerdo 0018 de 2024, sin usar la Propuesta de Malla Curricular para completar huecos.

Esta tarea depende de TASK-004.0, TASK-004.2 y TASK-004.3 (las tres cerradas e implementadas), que añadieron `PlanVersion.requiredCredits`, `VersionCourse.mandatory` y `Component.requiredCredits` / `Grouping.requiredCredits` respectivamente — los tres campos que este dataset necesita para representar fielmente el Acuerdo.

## Precondición — resuelta

La tabla completa de materias ya existe en `docs/curriculum-sources/acuerdo-0018-2024-materias.md` (fuente oficial curada, transcripción del Acuerdo 0018 de 2024). Codex debe leer ese archivo completo antes de `IMPLEMENT` y transcribir exactamente lo que declara — **si algo no está en ese archivo, no se inventa ni se infiere; se omite y se reporta** (ver decisión 4 y la sección "Materias explícitamente excluidas").

## Contexto mínimo

- `docs/tasks/TASK-004.0.md`, `docs/tasks/TASK-004.2.md`, `docs/tasks/TASK-004.3.md` — los tres prerrequisitos, cerrados.
- `packages/curriculum-domain/src/entities.ts` y `requirements.ts` — todas las entidades y `RequirementExpression` disponibles.
- `packages/curriculum-schema/src/entities.ts` — los schemas Zod contra los que se valida el dataset.
- `docs/ARCHITECTURE.md` — jerarquía `University → AcademicProgram → CurriculumPlan → PlanVersion`; nota el registro de decisión de TASK-003.0: `Campus`/`Sede` **no** están modelados como entidad propia (decisión deliberada, no revisitada aquí).
- `docs/curriculum-sources/acuerdo-0018-2024-materias.md` — fuente oficial curada con la tabla completa de materias. **Lectura obligatoria e íntegra antes de implementar.**
- `AGENTS.md` — reglas de alcance para Codex.
- Este documento (los datos y decisiones de abajo son vinculantes).

## Datos aprobados — estructura (completos, no dependen de la precondición)

**Identidad del plan:**

| Entidad | Valor |
|---|---|
| `University.name` | `Universidad Nacional de Colombia` |
| `AcademicProgram.name` | `Ciencias de la Computación (Sede Medellín)` — ver decisión 1 sobre `Sede` |
| `CurriculumPlan.name` | `Ciencias de la Computación (Sede Medellín)` |
| `PlanVersion.name` | `Acuerdo 0018 de 2024` |
| `PlanVersion.provenance` | `"official"` |
| `PlanVersion.lifecycle` | `"draft"` — ver decisión 2 |
| `PlanVersion.requiredCredits` | `146` |

**Componentes y Agrupaciones — 3 Componentes, 8 Agrupaciones:**

| Component | `requiredCredits` | Groupings (`requiredCredits`) |
|---|---|---|
| Componente de Fundamentación | 61 | Matemáticas (44), Programación (9), Ciencias Naturales y Estadística (8) |
| Componente de Formación Disciplinar o Profesional | 56 | Algoritmos y Computación (19), Computación Científica (16), Sistemas de Cómputo (6), Computación Aplicada (7), Trabajo de Grado (8) |
| Componente de Libre Elección | 29 | *(ninguna — ver decisión 3)* |

**Trabajo de Grado**: código `3010664`, nombre "Trabajo de grado", 8 créditos, `mandatory: true`. Requisito de acceso, tal como lo da la fuente: haber aprobado 34 créditos (60%) del total exigido en el Componente de Formación Disciplinar o Profesional. Se modela como `MIN_COMPONENT_CREDITS` (`componentId` = el `Component` "Formación Disciplinar o Profesional" de este mismo dataset, `credits: 34`) dentro de `requirements` de esa `VersionCourse`. No se modela ningún requisito administrativo (comité, propuesta radicada, director) — la fuente no lo especifica y `RequirementExpression` no tiene forma de representarlo.

**Materia explícitamente excluida**: la fuente menciona `3010665 — Cursos de posgrado` junto a Trabajo de Grado, pero sin créditos ni obligatoriedad determinables con seguridad. **No se crea como `VersionCourse`** — se omite y se reporta como dato pendiente en el resumen final, sin inventar los campos faltantes.

**Total esperado**: 60 `VersionCourse` (16 Matemáticas + 3 Programación + 6 Ciencias Naturales y Estadística + 9 Algoritmos y Computación + 8 Computación Científica + 5 Sistemas de Cómputo + 12 Computación Aplicada + 1 Trabajo de Grado), según el desglose de la fuente. Sirve como comprobación de completitud, no como valor a forzar si la fuente difiere.

## Decisiones aprobadas

Aprobadas por decisión humana. No se re-discuten ni se sustituyen por alternativas "mejores".

1. **`Sede Medellín` se codifica en `AcademicProgram.name` y en `CurriculumPlan.name`**, no como entidad propia — `Campus`/`Sede` no están modelados (registro de decisión de TASK-003.0). Si en el futuro Sidera incorpora otra sede del mismo programa, se evaluará entonces si esto sigue siendo suficiente; no se reabre aquí.
2. **`PlanVersion.lifecycle: "draft"`** mientras se cura el dataset — no `"published"`. `docs/ARCHITECTURE.md` exige aprobación humana explícita antes de publicar una versión curricular; esa publicación es un paso posterior y separado, no parte de esta tarea.
3. **Sin `Grouping` para Libre Elección**: el Acuerdo no presenta una agrupación de materias bajo ese componente en las tablas dadas. No se crea una `Grouping` artificial solo para completar la jerarquía. Si en el futuro se cargan materias de libre elección, ese vacío se resuelve en la tarea que las incorpore, no en esta.
4. **Ningún requisito se infiere**: todo `VersionCourse.requirements` debe corresponder a algo que el archivo fuente declare explícitamente como prerrequisito, correquisito o mínimo de créditos de esa materia. Si el archivo fuente no declara requisitos para una materia, esa `VersionCourse` se crea sin `requirements` (equivale a "disponible sin condición", per TASK-003). No se asume ningún prerrequisito por convención, orden numérico de código, ni conocimiento general del programa.
4.1. **Regla mecánica de transcripción de requisitos**: cuando una materia tiene un solo prerrequisito y ningún correquisito, `requirements` es un único `COURSE_COMPLETED` referenciando esa `VersionCourse`. Cuando tiene varios prerrequisitos y/o correquisitos listados juntos, se combinan con `ALL` — un `COURSE_COMPLETED` por cada prerrequisito y un `COURSE_COMPLETED_OR_CONCURRENT` por cada correquisito, todos como hijos directos del `ALL`. La fuente presenta cada lista de prerrequisitos/correquisitos como condiciones simultáneas, nunca alternativas — no se usa `ANY` ni `AT_LEAST` en esta tarea salvo que la fuente lo exprese explícitamente como alternativa (no ocurre en los datos suministrados).
5. **No se usa la Propuesta de Malla Curricular** para completar ninguna materia, crédito, agrupación o requisito faltante del Acuerdo 0018. Si algo falta en el archivo fuente del Acuerdo, queda pendiente y se reporta — no se rellena desde la Propuesta.
6. **`p.d.` (pendiente de definir) se preserva explícitamente sin resolver**: si el archivo fuente marca algún dato como `p.d.` (previsible en la Propuesta, pero aplica igual si apareciera en el Acuerdo), esa `VersionCourse` no incluye ese campo con un valor inventado. Si el campo es obligatorio en el schema (p. ej. `credits`, `mandatory`) y no puede completarse, esa materia **no se crea** en esta tarea y se reporta como pendiente — no se usa un valor placeholder (`0`, `false`, cadena vacía) para forzar la validación.
7. **Un `Course` por cada `VersionCourse`** en esta tarea: al ser la primera `PlanVersion` cargada, no hay reutilización de `Course` entre versiones todavía. `Course.name` = nombre de la materia; `Course.universityId` referencia la `University` de esta tarea.
8. **Traza de la fuente**: no se añade ningún campo nuevo de citación/traza a `curriculum-domain` ni a `curriculum-schema` — la trazabilidad se cumple manteniendo el archivo fuente (precondición) versionado en el repositorio, con una referencia explícita a él en el módulo de datos (comentario o constante, no un campo del dominio). No se reabre el modelo de dominio para esto salvo que aparezca un blocker real durante la implementación.
9. **Validación del dataset**: la prueba de esta tarea corre cada entidad construida (`University`, `AcademicProgram`, `CurriculumPlan`, `PlanVersion`, cada `Component`, cada `Grouping`, cada `Course`, cada `VersionCourse`) contra su schema de `curriculum-schema` (`safeParse` exitoso). Además verifica que **toda referencia `VersionCourseId` usada dentro de cualquier `requirements` del dataset (en `COURSE_COMPLETED`, `COURSE_COMPLETED_OR_CONCURRENT`) corresponda a una `VersionCourse` realmente creada en este mismo dataset** — sin referencias colgantes. No se valida consistencia aritmética entre niveles (suma de `Grouping.requiredCredits` contra `Component.requiredCredits`, etc.) — eso es de `curriculum-validator`, en una tarea posterior.
10. **Sin publicar, sin consumidores todavía**: ningún cambio en `apps/web`, `apps/admin`, `curriculum-engine`, `curriculum-validator`, `curriculum-importer`, `database`. El dataset queda exportado desde `curriculum-snapshot` para que una tarea posterior lo consuma.

Si alguna decisión resulta insuficiente para implementar algo, **pregunta antes de asumir**.

## Alcance permitido

- `packages/curriculum-snapshot/package.json`: añadir dependencias de workspace `@sidera/curriculum-domain` y `@sidera/curriculum-schema`.
- `packages/curriculum-snapshot/src/data/unal-cs-2024-official/**`: el dataset en sí — módulos TypeScript tipados según `curriculum-domain`, organizados como convenga (p. ej. un archivo por tipo de entidad), citando en un comentario la ruta del archivo fuente usado.
- `packages/curriculum-snapshot/src/data/unal-cs-2024-official.test.ts`: valida cada entidad del dataset contra su schema de `curriculum-schema`, y verifica los conteos estructurales (3 Components, 8 Groupings, `requiredCredits` de cada uno igual a los valores de la tabla de "Datos aprobados").
- `packages/curriculum-snapshot/src/index.ts`: reexporta el dataset.
- `pnpm-lock.yaml`: regenerado por `pnpm install` como consecuencia de las nuevas dependencias de workspace, no editado a mano.

Dependencia permitida: `@sidera/curriculum-domain` y `@sidera/curriculum-schema`, ambas ya existentes en el monorepo. Ninguna dependencia externa nueva.

## Fuera de alcance

- Cualquier materia cuyos datos obligatorios (código, nombre, créditos, obligatoriedad) no consten explícitamente en el archivo fuente.
- La Propuesta de Malla Curricular, en cualquier forma (decisión 5).
- Publicar la `PlanVersion` (`lifecycle: "published"`) — queda en `"draft"` (decisión 2).
- Validación de consistencia aritmética entre niveles (decisión 9) — `curriculum-validator`.
- Cualquier campo nuevo de citación/traza en `curriculum-domain` o `curriculum-schema` (decisión 8), salvo blocker real reportado y aprobado.
- Cambios en `curriculum-engine`, `curriculum-validator`, `curriculum-importer`, `database`, `apps/web`, `apps/admin`.
- Modificar `curriculum-domain` o `curriculum-schema` — si algo de lo que exige el Acuerdo no es representable con las entidades actuales, **detente y reporta**; no lo fuerces ni lo modifiques por tu cuenta.
- Refactors o renombrados no solicitados.
- TASK-004.5 o cualquier tarea posterior.

## Archivos permitidos

```
packages/curriculum-snapshot/package.json                                (+ 2 dependencias de workspace)
packages/curriculum-snapshot/src/data/unal-cs-2024-official/**           (nuevo — el dataset)
packages/curriculum-snapshot/src/data/unal-cs-2024-official.test.ts      (nuevo — validación contra schema)
packages/curriculum-snapshot/src/index.ts                                (reexport del dataset)
pnpm-lock.yaml                                                            (regenerado, no editado a mano)
```

Ningún otro archivo debe modificarse.

## Criterios de aceptación

- Existen exactamente: 1 `University`, 1 `AcademicProgram`, 1 `CurriculumPlan`, 1 `PlanVersion` (`provenance: "official"`, `lifecycle: "draft"`, `requiredCredits: 146`), 3 `Component`, 8 `Grouping`.
- Los `requiredCredits` de cada `Component` y cada `Grouping` coinciden exactamente con la tabla de "Datos aprobados".
- Ninguna `VersionCourse` incluye datos no presentes en el archivo fuente; ninguna materia con datos incompletos fue creada con valores inventados o placeholder (decisión 6). En particular, `3010665 Cursos de posgrado` no fue creada.
- Ningún requisito (`requirements`) fue inferido más allá de lo que el archivo fuente declara explícitamente (decisión 4), combinando múltiples prerrequisitos/correquisitos con `ALL` (decisión 4.1).
- El requisito de Trabajo de Grado se modela como `MIN_COMPONENT_CREDITS` con `credits: 34` sobre el `Component` "Formación Disciplinar o Profesional".
- Existen 60 `VersionCourse` en total, salvo que la revisión del archivo fuente revele una discrepancia — en ese caso se reporta, no se fuerza el número.
- Cada entidad construida pasa la validación de su schema correspondiente en `curriculum-schema`, y ninguna referencia `VersionCourseId` dentro de `requirements` queda sin resolver dentro del dataset (decisión 9).
- No se usó ningún dato de la Propuesta de Malla Curricular.
- No se modificó `curriculum-domain` ni `curriculum-schema`.
- Ningún archivo fuera de los cinco listados en "Archivos permitidos" queda modificado.
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

La tarea termina cuando la precondición bloqueante está resuelta (el archivo fuente existe), los criterios de aceptación se cumplen, y la secuencia de validación se ejecuta sin errores — **o** cuando Codex reporta explícitamente qué materias o datos quedaron fuera por no estar completos en la fuente, sin haberlos inventado. Codex entrega el resumen indicado en `AGENTS.md`, incluyendo cualquier dato omitido por incompleto, y se detiene, sin iniciar TASK-004.5 ni ninguna otra tarea.
