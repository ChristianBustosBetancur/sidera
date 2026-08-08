# TASK-000.T1 — Tarea desechable de prueba del runner

**Esta no es una tarea de producto.** Existe únicamente para ejercitar el runner de agentes de TASK-003.2 (FASE 1, simulada). No implementa nada, no se revisa contra criterios reales y no se commitea su resultado.

## Objetivo

Servir de carga de prueba para `tools/agent/run.mjs`: comprobar la máquina de estados, la observabilidad en terminal, los artefactos de `.agent/runs/**`, el presupuesto de intentos y el abort humano.

## Contexto mínimo

Ninguno. La tarea no requiere leer documentación del proyecto.

## Alcance permitido

El stub de IMPLEMENT escribe un archivo simulado en `.agent/simulated-workspace/TASK-000.T1/`, que está ignorado por Git.

Para la prueba manual T5, y sólo con `--implement=write-repo-file`, el stub escribe además `SIMULATED-T5-SCRATCH.md` en la raíz del repositorio, para poder comprobar que un Ctrl+C **no** lo destruye. Ese archivo se borra a mano al terminar la prueba.

## Fuera de alcance

- Cualquier cambio en `packages/**`, `apps/**`, `tests/**`.
- Cualquier cambio en configuración, CI o dependencias.
- Invocar Claude o Codex reales.
- Commit o push de cualquier resultado.

## Criterios de aceptación

Los del runner, no los de esta tarea:

1. El ciclo transita `IMPLEMENT → VALIDATE → REVIEW` y termina en `HUMAN_GATE` o `STOPPED`.
2. `.agent/state.json` refleja fase, intento, `mode: "simulated"`, `activeProcess` y `stopReason`.
3. `.agent/runs/TASK-000.T1/<timestamp>/` contiene los artefactos numerados y `events.jsonl`.
4. Todo lo producido por los stubs está marcado como `SIMULATED`.

## Cómo se ejecuta

```bash
node tools/agent/run.mjs TASK-000.T1 --reset
```

## Nota

Cuando el runner deje de ser simulado, esta tarea deja de tener sentido y debe eliminarse.
