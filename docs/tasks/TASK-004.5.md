# TASK-004.5 — Reparación: `curriculum-schema` no resuelve en typecheck sobre checkout limpio

## Objetivo

Corregir un bug de reproducibilidad de CI: `pnpm typecheck` falla en GitHub Actions (checkout limpio) para `@sidera/curriculum-snapshot`, aunque pasaba en local, porque `packages/curriculum-schema/package.json` no expone sus tipos desde `src/` cuando `dist/` todavía no existe.

## Contexto mínimo

- `docs/ARCHITECTURE.md` — principio ya documentado: "Los paquetes TypeScript internos pueden exponer sus tipos desde source mediante package exports mientras el runtime sigue consumiendo artefactos compilados, cuando esto sea necesario para que el typecheck del monorepo sea reproducible desde un checkout limpio."
- `packages/curriculum-domain/package.json` — **ya implementa exactamente este patrón** (ver "Causa raíz y fix" abajo). Es la referencia literal a copiar, no a reinventar.
- `packages/curriculum-schema/package.json`, `packages/curriculum-snapshot/package.json` — los dos extremos del problema.
- `turbo.json` — la tarea `typecheck` depende de `^typecheck` (typecheck de las dependencias), **no** de `^build`. Por diseño, ninguna tarea `typecheck` del monorepo compila `dist/` de sus dependencias.
- Este documento (la causa raíz y el fix son vinculantes, no se re-derivan).

## Causa raíz (diagnosticada y reproducida antes de escribir esta tarea)

1. `packages/curriculum-schema/package.json` declara `"types": "./dist/index.d.ts"` sin ningún campo `exports`. Con `moduleResolution: "Bundler"` (tsconfig raíz), TypeScript resuelve el paquete por ese `types` bare, que apunta a un artefacto compilado.
2. `turbo.json` → tarea `typecheck` → `dependsOn: ["^typecheck"]`, no `["^build"]`. Ninguna cadena de `pnpm typecheck` construye `dist/` de una dependencia antes de tipar un paquete que la consume.
3. En un checkout limpio (CI), `packages/curriculum-schema/dist/` no existe todavía cuando corre el `typecheck` de `curriculum-snapshot` → `tsc` no encuentra `@sidera/curriculum-schema` → `TS2307`.
4. En local, esto no se manifestó porque `packages/curriculum-schema/dist/` ya existía en disco, poblado por ejecuciones previas de `pnpm build` de tareas anteriores (TASK-004.0/002/003), acumuladas fuera del control de un checkout limpio. El pase local de TASK-004.4 fue válido pero **parasitario de artefactos preexistentes**, no reproducible desde cero.
5. **Confirmado por reproducción real**: moviendo temporalmente `packages/curriculum-schema/dist/` fuera del árbol, `pnpm --filter @sidera/curriculum-snapshot typecheck` reproduce exactamente `TS2307: Cannot find module '@sidera/curriculum-schema'`. Aplicando el fix de abajo (sin restaurar `dist/`), el mismo comando pasa.
6. `packages/curriculum-domain/package.json` **ya tiene el fix aplicado** desde antes de esta tarea (probablemente TASK-002), lo que explica por qué nadie lo notó hasta ahora: `curriculum-engine` depende de `curriculum-domain` (ya arreglado), y hasta TASK-004.4 ningún paquete fuera de `curriculum-schema` mismo dependía de `curriculum-schema` en tiempo de typecheck.

## Decisiones aprobadas

1. **Fix exacto**: añadir a `packages/curriculum-schema/package.json` el mismo bloque `exports` que ya tiene `packages/curriculum-domain/package.json`, verbatim salvo el nombre de archivo (idéntico, porque el punto de entrada también es `src/index.ts`):

   ```json
   "exports": {
     ".": {
       "types": "./src/index.ts",
       "default": "./dist/index.js"
     }
   }
   ```

   Se inserta inmediatamente después de `"types": "./dist/index.d.ts"`, igual posición que en `curriculum-domain/package.json`.
2. **No se toca `turbo.json`**: no se cambia `typecheck` a depender de `^build`. El patrón de `exports.types → source` es la solución ya elegida y documentada en `ARCHITECTURE.md` para este problema exacto; cambiar la orquestación de `turbo` sería una alternativa arquitectónica distinta, no solicitada y fuera de alcance.
3. **No se usan paths relativos** en `unal-cs-2024-official.test.ts` ni en ningún otro archivo para evitar el problema. El import público `@sidera/curriculum-schema` se preserva sin cambios.
4. **Sin cambios en `pnpm-lock.yaml`**: este fix no añade, quita ni cambia ninguna dependencia declarada — solo corrige cómo se resuelven los tipos de una dependencia ya existente. Si `pnpm install` regenerara el lockfile de todos modos, repórtalo antes de continuar; no se espera.
5. **`main`/`types` (bare, fuera de `exports`) no se tocan**: siguen apuntando a `dist/`, para runtime y para herramientas que no respeten `exports` (consistencia con `curriculum-domain`).

## Alcance permitido

```
packages/curriculum-schema/package.json    (únicamente el bloque exports, decisión 1)
```

Ningún otro archivo debe modificarse. En particular: ni `unal-cs-2024-official.test.ts`, ni ningún otro archivo de `curriculum-snapshot`, ni `turbo.json`, ni `tsconfig.json` de ningún paquete, ni `pnpm-lock.yaml` salvo que `pnpm install` lo regenere por sí solo como efecto secundario inevitable (repórtalo si ocurre).

## Fuera de alcance

- Cambiar `turbo.json` o la estrategia de dependencias entre tareas (decisión 2).
- Cualquier import relativo o path hack para evitar el problema (decisión 3).
- Aplicar el mismo patrón `exports` a otros paquetes que no lo tengan (`curriculum-engine`, `curriculum-validator`, `curriculum-importer`, `database`) — ninguno de ellos es consumido por otro paquete en typecheck todavía, así que no hay bug que reparar ahí. Si aparece uno igual en el futuro, es una tarea aparte.
- Cualquier cambio de dominio, de esquema o de dataset.
- TASK-004.6 o cualquier tarea posterior.

## Criterios de aceptación

- `packages/curriculum-schema/package.json` tiene el bloque `exports` exacto de la decisión 1, en la misma forma que `curriculum-domain/package.json`.
- `pnpm --filter @sidera/curriculum-snapshot typecheck` pasa incluso con `packages/curriculum-schema/dist/` ausente (verificable moviendo esa carpeta fuera del árbol temporalmente, sin `rm`).
- `pnpm typecheck` (raíz, todos los paquetes) pasa.
- `pnpm lint`, `pnpm test`, `pnpm build` siguen pasando sin cambios de comportamiento.
- El import `@sidera/curriculum-schema` en `unal-cs-2024-official.test.ts` permanece literalmente igual — sin path relativo.
- Ningún archivo fuera del listado en "Archivos permitidos" queda modificado.
- `pnpm-lock.yaml` no cambia (salvo efecto secundario reportado, ver decisión 4).

## Comandos de validación

```
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Condición exacta de terminación

La tarea termina cuando el fix de la decisión 1 está aplicado, los criterios de aceptación se cumplen, y la secuencia de validación se ejecuta sin errores — incluida la verificación explícita de que `typecheck` de `curriculum-snapshot` no depende de que `curriculum-schema/dist/` exista de antemano. Codex entrega el resumen indicado en `AGENTS.md` y se detiene, sin iniciar TASK-004.6 ni ninguna otra tarea.
