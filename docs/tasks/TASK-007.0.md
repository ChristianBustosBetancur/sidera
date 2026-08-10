# TASK-007.0 — Semántica de créditos curriculares satisfechos

## Objetivo

Introducir en `curriculum-engine` la distinción entre **créditos aprobados que pertenecen a un alcance** (`raw`) y **créditos que efectivamente satisfacen el requisito curricular** de ese alcance (`satisfied`), más el remanente (`excess`).

Hoy `calculatePlanProgress` suma créditos completados sin considerar la estructura obligatoria/optativa que el Acuerdo 0018 de 2024 declara, lo que permite que optativas excedentes sustituyan obligatorias pendientes y que una agrupación incompleta se reporte como 100 %.

**Esta tarea es solo de motor.** No toca Vista Plan, `/grafo`, `MIN_COMPONENT_CREDITS`, Libre Elección, ni reasigna excedentes.

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

Lógica de dominio con aritmética y casos borde reales → `claude-review` + `codex-qa` (`docs/AGENT_REVIEW_POLICY.md`, fila de `curriculum-engine` / algoritmos).

## Fundamento normativo (confirmado contra el Acuerdo 0018 de 2024)

El humano verificó el PDF original del Acuerdo, que **declara explícitamente** los créditos obligatorios y optativos exigidos por agrupación:

| Agrupación | Exigidos | Obligatorios | Optativos |
|---|---|---|---|
| Matemáticas | 44 | 40 | 4 |
| Programación | 9 | 9 | 0 |
| Ciencias Naturales y Estadística | 8 | 4 | 4 |
| Algoritmos y Computación | 19 | 12 | 7 |
| Computación Científica | 16 | 8 | 8 |
| Sistemas de Cómputo | 6 | 0 | 6 |
| Computación Aplicada | 7 | 0 | 7 |
| Trabajo de Grado | 8 | 8 | 0 |

Y a nivel componente: Fundamentación 61 = 53 obligatorios + 8 optativos; Disciplinar o Profesional 56 = 20 obligatorios + 28 optativos + 8 de Trabajo de Grado; Libre Elección 29.

**Ya no es una regla inferida.** Está respaldada por la norma.

**Verificación hecha antes de escribir esta tarea**: la fórmula residual `cupoOptativo = grouping.requiredCredits − Σ créditos de cursos mandatory` **reproduce exactamente** las cifras del Acuerdo en las 8 agrupaciones y en los 2 componentes con agrupaciones modeladas. Por eso el cupo se **deriva** en el motor y **no hace falta** añadir campos a `curriculum-domain`, `curriculum-schema` ni al dataset.

## Decisiones aprobadas

1. **Tres magnitudes por alcance:**
   - `rawCredits`: créditos de materias `COMPLETED` que pertenecen al alcance. Sin tope.
   - `satisfiedCredits`: créditos que satisfacen el requisito, respetando cupos. Siempre `≤ requiredCredits`.
   - `excessCredits`: `rawCredits − satisfiedCredits`. **Se conserva como información y no se reasigna a ningún otro alcance.**
2. **Cálculo por agrupación:**
   ```
   cupoOptativo        = max(grouping.requiredCredits − créditosObligatoriosTotales, 0)
   obligatoriasSatisf. = Σ créditos de materias mandatory COMPLETED de la agrupación
   optativasSatisf.    = min(Σ créditos de materias no-mandatory COMPLETED, cupoOptativo)
   satisfiedCredits    = obligatoriasSatisf. + optativasSatisf.
   ```
   `créditosObligatoriosTotales` = suma de créditos de **todas** las materias `mandatory` de la agrupación presentes en el contexto.
3. **Las optativas nunca sustituyen obligatorias.** Es consecuencia directa de la decisión 2: el término de optativas está acotado por `cupoOptativo` y no puede compensar obligatorias pendientes. Debe quedar explícito en el código y cubierto por tests.
4. **Propagación estricta hacia arriba:**
   ```
   satisfied(componente) = Σ satisfied(agrupaciones del componente)
   satisfied(plan)       = Σ satisfied(componentes)
   ```
   **Prohibido** recalcular el componente o el plan volviendo a sumar cursos crudos: eso es exactamente el bug que esta tarea corrige. `raw` y `excess` se agregan de la misma forma aditiva.
5. **Libre Elección no se infiere.** Un componente sin agrupaciones modeladas aporta `satisfied = 0`. **Prohibido** rellenarlo con excedentes de otros alcances o estimarlo de cualquier forma. Su `requiredCredits` sigue contando en el denominador del plan; la consecuencia (el plan solo puede representar 117 de 146 créditos satisfechos hoy) es correcta y esperada.
6. **Proyección con `IN_PROGRESS` compartiendo cupo, no duplicándolo.** La proyección se calcula sobre la unión de completadas y en curso, con un único `min`:
   ```
   optativasProyectadas = min(Σ optativas (COMPLETED ∪ IN_PROGRESS), cupoOptativo)
   ```
   **Prohibido** calcular `min` por separado para completadas y para en curso y sumar los resultados: eso consumiría el cupo dos veces. La proyección es una magnitud aparte; **no altera** `satisfiedCredits`.
7. **`calculatePlanProgress` no se modifica ni se elimina.** Conserva su firma y comportamiento actuales (semántica `raw`), porque `apps/web` la consume y la UI está fuera de alcance. La API nueva **convive** con ella; la migración de consumidores es TASK-007.1.
8. **Diagnóstico ante datos inconsistentes.** Si en una agrupación los créditos obligatorios superan `requiredCredits` (cupo residual negativo), el cupo se acota a `0` y se emite un diagnóstico estructurado. Hoy no ocurre en el dataset (verificado, 8/8), pero el cupo derivado depende de que el contexto contenga todas las materias obligatorias, así que la inconsistencia debe reportarse en vez de producir números silenciosamente erróneos.
9. **Materias fuera de agrupación conocida** no contribuyen a ninguna agrupación; se reportan con el diagnóstico de referencia no resuelta ya existente, sin inventar pertenencia.
10. **Sin cambios en `MIN_COMPONENT_CREDITS`, `MIN_GROUPING_CREDITS`, `MIN_TOTAL_CREDITS`, `MIN_GROUPING_COURSES`, `evaluation.ts`, `state.ts`.** La semántica del gate de Trabajo de Grado queda deliberadamente intacta y se decidirá en una tarea específica.
11. **Sin cambios fuera de `packages/curriculum-engine`.** Sin dependencias nuevas.

## Alcance permitido

```
packages/curriculum-engine/src/progress.ts        (API nueva; NO modificar calculatePlanProgress)
packages/curriculum-engine/src/types.ts           (tipos de resultado y diagnóstico nuevo)
packages/curriculum-engine/src/index.ts           (exports)
packages/curriculum-engine/src/progress.test.ts   (tests obligatorios)
```

Si Codex considera imprescindible un archivo adicional **dentro de `packages/curriculum-engine/src/`** (p. ej. un módulo propio para la nueva lógica), puede crearlo, justificándolo en el resumen. Cualquier necesidad de tocar `curriculum-domain`, `curriculum-schema`, `curriculum-snapshot` o `apps/**` es motivo para **detenerse y reportar**, no para proceder.

## Fuera de alcance

- `apps/web` completo: Vista Plan, `/grafo`, barras EXP, proyección visual, conteos.
- `evaluation.ts`, `state.ts`, y los cuatro leaves de umbral de crédito (decisión 10).
- Modificar o eliminar `calculatePlanProgress` (decisión 7).
- Añadir campos a `curriculum-domain` / `curriculum-schema` / dataset (el cupo se deriva).
- Reasignar excedentes a Libre Elección o a cualquier otro alcance (decisión 5).
- Inferir materias o agrupaciones de Libre Elección.
- Reglas de graduación, `3010665 Cursos de posgrado`, la Propuesta de Malla Curricular.

## Tests obligatorios

Todos en `progress.test.ts`, con fixtures propios del test (no dependen del snapshot real):

1. **Matemáticas** — 36 créditos obligatorios + 8 optativos completados → `satisfied = 40`, **no 44**; `raw = 44`; `excess = 4`.
2. **Matemáticas** — 40 obligatorios + 4 optativos → `satisfied = 44`; `excess = 0`.
3. **Matemáticas** — 40 obligatorios + 24 optativos → `satisfied = 44`; `excess = 20`.
4. **Programación** — agrupación 100 % obligatoria: comportamiento normal, `satisfied = raw` mientras no se exceda, `excess = 0`.
5. **Sistemas de Cómputo** — agrupación 100 % optativa: 15 créditos completados → `satisfied = 6`; `excess = 9`.
6. **Computación Aplicada** — muchas optativas completadas → `satisfied` topa en `7`.
7. **Componente Fundamentación** — `satisfied` topa en `61`; el exceso de Matemáticas **no** lo infla.
8. **Componente Disciplinar o Profesional** — `satisfied` topa en `56`.
9. **El exceso de una agrupación no compensa el déficit de otra** (p. ej. exceso en Computación Aplicada con Algoritmos incompleto).
10. **Invariantes**, comprobados en agrupación, componente y plan: `satisfied ≤ requiredCredits`; `satisfied ≤ raw`; `excess === raw − satisfied`.
11. **`IN_PROGRESS` comparte el cupo optativo restante con `COMPLETED`**: con el cupo ya consumido por completadas, una optativa en curso **no** incrementa la proyección de esa agrupación.
12. **Libre Elección no se infiere**: componente sin agrupaciones → `satisfied = 0`, sin recibir excedentes de otros componentes.

Adicionalmente: un caso de cupo residual negativo → acotado a `0` con el diagnóstico de la decisión 8.

Los **72 tests existentes deben seguir pasando sin modificarse**, salvo la actualización mecánica de fixtures si un tipo compartido lo exigiera — en cuyo caso ninguna aserción existente puede cambiar.

## Criterios de aceptación

1. Existe API nueva en `curriculum-engine` que expone `rawCredits`, `satisfiedCredits` y `excessCredits` por agrupación, componente y plan.
2. El cupo optativo se deriva como `requiredCredits − créditosObligatoriosTotales`, acotado inferiormente a `0`.
3. Las optativas completadas se acotan al cupo; nunca compensan obligatorias pendientes.
4. Componente y plan derivan su `satisfied` de la agregación de sus hijos, sin volver a sumar cursos crudos.
5. Un componente sin agrupaciones aporta `satisfied = 0` y no recibe excedentes.
6. La proyección con `IN_PROGRESS` usa un único `min` sobre la unión con `COMPLETED`; no consume el cupo dos veces ni altera `satisfiedCredits`.
7. `calculatePlanProgress` conserva firma y comportamiento; sus tests actuales pasan sin modificarse.
8. Cupo residual negativo → `0` + diagnóstico estructurado.
9. Los 12 tests obligatorios están implementados y pasan.
10. Cero cambios fuera de `packages/curriculum-engine/src/`.
11. Cero dependencias nuevas.
12. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pasan sin errores.

## Comandos de validación

```
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Condición exacta de terminación

La tarea termina cuando los criterios de aceptación se cumplen y la secuencia de validación se ejecuta sin errores — o cuando Codex reporta explícitamente que necesita tocar un package fuera de `curriculum-engine`, sin hacerlo por su cuenta. Codex entrega el resumen indicado en `AGENTS.md` y se detiene, sin iniciar ninguna tarea posterior.
