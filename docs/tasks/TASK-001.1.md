# TASK-001.1 — Fortalecimiento de la infraestructura de validación

## Objetivo

Cerrar tres huecos de cobertura en la infraestructura de validación (tests, lint, typecheck) antes de introducir lógica curricular en TASK-002.

## Contexto mínimo

- `docs/tasks/TASK-001.md` — bootstrap ya cerrado; esta tarea solo lo corrige.
- `AGENTS.md` — reglas de alcance para Codex.

## Alcance permitido

Exclusivamente estas tres correcciones:

- **N1** — `vitest.config.mts`: el `include` debe detectar tanto `tests/**/*.test.ts` como `packages/**/src/**/*.test.ts`.
- **N2** — `pnpm lint` debe cubrir también los archivos relevantes de raíz (`tests/`, `vitest.config.mts`, `eslint.config.mjs`), además de los workspaces que ya cubre `turbo run lint`.
- **N3** — `pnpm typecheck` debe comprobar también el código TypeScript bajo `tests/`.

## Fuera de alcance

- Lógica curricular de cualquier tipo.
- Instalación de Zod o de cualquier dependencia de dominio.
- Modificación de `apps/web` y `apps/admin`, salvo que sea estrictamente necesario para las tres correcciones.
- Cambios de nombre de packages o de apps (N5 se descarta deliberadamente).
- N4 (`pnpm` ausente del PATH): es un problema del entorno local, no se resuelve desde el repositorio.
- Refactors, reorganizaciones o mejoras no solicitadas.
- TASK-002.

## Archivos esperados

```
vitest.config.mts            (modificado — N1)
package.json                 (modificado — N2, N3: scripts raíz)
tests/tsconfig.json          (nuevo, o mecanismo equivalente — N3)
tsconfig.json                (modificado si N3 lo requiere)
eslint.config.mjs            (modificado solo si N2 lo requiere)
```

No deben crearse ni modificarse otros archivos.

## Criterios de aceptación

- Un test de prueba colocado en `packages/*/src/**/*.test.ts` es detectado y ejecutado por `pnpm test` (verificado durante la tarea; el archivo de prueba temporal **no** debe quedar en el repositorio).
- El smoke test existente en `tests/` sigue detectándose y pasando.
- `pnpm lint` reporta errores si se introduce una violación de lint en `tests/` o en un archivo de configuración de raíz.
- `pnpm typecheck` reporta errores si se introduce un error de tipos en `tests/`.
- La secuencia completa de validación se ejecuta sin errores sobre el repositorio limpio.
- No se añadió ninguna dependencia nueva de dominio ni lógica curricular.

## Comandos de validación

```
pnpm install
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

## Condición exacta de terminación

La tarea termina cuando N1, N2 y N3 están resueltos, los criterios de aceptación se cumplen y la secuencia de validación se ejecuta sin errores. Al terminar, Codex debe entregar el resumen indicado en `AGENTS.md` y detenerse, sin iniciar TASK-002 ni ninguna otra tarea.
