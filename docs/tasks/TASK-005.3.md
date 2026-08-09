# TASK-005.3 — Auditoría de fidelidad del dataset en la experiencia

## Objetivo

Verificar, con `codex-data-audit`, que las dos vistas construidas (TASK-005.1, TASK-005.2) representan fielmente el dataset oficial y su fuente — sin datos inventados, sin afirmaciones de procedencia incorrectas o hardcodeadas, sin omisiones presentadas como si fueran datos completos — y corregir los hallazgos concretos que resulten de esa auditoría, dentro de un alcance mínimo.

No es una tarea de nueva funcionalidad visual. Es integración y verificación de fidelidad sobre lo ya construido.

## Reviewers requeridos

```reviewers
claude-review
codex-data-audit
```

Aplicación directa de `docs/AGENT_REVIEW_POLICY.md`: "dataset, importación o fuentes curriculares" → `claude-review` + `codex-data-audit`.

## Hallazgo ya identificado (punto de partida, no el único a corregir)

Verificado antes de escribir esta tarea: `apps/web/app/curriculum-view.tsx` muestra el texto **literal** `"Plan oficial"` junto al nombre del plan, en vez de leerlo de `unalCs2024Official.planVersion.provenance` (que vale `"official"`, TASK-004.4). **`planVersion.lifecycle` (`"draft"`) no se muestra en ninguna parte de ninguna de las dos vistas.** El texto hardcodeado da la respuesta correcta hoy por coincidencia, no porque esté leyendo el dato real — si `provenance` cambiara alguna vez, la UI seguiría diciendo "Plan oficial" de forma incorrecta. `apps/web/app/graph-view.tsx` no muestra ni siquiera el nombre del plan ni su procedencia, solo la universidad.

## Contexto mínimo

- `docs/curriculum-sources/acuerdo-0018-2024-materias.md` — la fuente curada. `codex-data-audit` debe leerla completa.
- `packages/curriculum-snapshot/src/data/unal-cs-2024-official/index.ts` — el dataset. `codex-data-audit` debe leerlo completo y compararlo contra la fuente.
- `apps/web/app/curriculum-view.tsx`, `apps/web/app/graph-view.tsx`, `apps/web/lib/curriculum-data.ts`, `apps/web/lib/curriculum-graph.ts` — todo el código de las dos vistas existentes.
- `docs/tasks/TASK-004.4.md` — decisiones vinculantes del dataset: `provenance: "official"`, `lifecycle: "draft"`, exclusión explícita de `3010665 Cursos de posgrado`, sin `Grouping` para Libre Elección.
- `docs/AGENT_REVIEW_POLICY.md` — contrato de salida de `codex-data-audit` (`sourceMismatches`, `inventedFields`, `unresolvedReferences`, `provenanceIssues`).

## Decisiones aprobadas

1. **`provenance` y `lifecycle` se leen del dato real, nunca como texto hardcodeado.** Ambas vistas deben mostrar, de forma visible y consistente, que el plan es `official` y que su `lifecycle` es `draft` — con el texto que corresponda a esos valores reales, no una cadena fija que coincida con el valor actual por casualidad. Si el dataset cambiara de `provenance` o `lifecycle`, la UI debe reflejarlo sin tocar código.
2. **`codex-data-audit` hace una pasada completa de fidelidad**, comparando: fuente (`docs/curriculum-sources/acuerdo-0018-2024-materias.md`) → dataset (`packages/curriculum-snapshot`) → lo que ambas vistas de `apps/web` efectivamente muestran. Busca específicamente:
   - Datos mostrados en la UI que no provienen del dataset (inventados o derivados incorrectamente).
   - Afirmaciones de procedencia/estado incorrectas o desactualizadas (como el hallazgo ya identificado).
   - Materias, créditos, requisitos o agrupaciones que la UI omite silenciosamente sin indicarlo, cuando el dataset sí los tiene.
   - Cualquier mezcla accidental de datos de la Propuesta de Malla Curricular — no debería haber ninguna, pero se verifica explícitamente.
   - Referencias no resueltas visibles en la UI (materias referenciadas que no existen en el dataset).
3. **Los hallazgos de `codex-data-audit` que sean blockers se corrigen dentro de esta misma tarea**, si la corrección es mecánica y acotada (mostrar un dato real en vez de uno hardcodeado, corregir un texto, arreglar una referencia rota). Si un hallazgo implica una decisión de producto o de dominio no cubierta aquí, se reporta como blocker real y **no se implementa** — se detiene la tarea y se reporta, no se improvisa una solución.
4. **Sin cambios en `packages/curriculum-domain`, `curriculum-schema`, `curriculum-engine` ni `curriculum-snapshot`.** Esta tarea corrige cómo `apps/web` presenta los datos, no los datos mismos. Si la auditoría concluyera que el propio dataset tiene un error, se reporta como blocker — no se edita el dataset en esta tarea.
5. **Sin funcionalidad nueva más allá de lo que la fidelidad exige.** No es la tarea para añadir filtros, búsqueda, exportación ni ninguna otra mejora — solo lo que corrija una discrepancia real encontrada.
6. **Sin dependencias nuevas.**

## Alcance permitido

```
apps/web/app/curriculum-view.tsx     (fix del hallazgo identificado + lo que la auditoría encuentre en este archivo)
apps/web/app/graph-view.tsx          (mostrar procedencia/plan + lo que la auditoría encuentre en este archivo)
apps/web/lib/curriculum-data.ts      (si conviene centralizar la lectura de provenance/lifecycle aquí)
apps/web/app/*.module.css            (solo el estilo mínimo necesario para mostrar el dato nuevo)
```

Ningún otro archivo debe modificarse, salvo que un hallazgo real de `codex-data-audit` justifique tocar otro archivo dentro de `apps/web` — en ese caso, debe reportarse explícitamente por qué.

## Fuera de alcance

- Cualquier cambio en `packages/curriculum-domain`, `curriculum-schema`, `curriculum-engine`, `curriculum-snapshot` (decisión 4).
- Nueva funcionalidad no motivada por un hallazgo de fidelidad (decisión 5).
- Resolver el hydration mismatch de `docs/KNOWN_ISSUES.md`.
- Persistencia, backend, cuentas de usuario, 3D.
- `apps/admin`.
- TASK-005.4 o cualquier tarea posterior.

## Criterios de aceptación

- `provenance` y `lifecycle` se muestran en ambas vistas, leídos de `unalCs2024Official.planVersion`, sin texto hardcodeado que dependa de su valor actual.
- `codex-data-audit` completó una comparación real fuente → dataset → UI, y su veredicto queda en los artefactos del run.
- Todo blocker mecánico encontrado por `codex-data-audit` está corregido.
- Todo hallazgo que implique una decisión de producto/dominio queda reportado, no implementado a ciegas.
- Ninguna vista muestra datos que no provengan del dataset real.
- No hay mezcla de datos de la Propuesta de Malla Curricular en ninguna vista.
- Ambas vistas de TASK-005.1 y TASK-005.2 siguen funcionando igual en todo lo demás.
- Cero dependencias nuevas.
- Ningún archivo fuera de "Archivos permitidos" queda modificado sin justificación explícita.
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

La tarea termina cuando `codex-data-audit` completó su auditoría, los hallazgos mecánicos están corregidos, los criterios de aceptación se cumplen, y la secuencia de validación se ejecuta sin errores — o cuando se reporta explícitamente un hallazgo que requiere una decisión humana, sin haberlo resuelto por su cuenta. Codex entrega el resumen indicado en `AGENTS.md`, incluyendo el detalle de la auditoría de `codex-data-audit`, y se detiene, sin iniciar ninguna tarea posterior.
