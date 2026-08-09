# TASK-005.4 — Trayectoria única compartida entre las dos vistas

## Objetivo

Unificar la trayectoria del estudiante en **una sola fuente de verdad** consumida por la Vista Plan (`/`) y la Vista Explorar (`/grafo`), eliminando la duplicación actual de estado y de lógica de marcado. Hoy cada vista mantiene su propio `useState<StudentTrajectory>` y su propia copia literal de `markCourse`: marcar una materia en una vista no se refleja en la otra.

Esta tarea **no cambia nada visualmente** y **no añade persistencia**. Es exclusivamente una unificación de estado.

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

Aplicación directa de `docs/AGENT_REVIEW_POLICY.md`: "UI interactiva o compleja (estado, interacción, grafos, rendimiento)" → `claude-review` + `codex-qa`.

## Contexto mínimo

- `apps/web/app/curriculum-view.tsx` — Vista Plan. Su trayectoria vive en `useState<StudentTrajectory>` (línea ~205), y `markCourse` (línea ~226) contiene la lógica de marcado.
- `apps/web/app/graph-view.tsx` — Vista Explorar. Tiene **la misma** trayectoria local (línea ~136) y **la misma** función `markCourse` (línea ~221), copiada literalmente.
- `apps/web/lib/curriculum-data.ts` — módulo compartido ya existente: `evaluationContext`, `coursesById`, `versionCoursesById`, `componentsById`, `groupingsById`, `planVersionStatus`, `requirementLines`. Es el precedente de "helper compartido" en esta app.
- `apps/web/app/layout.tsx` — root layout (Server Component). Envuelve ambas rutas.
- `packages/curriculum-engine/src/index.ts` — `deriveVersionCourseState`, `StudentTrajectory`. No se modifica.

## Decisiones aprobadas

1. **Solución mínima: React Context + `useState`.** Un Provider cliente y un hook de acceso. **Prohibido** introducir Redux, Zustand, Jotai, MobX, un store global propio, o cualquier arquitectura de estado más compleja. Cero dependencias nuevas.
2. **El Provider vive en el root layout** (`apps/web/app/layout.tsx`), de forma que la trayectoria sobrevive a la navegación cliente entre `/` y `/grafo` mediante `<Link>`. `layout.tsx` sigue siendo Server Component: el Provider es un componente `"use client"` importado desde él, y `{children}` se le pasa como prop sin convertir las páginas en cliente.
3. **`layout.tsx` solo puede cambiar para envolver `{children}` con el Provider.** Está explícitamente prohibido tocar `<html lang="es">`, `<body>`, `metadata`, o añadir cualquier atributo/clase/script — ese elemento es el epicentro del hydration mismatch documentado en `docs/KNOWN_ISSUES.md` y esta tarea no lo investiga ni lo toca.
4. **El estado compartido expone exactamente tres cosas y nada más:**
   - `trajectory: StudentTrajectory` — la trayectoria única.
   - `states: ReadonlyMap<VersionCourseId, DerivedCourseState>` — estados derivados con `deriveVersionCourseState` sobre `evaluationContext`, memoizados por `trajectory`. Sustituye a los dos `useMemo` idénticos que hoy existen en cada vista.
   - `markCourse(versionCourseId, mark)` — la lógica de marcado, **movida sin cambios de comportamiento** desde las vistas.

   El tipo `Mark` (`"UNMARKED" | "IN_PROGRESS" | "COMPLETED"`), hoy declarado por duplicado en ambas vistas, pasa a declararse una sola vez en el módulo compartido y se importa desde ahí.
5. **Comportamiento idéntico al actual, sin excepciones.** `markCourse` conserva su semántica exacta (mover el id entre `completedVersionCourseIds` e `inProgressVersionCourseIds`, filtrando duplicados). No se añade validación nueva, no se impide marcar nada que hoy se pueda marcar, no se reordena la salida. Cualquier cambio de comportamiento es un defecto de esta tarea.
6. **`calculatePlanProgress` se queda donde está**, en `curriculum-view.tsx`. Es específico de la Vista Plan y moverlo no aporta nada a esta unificación.
7. **Sin persistencia.** Nada de `localStorage`, `sessionStorage`, cookies, URL ni backend. Al recargar la página, la trayectoria vuelve a vacío — igual que hoy. La persistencia es TASK-005.5 y añadirla aquí es scope expansion.
8. **Sin cambios visuales ni de interacción.** Mismas tarjetas, mismos botones, mismos textos, mismo CSS. Los tres botones siguen en cada nodo del grafo por ahora: quitarlos es TASK-005.7.
9. **Sin cambios en `packages/**`.** Si algo pareciera faltar en el engine, **detente y reporta** en vez de modificarlo.
10. **Estado inicial vacío**, definido una sola vez en el módulo compartido. Las constantes `EMPTY_TRAJECTORY` duplicadas en ambas vistas desaparecen.

## Alcance permitido

```
apps/web/lib/trajectory.tsx          (nuevo — Provider + hook + tipo Mark + estado inicial)
apps/web/app/layout.tsx              (únicamente envolver {children} con el Provider — decisión 3)
apps/web/app/curriculum-view.tsx     (consumir el hook; eliminar estado, markCourse, states, Mark y EMPTY_TRAJECTORY locales)
apps/web/app/graph-view.tsx          (idem)
```

El nombre y la ubicación exacta del módulo nuevo pueden variar dentro de `apps/web/lib/**` si encaja mejor con la convención existente, pero debe ser un único módulo compartido, no uno por vista.

Ningún otro archivo debe modificarse. En particular: nada bajo `packages/**`, `apps/admin/**`, `tools/agent/**`, ni ningún `package.json`.

## Fuera de alcance

- Persistencia en `localStorage` o cualquier otro medio (decisión 7 — es TASK-005.5).
- Pan/drag del grafo, más espacio de canvas (TASK-005.6).
- Quitar los botones de los nodos, panel de detalle (TASK-005.7).
- Explicación de bloqueos (TASK-005.8).
- Modo foco (TASK-005.9).
- Resolver o investigar el hydration mismatch de `docs/KNOWN_ISSUES.md` — **explícitamente prohibido**.
- Cualquier librería de gestión de estado (decisión 1).
- Rediseño visual, 3D, árbol inmersivo, backend, cuentas de usuario.
- Modificar `packages/curriculum-domain`, `curriculum-schema`, `curriculum-engine`, `curriculum-snapshot`.

## Criterios de aceptación

- Existe **un único** módulo compartido que declara la trayectoria, el tipo `Mark`, el estado inicial vacío, los estados derivados y `markCourse`.
- Ni `curriculum-view.tsx` ni `graph-view.tsx` contienen ya `useState<StudentTrajectory>`, ni una definición propia de `markCourse`, ni su propia constante de trayectoria vacía, ni su propio `useMemo` de estados derivados, ni su propia declaración del tipo `Mark`.
- El Provider está montado en `apps/web/app/layout.tsx` envolviendo `{children}`; `layout.tsx` no tiene ningún otro cambio (decisión 3), y `<html lang="es">` queda **byte a byte idéntico**.
- Las páginas `app/page.tsx` y `app/grafo/page.tsx` siguen sin ser Client Components (no adquieren `"use client"`).
- Marcar una materia en una vista y navegar con `<Link>` a la otra muestra la misma trayectoria y los mismos estados derivados.
- El comportamiento de marcado es idéntico al actual (decisión 5): mismas transiciones entre `UNMARKED`/`IN_PROGRESS`/`COMPLETED`, mismos botones deshabilitados en materias bloqueadas.
- Ninguna vista cambia visualmente: mismo layout, mismo CSS, mismos textos.
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

La tarea termina cuando los criterios de aceptación se cumplen y la secuencia de validación se ejecuta sin errores. Codex entrega el resumen indicado en `AGENTS.md` y se detiene, sin iniciar TASK-005.5 ni ninguna otra tarea.
