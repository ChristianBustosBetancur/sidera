# TASK-003.3 — Real agent workflow smoke test

## Objetivo

Validar end-to-end el workflow real:

Codex IMPLEMENT → VALIDATE → Claude REVIEW → HUMAN_GATE.

## Cambio solicitado

Añadir a README.md una única frase breve en una sección apropiada indicando que Sidera utiliza un workflow supervisado para validar cambios antes de integrarlos.

## Alcance

Modificar únicamente:

- README.md

## Restricciones

- No cambiar comportamiento del producto.
- No agregar dependencias.
- No modificar otros archivos.
- No hacer commit.
- No hacer push.

## Criterios de aceptación

- Sólo README.md queda modificado por IMPLEMENT.
- La frase añadida es breve y coherente con el README actual.
- lint pasa.
- typecheck pasa.
- test pasa.
- build pasa.
- Claude REVIEW devuelve PASS.
- El runner termina en HUMAN_GATE.
