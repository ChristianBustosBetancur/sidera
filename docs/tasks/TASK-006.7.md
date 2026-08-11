# TASK-006.7 — Reparar el grafo de tareas para checkouts limpios

> Nota de numeración: esta tarea se propuso inicialmente como "TASK-006.3", pero ese número ya está ocupado por `docs/tasks/TASK-006.3.md` ("Prepare Vercel Preview", cerrada). Se usa el siguiente libre de la serie.

## Objetivo

El check `CI / Validate` de GitHub Actions falla en el PR `feat/curriculum-visualization` → `main`, en `pnpm typecheck`, mientras que en local todo pasa. La causa es que el pipeline **depende accidentalmente de artefactos `dist/` preexistentes**, que en un checkout limpio no existen.

Esta tarea repara el grafo de tareas para que la secuencia completa funcione en un checkout limpio. **No es una tarea de producto**: no cambia UI, dominio ni semántica curricular.

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

`docs/AGENT_REVIEW_POLICY.md`: "Infraestructura del workflow" → `claude-review`, más `codex-qa` porque cambia el grafo de dependencias de build.

## Diagnóstico (reproducido en clones aislados, no inferido)

Los packages internos publican tipos y código desde `dist/`:

```json
// packages/curriculum-engine/package.json
"main":  "./dist/index.js",
"types": "./dist/index.d.ts"
```

`dist/` está en `.gitignore` y **0 archivos `dist/` están versionados** (verificado con `git ls-files`). En local existe por decenas de builds previos; en Actions no.

**Defecto A — `turbo.json`:**
```json
"typecheck": { "dependsOn": ["^typecheck"] }
```
Depende del *typecheck* de sus dependencias, no de su *build*. `tsc --noEmit` sobre `apps/web` nunca genera los `.d.ts` de las dependencias → `TS2307: Cannot find module '@sidera/curriculum-engine'` y `'@sidera/curriculum-snapshot'`, seguidos de decenas de `TS7006`/`TS2339` **en cascada** (síntomas, no causas).

**Defecto B — `vitest.config.mts`:**
Solo aliasa `@sidera/curriculum-schema` hacia `src`. `@sidera/curriculum-engine` y `@sidera/curriculum-snapshot` se resuelven vía `package.json` → `dist` → inexistente.

**Reproducción en clon limpio** (`git clone --local` + `pnpm install --frozen-lockfile`, sin `dist` ni `node_modules`):

| Comando | Resultado |
|---|---|
| `pnpm typecheck` | **FALLA** — mismos `TS2307` que Actions |
| `pnpm test` | **FALLA** — `Failed to resolve entry for package "@sidera/curriculum-engine"`, **82/100** |

CI se detiene en `typecheck` y nunca llega a `test`: **arreglar solo `typecheck` dejaría CI fallando en el paso siguiente.**

Prueba de causalidad en el mismo clon: `pnpm build` (9/9) → `dist` aparece → `pnpm typecheck` pasa 9/9.

## Decisiones aprobadas

1. **`turbo.json`**: `typecheck` pasa a depender del build de sus dependencias:
   ```diff
   - "typecheck": { "dependsOn": ["^typecheck"] }
   + "typecheck": { "dependsOn": ["^build"] }
   ```
   El typecheck de un consumidor exige las declaraciones de sus dependencias. **Prohibido** depender de `dist` preexistente.

2. **`vitest.config.mts`**: extender los alias hacia `src`, siguiendo el patrón ya establecido para `curriculum-schema` (TASK-004.6).

   **Set justificado por evidencia, verificado empíricamente** — solo los packages que los tests necesitan resolver **como valor en runtime**:

   | Package | Justificación | Alias |
   |---|---|---|
   | `curriculum-engine` | `calculateSatisfiedPlanProgress` es **valor** en `apps/web/lib/curriculum-data.test.ts` | **añadir** |
   | `curriculum-snapshot` | `unalCs2024Official` es **valor** en el mismo test | **añadir** |
   | `curriculum-schema` | esquemas como valor en el test de snapshot | ya existe, conservar |
   | `curriculum-domain` | **todos** sus imports en el grafo runtime (tests, `engine/src`, `snapshot/src`) son `import type`, erasados en ejecución. Su único valor exportado (`courseCompleted`) no lo consume nadie ahí | **NO añadir** |

   Verificado en clon limpio: con solo esos tres alias, `pnpm test` da **100/100 sin `dist`**. **Prohibido** añadir alias sin evidencia de import como valor.

3. **Prohibiciones explícitas**: no commitear `dist/**`; no añadir `any`; no añadir casts para tapar errores; no tocar `packages/**`; no tocar `apps/**`; no cambiar semántica curricular; no cambiar producto ni UI; **no modificar `.github/workflows/ci.yml`** (con esta corrección no hace falta).

4. **Sin dependencias nuevas.**

## Alcance permitido

```
turbo.json
vitest.config.mts
```

**Dos archivos.** Ningún otro debe modificarse: nada bajo `packages/**`, `apps/**`, `.github/**`, `docs/**` (salvo este documento), ni ningún `package.json`.

## Fuera de alcance

- Versionar `dist/`, cambiar `main`/`types`/`exports` de los packages, project references, condiciones de exports hacia `src`.
- Silenciar errores de TypeScript con `any`, casts o `@ts-ignore`.
- Cambios en `.github/workflows/ci.yml`.
- Producto, UI, dominio, dataset, semántica curricular.
- Merge a `main`, push, o cualquier despliegue.
- Los issues conocidos abiertos (hydration mismatch, bug móvil/tablet, banda 47–72rem, scrollbar horizontal).

## Criterio central de aceptación

**No basta con validar en el repo de trabajo**, donde `dist` ya existe y enmascara el fallo.

Debe validarse en un **clon limpio aislado sin `dist` preexistente**:

```bash
git clone --local <repo> <destino-temporal>
cd <destino-temporal> && git checkout feat/curriculum-visualization
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Resultado esperado: **lint PASS · typecheck PASS · test 100/100 PASS · build PASS**.

## Criterios de aceptación

1. `turbo.json` declara `"typecheck": { "dependsOn": ["^build"] }`.
2. `vitest.config.mts` aliasa hacia `src` exactamente `curriculum-engine`, `curriculum-schema` y `curriculum-snapshot`; **no** aliasa `curriculum-domain`.
3. En un clon limpio sin `dist`: `pnpm install --frozen-lockfile`, `lint`, `typecheck`, `test` (**100/100**) y `build` pasan en ese orden.
4. En el repo de trabajo: `lint`, `typecheck`, `test` (100/100) y `build` siguen pasando.
5. No se versiona ningún archivo bajo `dist/`.
6. No se añade `any`, casts ni supresiones de error.
7. Cero cambios en `packages/**`, `apps/**` y `.github/**`.
8. Cero dependencias nuevas.
9. Ningún archivo fuera de "Alcance permitido" queda modificado.

## Comandos de validación

```
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Condición exacta de terminación

La tarea termina cuando los criterios de aceptación se cumplen, incluida la verificación en clon limpio. Codex entrega el resumen indicado en `AGENTS.md` y se detiene, sin realizar merge, push ni despliegue, y sin iniciar ninguna tarea posterior.
