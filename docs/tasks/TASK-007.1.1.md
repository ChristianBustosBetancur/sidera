# TASK-007.1.1 — Derivar el nombre del componente no modelado

## Objetivo

La nota añadida en TASK-007.1 deriva el número de créditos pero **escribe a mano** el nombre "Libre Elección":

```jsx
{unmodeledCredits} créditos de Libre Elección aún no están modelados en Sidera.
```

Con el dataset actual el texto es exacto —Libre Elección es el único componente sin agrupaciones—, pero el nombre está acoplado a un dato que debería derivarse. Es la misma clase de acoplamiento que `codex-data-audit` marcó en TASK-005.3 con `"Plan oficial"`.

Esta tarea deriva también el nombre. **Cambio mínimo**, todo lo demás de TASK-007.1 intacto.

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

## Estado actual (inspeccionado antes de escribir esta tarea)

- `apps/web/lib/curriculum-data.ts` expone `unmodeledComponentRequiredCredits(components): number`, que filtra `component.groupings.length === 0` y suma `requiredCredits`. **No filtra por `requiredCredits > 0`.**
- `apps/web/lib/curriculum-data.ts` ya expone `componentsById`, un `Map<ComponentId, Component>` construido desde el snapshot, con `.name`. **El nombre se puede resolver sin tocar dominio, motor ni dataset.**
- `ComponentCreditProgress` (motor) trae `componentId`, `requiredCredits` y `groupings[]`, pero **no** el nombre — por eso hace falta el `Map`.
- El texto vive inline en `curriculum-view.tsx`, dentro de `.progressCard`.

## Decisiones aprobadas

1. **Helper único que devuelve la nota completa**, sustituyendo a `unmodeledComponentRequiredCredits`. Devuelve `undefined` cuando no hay componentes sin modelar, de modo que el JSX solo decida renderizar o no:
   ```ts
   unmodeledComponentsNote(components, componentName?) : { credits; names; text } | undefined
   ```
2. **Criterio de "no modelado"**: componente **sin agrupaciones** (`groupings.length === 0`) **y con `requiredCredits > 0`**. El segundo filtro es nuevo: un componente sin agrupaciones y sin créditos exigidos no aporta nada y no debe generar nota.
3. **Redacción según el número de componentes:**
   - **Exactamente uno**: `"{N} créditos de {nombre} aún no están modelados en Sidera."`
   - **Más de uno**: se listan los nombres de forma compacta, unidos con comas y una `y` final (p. ej. `"{N} créditos de A, B y C aún no están modelados en Sidera."`). Se listan porque la nota es corta y el nombre es información útil; **prohibido** producir una frase que nombre solo a uno de ellos o que insinúe que son un único componente.
4. **El nombre se resuelve desde `componentsById`**, mediante un parámetro con valor por defecto para que el helper siga siendo puro y testeable con fixtures propias:
   ```ts
   componentName: (id: ComponentId) => string | undefined = (id) => componentsById.get(id)?.name
   ```
5. **Nombre no resoluble**: si un `componentId` no está en el mapa, sus créditos **siguen contando** en el total, y se usa un descriptor neutro para ese componente, coherente con el estilo ya presente en `requirementLines` (`"el componente indicado"`). **Prohibido** omitir esos créditos en silencio o inventar un nombre.
6. **La redacción se mantiene como limitación de Sidera**, no como déficit del estudiante — igual que en TASK-007.1. Prohibido "te faltan N créditos" o equivalente.
7. **Nada más cambia.** Ni el cálculo de créditos satisfechos, ni las barras, ni las etapas cromáticas, ni la llamada única al motor, ni el resto de la Vista Plan. Sin cambios de estilo salvo que la nota nueva lo exija (no debería).
8. **Cero cambios en `packages/**` (dominio, esquema, motor, dataset) y en `/grafo`. Sin dependencias nuevas.**

## Alcance permitido

```
apps/web/lib/curriculum-data.ts        (sustituir el helper por unmodeledComponentsNote)
apps/web/lib/curriculum-data.test.ts   (tests del helper nuevo)
apps/web/app/curriculum-view.tsx       (renderizar note.text en vez del texto inline)
```

Ningún otro archivo debe modificarse. En particular: nada bajo `packages/**`, `apps/web/app/graph-view.*`, `apps/web/lib/curriculum-graph.ts`, `apps/admin/**`, `tools/agent/**`, ni ningún `package.json`. `apps/web/app/curriculum-view.module.css` solo si la nota lo requiriese, cosa que no se espera.

## Fuera de alcance

- Cualquier cambio a la semántica de créditos satisfechos (TASK-007.0/007.1).
- TASK-007.2: marcador de proyección, línea de conteos aprobadas/disponibles.
- `/grafo`, el bug móvil/tablet, `MIN_COMPONENT_CREDITS`, Libre Elección normativa.
- Modelar materias o agrupaciones de Libre Elección.
- El hydration mismatch de `docs/KNOWN_ISSUES.md`.

## Tests (Vitest sin DOM, en `curriculum-data.test.ts`)

1. **Un componente sin modelar** → `credits`, `names` con un solo nombre, y `text` exactamente `"29 créditos de Libre Elección aún no están modelados en Sidera."` usando una fixture con ese nombre y 29 créditos.
2. **Dos o más componentes sin modelar** → `text` lista todos los nombres de forma compacta y `credits` es la suma; ningún nombre queda fuera.
3. **Ningún componente sin modelar** (todos con agrupaciones) → devuelve `undefined`.
4. **Componente sin agrupaciones pero con `requiredCredits === 0`** → **no** genera nota (decisión 2).
5. **Nombre no resoluble** → sus créditos siguen sumando y el texto usa el descriptor neutro, sin inventar nombre (decisión 5).
6. **Con el dataset oficial real**: el resultado es `29` créditos y el nombre del componente de Libre Elección tal como aparece en el snapshot — no una cadena escrita a mano en el test.

Los tests existentes deben seguir pasando; los de `unmodeledComponentRequiredCredits` se sustituyen por los del helper nuevo.

## Criterios de aceptación

1. El nombre del componente ya no aparece escrito a mano en `curriculum-view.tsx`; procede de los datos.
2. Con exactamente un componente sin modelar, el texto es `"{N} créditos de {nombre} aún no están modelados en Sidera."`.
3. Con más de uno, todos los nombres aparecen de forma compacta y correcta; ninguna frase afirma que son uno solo.
4. Un componente sin agrupaciones y con `requiredCredits === 0` no genera nota.
5. Un nombre no resoluble no descarta sus créditos ni produce un nombre inventado.
6. Con el dataset oficial, la nota sigue diciendo 29 créditos y el nombre real del componente.
7. La redacción sigue expresando una limitación de Sidera, no un déficit del estudiante.
8. Nada más de la Vista Plan cambia: barras, porcentajes, etapas, llamada única al motor.
9. Cero cambios en `packages/**`, `/grafo` y dataset. Cero dependencias nuevas.
10. Ningún archivo fuera de "Alcance permitido" queda modificado.
11. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pasan sin errores.

## Comandos de validación

```
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Condición exacta de terminación

La tarea termina cuando los criterios de aceptación se cumplen y la secuencia de validación se ejecuta sin errores. Codex entrega el resumen indicado en `AGENTS.md` y se detiene, sin iniciar ninguna tarea posterior.
