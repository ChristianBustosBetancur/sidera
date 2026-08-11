# TASK-005.5 — Persistencia local de la trayectoria

## Objetivo

Hacer que la trayectoria compartida de TASK-005.4 **sobreviva a una recarga o al cierre del navegador**, guardándola en `localStorage` detrás de una interfaz estrecha que pueda sustituirse por un backend real más adelante sin tocar ninguna vista.

Hoy la trayectoria vive solo en memoria: recargar `/` o `/grafo` la pierde entera.

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

Aplicación directa de `docs/AGENT_REVIEW_POLICY.md`: "UI interactiva o compleja (estado, interacción, grafos, rendimiento)" → `claude-review` + `codex-qa`. Además, esta tarea tiene casos borde reales (datos corruptos, dataset cambiado, SSR, cuota de almacenamiento) que son exactamente lo que `codex-qa` debe auditar.

## Contexto mínimo

- `apps/web/lib/trajectory.tsx` — el Provider único creado en TASK-005.4. Es el **único** punto de la app que debe hablar con la capa de persistencia.
- `docs/tasks/TASK-005.4.md` — decisiones vigentes: Context + `useState`, sin librerías de estado, Provider montado en el root layout.
- `docs/KNOWN_ISSUES.md` — hydration mismatch abierto. Esta tarea **no** lo investiga, y además **no debe introducir uno nuevo** (decisión 3).
- `packages/curriculum-engine/src/index.ts` — `StudentTrajectory`. No se modifica.
- `packages/curriculum-snapshot` — `unalCs2024Official.planVersion.id` y `versionCourses`, necesarios para validar lo que se lee.

## Decisiones aprobadas

1. **Interfaz estrecha y sustituible.** La persistencia vive en su propio módulo (p. ej. `apps/web/lib/trajectory-storage.ts`) que expone **solo dos funciones**: cargar y guardar una `StudentTrajectory`. Ninguna vista, ni el Provider, conoce `localStorage`, claves ni formato de serialización: solo llaman a esas dos funciones. Sustituir `localStorage` por una API HTTP debe ser un cambio contenido a ese módulo.
2. **Solo se persiste lo mínimo e irreducible**: `completedVersionCourseIds` e `inProgressVersionCourseIds`. **Nunca** se persiste nada derivado (estados `AVAILABLE`/`BLOCKED`/..., progreso, niveles del grafo, evaluaciones): todo eso se recalcula siempre con el engine a partir de la trayectoria. Persistir datos derivados los dejaría desincronizados en cuanto cambiara el dataset o el engine.
3. **La lectura ocurre después del montaje, nunca durante el render inicial ni en SSR.** El primer render del cliente debe producir exactamente el mismo HTML que el servidor (trayectoria vacía); la trayectoria almacenada se carga en un efecto posterior al montaje y actualiza el estado. Está **prohibido** leer `localStorage` durante el render, en el inicializador de `useState`, o de cualquier forma que haga divergir el primer render cliente/servidor. Esta tarea no puede introducir un hydration mismatch nuevo.
4. **La escritura no puede pisar lo guardado antes de haber cargado.** Debe existir una guarda explícita para que el efecto de guardado no escriba la trayectoria vacía inicial encima de una trayectoria almacenada antes de que la carga haya terminado. Este es el fallo más probable de esta tarea y debe estar resuelto de forma evidente en el código.
5. **Formato versionado y ligado al plan.** Lo almacenado incluye un número de versión de formato y el `planVersionId` al que pertenece. Si la versión de formato no coincide, o el `planVersionId` no coincide con el del dataset actual, lo almacenado **se descarta y se empieza limpio** — no se intenta migrar ni adivinar.
6. **Recuperación segura ante cualquier dato inválido.** JSON no parseable, forma inesperada, campos ausentes, tipos incorrectos, ids que ya no existen en el dataset: nada de eso puede lanzar una excepción no capturada ni romper la página. La regla es **descartar y empezar limpio**, nunca crashear y nunca renderizar a medias. Los ids que no existen en `unalCs2024Official.versionCourses` se filtran al cargar; si tras filtrar no queda nada útil, se empieza limpio.
7. **`localStorage` puede fallar y hay que tolerarlo.** En modo privado, con la cuota llena, o con almacenamiento deshabilitado, tanto leer como escribir pueden lanzar. Ambas operaciones van protegidas: si la persistencia no está disponible, la app funciona exactamente como hoy (trayectoria en memoria) sin errores visibles ni bucles de reintento.
8. **Sin cambios visuales ni de interacción.** No se añade indicador de "guardado", ni botón de reset, ni aviso alguno. Mismas vistas, mismo CSS, mismos textos. Si la trayectoria se restaura al recargar, el usuario simplemente la ve marcada.
9. **Sin dependencias nuevas.** Nada de `zod` en `apps/web`, ni librerías de persistencia, ni `use-local-storage`. La validación de lo leído se escribe a mano en el módulo de persistencia; es pequeña y explícita.
10. **Sin cambios en `packages/**`.** Ni en `curriculum-schema` para validar el payload almacenado: la persistencia local es una preocupación de `apps/web`, no del dominio.
11. **Sin `sessionStorage`, cookies, URL, IndexedDB ni backend.** Solo `localStorage`.

## Alcance permitido

```
apps/web/lib/trajectory-storage.ts    (nuevo — carga/guardado, validación, versionado)
apps/web/lib/trajectory.tsx           (usar el módulo de persistencia: cargar tras montar, guardar al cambiar)
```

El nombre exacto del módulo nuevo puede variar dentro de `apps/web/lib/**`, pero debe ser un módulo dedicado y separado del Provider.

Ningún otro archivo debe modificarse. En particular: ni las vistas, ni `layout.tsx`, ni ningún CSS, ni nada bajo `packages/**`, `apps/admin/**`, `tools/agent/**`, ni ningún `package.json`.

## Fuera de alcance

- Botón de reset/limpiar trayectoria, indicador de guardado, exportar/importar (decisión 8).
- Múltiples trayectorias, perfiles o escenarios "qué pasaría si".
- Backend, cuentas de usuario, sincronización entre dispositivos.
- Migrar datos almacenados con un formato antiguo (decisión 5: se descartan).
- Pan/drag del grafo (TASK-005.6), panel de detalle (TASK-005.7), explicación de bloqueos (TASK-005.8), modo foco (TASK-005.9).
- Resolver o investigar el hydration mismatch de `docs/KNOWN_ISSUES.md` — **explícitamente prohibido**. (Sí es obligatorio no crear uno nuevo, decisión 3.)
- Modificar `packages/curriculum-domain`, `curriculum-schema`, `curriculum-engine`, `curriculum-snapshot`.

## Criterios de aceptación

- Existe un módulo de persistencia dedicado que expone únicamente cargar y guardar una `StudentTrajectory`; ni las vistas ni el resto del Provider mencionan `localStorage` ni la clave de almacenamiento.
- Solo se serializan `completedVersionCourseIds` e `inProgressVersionCourseIds`, junto con la versión de formato y el `planVersionId` (decisiones 2 y 5). No se serializa ningún dato derivado.
- La carga ocurre en un efecto posterior al montaje; no hay ninguna lectura de `localStorage` en el render, en el inicializador de `useState`, ni en código que se ejecute en el servidor (decisión 3).
- Existe una guarda explícita que impide que el primer guardado escriba la trayectoria vacía sobre una almacenada (decisión 4).
- Un valor almacenado corrupto, con versión distinta, con `planVersionId` distinto, o con ids inexistentes, produce arranque limpio sin excepción visible ni página rota (decisiones 5 y 6).
- Leer o escribir con `localStorage` no disponible no rompe la app ni genera bucles de reintento (decisión 7).
- Marcar materias, recargar la página y volver a `/` y a `/grafo` muestra la misma trayectoria y los mismos estados derivados en ambas vistas.
- Ninguna vista cambia visualmente ni añade elementos de UI.
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

La tarea termina cuando los criterios de aceptación se cumplen y la secuencia de validación se ejecuta sin errores. Codex entrega el resumen indicado en `AGENTS.md` y se detiene, sin iniciar TASK-005.6 ni ninguna otra tarea.
