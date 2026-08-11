# TASK-005.0.1 — Validaciones adicionales declaradas por la TASK

## Objetivo

Permitir que una TASK declare **comandos de validación adicionales** que se ejecuten como parte de `VALIDATE`, junto a las cuatro estándar, de modo que verificaciones específicas (por ejemplo `node tools/agent/selftest.mjs`) formen parte de la **evidencia oficial** y sean visibles para todos los reviewers.

Cierra un hueco real detectado durante TASK-005.0: su criterio de aceptación central era que el selftest pasara, pero `VALIDATE` solo ejecuta `lint/typecheck/test/build`, así que `claude-review` —que es evidence-only por diseño— no podía verificarlo. Rechazó correctamente dos veces y se consumieron dos reparaciones por un defecto de la spec, no del código.

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

## ⚠️ Nota de bootstrap — vinculante para el reviewer

Esta TASK **implementa** el soporte de validaciones extra. El runner que la ejecuta es el anterior, que todavía **no** lee el bloque `validations`. En consecuencia:

- El bloque `validations` declarado más abajo **no se ejecutará en este run**.
- `node tools/agent/selftest.mjs` **no aparecerá** en la evidencia de `VALIDATE` de este run.
- **Ningún reviewer debe emitir un blocker por la ausencia de esa evidencia.** Es una consecuencia conocida y esperada del bootstrap, no un incumplimiento.
- Los criterios de aceptación de esta TASK son verificables **por lectura del diff**. El Controller ejecuta el selftest fuera de banda y reporta el resultado en el resumen.
- A partir de la TASK siguiente, el bloque sí se respeta y la evidencia sí aparece.

`codex-qa` sí se ejecutará en este run: TASK-005.0 ya está integrada y el runner actual lee el bloque `reviewers`.

## Validaciones adicionales

```validations
node tools/agent/selftest.mjs
```

## Contexto mínimo

- `tools/agent/run.mjs` — el runner actual, ya extendido con reviewers en TASK-005.0. Leer entero antes de tocarlo.
- `tools/agent/selftest.mjs` — regresiones del runner en modo `--simulated`.
- `docs/AGENT_REVIEW_POLICY.md` — precedente directo del **formato de declaración**: bloque cercado en el documento de la TASK, parseado por el runner. Esta TASK replica ese patrón para `validations`.
- `docs/tasks/TASK-005.0.md` — la extensión de reviewers, cuyo estilo y convenciones se mantienen.
- `docs/tasks/TASK-003.2.md` — decisiones vigentes: presupuesto de reparación (C), observabilidad sin chain-of-thought (K), abort seguro (L), una TASK por ejecución (M). **Ninguna se modifica aquí.**
- `AGENTS.md` — reglas de alcance para Codex.

## Decisiones aprobadas

1. **Formato de declaración**: bloque cercado de lenguaje `validations` en el documento de la TASK, un comando por línea, ignorando líneas vacías y espacios sobrantes. Mismo patrón que el bloque `reviewers` de TASK-005.0:

   ````markdown
   ## Validaciones adicionales

   ```validations
   node tools/agent/selftest.mjs
   ```
   ````

2. **Las cuatro estándar siguen siendo obligatorias y van primero**: `lint`, `typecheck`, `test`, `build`, en ese orden, exactamente como hoy. Las adicionales se ejecutan **después**, en el orden declarado. Una TASK no puede quitar, sustituir ni reordenar las estándar.

3. **Solo comandos declarados**: el runner no infiere, deduce ni sintetiza ningún comando. Ejecuta exclusivamente las líneas del bloque. Sin bloque, no hay validaciones adicionales.

4. **Sin shell**: cada comando declarado se divide por espacios en programa + argumentos y se lanza **sin shell** (`useShell: false`). Esto elimina encadenamiento y metacaracteres (`&&`, `|`, `;`, redirecciones, sustitución de comandos): una validación declarada es un programa con argumentos, no una línea de shell. Un comando que requiera shell no está soportado y debe replantearse como script invocable directamente.

5. **Fallo = VALIDATE falla**: si una validación adicional devuelve un código de salida distinto de cero, `VALIDATE` falla igual que con una estándar — se corta la secuencia, `REVIEW` no se ejecuta, y su salida se convierte en blockers para la reparación. Mismo comportamiento y mismo corte a la primera que falla.

6. **Misma evidencia, mismos artefactos**: los resultados de las validaciones adicionales se acumulan en el **mismo** array que las estándar (`20-validate.json`) y su salida literal se anexa al **mismo** log (`21-validate.log`). No se crean archivos de artefacto nuevos.

7. **Visibilidad automática para todos los reviewers**: como el prompt de `REVIEW` ya incrusta `JSON.stringify(validateResults)`, incluir las adicionales en ese array las hace evidencia para `claude-review`, `codex-qa` y `codex-data-audit` **sin tocar la ruta de review**. Es el punto central de esta TASK y la razón de la decisión 6.

8. **Distinguibles en la evidencia**: cada entrada de resultado indica si proviene de las estándar o de la declaración de la TASK, mediante un campo explícito (por ejemplo `source: "standard" | "task"`). El nombre exacto del campo queda a criterio de la implementación, pero debe existir y ser legible para un reviewer.

9. **Observabilidad (decisión K de TASK-003.2, sin relajarla)**: cada validación adicional registra en terminal y en `events.jsonl` su inicio, su fin, su código de salida y su resultado, igual que las estándar. No se captura ni persiste razonamiento privado de ningún agente.

10. **Compatibilidad total hacia atrás**: una TASK sin bloque `validations` produce exactamente el mismo comportamiento, los mismos artefactos y la misma evidencia que antes de esta TASK. Todas las TASK anteriores quedan inalteradas.

11. **Sin cambios en el resto del workflow**: presupuesto de reparación, `SIGINT`, `buildReviewSnapshot()`, selección de reviewers, gate agregado y prohibiciones de `push`/`merge`/`main`/destructivas quedan intactos.

## Alcance permitido

- `tools/agent/run.mjs`: parseo del bloque `validations` y ejecución de los comandos declarados dentro de la fase `VALIDATE`.
- `tools/agent/selftest.mjs`: **únicamente añadir** casos de regresión nuevos, sin modificar los existentes:
  1. Una TASK sin bloque `validations` ejecuta exactamente las cuatro estándar (comportamiento por defecto preservado).
  2. Una TASK con una validación adicional que **pasa** la incluye en `20-validate.json`, marcada como declarada por la TASK, y el run continúa a `REVIEW`.
  3. Una TASK con una validación adicional que **falla** hace fallar `VALIDATE`, impide que `REVIEW` se ejecute, y alimenta la reparación.

Ninguna dependencia nueva. El runner sigue sin dependencias externas.

## Fuera de alcance

- Reescribir o reestructurar `run.mjs` más allá de lo necesario. Es una extensión mínima, igual que TASK-005.0.
- Permitir que una TASK modifique, sustituya o reordene las cuatro validaciones estándar.
- Ejecutar comandos con shell, o soportar encadenamiento y metacaracteres (decisión 4).
- Inferir comandos de validación a partir del contenido de la TASK o del diff (decisión 3).
- Paralelizar validaciones: se ejecutan secuencialmente, como el resto del runner.
- Cambiar los artefactos existentes, el presupuesto de reparación o la lógica de reviewers.
- Cambiar `.github/workflows/**`, `packages/**`, `apps/**`, `docs/**` o cualquier documento de TASK anterior.
- TASK-005.1 o cualquier tarea posterior.

## Archivos permitidos

```
tools/agent/run.mjs         (parseo + ejecución de validaciones declaradas)
tools/agent/selftest.mjs    (solo añadir los 3 casos nuevos descritos)
```

Ningún otro archivo debe modificarse.

## Criterios de aceptación

- Una TASK sin bloque `validations` produce exactamente el mismo comportamiento y los mismos artefactos que antes de esta TASK.
- Una TASK con bloque `validations` ejecuta las cuatro estándar primero y después los comandos declarados, en el orden declarado.
- Los comandos declarados se ejecutan sin shell, como programa + argumentos.
- El runner no ejecuta ningún comando que no esté declarado explícitamente en el bloque.
- Una validación adicional fallida hace fallar `VALIDATE`, corta la secuencia y evita `REVIEW`.
- Los resultados de las adicionales aparecen en `20-validate.json` junto a las estándar, distinguibles por un campo explícito, y su salida en `21-validate.log`.
- Los resultados de las adicionales llegan al prompt de todos los reviewers como parte de `validateResults`, sin cambios en la ruta de review.
- Terminal y `events.jsonl` registran inicio, fin, código de salida y resultado de cada validación adicional.
- `node tools/agent/selftest.mjs` pasa completo, incluidos sus casos previos sin modificar y los 3 nuevos.
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

Verificación específica de esta TASK (ejecutada por el Controller fuera de banda, por el bootstrap descrito arriba):

```
node tools/agent/selftest.mjs
```

## Condición exacta de terminación

La tarea termina cuando los criterios de aceptación se cumplen —verificables por lectura del diff— y la secuencia de validación se ejecuta sin errores. Codex entrega el resumen indicado en `AGENTS.md` y se detiene, sin iniciar TASK-005.1 ni ninguna otra tarea.
