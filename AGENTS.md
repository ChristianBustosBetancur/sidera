# AGENTS.md — Instrucciones para Codex en Sidera

Codex actúa en este repositorio como responsable de: backend, modelo de datos, lógica de dominio, algoritmos de grafos, validaciones, importadores, APIs, base de datos y pruebas.

## Lectura obligatoria antes de trabajar

- `docs/ARCHITECTURE.md`
- `docs/DOMAIN.md`
- `docs/AGENT_SECURITY.md`
- El archivo `docs/tasks/TASK-XXX.md` de la tarea activa

No leas más contexto del necesario para la tarea activa.

## Reglas de alcance

- Implementa exclusivamente lo definido en "Alcance permitido" de la tarea activa. Ignora todo lo listado en "Fuera de alcance".
- No modifiques `apps/web` ni `apps/admin` (frontend) salvo indicación explícita en la tarea.
- No hagas refactors, renombrados ni limpiezas no solicitadas, aunque el código lo sugiera.
- Si una tarea es ambigua o requiere una decisión arquitectónica no cubierta en `docs/`, pregunta antes de asumir.

## Pruebas y contratos

- Toda lógica de dominio (`packages/curriculum-*`) debe ser independiente de React/Next.js y utilizable desde frontend, backend, importadores y pruebas sin duplicación (ver `docs/ARCHITECTURE.md`).
- Los contratos de datos se validan con esquemas explícitos (`curriculum-schema`), no con suposiciones implícitas de forma.
- Toda funcionalidad nueva en `packages/curriculum-*` requiere pruebas (Vitest) dentro del mismo alcance de la tarea.

## Seguridad

- No uses credenciales de producción.
- No guardes secretos en el repositorio.
- No ejecutes migraciones ni acciones destructivas sobre datos sin aprobación humana explícita.
- Ver `docs/AGENT_SECURITY.md` para el resto de reglas.

## Restricción de entorno

El único directorio autorizado para este proyecto será `D:\Dev\sidera`.

No leas, listes, escribas, modifiques, elimines ni ejecutes nada fuera de ese directorio. En particular, no accedas por iniciativa propia a `C:\Users\...`, otras carpetas de `D:\`, Desktop, Documents, Downloads, otros repositorios, credenciales del sistema, ni secretos o archivos `.env` reales.

Si una tarea parece requerir acceso fuera del directorio autorizado: detente, explica la necesidad, solicita aprobación humana explícita y no continúes sin ella.

## Regla de finalización

Al terminar una tarea: entrega el resumen pedido por la tarea (archivos creados/modificados, comandos ejecutados, decisiones que requieren aprobación humana) y **detente**. No inicies la siguiente tarea automáticamente.
