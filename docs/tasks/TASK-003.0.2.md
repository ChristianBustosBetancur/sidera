# TASK-003.0.2 — Multi-program domain foundation

## Objetivo

Introducir en el dominio la jerarquía institucional mínima `University → AcademicProgram → CurriculumPlan → PlanVersion`, y dar a `Course` un dueño institucional (`University`), de modo que Sidera pueda soportar varios programas académicos sin duplicar asignaturas compartidas.

Es una tarea de **tipos y contratos**. No hay lógica nueva, ni algoritmos, ni comportamiento, ni datos reales.

Ciencias de la Computación será simplemente el primer `AcademicProgram`. El núcleo permanece genérico y no debe contener ninguna referencia a Ciencias de la Computación.

## Contexto mínimo

- `docs/tasks/TASK-002.md` — modelo estructural cerrado (entidades, hojas, combinadores). Sus decisiones siguen vigentes.
- `docs/tasks/TASK-003.md` — motor de evaluación. Su decisión 12 (ámbito = una única `PlanVersion`) sigue vigente.
- `packages/curriculum-domain/src/` — entidades e identificadores actuales.
- `packages/curriculum-schema/src/` — esquemas espejo.
- `docs/DOMAIN.md`, `docs/ARCHITECTURE.md` — documentos a alinear.
- `AGENTS.md` — reglas de alcance.
- Este documento (las decisiones de abajo son vinculantes).

Estado de partida relevante:

- `CurriculumPlan` es hoy la raíz absoluta del grafo: no tiene padre.
- `Course` está hoy huérfana: `{ id, name }`, sin dueño. TASK-002 dejó fuera de alcance la multiinstitución de forma deliberada; esta tarea cierra ese hueco.
- `Component` cuelga de `PlanVersion` (no de `CurriculumPlan`). **No cambia.**
- Precedente vinculante de TASK-002 decisión 8: `VersionCourse` **no** duplica `componentId`; su `Component` se deriva de su `Grouping`, y existe un test que rechaza activamente `componentId` en `VersionCourse`.

## Decisiones aprobadas

Aprobadas por decisión humana. **No se re-discuten ni se sustituyen por alternativas "mejores".**

### A. Dueño de `Course`

`Course` pertenece a `University` y lleva `universityId` **obligatorio**.

`Course` **no** pertenece a `AcademicProgram`. `Course` **no** permanece global.

Motivo: una misma asignatura institucional debe poder ser compartida por varios programas sin duplicarla artificialmente.

```
University
├── Course "Cálculo Diferencial"
└── AcademicProgram
    ├── Ciencias de la Computación
    └── otro programa
```

Ambos programas usan el mismo `Course` mediante distintos `VersionCourse`.

### B. Sin atributos adicionales

**No** incluir `slug`. **No** incluir `shortName`.

- `University`: únicamente `id`, `name`.
- `AcademicProgram`: únicamente `id`, `universityId`, `name`.

No añadir ningún otro atributo.

### C. Cardinalidad `AcademicProgram → CurriculumPlan`

El modelo debe **permitir** múltiples `CurriculumPlan` por `AcademicProgram`. No se asume que existan varios simultáneamente. **No** imponer relación 1:1. Esta decisión **no** añade ningún campo: la cardinalidad ya queda expresada por `CurriculumPlan.academicProgramId`.

### D. Obligatoriedad

Son **obligatorios**, sin excepción:

- `AcademicProgram.universityId`
- `CurriculumPlan.academicProgramId`
- `Course.universityId`

**No** usar campos opcionales por compatibilidad. No hay datos reales cargados; un campo opcional produciría dos formas válidas de la misma entidad para siempre.

### E. Nivel del programa

**No** incluir pregrado/posgrado. **No** incluir `Degree` ni ningún atributo equivalente.

### F. Documentación alineada

Entran en el alcance mínimo `docs/DOMAIN.md` y `docs/ARCHITECTURE.md`, **solo** para mantener la documentación alineada con el nuevo modelo.

`docs/DOMAIN.md` debe documentar mínimamente:

```
University → AcademicProgram → CurriculumPlan → PlanVersion
University → Course
```

`docs/ARCHITECTURE.md` debe actualizarse **únicamente** en lo necesario para reflejar que `CurriculumPlan` ya no es la raíz conceptual absoluta.

**No** hacer refactors documentales ni reescrituras generales. **No** tocar ninguna otra sección de esos documentos.

### G. Identificación de la tarea

Esta tarea es `TASK-003.0.2`. No existe `TASK-003.0A`.

### H. Regla `Course` / `VersionCourse` (decisión arquitectónica explícita)

`Course` representa la **identidad institucional compartida** de una asignatura.
`VersionCourse` representa **cómo esa asignatura participa dentro de una `PlanVersion` concreta**.

Por tanto:

- `Course` **no** contiene `requirements`.
- Los `requirements` pertenecen a `VersionCourse`.
- Dos `VersionCourse` que apunten al mismo `Course` **pueden** tener `requirements` diferentes. **Esto es válido por diseño y no es un error de modelado.**
- Compartir `CourseId` significa **identidad compartida de asignatura**, **no** identidad curricular.
- `groupingId`, `credits`, `academicCode` y `requirements` siguen siendo **contextuales a `VersionCourse`**.

Ejemplo conceptual:

```
Course: "Cálculo Diferencial", universityId = UNAL

VersionCourse dentro de Ciencias de la Computación:
  courseId     = <ese Course>
  requirements = requisito A

VersionCourse dentro de otro programa:
  courseId     = <ese mismo Course>
  requirements = requisito B
```

Ambos representan la misma asignatura institucional con reglas curriculares diferentes.

Consecuencias explícitas de esta decisión:

- **No** crear `ProgramCourse`.
- **No** introducir ninguna relación N:M programa↔materia. `VersionCourse` ya resuelve ese contexto con más precisión (por versión, no por programa).
- **No** modificar `curriculum-engine` para anticipar doble titulación. El engine sigue evaluando una sola `PlanVersion`.

### Regla general de referencias

**Cada entidad referencia únicamente a su padre inmediato cuando corresponda. Los ancestros se derivan por navegación y no se denormalizan.**

Referencias válidas:

```
AcademicProgram → University
CurriculumPlan  → AcademicProgram
PlanVersion     → CurriculumPlan
Course          → University
Grouping        → Component
VersionCourse   → PlanVersion, Course, Grouping
```

**No** añadir:

- `universityId` a `CurriculumPlan`
- `universityId` a `PlanVersion`
- `academicProgramId` a `PlanVersion`
- `componentId` a `VersionCourse` (ya prohibido en TASK-002)
- ningún otro ancestro redundante

Si alguna de estas decisiones resulta insuficiente para modelar algo, **pregunta antes de asumir**; no la extiendas silenciosamente.

## Modelo final esperado

```
University          { id, name }
   └─ AcademicProgram   { id, universityId, name }
        └─ CurriculumPlan   { id, academicProgramId, name }
             └─ PlanVersion     { id, curriculumPlanId, name, provenance, lifecycle }   ← SIN CAMBIOS
                  ├─ Component      { id, planVersionId, name }                          ← SIN CAMBIOS
                  │    └─ Grouping      { id, componentId, name }                        ← SIN CAMBIOS
                  └─ VersionCourse  { id, planVersionId, courseId, groupingId,
                                      academicCode, credits, requirements? }             ← SIN CAMBIOS

University
   └─ Course           { id, universityId, name }     ← catálogo institucional, transversal a programas
```

Diff conceptual respecto al estado actual del dominio:

```diff
+ export type University = {
+   id: UniversityId;
+   name: string;
+ };
+
+ export type AcademicProgram = {
+   id: AcademicProgramId;
+   universityId: UniversityId;
+   name: string;
+ };

  export type CurriculumPlan = {
    id: CurriculumPlanId;
+   academicProgramId: AcademicProgramId;
    name: string;
  };

  export type Course = {
    id: CourseId;
+   universityId: UniversityId;
    name: string;
  };
```

Identificadores nuevos: `UniversityId`, `AcademicProgramId` (mismo patrón `OpaqueId<Name>` existente). Total tras la tarea: 8 IDs opacos.

**Cuatro campos nuevos en total. Ninguna entidad existente pierde nada, se elimina ni se renombra. `PlanVersion`, `Component`, `Grouping` y `VersionCourse` quedan estructuralmente intactos.**

## Invariantes

Invariantes que **esta tarea debe garantizar** (verificables por tipo o por esquema, entidad a entidad):

1. `AcademicProgram` referencia exactamente una `University`, obligatoriamente.
2. `CurriculumPlan` referencia exactamente un `AcademicProgram`, obligatoriamente, y **no** referencia `University`.
3. `Course` referencia exactamente una `University`, obligatoriamente.
4. `PlanVersion` referencia **únicamente** `CurriculumPlan`. No conoce programa ni universidad.
5. `Course` **no** contiene `requirements`, `credits`, `academicCode` ni `groupingId`.
6. `VersionCourse` conserva `requirements`, `credits`, `academicCode` y `groupingId`, y **no** contiene `componentId` (invariante preexistente de TASK-002, que debe seguir verificándose).
7. Los esquemas son `strictObject`: cualquier campo ancestro denormalizado es rechazado.
8. Un mismo `CourseId` puede aparecer en `VersionCourse` de distintas `PlanVersion` con `requirements` distintos, y ambos son estructuralmente válidos.

Invariantes que **esta tarea NO puede garantizar** — ver "Deuda explícita para curriculum-validator".

## Alcance permitido

**En `packages/curriculum-domain`** (TypeScript puro, sin dependencias de runtime):

- `UniversityId` y `AcademicProgramId` en `identifiers.ts`, siguiendo el patrón `OpaqueId<Name>` existente.
- Tipos `University` y `AcademicProgram` en `entities.ts`.
- Campo `academicProgramId` en `CurriculumPlan`.
- Campo `universityId` en `Course`.
- Exports correspondientes en `index.ts`.

**En `packages/curriculum-schema`**:

- Esquemas de ID espejo: `universityIdSchema`, `academicProgramIdSchema`.
- Esquemas de entidad espejo: `universitySchema`, `academicProgramSchema`, ambos `z.strictObject`.
- Los dos campos nuevos en `curriculumPlanSchema` y `courseSchema`, obligatorios.
- Exports correspondientes en `index.ts`.
- Sin dependencias nuevas (`zod` ya está presente).

**Pruebas**: Vitest, junto al código, en `packages/curriculum-schema/src/**/*.test.ts`. Actualizar los fixtures existentes que dejen de compilar o de validar, y añadir los casos listados más abajo. Todos los datos de prueba deben ser **ficticios y mínimos**.

**Documentación** (decisión F, alcance estrictamente aditivo):

- `docs/DOMAIN.md`: añadir el vocabulario de `University` y `AcademicProgram`, y las dos cadenas de pertenencia. Añadir una nota mínima sobre la regla `Course` / `VersionCourse` de la decisión H.
- `docs/ARCHITECTURE.md`: ajustar únicamente lo necesario para reflejar que `CurriculumPlan` ya no es la raíz conceptual absoluta.

## Fuera de alcance

- **`packages/curriculum-engine`: cero cambios.** Ver criterio de aceptación 10.
- `curriculum-validator`, `curriculum-snapshot`, `curriculum-importer`, `packages/database`.
- `apps/web`, `apps/admin`, cualquier frontend, ruteo o presentación.
- Base de datos, esquema SQL, migraciones, APIs, despliegue.
- Datos reales de la Universidad Nacional de Colombia.
- Fixture completo de Ciencias de la Computación, o de cualquier programa real.
- Doble titulación, homologaciones, equivalencias, comparación cross-program, reconocimiento cross-program.
- `ProgramCourse` o cualquier relación N:M programa↔materia.
- `Faculty`, `Department`, `Campus`, `Degree`, `School`, SNIES, país/región, o cualquier otra estructura administrativa.
- `slug`, `shortName`, nivel pregrado/posgrado.
- `provenance` o `lifecycle` en `University` o `AcademicProgram` — son propiedades de la versión del plan, no de la institución.
- Validación de invariantes de grafo entre entidades (ver deuda para `curriculum-validator`).
- Refactors no solicitados, renombrados, reordenaciones o limpiezas, aunque el código lo sugiera.
- Reescritura general de `docs/DOMAIN.md` o `docs/ARCHITECTURE.md`.
- `TASK-003.1`, `TASK-004` o cualquier tarea posterior.

## Archivos permitidos

```
packages/curriculum-domain/src/identifiers.ts     (+2 IDs opacos)
packages/curriculum-domain/src/entities.ts        (+2 tipos, +2 campos)
packages/curriculum-domain/src/index.ts           (+exports)
packages/curriculum-schema/src/identifiers.ts     (+2 esquemas de ID)
packages/curriculum-schema/src/entities.ts        (+2 esquemas, +2 campos)
packages/curriculum-schema/src/index.ts           (+exports)
packages/curriculum-schema/src/schema.test.ts     (fixtures + casos nuevos)
docs/DOMAIN.md                                    (vocabulario nuevo, aditivo)
docs/ARCHITECTURE.md                              (solo la raíz conceptual)
```

Ningún otro archivo debe modificarse. En particular: **ningún archivo bajo `packages/curriculum-engine/`**, ningún `package.json`, ni `pnpm-lock.yaml` (no hay dependencias nuevas).

## Impacto esperado por package

| Package | Impacto | Detalle |
|---|---|---|
| `curriculum-domain` | **Sí — cambio principal** | +`UniversityId`, +`AcademicProgramId`, +`University`, +`AcademicProgram`, +`academicProgramId` en `CurriculumPlan`, +`universityId` en `Course`, +exports. Sigue sin dependencias de runtime |
| `curriculum-schema` | **Sí — espejo mecánico** | +2 esquemas de ID, +2 esquemas de entidad `strictObject`, +2 campos obligatorios, +exports. Sin dependencias nuevas |
| tests | **Sí** | `schema.test.ts`: los fixtures de `curriculumPlanSchema` y `courseSchema` dejarán de validar y deben actualizarse; añadir los casos mínimos listados abajo |
| `curriculum-engine` | **Ninguno — verificable** | No importa `Course` ni `CurriculumPlan`; su contexto de evaluación está anclado en `PlanVersionId` y solo contiene `VersionCourse`, `Grouping`, `Component`, ninguno de los cuales cambia |
| `curriculum-validator` | **Ninguno ahora** | Recibe deuda explícita (abajo) |
| `curriculum-snapshot` | **Ninguno ahora** | Recibirá trabajo futuro (nota abajo) |
| `curriculum-importer` | **Ninguno ahora** | Fuera de alcance |
| `database` | **Ninguno ahora** | El esquema SQL sigue sin definirse |
| `apps/web`, `apps/admin` | **Ninguno** | Fuera de alcance |
| `pnpm-lock.yaml` | **Ninguno** | Sin dependencias nuevas |

Nota sobre `packages/curriculum-domain/src/requirements.test.ts`: **sin impacto**. No referencia `Course` ni `CurriculumPlan`.

## Criterios de aceptación

1. `curriculum-domain` sigue sin ninguna dependencia de runtime (tampoco Zod).
2. Existen los tipos `University` y `AcademicProgram` con exactamente los campos aprobados en la decisión B, ni uno más.
3. `UniversityId` y `AcademicProgramId` son IDs opacos, siguiendo el patrón `OpaqueId<Name>` ya existente.
4. `CurriculumPlan` tiene `academicProgramId` obligatorio y **no** tiene `universityId`.
5. `Course` tiene `universityId` obligatorio y **no** tiene `requirements`, `credits`, `academicCode` ni `groupingId`.
6. `PlanVersion` conserva exactamente sus campos actuales: **no** se le añade `academicProgramId` ni `universityId`.
7. `Component`, `Grouping` y `VersionCourse` quedan estructuralmente sin cambios; `VersionCourse` sigue sin `componentId` y sigue conservando `requirements`.
8. Los esquemas nuevos son `z.strictObject` y los campos nuevos son obligatorios, no opcionales.
9. Los esquemas rechazan los campos ancestro denormalizados prohibidos.
10. **`packages/curriculum-engine/**` permanece intacto**: `git diff --stat` no muestra ningún archivo de ese directorio. Es una prueba de regresión arquitectónica: si el engine necesitara cambiar, el modelo estaría mal.
11. No se introduce `ProgramCourse` ni ninguna relación N:M programa↔materia.
12. No aparece "Ciencias de la Computación", "UNAL" ni ningún dato institucional real en `packages/**`. Los fixtures de prueba son ficticios y mínimos.
13. No se añade ninguna de las estructuras prohibidas (`Faculty`, `Department`, `Campus`, `Degree`, `School`, SNIES, país/región, `slug`, `shortName`, nivel).
14. `docs/DOMAIN.md` documenta las dos cadenas de pertenencia y la regla `Course`/`VersionCourse`, sin reescribir secciones existentes.
15. `docs/ARCHITECTURE.md` refleja que `CurriculumPlan` ya no es la raíz conceptual absoluta, sin otros cambios.
16. El diff se limita estrictamente a la lista de archivos permitidos.
17. La secuencia de validación se ejecuta sin errores y la suite de pruebas pasa completa.

## Casos de prueba mínimos

En `packages/curriculum-schema/src/schema.test.ts`, con datos ficticios:

1. `universitySchema` valida `{ id, name }`.
2. `universitySchema` rechaza un objeto con un campo extra (`strictObject`).
3. `academicProgramSchema` valida `{ id, universityId, name }`.
4. `academicProgramSchema` rechaza un `AcademicProgram` **sin** `universityId` (obligatoriedad).
5. `curriculumPlanSchema` valida `{ id, academicProgramId, name }`.
6. `curriculumPlanSchema` rechaza un `CurriculumPlan` **sin** `academicProgramId`.
7. `curriculumPlanSchema` rechaza un `CurriculumPlan` que incluya `universityId` (ancestro denormalizado).
8. `courseSchema` valida `{ id, universityId, name }`.
9. `courseSchema` rechaza un `Course` **sin** `universityId`.
10. `courseSchema` rechaza un `Course` que incluya `requirements` (decisión H: los requisitos no viven en `Course`).
11. `planVersionSchema` rechaza un `PlanVersion` que incluya `academicProgramId`, y rechaza uno que incluya `universityId`.
12. **Caso central de la decisión H:** dos `VersionCourse` distintos, en dos `PlanVersion` distintas, con el **mismo** `courseId` y `requirements` **diferentes**, validan ambos correctamente. Este test documenta que compartir `CourseId` es identidad de asignatura, no identidad curricular.
13. Invariante preexistente preservado: `versionCourseSchema` sigue rechazando `componentId`.
14. Invariante preexistente preservado: el mismo `academicCode` en dos `PlanVersion` distintas sigue siendo válido.

Los casos existentes de TASK-002 que sigan aplicando deben seguir pasando; solo se actualizan los fixtures que los campos obligatorios nuevos invalidan.

## Comandos de validación

```
pnpm install
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

Verificación adicional del criterio 10:

```
git diff --stat -- packages/curriculum-engine
```

Debe devolver salida vacía.

## Deuda explícita que queda para `curriculum-validator`

Esta tarea deja **conscientemente sin verificar** el siguiente invariante de grafo:

> Un `CurriculumPlan` perteneciente a un `AcademicProgram` de la universidad A no debe contener `VersionCourse` que referencien `Course` de la universidad B.

Es un invariante **entre entidades**, no de forma de una entidad aislada. `z.strictObject` valida entidades una a una y estructuralmente **no puede** cruzarlas. **No debe intentarse resolver en Zod**, ni con `superRefine`, ni con validaciones cruzadas dentro de `curriculum-schema`.

Corresponde a `curriculum-validator`, en una tarea posterior, junto con el resto de la integridad referencial del grafo curricular (misma lógica ya establecida en TASK-003 decisión 9, donde las referencias no resueltas producen diagnóstico en el engine y la integridad completa se delega al validador).

Queda registrado que existe una ventana entre esta tarea y la del validador durante la cual el invariante existe conceptualmente pero nadie lo verifica. Es aceptable porque no hay datos reales cargados.

## Nota futura sobre cross-program y doble titulación (registro — NO implementar)

La decisión H deja abierta, sin implementarla, la capacidad de:

- doble titulación;
- comparación entre programas;
- materias compartidas entre programas;
- reconocimiento cross-program;
- equivalencias y homologaciones.

Todo eso queda **fuera de alcance ahora**. En particular:

- **No** modificar `curriculum-engine` para anticiparlo. El engine sigue evaluando una sola `PlanVersion` (TASK-003 decisión 12).
- **No** añadir entidades, campos ni relaciones "preparatorias".

Registro técnico para la tarea futura que lo aborde: mientras el ámbito de evaluación sea una única `PlanVersion`, el engine no necesita conocer `Course`. Si en el futuro se aborda homologación o comparación entre versiones, el engine sí tendría que resolver `Course` para reconocer que dos `VersionCourse` distintos son la misma asignatura institucional. Eso no cambia nada hoy.

Registro adicional para `curriculum-snapshot`: un snapshot de `PlanVersion` destinado al cliente probablemente deba incluir el nombre del programa y de la universidad para poder mostrarlos. Se resolverá en la tarea de snapshot, no aquí.

## Condición exacta de terminación

La tarea termina cuando los criterios de aceptación se cumplen, los casos de prueba mínimos existen y pasan, `git diff --stat -- packages/curriculum-engine` devuelve salida vacía, y la secuencia de validación se ejecuta sin errores.

Codex **no** hace commit y **no** hace push. Implementa, valida, revisa su propio diff, entrega el resumen indicado en `AGENTS.md` —confirmando explícitamente que no modificó `curriculum-engine` ni ningún archivo fuera de la lista de archivos permitidos— y se detiene, sin iniciar `TASK-003.1` ni ninguna otra tarea.

El commit lo realiza una persona después de la revisión humana.
