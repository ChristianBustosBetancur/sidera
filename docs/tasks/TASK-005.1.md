# TASK-005.1 — Primera vista curricular (Component → Grouping → VersionCourse)

## Objetivo

Construir en `apps/web` una primera vista funcional del plan oficial de Ciencias de la Computación (Acuerdo 0018 de 2024), organizada exactamente por la jerarquía de datos real — `Component → Grouping → VersionCourse` — sin inventar semestres ni ningún otro agrupamiento que el dataset no tenga.

Debe ser útil, no una demo vacía: consumir el dataset real, mostrar información real por materia, y usar el motor curricular real para estado y progreso.

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

Aplicación directa de `docs/AGENT_REVIEW_POLICY.md`: esta vista tiene estado interactivo real (trayectoria del estudiante), lo que la clasifica como "UI interactiva o compleja".

## Contexto mínimo

- `packages/curriculum-snapshot/src/data/unal-cs-2024-official/index.ts` — el dataset real (`unalCs2024Official`): university, academicProgram, curriculumPlan, planVersion, components, groupings, courses, versionCourses. Ya cerrado, no se modifica.
- `packages/curriculum-engine/src/index.ts` — `deriveVersionCourseState`, `calculatePlanProgress`, y los tipos `CurriculumEvaluationContext`, `StudentTrajectory`, `DerivedCourseState`, `PlanProgressResult`. Ya cerrado, no se modifica.
- `packages/curriculum-domain/src/entities.ts` — formas de `VersionCourse`, `Course`, `Component`, `Grouping` (créditos, `mandatory`, nombres, `requiredCredits`).
- `apps/web/app/page.tsx`, `layout.tsx`, `globals.css` — el placeholder actual, a reemplazar por contenido real.
- `apps/web/package.json` — sin dependencias de workspace todavía.
- `docs/PERFORMANCE.md` — dispositivo de referencia gama baja; JS inicial limitado; carga diferida de lo no esencial; sin efectos visuales permanentes; cálculos curriculares locales y rápidos.
- `docs/PRODUCT.md` — MVP: visualización del árbol, estados de materia, progreso académico, rápido en gama baja.
- `AGENTS.md` no aplica aquí en el sentido de "backend": esta TASK vive en `apps/web`, no en `packages/curriculum-*`. Sigue aplicando para las reglas generales de alcance de Codex como implementador.
- Este documento (las decisiones de abajo son vinculantes).

## Decisiones aprobadas

1. **Organización única de esta vista: `Component → Grouping → VersionCourse`.** Sin semestres, sin niveles, sin ningún agrupamiento derivado — el dataset no los tiene. Los niveles derivados del grafo de prerrequisitos son TASK-005.2, una capa distinta, no esta.
2. **Trayectoria del estudiante en estado local de React** (`useState`/`useReducer`, sin librería de estado externa). Sin backend, sin persistencia, sin `localStorage` todavía — se pierde al recargar, y eso es aceptable para esta iteración.
3. **Interacción mínima de trayectoria**: cada `VersionCourse` cuyo estado derivado no sea `BLOCKED` debe poder marcarse por el usuario como `IN_PROGRESS` o `COMPLETED` (y volver a "sin marcar"), actualizando la trayectoria y, en cascada, el estado derivado de las demás materias. La forma exacta de la interacción (checkbox, botón, ciclo de estados) queda a criterio de la implementación.
4. **Estado por materia via `deriveVersionCourseState`**, no reimplementado en la UI. La vista nunca decide por su cuenta si una materia está `AVAILABLE`/`BLOCKED`/`COMPLETED`/`IN_PROGRESS` — siempre pregunta al engine con el `CurriculumEvaluationContext` construido desde el dataset y la trayectoria actual.
5. **Progreso agregado via `calculatePlanProgress`**, con `requiredCredits` tomado de `unalCs2024Official.planVersion.requiredCredits` (146) — nunca hardcodeado. Se muestra de forma visible en la parte superior de la vista (créditos completados, créditos requeridos, y el `ratio`).
6. **Contenido mínimo por `VersionCourse`**: nombre (via `Course.name` referenciado por `courseId`), `academicCode`, `credits`, distinción visual obligatoria/electiva (`mandatory`), y su estado derivado. Prerrequisitos y correquisitos se listan como texto (p. ej. "Prerrequisito: 1000004-M Cálculo diferencial") — **no** como grafo visual; eso es TASK-005.2.
7. **Distinción obligatoria/electiva**: visualmente clara (color, badge o icono), sin depender solo de texto pequeño ilegible en móvil.
8. **Sin dependencias visuales nuevas.** CSS plano o CSS Modules únicamente (`*.module.css`, ya soportado nativamente por Next.js sin configuración adicional). Ninguna librería de UI, de iconos, de gráficos ni de animación.
9. **Rendimiento**: sin animaciones en bucle ni efectos visuales continuos (`docs/PERFORMANCE.md`). El árbol completo (60 materias) se renderiza sin virtualización — es un volumen pequeño y no la justifica. Ningún cálculo de estado o progreso se repite innecesariamente entre renders (memoización donde el propio React lo pida, sin sobre-ingeniería).
10. **Responsive y usable en móvil**: sin diseño fijo pensado solo para escritorio; los `Grouping` deben poder recorrerse y sus materias leerse cómodamente en una pantalla angosta (real, sin simular con devtools únicamente si es posible).
11. **Sin 3D, sin backend, sin base de datos, sin API routes de Next.js para esto.** Todo el cálculo ocurre en el cliente, a partir de datos importados en build time del paquete `@sidera/curriculum-snapshot`.
12. **`apps/web/package.json` gana dependencias de workspace**: `@sidera/curriculum-snapshot`, `@sidera/curriculum-engine`, `@sidera/curriculum-domain` (`workspace:*`), siguiendo el mismo patrón ya usado en `curriculum-engine`/`curriculum-snapshot` para sus propias dependencias internas.
13. **Se reemplaza el contenido de `apps/web/app/page.tsx`** por la vista real. La ruta exacta (todo en `/`, o `/` enlazando a `/plan`) queda a criterio de la implementación, pero la vista debe ser alcanzable navegando la app desde `/` sin pasos adicionales.

## Alcance permitido

```
apps/web/package.json                 (+3 dependencias de workspace)
apps/web/app/**                       (page.tsx, layout.tsx, nuevos componentes, *.module.css, nueva(s) ruta(s) si se usan)
apps/web/lib/**                       (opcional — helpers de construcción de CurriculumEvaluationContext/StudentTrajectory a partir del dataset, si conviene aislarlos)
pnpm-lock.yaml                        (regenerado por pnpm install, no editado a mano)
```

Ningún otro archivo debe modificarse. En particular: nada bajo `packages/**`, `apps/admin/**`, `docs/**` salvo este propio documento, `tools/agent/**`, ni `.github/workflows/**`.

## Fuera de alcance

- Grafo visual de prerrequisitos/correquisitos, niveles derivados del grafo — TASK-005.2.
- Integración/auditoría completa de fidelidad del dataset en la experiencia — TASK-005.3.
- Persistencia de la trayectoria (`localStorage`, backend, cuentas de usuario).
- 3D, animaciones no triviales, librerías de UI/gráficos/iconos.
- Cambiar `packages/curriculum-domain`, `curriculum-schema`, `curriculum-engine` o `curriculum-snapshot` — si algo pareciera faltar ahí, **detente y pregunta**; no lo añadas ni lo modifiques.
- `apps/admin`.
- Modo rendimiento explícito conmutable (`docs/PERFORMANCE.md`, "Modo rendimiento") — se prioriza rendimiento por defecto en esta TASK, pero un toggle explícito es una tarea posterior.
- Presupuestos numéricos de rendimiento (tamaño de bundle, TTI, FPS) — `docs/PERFORMANCE.md` los deja pendientes explícitamente; no se inventan aquí.
- Refactors o renombrados no solicitados en `apps/web`.
- TASK-005.2 o cualquier tarea posterior.

## Contrato de datos esperado (forma conceptual, no literal)

- `CurriculumEvaluationContext` se construye una vez a partir de `unalCs2024Official.versionCourses`, `unalCs2024Official.groupings`, `unalCs2024Official.components`, con `planVersionId: unalCs2024Official.planVersion.id`.
- `StudentTrajectory` (`completedVersionCourseIds`, `inProgressVersionCourseIds`) vive en el estado de React, derivada de la interacción del usuario.
- Para cada `VersionCourse`, `deriveVersionCourseState(versionCourseId, context, trajectory)` da el estado a mostrar.
- `calculatePlanProgress(context, trajectory, unalCs2024Official.planVersion.requiredCredits)` da el progreso agregado a mostrar.

## Criterios de aceptación

- Las 60 materias del dataset oficial aparecen en la vista, agrupadas por `Component` y dentro de cada uno por `Grouping`, en ese orden jerárquico.
- Cada materia muestra nombre, código, créditos, si es obligatoria o electiva, su estado derivado, y sus prerrequisitos/correquisitos (si tiene) como texto legible.
- El progreso agregado (créditos completados / `requiredCredits` = 146, y el `ratio`) es visible sin interacción adicional.
- Marcar una materia como completada/en curso actualiza su propio estado y el de las materias que dependen de ella, vía `deriveVersionCourseState` — verificable manualmente con al menos una cadena de prerrequisitos real del dataset (p. ej. completar `1000004-M` debe cambiar el estado de `1000005-M`).
- Ningún cálculo de elegibilidad, estado o progreso está reimplementado en la UI — todo pasa por `@sidera/curriculum-engine`.
- No hay semestres, niveles ni ningún agrupamiento inventado.
- Cero dependencias nuevas fuera de los tres paquetes de workspace de la decisión 12.
- La vista es usable en una ventana estrecha (móvil) sin overflow horizontal ni texto ilegible.
- `pnpm --filter web dev` sirve la vista sin errores de consola.
- Ningún archivo fuera de "Archivos permitidos" queda modificado.
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

La tarea termina cuando los criterios de aceptación se cumplen y la secuencia de validación se ejecuta sin errores. Codex entrega el resumen indicado en `AGENTS.md` y se detiene, sin iniciar TASK-005.2 ni ninguna otra tarea.
