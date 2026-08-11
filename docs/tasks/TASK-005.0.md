# TASK-005.0 — Reviewers especializados en el runner (CODEX_QA, CODEX_DATA_AUDIT)

## Objetivo

Extender `tools/agent/run.mjs` para que una TASK pueda requerir, además del `claude-review` actual, dos reviewers opcionales adicionales ejecutados con **Codex CLI en sesiones independientes y read-only**: `codex-qa` y `codex-data-audit`.

Es una **extensión mínima del runner existente**, no una reescritura. La fase `REVIEW` pasa de ejecutar un reviewer a ejecutar el conjunto declarado por la TASK, y el gate pasa a exigir `PASS` de todos ellos.

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

> **Nota de bootstrap (no es una excepción a la política):** esta TASK es la que *implementa* la lectura de este bloque. El runner que la ejecuta es el anterior, que solo conoce `claude-review`; por tanto `codex-qa` quedará declarado pero no se ejecutará en este run concreto. A partir de la siguiente TASK, el bloque se respeta de verdad. Esto debe reportarse explícitamente en el resumen, no darse por ejecutado.

## Contexto mínimo

- `docs/AGENT_REVIEW_POLICY.md` — **la política es vinculante**: ids válidos, tabla de selección, contratos de salida y gate agregado ya están definidos ahí. Esta TASK los implementa, no los redefine.
- `tools/agent/run.mjs` — el runner actual. Leer entero antes de tocarlo.
- `tools/agent/selftest.mjs` — pruebas de regresión del runner, en modo `--simulated`. Dependen de los nombres de artefacto `40-review-prompt.md` y del comportamiento actual.
- `docs/tasks/TASK-003.2.md` — decisiones vigentes del workflow: presupuesto de reparación (decisión C), observabilidad sin chain-of-thought (decisión K), abort seguro (decisión L), una TASK por ejecución (decisión M). **Ninguna se modifica aquí.**
- `AGENTS.md` — reglas de alcance para Codex.

## Hechos verificados del CLI (no inventar flags)

Comprobado con el binario real (`codex exec --help`, codex-cli 0.147.0) antes de redactar esta TASK:

| Flag | Estado | Uso aquí |
|---|---|---|
| `--sandbox <MODE>` | valores válidos: `read-only`, `workspace-write`, `danger-full-access` | los reviewers usan `read-only` |
| `--ephemeral` | existe: "Run without persisting session files to disk" | garantiza sesión independiente, sin contexto compartido con IMPLEMENT |
| `--ignore-user-config` | existe | ya usado por IMPLEMENT, se replica |
| `--ignore-rules` | existe | ya usado por IMPLEMENT, se replica |
| prompt por stdin (`-`) | existe | mismo mecanismo que IMPLEMENT |

**No se usa ningún flag fuera de esta tabla.** En particular, no se usan `--output-schema`, `--json` ni `-o/--output-last-message`: el parseo del último bloque ```json cercado ya está implementado y probado en el runner, y reusarlo es lo mínimo.

## Decisiones aprobadas

1. **Invocación de los reviewers Codex**, idéntica a IMPLEMENT salvo el sandbox:

   ```
   codex exec --sandbox read-only --ephemeral --ignore-user-config --ignore-rules -
   ```

   `--ephemeral` es lo que materializa "sesión independiente": no persiste archivos de sesión, y cada invocación es un proceso nuevo sin contexto heredado de IMPLEMENT.

2. **Declaración de reviewers en la TASK**: el runner extrae del documento de la TASK (`00-task.md` dentro del run dir) el primer bloque cercado de lenguaje `reviewers`, y toma un id por línea, ignorando líneas vacías y espacios. Formato exacto documentado en `docs/AGENT_REVIEW_POLICY.md`.

3. **Por defecto, `claude-review` únicamente**: si la TASK no declara bloque `reviewers`, o el archivo de TASK no existe, se ejecuta solo `claude-review`. Es el comportamiento actual, y así **ninguna TASK anterior ni el selftest cambian de resultado**.

4. **`claude-review` siempre se ejecuta**, esté o no listado. Si el bloque lo omite, se añade implícitamente.

5. **Id desconocido → `STOPPED`**, nunca se ignora en silencio. Nuevo `stopReason`: `"unknown-reviewer"`, con el id ofensor en el evento. Coherente con la filosofía existente de "un review ambiguo es un fallo del sistema, no un PASS".

6. **El snapshot de evidencia se construye UNA vez por intento**, con la `buildReviewSnapshot()` existente, y se comparte entre todos los reviewers. Motivo: todos deben juzgar exactamente la misma evidencia, y reconstruirlo por reviewer sería trabajo redundante sobre git.

7. **Evidencia por reviewer**:
   - `claude-review`: sin cambios respecto a hoy — mismo prompt, mismo system prompt evidence-only, mismos artefactos `40/41/42`.
   - `codex-qa` y `codex-data-audit`: reciben el mismo bundle (TASK, diff, status, resultados de VALIDATE) y **además pueden leer el repositorio**, porque corren con sandbox `read-only`. Esa diferencia es deliberada y está justificada en `docs/AGENT_REVIEW_POLICY.md`; no se les prohíbe leer archivos en el prompt.

8. **Artefactos separados por agente**, siguiendo la numeración existente:

   | Reviewer | Prompt | Salida | Veredicto |
   |---|---|---|---|
   | `claude-review` | `40-review-prompt.md` | `41-review-output.md` | `42-verdict.json` |
   | `codex-qa` | `50-qa-prompt.md` | `51-qa-output.md` | `52-qa-verdict.json` |
   | `codex-data-audit` | `60-data-audit-prompt.md` | `61-data-audit-output.md` | `62-data-audit-verdict.json` |

   Los nombres `40/41/42` **no se renombran**: el selftest depende de ellos.

9. **Parseo de veredicto compartido**: la lógica actual (último bloque ```json, `verdict` ∈ {`PASS`,`FAIL`}) sirve para los tres. Se exige `verdict`; `blockers` se lee como `parsed.blockers ?? []`. Los campos informativos adicionales (`risks`, `missingTests`, `sourceMismatches`, `inventedFields`, `unresolvedReferences`, `provenanceIssues`) se persisten tal cual en el archivo de veredicto sin validación de forma — no bloquean el gate.

10. **Gate agregado**: se llega a `HUMAN_GATE` solo si `VALIDATE` pasó **y** todos los reviewers requeridos devolvieron `PASS`. Si alguno devuelve `FAIL`, los `blockers` de **todos** los que fallaron se concatenan en un único documento de blockers, etiquetado por reviewer, y se vuelve a `IMPLEMENT`.

11. **La reparación re-ejecuta todo**: en la vuelta siguiente se ejecutan de nuevo `VALIDATE` completo y **todos** los reviewers requeridos, no solo el que falló.

12. **Presupuesto de reparación sin cambios**: intento inicial + 2 reparaciones (`MAX_ATTEMPTS = 3`), después `STOPPED` con `repair-budget-exhausted`.

13. **Reglas terminales existentes, ahora por reviewer**: un veredicto no parseable de cualquier reviewer → `STOPPED` con `unparseable-verdict`; un `FAIL` con `blockers` vacío de cualquier reviewer → `STOPPED` con `empty-blockers`. En ambos casos el evento debe registrar **cuál** reviewer lo produjo.

14. **Modo `--simulated`**: todos los reviewers requeridos usan el stub existente `tools/agent/stubs/review.mjs` (acepta `--verdict` y `--out`), cada uno escribiendo sus propios artefactos. No se crean stubs nuevos. El flag `--review=<pass|fail>` sigue aplicando a todos por igual.

15. **Observabilidad (decisión K de TASK-003.2, sin relajarla)**: la terminal debe mostrar, por intento, el inicio/fin/veredicto de cada reviewer requerido y un `SKIPPED` explícito para los no requeridos, más el veredicto agregado del gate. Todo ello se persiste en `events.jsonl` con el mismo detalle. **No se captura, muestra ni persiste razonamiento privado** de ningún agente.

16. **Sin cambios en seguridad**: los reviewers no escriben archivos, no ejecutan git, no usan red adicional, MCP, búsqueda web ni credenciales. El runner sigue sin contener código capaz de `push`, `merge` ni `checkout main`, y sigue sin rollback destructivo.

## Alcance permitido

- `tools/agent/run.mjs`: la extensión descrita arriba.
- `tools/agent/selftest.mjs`: **únicamente añadir** dos casos de regresión nuevos, sin modificar los existentes:
  1. Una TASK sin bloque `reviewers` ejecuta solo `claude-review` y produce los artefactos `40/41/42`, sin `50-*` ni `60-*` (comportamiento por defecto preservado).
  2. Una TASK que declara un id desconocido termina en `STOPPED` con `stopReason: "unknown-reviewer"`.

Ninguna dependencia nueva. El runner sigue sin dependencias externas.

## Fuera de alcance

- Reescribir o reestructurar `run.mjs` más allá de lo necesario para esta extensión. El objetivo declarado es una extensión mínima.
- Añadir proveedores nuevos: solo Claude CLI y Codex CLI, ya presentes.
- Usar flags de CLI fuera de la tabla de "Hechos verificados".
- Cambiar el presupuesto de reparación, el manejo de `SIGINT`, la lógica de `buildReviewSnapshot()`, el system prompt de `claude-review`, o los nombres de artefacto existentes.
- Cambiar `.github/workflows/**`, `packages/**`, `apps/**` o cualquier documento de TASK anterior.
- Modificar `docs/AGENT_REVIEW_POLICY.md` (ya versionada y aprobada; es entrada, no salida, de esta TASK).
- Ejecutar reviewers en paralelo: se ejecutan secuencialmente, como el resto del runner.
- TASK-005.1 o cualquier tarea posterior.

## Archivos permitidos

```
tools/agent/run.mjs         (extensión de la fase REVIEW y el gate)
tools/agent/selftest.mjs    (solo añadir los 2 casos nuevos descritos)
```

Ningún otro archivo debe modificarse.

## Criterios de aceptación

- Una TASK sin bloque `reviewers` produce exactamente el mismo comportamiento y los mismos artefactos que antes de esta TASK.
- Una TASK que declara `codex-qa` y/o `codex-data-audit` los ejecuta con `codex exec --sandbox read-only --ephemeral --ignore-user-config --ignore-rules -`, en procesos independientes, y escribe sus artefactos en los nombres de la decisión 8.
- `claude-review` se ejecuta siempre, aunque el bloque no lo liste.
- Un id de reviewer desconocido termina el run en `STOPPED` con `stopReason: "unknown-reviewer"`.
- El gate solo alcanza `HUMAN_GATE` con `VALIDATE` PASS y todos los reviewers requeridos en PASS.
- Un `FAIL` de cualquier reviewer acumula sus blockers, etiquetados por reviewer, y vuelve a `IMPLEMENT`; la vuelta siguiente re-ejecuta `VALIDATE` y **todos** los reviewers requeridos.
- El presupuesto sigue siendo intento inicial + 2 reparaciones.
- Un veredicto no parseable o un `FAIL` sin blockers, de cualquier reviewer, produce `STOPPED` identificando al reviewer responsable.
- La terminal y `events.jsonl` reflejan inicio/fin/veredicto por reviewer, los `SKIPPED`, y el veredicto agregado.
- No se persiste razonamiento privado de ningún agente.
- El snapshot de evidencia se construye una sola vez por intento.
- `tools/agent/selftest.mjs` pasa completo, incluidos sus casos previos sin modificar y los 2 nuevos.
- El runner sigue sin dependencias externas y sin código capaz de `push`, `merge`, `checkout main`, `git reset --hard` ni `git clean`.
- Ningún archivo fuera de los dos permitidos queda modificado.

## Comandos de validación

```
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Verificación específica de esta TASK:

```
node tools/agent/selftest.mjs
```

## Condición exacta de terminación

La tarea termina cuando los criterios de aceptación se cumplen, `node tools/agent/selftest.mjs` pasa completo, y la secuencia de validación se ejecuta sin errores. Codex entrega el resumen indicado en `AGENTS.md` —incluyendo explícitamente que `codex-qa` no llegó a ejecutarse en este run por el bootstrap descrito arriba— y se detiene, sin iniciar TASK-005.1 ni ninguna otra tarea.
