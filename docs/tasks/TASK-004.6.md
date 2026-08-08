# TASK-004.6 — Reparación: `curriculum-schema` no resuelve en runtime de test sobre checkout limpio

## Objetivo

Corregir un segundo bug de reproducibilidad de CI, expuesto después de TASK-004.5: `pnpm test` falla en GitHub Actions (checkout limpio) con `Failed to resolve entry for package "@sidera/curriculum-schema"`, en el import runtime de `unal-cs-2024-official.test.ts`. TASK-004.5 arregló la resolución de **tipos** para `tsc`; este es el mismo problema estructural pero para la resolución **runtime** que usa Vitest/Vite.

## Contexto mínimo

- `docs/tasks/TASK-004.5.md` — el bug hermano ya cerrado (resolución de tipos). Este documento no lo reabre ni lo modifica.
- `packages/curriculum-schema/package.json` — su bloque `exports` (de TASK-004.5): `types` apunta a `./src/index.ts`, pero `default` sigue apuntando a `./dist/index.js`.
- `packages/curriculum-domain/package.json` — mismo patrón (`types` a source, `default` a dist). Nunca expuso este bug porque **todos** los imports de `@sidera/curriculum-domain` en el repo son `import type` (solo tipos, se eliminan en compilación, Vite nunca necesita resolver un módulo runtime real). Verificado por inspección: `curriculum-schema/src/{entities,requirements,identifiers}.ts`, `curriculum-engine/src/{types,evaluation,evaluation.test,progress.test}.ts` y `curriculum-snapshot/src/data/unal-cs-2024-official/index.ts` — todos `import type`.
- `packages/curriculum-snapshot/src/data/unal-cs-2024-official.test.ts` — el único import runtime real (valores, no tipos) de `@sidera/curriculum-schema` en el repo: `academicProgramSchema`, `componentSchema`, etc., usados con `.safeParse(...)`.
- `vitest.config.mts` (raíz) — configuración actual de Vitest, sin `resolve.alias`.
- `.github/workflows/ci.yml` — orden real de CI: `install → lint → typecheck → test → build`. **`test` corre antes que `build`.** Ningún `dist/` existe todavía cuando Vitest intenta resolver `@sidera/curriculum-schema`.
- `docs/ARCHITECTURE.md` — principio ya documentado y **vinculante, no se reabre aquí**: "el runtime sigue consumiendo artefactos compilados" para consumidores reales del paquete (una app Next.js, un script Node). Esta tarea no cambia esa garantía.
- Este documento (la causa raíz y el fix son vinculantes).

## Causa raíz (diagnosticada y reproducida antes de escribir esta tarea)

1. El bloque `exports` de `curriculum-schema/package.json` (TASK-004.5) resuelve `types` desde `src/index.ts`, pero `default` sigue apuntando a `dist/index.js` — correcto y deliberado para consumidores runtime reales (decisión de `ARCHITECTURE.md`: la compilación sigue siendo la fuente de verdad para ejecución real).
2. `pnpm test` ejecuta `vitest run` directamente (no vía `turbo run test` — `turbo.json` no define una tarea `test`). Nada construye `dist/` antes de que Vitest resuelva los módulos.
3. En CI, `test` corre antes que `build` (orden de `ci.yml`). Cuando Vitest intenta resolver `@sidera/curriculum-schema` para ejecutar el import runtime de `unal-cs-2024-official.test.ts`, sigue la condición `default` → `./dist/index.js`, que no existe todavía → `Failed to resolve entry for package "@sidera/curriculum-schema"`.
4. En local esto no se manifestó por la misma razón que TASK-004.5: `dist/` de `curriculum-schema` ya existía en disco por builds previos acumulados, ajenos a un checkout limpio.
5. `curriculum-domain` nunca expuso este bug porque, verificado arriba, **ningún** import suyo en el repo es un import runtime real — todos son `import type`, que Vite elimina antes de intentar resolver el módulo en tiempo de ejecución.
6. **Confirmado por reproducción real**: moviendo temporalmente `packages/curriculum-schema/dist/` fuera del árbol (sin `rm`), `pnpm test` reproduce exactamente `Failed to resolve entry for package "@sidera/curriculum-schema"` en `unal-cs-2024-official.test.ts`, con el resto de la suite (59 tests) pasando con normalidad. Aplicando el fix de abajo (sin restaurar `dist/`), `pnpm test` (63/63) y `pnpm typecheck` pasan igual.

## Decisiones aprobadas

1. **El fix vive en `vitest.config.mts` (raíz), no en `curriculum-schema/package.json`**: se añade `resolve.alias` mapeando el especificador `@sidera/curriculum-schema` a la ruta absoluta de `packages/curriculum-schema/src/index.ts`. Esto resuelve el import runtime **solo dentro de Vitest**, sin tocar el contrato público (`exports`) del paquete.
2. **No se toca `curriculum-schema/package.json` en esta tarea**: su `exports.default` sigue apuntando a `./dist/index.js`. Esta tarea no reabre TASK-004.5 ni cambia la garantía de `ARCHITECTURE.md` de que el runtime real consume artefactos compilados — el alias es exclusivo del entorno de pruebas.
3. **Alcance del alias: únicamente `@sidera/curriculum-schema`**, el único paquete con un import runtime real hoy. No se añade un alias genérico para todos los `@sidera/*` ni se anticipa el problema para paquetes que todavía no lo tienen (mismo criterio de alcance que TASK-004.5, decisión 2 — no se arregla preventivamente lo que no está roto).
4. **Sin nuevas dependencias**: `resolve.alias` es una opción nativa de Vite/Vitest (`vitest/config` reexporta la forma de configuración de Vite). No se instala `vite-tsconfig-paths` ni ningún paquete adicional.
5. **Sin imports relativos**: `unal-cs-2024-official.test.ts` conserva literalmente `from "@sidera/curriculum-schema"`. El alias es transparente al código fuente — resuelve el mismo especificador público, no lo reemplaza.
6. **La ruta del alias se construye con `fileURLToPath(new URL(...))`**, no con un string relativo manual ni con `path.resolve(__dirname, ...)` — `vitest.config.mts` es un módulo ESM (`.mts`) sin `__dirname` disponible; `import.meta.url` es la forma correcta y ya usada implícitamente por el propio ecosistema Vite en este tipo de archivo.

## Alcance permitido

```
vitest.config.mts    (raíz — únicamente el bloque resolve.alias para @sidera/curriculum-schema)
```

Ningún otro archivo debe modificarse. En particular: ni `curriculum-schema/package.json` (ya cerrado en TASK-004.5), ni `unal-cs-2024-official.test.ts`, ni ningún otro archivo de `curriculum-snapshot`, ni `turbo.json`, ni `ci.yml`, ni `pnpm-lock.yaml`.

## Fuera de alcance

- Modificar `curriculum-schema/package.json` o su bloque `exports` (decisión 2) — ese archivo ya quedó cerrado en TASK-004.5 para el problema de tipos; este es un problema distinto, resuelto en una capa distinta.
- Cambiar el orden de `install → lint → typecheck → test → build` en `ci.yml`, o hacer que `test` dependa de `build`.
- Añadir alias para otros paquetes `@sidera/*` que hoy no tienen imports runtime cruzados (decisión 3).
- Instalar `vite-tsconfig-paths` o cualquier plugin de resolución adicional (decisión 4).
- Cualquier import relativo en archivos de test o de dataset (decisión 5).
- Cualquier cambio de dominio, de esquema o del dataset de TASK-004.4.
- TASK-004.7 o cualquier tarea posterior.

## Contrato exacto del fix

Forma esperada de `vitest.config.mts` tras el cambio (el fix ya fue verificado con este contenido exacto antes de escribir esta tarea):

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@sidera/curriculum-schema": fileURLToPath(
        new URL("./packages/curriculum-schema/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["tests/**/*.test.ts", "packages/**/src/**/*.test.ts"],
  },
});
```

## Criterios de aceptación

- `vitest.config.mts` tiene el bloque `resolve.alias` de la sección anterior; el resto del archivo (incluida la clave `test.include`) permanece igual.
- `pnpm test` pasa **incluso con `packages/curriculum-schema/dist/` ausente** (verificable moviendo esa carpeta fuera del árbol temporalmente, sin `rm`) — 63 tests, 6 archivos, ninguno fallado.
- `pnpm typecheck` sigue pasando sin cambios (esta tarea no toca la resolución de tipos, ya cerrada en TASK-004.5).
- `pnpm lint` y `pnpm build` siguen pasando.
- El import `@sidera/curriculum-schema` en `unal-cs-2024-official.test.ts` permanece literalmente igual.
- `curriculum-schema/package.json` no queda modificado por esta tarea.
- Ningún archivo fuera de `vitest.config.mts` queda modificado.
- `pnpm-lock.yaml` no cambia.

## Comandos de validación

```
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Verificación adicional específica de esta tarea (repetir con `curriculum-schema/dist/` movido fuera del árbol, no borrado):

```
pnpm typecheck
pnpm test
```

## Condición exacta de terminación

La tarea termina cuando el fix de la sección "Contrato exacto del fix" está aplicado literalmente, los criterios de aceptación se cumplen, y la secuencia de validación se ejecuta sin errores — incluida la verificación explícita de que `pnpm test` no depende de que `curriculum-schema/dist/` exista de antemano. Codex entrega el resumen indicado en `AGENTS.md` y se detiene, sin iniciar TASK-004.7 ni ninguna otra tarea.
