# TASK-002 — Primer modelo curricular estructural

## Objetivo

Definir el modelo curricular **estructural** en TypeScript puro (`curriculum-domain`) y su validación estructural con Zod (`curriculum-schema`). Sin evaluación de reglas, sin estudiante, sin persistencia.

## Contexto mínimo

- `docs/DOMAIN.md` — vocabulario del dominio.
- `docs/ARCHITECTURE.md` — separación entre paquetes.
- `AGENTS.md` — reglas de alcance para Codex.
- Este documento (las decisiones de dominio de abajo son vinculantes).

## Decisiones de dominio obligatorias

Estas decisiones ya están aprobadas. No se re-discuten ni se sustituyen por alternativas "mejores".

1. **Requisitos como árbol de expresiones**, nunca listas planas. Los nodos combinadores conceptuales son `ALL`, `ANY`, `AT_LEAST`. Los casos triviales deben seguir siendo simples de construir y de leer.
2. **Modelo unificado `RequirementExpression`** con nodos y hojas discriminados. Prerrequisitos, correquisitos y requisitos por créditos comparten la misma estructura; la semántica se distingue por el tipo de hoja (`RequirementLeaf`), por ejemplo: `COURSE_COMPLETED`, `COURSE_COMPLETED_OR_CONCURRENT`, `MIN_TOTAL_CREDITS`, `MIN_COMPONENT_CREDITS`. **No** se crean tres motores de reglas separados.
3. **Electivas**: el dominio debe poder expresar requisitos que no son materias concretas (mínimo de créditos o mínimo de materias dentro de una agrupación). **No** se modelan como materias ficticias. TASK-002 solo define su estructura; evaluarlos corresponde a tareas posteriores.
4. **Identidad**: los IDs son internos, opacos y estables. El código académico es un atributo y **no** se asume globalmente único ni sirve como identidad. Separación obligatoria entre `Course` (identidad estable de la materia) y `VersionCourse` (esa materia dentro de una versión de plan). `PlanVersion` tiene ID interno independiente de su nombre, año, periodo o referencia oficial.
5. **Procedencia y ciclo de vida son dos conceptos separados**, no un único enum:
   - `provenance`: `official` | `proposal` | `community`
   - `lifecycle`: `draft` | `published` | `archived`

   Ambos pertenecen a `curriculum-domain`.
6. **Correquisitos**: relaciones dirigidas. No asumir simetría.
7. **Créditos**: enteros. Sin horas ni desglose teórico/práctico.
8. **Jerarquía curricular `Component` → `Grouping` → `VersionCourse`**:
   - `Component` representa el nivel oficial amplio del plan curricular.
   - `Grouping` representa una agrupación curricular dentro de un `Component`; cada `Grouping` pertenece **exactamente a un** `Component`.
   - Cada `VersionCourse` pertenece **exactamente a una** `Grouping` curricular oficial.
   - `VersionCourse` **no** duplica `componentId`: su `Component` se deriva de su `Grouping`.
   - `MIN_COMPONENT_CREDITS` referencia un `Component`.
   - Los requisitos electivos (mínimo de créditos o mínimo de materias dentro de un conjunto) referencian una `Grouping`.
   - **No** se modela todavía pertenencia múltiple de una materia a varias `Grouping`.
   - Líneas de énfasis, tags y clasificaciones futuras permanecen separadas de esta jerarquía curricular. No añadir complejidad sin evidencia del currículo oficial.
9. **Estado académico**: siempre derivado; **no** es estado persistente de `VersionCourse`.
10. `curriculum-domain` permanece TypeScript puro y **no** depende de Zod. `curriculum-schema` puede depender de `curriculum-domain` y de Zod.

Si alguna de estas decisiones resulta insuficiente para modelar algo, **pregunta antes de asumir**; no la extiendas silenciosamente.

## Alcance permitido

**En `packages/curriculum-domain`** (TypeScript puro, sin dependencias):

- Tipos e identificadores de: `CurriculumPlan`, `PlanVersion`, `Course`, `VersionCourse`, `Component`, `Grouping`.
- `RequirementExpression` y `RequirementLeaf` como unión discriminada, con los combinadores `ALL`, `ANY`, `AT_LEAST` y los tipos de hoja indicados en la decisión 2.
- Requisitos estructurales de tipo electivo (mínimos de créditos o de número de materias dentro de una agrupación).
- Enums/uniones de `provenance` y `lifecycle`.
- Constructores o helpers mínimos para expresar casos triviales de forma legible (por ejemplo, un único prerrequisito). Nada más.

**En `packages/curriculum-schema`**:

- Esquemas Zod que validen estructuralmente las entidades anteriores, incluyendo la recursividad de `RequirementExpression`.
- Tipos derivados de los esquemas, alineados con los de `curriculum-domain` (sin duplicar la definición conceptual).
- Dependencias nuevas permitidas: `zod` en `curriculum-schema`, y la dependencia de workspace a `@curriculum-universe/curriculum-domain`.

**Pruebas**: Vitest, colocadas junto al código (`packages/*/src/**/*.test.ts`).

## Fuera de alcance

- Progreso del estudiante, estado académico calculado, materias aprobadas o en curso, historial del estudiante.
- `curriculum-engine`, cálculo de desbloqueos, razones de bloqueo, simulación de semestre.
- Evaluación de expresiones de requisitos (solo se define su estructura).
- Homologaciones y equivalencias.
- Entidad `Institución` / multiinstitución.
- `curriculum-validator`, `curriculum-snapshot`, `curriculum-importer`, `database`.
- Base de datos, esquema SQL, migraciones, Supabase, APIs, frontend, despliegue.
- Datos curriculares reales (los ejemplos usados en pruebas deben ser ficticios y mínimos).
- Refactors no solicitados y cambios de nombre de packages o apps.
- TASK-003 o cualquier tarea posterior.

## Archivos permitidos

```
packages/curriculum-domain/src/**        (nuevos tipos + pruebas)
packages/curriculum-schema/src/**        (esquemas Zod + pruebas)
packages/curriculum-schema/package.json  (dependencias: zod, curriculum-domain)
pnpm-lock.yaml                           (consecuencia de instalar zod)
```

No debe modificarse ningún otro archivo. En particular: sin cambios en `apps/`, en la documentación, en la configuración raíz ni en los demás packages.

## Criterios de aceptación

- `curriculum-domain` no tiene ninguna dependencia en runtime (tampoco Zod).
- Existen los tipos de las nueve entidades listadas en el alcance, con IDs internos opacos separados de los códigos académicos.
- `RequirementExpression` es una unión discriminada recursiva que cubre `ALL`, `ANY`, `AT_LEAST` y los cuatro tipos de hoja indicados.
- `provenance` y `lifecycle` son conceptos independientes, no un enum combinado.
- Los requisitos electivos se expresan mediante hojas de requisito, no mediante materias ficticias, y referencian una `Grouping`.
- `Grouping` referencia exactamente un `Component`; `VersionCourse` referencia exactamente una `Grouping` y **no** tiene campo `componentId`.
- `MIN_COMPONENT_CREDITS` referencia un `Component`, no una `Grouping`.
- `VersionCourse` no contiene ningún campo de estado académico del estudiante.
- Los esquemas Zod validan y rechazan correctamente las estructuras anteriores.
- No se implementa evaluación de requisitos en ningún lugar.
- La secuencia de validación se ejecuta sin errores.

## Casos de prueba requeridos

Como mínimo:

1. Una expresión trivial de un solo prerrequisito (`COURSE_COMPLETED`) se construye y valida correctamente.
2. Una expresión anidada `ALL` que contiene un `ANY` valida correctamente.
3. `AT_LEAST` con su umbral valida, y se rechaza un umbral inválido (por ejemplo, cero o negativo).
4. Cada uno de los cuatro tipos de hoja valida su forma esperada.
5. Una hoja con `type` desconocido es rechazada por el esquema.
6. Un requisito electivo (mínimo de créditos o de materias en una `Grouping`) se representa sin recurrir a materias ficticias y referencia una `Grouping`.
6b. La jerarquía valida: un `Grouping` con su `componentId`, y un `VersionCourse` con su `groupingId`. Un `VersionCourse` que incluya `componentId` es rechazado por el esquema.
6c. `MIN_COMPONENT_CREDITS` valida referenciando un `Component`.
7. Un `VersionCourse` válido se valida; uno con código académico duplicado en otra versión **no** se considera inválido (los códigos no son globalmente únicos).
8. `provenance` y `lifecycle` aceptan sus valores permitidos y rechazan valores fuera de rango, de forma independiente entre sí.

## Comandos de validación

```
pnpm install
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

## Condición exacta de terminación

La tarea termina cuando los criterios de aceptación se cumplen, los casos de prueba requeridos existen y pasan, y la secuencia de validación se ejecuta sin errores. Al terminar, Codex debe entregar el resumen indicado en `AGENTS.md` y detenerse, sin iniciar TASK-003 ni ninguna otra tarea.
