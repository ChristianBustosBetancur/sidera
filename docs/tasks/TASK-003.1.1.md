# TASK-003.1.1 — Fix: typecheck reproducible en checkout limpio

## Objetivo

Conseguir que la secuencia

```bash
git clone <repo>
pnpm install --frozen-lockfile
pnpm typecheck
```

funcione en un checkout limpio **sin `dist/` previamente generado, sin `pnpm build` previo y sin caché de Turbo**, manteniendo simultáneamente `pnpm build` y `pnpm test` funcionando y los límites de output entre paquetes intactos.

Es una tarea de **metadata de paquete**. No hay lógica nueva, ni cambios de dominio, ni cambios de código funcional, ni cambios en CI, ni despliegue, ni datos.

Corrige el fallo de CI aparecido tras el primer push público (TASK-003.1).

## Contexto mínimo

- `docs/ARCHITECTURE.md` — estructura del monorepo; esta tarea añade una regla ahí.
- Este documento (las decisiones de abajo son vinculantes).

No es necesario leer `docs/PRODUCT.md`, `docs/DOMAIN.md` ni `docs/PERFORMANCE.md`: esta tarea no toca dominio ni interfaz.

## Causa raíz

`@sidera/curriculum-domain` expone sus tipos **únicamente** a través de `"types": "./dist/index.d.ts"`. `dist/` está en `.gitignore` y por tanto **no existe en un checkout limpio**.

`packages/curriculum-engine` y `packages/curriculum-schema` importan `@sidera/curriculum-domain` y ejecutan `tsc --noEmit`. En CI, `typecheck` corre **antes** de `build` (orden correcto: `lint → typecheck → test → build`), de modo que el `.d.ts` que necesitan no existe todavía y la resolución falla.

En local el fallo quedaba enmascarado por dos residuos: un `dist/` de builds anteriores presente en el working tree, y la caché de Turbo.

**Clasificación:** dependencia de artefactos generados (`dist`) para una operación que debe ser de sólo-lectura y reproducible. **No** es un problema de orden de CI, ni de linking de pnpm, ni de `moduleResolution`.

### Descartado explícitamente: project references

Se probó empíricamente añadir `"references": [{ "path": "../curriculum-domain" }]` a los tsconfig de engine y schema. **Falló.** El *source-of-project-reference redirect* (el mecanismo que sustituye un `.d.ts` no construido por su `.ts` fuente) está condicionado, en TypeScript 5.9.3, a que el compiler host implemente `useSourceOfProjectReferenceRedirect()`. De las 11 ocurrencias del símbolo en `typescript.js`, la única que devuelve un valor verdadero está en el `Project` de tsserver:

```js
useSourceOfProjectReferenceRedirect() {
  return this.languageServiceEnabled;
}
```

Es decir: **el redirect es una función del servicio de lenguaje (editor), no del compilador de línea de comandos.** `tsc --noEmit` nunca lo activa. Esto explica además por qué el editor no mostraba errores mientras `tsc` fallaba.

Consecuencia operativa: **no reintentar la vía de project references.** Está refutada con evidencia.

## Evidencia del fallo original

CI de GitHub Actions, checkout limpio, `pnpm install --frozen-lockfile`, remote cache desactivado, `lint` en verde:

```
@sidera/curriculum-engine:typecheck
$ tsc --noEmit
src/evaluation.test.ts(10,8): error TS2307: Cannot find module '@sidera/curriculum-domain' or its corresponding type declarations.
src/evaluation.ts(9,8): error TS2307: Cannot find module '@sidera/curriculum-domain' or its corresponding type declarations.
src/state.ts(1,38): error TS2307: Cannot find module '@sidera/curriculum-domain' or its corresponding type declarations.
src/types.ts(10,8): error TS2307: Cannot find module '@sidera/curriculum-domain' or its corresponding type declarations.
```

Los `TS7006` (implicit any) y `TS2366` (return type) que aparecen a continuación son **errores en cascada**, no independientes: al no resolverse el módulo, todo símbolo importado queda `any` y `strict` dispara los secundarios. Desaparecen al corregir el `TS2307`.

Reproducción local del control negativo (renombrando `dist/` y `tsbuildinfo`, `TURBO_FORCE=1`):

```
Tasks:    7 successful, 9 total
Cached:    0 cached, 9 total
Failed:    @sidera/curriculum-engine#typecheck
EXITCODE=2
```

`curriculum-schema` sufre el mismo fallo; en CI quedaba oculto porque Turbo cancelaba su tarea al fallar engine primero. Ejecutado en aislamiento:

```
src/entities.ts(11,8): error TS2307: Cannot find module '@sidera/curriculum-domain' ...
src/identifiers.ts(11,8): error TS2307: Cannot find module '@sidera/curriculum-domain' ...
src/requirements.ts(5,8): error TS2307: Cannot find module '@sidera/curriculum-domain' ...
```

**Importante:** el fix debe resolver ambos paquetes, no sólo engine.

## Evidencia de la prueba empírica que confirmó la solución

Prueba temporal ejecutada y revertida por completo (repositorio devuelto a `5bd3e28`, `git status` y `git diff` limpios). Estado: 7 `dist/` renombrados, 10 `tsbuildinfo` renombrados, `TURBO_FORCE=1`, sin `build` previo. Único cambio aplicado: el bloque `exports` en `packages/curriculum-domain/package.json`.

**`pnpm typecheck`:**

```
• Remote caching disabled
@sidera/curriculum-engine:typecheck: cache bypass, force executing 15dabfbb1d3fd1c6
@sidera/curriculum-schema:typecheck: cache bypass, force executing 624d89c1e009b79a
 Tasks:    9 successful, 9 total
Cached:    0 cached, 9 total
EXITCODE=0
```

**Resolución observada** (`tsc --noEmit --traceResolution` en `curriculum-engine`, con `dist` inexistente):

```
======== Resolving module '@sidera/curriculum-domain' from '.../curriculum-engine/src/state.ts' ========
======== Module name '@sidera/curriculum-domain' was successfully resolved to
         'D:/Dev/sidera/packages/curriculum-domain/src/index.ts'
         with Package ID '@sidera/curriculum-domain/src/index.ts@0.0.0'. ========
```

Comprobación simultánea de ausencia de `dist`:

```
ls: cannot access 'D:/Dev/sidera/packages/curriculum-domain/dist': No such file or directory
```

**`pnpm build`** desde el mismo estado limpio: `9 successful, 9 total`, `0 cached`, exit 0, incluidos los builds de Next de `web` y `admin`.

**`pnpm test`:** `Test Files 4 passed (4)`, `Tests 34 passed (34)`, exit 0.

**Ausencia de `TS6059` / `TS6307`:** búsqueda explícita ejecutando `tsc -p tsconfig.json` aislado en ambos paquetes → sin coincidencias. El motivo está en el propio trace: `with Package ID '...@0.0.0'`. Al resolverse a través de `node_modules`, TypeScript marca esos archivos como *external library files*; no se emiten y no se someten a la comprobación de `rootDir`.

**Ausencia de contaminación de outputs:** `curriculum-engine/dist` contiene exactamente sus 5 módulos propios; `curriculum-schema/dist` los suyos; ningún subdirectorio anidado en ningún `dist` (una violación de `rootDir` habría producido `dist/curriculum-engine/src/...`); ningún archivo de `curriculum-domain` emitido dentro del output de otro paquete. Los `.d.ts` emitidos referencian el dominio por especificador de paquete, no por ruta al source ajeno:

```ts
import type { VersionCourseId } from "@sidera/curriculum-domain";
```

## Decisiones aprobadas

Aprobadas por decisión humana. **No se re-discuten ni se sustituyen por alternativas "mejores".**

### A. Estrategia: package exports con `types` → source

`@sidera/curriculum-domain` expone sus tipos desde el source y su runtime desde el artefacto compilado. Separación confirmada empíricamente.

### B. Se conservan los campos legacy

`main` y `types` **se mantienen tal cual**. No se eliminan, no se reestructuran, no se reordenan en esta tarea.

### C. Sólo `curriculum-domain`

El cambio se aplica **exclusivamente** a `packages/curriculum-domain/package.json`. **No** se replica preventivamente en los otros seis paquetes.

Motivo: `curriculum-domain` es hoy el único paquete de workspace consumido por otros (`curriculum-engine` y `curriculum-schema`) y el único necesario para resolver el fallo real observado.

### D. La rama `default` no se toca

`"default": "./dist/index.js"` se mantiene apuntando al artefacto compilado. La separación tipos-desde-source / runtime-desde-dist es deliberada y no debe unificarse.

### E. No se reintenta la vía de project references

Refutada empíricamente (ver "Causa raíz"). No añadir `references` a ningún tsconfig en esta tarea.

### F. El orden de CI es correcto y no se toca

`lint → typecheck → test → build` se mantiene. `typecheck` **no** debe depender de `build` ni de `^build`. El problema nunca estuvo en el workflow.

## Alcance permitido

1. Añadir el bloque `exports` a `packages/curriculum-domain/package.json`, conservando `main` y `types` intactos.
2. Añadir la regla mínima a `docs/ARCHITECTURE.md`.
3. Ejecutar el protocolo de validación descrito más abajo y reportar sus resultados.

Nada más.

## Fuera de alcance

- Modificar `packages/curriculum-engine/tsconfig.json` o `packages/curriculum-schema/tsconfig.json`.
- Modificar cualquier otro `tsconfig.json`, incluido el raíz.
- Modificar `turbo.json`.
- Modificar `.github/workflows/ci.yml`.
- Modificar cualquier `scripts` de cualquier `package.json`, incluido el raíz.
- Modificar `dependencies` o `devDependencies` de cualquier paquete.
- Añadir `exports` a los otros seis paquetes (decisión C).
- Añadir `references` a ningún tsconfig (decisión E).
- Eliminar o reestructurar `main` / `types` (decisión B).
- Introducir `paths`, alias de resolución o `transpilePackages`.
- Migrar a `tsc -b` o al solution builder.
- Corregir la emisión de `*.test.ts` dentro de `dist/` — **deuda técnica registrada, tarea independiente** (ver abajo).
- Reorganizar `docs/AGENT_SECURITY.md` o el README — **tarea independiente posterior**, ya aprobada pero no incluida aquí.
- Versionar `dist/`, tocar `.gitignore`, o cualquier cambio en `apps/**`, `tests/**` o el resto de `packages/**`.
- Commit, push, tag, release.

## Archivos permitidos

```
packages/curriculum-domain/package.json   (modificado: añade el bloque exports aprobado)
docs/ARCHITECTURE.md                      (modificado: añade la regla mínima)
```

**Exactamente 2 archivos, ambos modificados. Ninguno nuevo.** Ningún otro archivo debe crearse ni modificarse.

El criterio sobre `packages/curriculum-domain/package.json` es que **se añada únicamente el bloque `exports` aprobado** (ver "Configuración exacta esperada"), sin tocar ninguna otra clave. El número exacto de líneas resultante depende del formato y **no forma parte del criterio**.

### `pnpm-lock.yaml`

**No debe modificarse.** El cambio es metadata de un paquete `private: true` sin alteración de dependencias, por lo que no debería afectar al lockfile.

Si tras el cambio `pnpm install --frozen-lockfile` fallara o pnpm modificara el lockfile por sí mismo: **detenerse, no asumir el cambio, y reportarlo para decisión humana.** No hacer commit de un lockfile modificado sin aprobación explícita.

## Configuración exacta esperada

`packages/curriculum-domain/package.json` debe quedar exactamente así:

```json
{
  "name": "@sidera/curriculum-domain",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "lint": "eslint src",
    "typecheck": "tsc --noEmit"
  }
}
```

El diff resultante debe ser **exactamente** este y nada más:

```diff
   "main": "./dist/index.js",
   "types": "./dist/index.d.ts",
+  "exports": {
+    ".": {
+      "types": "./src/index.ts",
+      "default": "./dist/index.js"
+    }
+  },
   "scripts": {
```

El orden de las claves dentro de `exports` es significativo: `types` debe ir **antes** que `default`. Las condiciones de `exports` se evalúan en orden y `default` captura todo; si `types` fuera después, nunca se alcanzaría.

### Regla en `docs/ARCHITECTURE.md`

Añadir a la sección **"Principios de separación"**, como último punto:

> - Los paquetes TypeScript internos pueden exponer sus tipos desde source mediante package exports mientras el runtime sigue consumiendo artefactos compilados, cuando esto sea necesario para que el typecheck del monorepo sea reproducible desde un checkout limpio. No es una regla automática para todos los paquetes: se aplica cuando existe una dependencia de workspace real que lo requiere.

No reescribir ni reordenar el resto del documento.

## Criterios de aceptación

1. `packages/curriculum-domain/package.json` contiene el bloque `exports` exacto especificado arriba, con `types` antes de `default`.
2. `main` y `types` siguen presentes y sin cambios.
3. `scripts` y ausencia de `dependencies` sin cambios.
4. Ningún otro `package.json` modificado.
5. Ningún `tsconfig.json` modificado.
6. `turbo.json` y `.github/workflows/ci.yml` sin cambios.
7. `pnpm-lock.yaml` sin cambios (o, si cambió, la tarea está detenida y reportada, no completada).
8. `docs/ARCHITECTURE.md` contiene la regla, añadida sin reescribir el resto.
9. `git status --porcelain` muestra exactamente 2 archivos modificados y ninguno sin seguimiento.
10. El protocolo de validación completo pasa en todos sus pasos.

## Protocolo de validación en estado limpio

Debe ejecutarse **en este orden**, sin saltarse pasos. Todo ocurre dentro de `D:\Dev\sidera`.

### Nota sobre los comandos de este protocolo

**Los comandos Bash que aparecen a continuación son ejemplos ilustrativos, no comandos obligatorios.** El implementador debe usar los equivalentes seguros del shell realmente disponible (PowerShell, `sh`, o las herramientas del propio agente) y respetar en todo momento `AGENTS.md` y el documento de seguridad operativa para agentes (`docs/AGENT_SECURITY.md`, ruta adoptada posteriormente por TASK-003.1.2).

En particular:

- **La validación no requiere ejecutar comandos destructivos.** Si una política de agentes bloquea `rm -rf`, un borrado recursivo o cualquier otra operación, debe usarse una alternativa permitida (renombrar en lugar de borrar, mover a un nombre temporal, o pedir la operación a un humano). No se debe intentar eludir una política ni ejecutar una variante disfrazada del comando bloqueado.
- **Ninguna operación debe salir de `D:\Dev\sidera`.**
- **Lo que se valida es el estado final y la evidencia recogida, no la ejecución de un comando concreto.** Cualquier método que demuestre de forma verificable la condición exigida en cada paso es aceptable.

Si algún paso no puede ejecutarse por una restricción de política, **detenerse, explicar la restricción y solicitar aprobación humana**; no darlo por cumplido ni omitirlo en el reporte.

### Paso 0 — Preparación

Registrar el estado de partida:

```bash
git status --porcelain
```

Renombrar (**nunca borrar**) los artefactos generados que enmascararían el resultado:

```bash
for d in packages/*/dist; do [ -d "$d" ] && mv "$d" "$d.probe-bak"; done
```

```bash
for f in packages/*/tsconfig.tsbuildinfo apps/*/tsconfig.tsbuildinfo tests/tsconfig.tsbuildinfo; do [ -f "$f" ] && mv "$f" "$f.probe-bak"; done
```

### Paso 1 — Comprobación de ausencia de `dist` previa a typecheck

**Bloqueante.** Ambos comandos deben devolver salida vacía:

```bash
find . -maxdepth 3 -name dist -type d -not -path "*/node_modules/*"
```

```bash
find . -maxdepth 3 -name "*.tsbuildinfo" -not -path "*/node_modules/*"
```

Y, comprobado a través del symlink de pnpm (que es lo que ve realmente el consumidor), debe fallar:

```bash
ls packages/curriculum-engine/node_modules/@sidera/curriculum-domain/dist
```

Salida esperada: `No such file or directory`.

Si algún `dist` sigue activo, **detenerse**: el resultado no sería válido.

Confirmar además que **no se ha ejecutado `pnpm build`** en ningún momento desde el Paso 0.

### Paso 2 — Comprobación sin caché de Turbo: `pnpm typecheck`

```bash
TURBO_FORCE=1 pnpm typecheck
```

Exigido en la salida:

- `• Remote caching disabled`
- `cache bypass, force executing` en cada tarea
- `Cached: 0 cached, 9 total`
- `Tasks: 9 successful, 9 total`
- exit code `0`
- **cero** ocurrencias de `TS2307`
- `@sidera/curriculum-engine` y `@sidera/curriculum-schema` entre las tareas exitosas — no basta con que Turbo no las haya llegado a ejecutar

### Paso 3 — Comprobación de resolución de módulos

Con `dist` todavía ausente:

```bash
cd packages/curriculum-engine && ../../node_modules/.bin/tsc --noEmit --traceResolution
```

Debe aparecer, para `@sidera/curriculum-domain`:

```
was successfully resolved to '.../packages/curriculum-domain/src/index.ts'
```

Repetir en `packages/curriculum-schema`. Si la resolución apunta a `dist/index.d.ts`, el Paso 1 no se cumplió y el resultado es inválido.

### Paso 4 — Build posterior

Desde el mismo estado (sin restaurar los `dist.probe-bak`):

```bash
TURBO_FORCE=1 pnpm build
```

Exigido: `Tasks: 9 successful, 9 total`, `0 cached`, exit code `0`.

Búsqueda explícita de errores de proyecto, que debe devolver vacío:

```bash
cd packages/curriculum-engine && ../../node_modules/.bin/tsc -p tsconfig.json 2>&1 | grep -iE "TS6059|TS6307|rootDir"
```

Repetir en `packages/curriculum-schema`.

### Paso 5 — Verificación de no contaminación de outputs

```bash
find packages/*/dist -type d -not -name dist
```

Debe devolver **vacío**. Cualquier subdirectorio anidado (por ejemplo `dist/curriculum-engine/src/`) indica violación de `rootDir` y **invalida la tarea**.

```bash
ls packages/curriculum-engine/dist
```

Debe contener exactamente: `evaluation`, `evaluation.test`, `index`, `state`, `types` (`.js` + `.d.ts`). Ningún archivo procedente de `curriculum-domain`.

```bash
grep -rn "curriculum-domain" packages/curriculum-engine/dist/*.d.ts
```

Las referencias deben ser por especificador de paquete (`from "@sidera/curriculum-domain"`), **nunca** rutas relativas hacia el source ajeno (`../curriculum-domain/src/...`).

Repetir las tres comprobaciones en `packages/curriculum-schema/dist`.

### Paso 6 — Tests

```bash
pnpm test
```

Exigido: `Test Files 4 passed (4)`, `Tests 34 passed (34)`, exit code `0`.

### Paso 7 — Restauración del entorno de prueba

Eliminar los artefactos **generados por la prueba** y restaurar los originales renombrados. Aplica aquí con especial relevancia la nota anterior: si el borrado recursivo está bloqueado por política, renombrar los artefactos generados a un nombre temporal en lugar de borrarlos, y reportarlo. Lo exigido es el estado final del Paso 8.

```bash
for d in packages/*/dist; do [ -d "$d.probe-bak" ] && rm -rf "$d"; done
```

```bash
for d in packages/*/dist.probe-bak; do [ -d "$d" ] && mv "$d" "${d%.probe-bak}"; done
```

Análogamente para los `tsconfig.tsbuildinfo`. Comprobar que no queda ningún temporal:

```bash
find . -name "*probe*" -not -path "*/node_modules/*" -not -path "./.git/*"
```

### Paso 8 — Verificación final del repositorio

```bash
git status --porcelain
```

Debe mostrar **exactamente** dos entradas, ambas modificadas:

```
 M docs/ARCHITECTURE.md
 M packages/curriculum-domain/package.json
```

```bash
git diff
```

Debe mostrar únicamente el bloque `exports` y la regla de arquitectura. Nada más.

## Verificación en CI real

Tras el merge, el workflow `CI` sobre `main` debe pasar completo en un runner limpio: `lint`, `typecheck`, `test`, `build`, en ese orden, **sin haber modificado `ci.yml`**. Ésa es la comprobación definitiva de que la solución es reproducible fuera de la máquina de desarrollo.

Si `typecheck` volviera a fallar en CI pese a pasar el protocolo local, **detenerse y reportar**; no añadir un `build` previo como paliativo.

## Deuda técnica registrada (fuera de alcance)

`include: ["src/**/*.ts"]` en los tsconfig de paquete incorpora los `*.test.ts` al build, que se emiten dentro de `dist/`. Verificado: `requirements.test.d.ts`, `requirements.test.js` en `curriculum-domain/dist`; `evaluation.test.*` en `curriculum-engine/dist`; `schema.test.*` en `curriculum-schema/dist`.

Los tests están viajando dentro del artefacto compilado. **No se corrige aquí.** Requiere tarea independiente (probablemente un `tsconfig.build.json` con `exclude: ["**/*.test.ts"]`).

## Limitación conocida

Con `types` apuntando al source, el typecheck de `curriculum-engine` y `curriculum-schema` incorpora el source de `curriculum-domain`. Un error de tipos en `curriculum-domain/src` aparecerá también en el typecheck de sus consumidores.

El límite de **runtime** y el del **artefacto emitido** se conservan intactos (verificado en el Paso 5). El que desaparece es el límite a nivel de tipos. Es el precio conocido y aceptado de esta estrategia, a cambio de un `typecheck` que es genuinamente una operación de sólo-lectura y reproducible desde `git clone`.

Segunda observación: hoy **todas** las importaciones cruzadas desde el dominio son type-only — los `.js` emitidos de engine y schema no contienen ninguna referencia a `@sidera/curriculum-domain`. La rama `"default": "./dist/index.js"` no está ejercitada todavía. En cuanto alguien importe un valor (`courseCompleted` es hoy el único export de valor del dominio), esa rama pasará a usarse y exigirá que `curriculum-domain` esté construido; `turbo.json` ya lo garantiza con `build.dependsOn: ["^build"]`, por lo que la arquitectura es correcta, pero conviene saber que esa ruta no está cubierta por la evidencia actual.

## Condición exacta de terminación

La tarea termina cuando **todas** estas condiciones se cumplen a la vez:

1. Los 2 archivos permitidos están modificados y ningún otro.
2. Los 10 criterios de aceptación se cumplen.
3. Los pasos 1 a 8 del protocolo de validación pasan en su totalidad.
4. `git status --porcelain` muestra exactamente las 2 entradas esperadas.
5. `pnpm-lock.yaml` está sin cambios.
6. Se ha entregado el resumen: archivos modificados, salida literal de `pnpm typecheck` / `pnpm build` / `pnpm test`, evidencia de resolución del Paso 3, evidencia de no contaminación del Paso 5, y confirmación de restauración del Paso 7.

**No se hace commit. No se hace push. No se abre PR.** Son pasos humanos posteriores.

**No se continúa con ninguna otra tarea.** En particular, la reorganización de `docs/AGENT_SECURITY.md` y la reescritura del README son una tarea independiente y posterior, ya aprobada pero **no** incluida aquí.

Si cualquier paso del protocolo falla: **detenerse, restaurar el entorno de prueba (Paso 7), reportar el fallo con la salida literal, y no intentar arquitecturas alternativas sin nueva aprobación humana.**
