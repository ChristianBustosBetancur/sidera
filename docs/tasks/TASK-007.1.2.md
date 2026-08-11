# TASK-007.1.2 — Redacción gramaticalmente neutra de la nota de componentes no modelados

## Objetivo

TASK-007.1.1 derivó correctamente el nombre del componente, pero la plantilla `"{N} créditos de {nombre} aún no están modelados en Sidera."` produce una frase que cojea con el nombre real del dataset:

> "29 créditos de **Componente de Libre Elección** aún no están modelados en Sidera."

El nombre incluye la palabra "Componente", así que la preposición pide *"del"*. Esta tarea cambia la plantilla por una **gramaticalmente neutra**, que funcione con cualquier nombre sin contracciones ni concordancias.

Cambio mínimo: **solo la construcción del texto**. Todo lo demás de TASK-007.1.1 queda intacto.

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

## Estado actual

`apps/web/lib/curriculum-data.ts`, en `unmodeledComponentsNote`:

```ts
const namesText =
  names.length === 1
    ? names[0]
    : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;

return {
  credits,
  names,
  text: `${credits} créditos de ${namesText} aún no están modelados en Sidera.`,
};
```

## Decisiones aprobadas

1. **Plantilla nueva para un solo componente**, fijada por el humano:
   ```
   {N} créditos aún no modelados en Sidera ({nombreDelComponente}).
   ```
   Al ir el nombre entre paréntesis, ninguna preposición lo precede y la frase funciona con cualquier nombre.
2. **Varios componentes**: se conserva la misma estructura, con los nombres derivados listados dentro del paréntesis de forma compacta (comas y una `y` final), p. ej.:
   ```
   {N} créditos aún no modelados en Sidera (A, B y C).
   ```
   Sigue siendo gramaticalmente neutra por la misma razón. **Prohibido** volver a una construcción con preposición delante del nombre.
3. **Nada más cambia.** Se conservan sin tocar: el filtro `groupings.length === 0 && requiredCredits > 0`, la suma de créditos, el array `names`, el parámetro inyectable `componentName`, el fallback `"el componente indicado"` para nombres no resolubles, el retorno `undefined` cuando no hay componentes sin modelar, y la firma del helper.
4. **La redacción sigue expresando una limitación de Sidera**, no un déficit del estudiante.
5. **Sin cambios en `packages/**`, `/grafo`, dataset, ni en el resto de la Vista Plan.** Sin dependencias nuevas. Sin cambios de estilo.

## Alcance permitido

```
apps/web/lib/curriculum-data.ts        (solo la construcción de `text`)
apps/web/lib/curriculum-data.test.ts   (actualizar las aserciones de texto)
```

`apps/web/app/curriculum-view.tsx` **no debe cambiar**: ya renderiza `unmodeledNote.text` y es agnóstico de la redacción.

Ningún otro archivo debe modificarse.

## Fuera de alcance

- Cualquier cambio a la lógica de selección de componentes, suma de créditos, resolución de nombres o fallback (decisión 3).
- Semántica de créditos satisfechos (TASK-007.0/007.1).
- TASK-007.2, `/grafo`, bug móvil/tablet, `MIN_COMPONENT_CREDITS`, Libre Elección normativa.
- El hydration mismatch de `docs/KNOWN_ISSUES.md`.

## Tests

Se **actualizan las aserciones de texto** de los tests existentes de `unmodeledComponentsNote` a la plantilla nueva; no se añaden casos nuevos ni se eliminan los existentes:

1. Un componente → `text === "29 créditos aún no modelados en Sidera (Libre Elección)."` (con la fixture correspondiente).
2. Varios componentes → el texto lista todos los nombres dentro del paréntesis, con la `y` final; ningún nombre queda fuera.
3. Ningún componente sin modelar → sigue devolviendo `undefined`.
4. `requiredCredits === 0` sin agrupaciones → sigue sin generar nota.
5. Nombre no resoluble → el descriptor neutro aparece dentro del paréntesis y los créditos siguen sumando.
6. Dataset oficial → 29 créditos y el nombre real del snapshot, con la plantilla nueva.

Los 94 tests existentes deben seguir pasando (con las aserciones de texto actualizadas donde corresponda).

## Criterios de aceptación

1. Con un componente, `text` sigue exactamente la plantilla `"{N} créditos aún no modelados en Sidera ({nombre})."`.
2. Con varios, los nombres van dentro del paréntesis, listados de forma compacta y completa.
3. Ninguna variante coloca una preposición inmediatamente antes del nombre del componente.
4. El filtro, la suma, `names`, `componentName`, el fallback y el retorno `undefined` quedan sin cambios.
5. `curriculum-view.tsx` no se modifica.
6. La redacción sigue siendo una limitación de Sidera, no un déficit del estudiante.
7. Cero cambios en `packages/**`, `/grafo` y dataset. Cero dependencias nuevas.
8. Ningún archivo fuera de "Alcance permitido" queda modificado.
9. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pasan sin errores.

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
