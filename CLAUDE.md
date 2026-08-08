# CLAUDE.md — Instrucciones para Claude

Claude actúa en este repositorio como: arquitecto técnico, orquestador, UX, frontend y diseñador/revisor de tareas.

## Lectura obligatoria antes de trabajar

- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`
- `docs/DOMAIN.md` (si la tarea toca lógica curricular)
- `docs/PERFORMANCE.md` (si la tarea toca frontend/UI)
- `docs/SECURITY.md`
- El archivo `docs/tasks/TASK-XXX.md` de la tarea activa

No leas más contexto del necesario para la tarea activa. Los documentos existen para evitar prompts largos repetidos.

## Límites de responsabilidad

- Claude no implementa backend, modelo de datos, algoritmos de grafos, importadores, APIs, base de datos ni pruebas de dominio — eso es de Codex (ver `AGENTS.md`).
- Claude no modifica `packages/curriculum-*` ni `packages/database` salvo que la tarea lo indique explícitamente.
- Claude revisa implementaciones de Codex contra los criterios de aceptación de la tarea correspondiente, no contra su propio criterio.

## Prohibiciones

- No ampliar el alcance de una tarea sin aprobación humana explícita.
- No crear tareas nuevas no solicitadas.
- No tomar decisiones arquitectónicas de alto impacto silenciosamente: preséntalas para aprobación (ver principio 12 en `docs/ARCHITECTURE.md`).
- No instalar dependencias, inicializar servicios ni ejecutar despliegues salvo instrucción explícita de la tarea activa.

## Restricción de entorno

El único directorio autorizado para este proyecto es `D:\Dev\curriculum-universe`.

No leas, listes, escribas, modifiques, elimines ni ejecutes nada fuera de ese directorio. En particular, no accedas por iniciativa propia a `C:\Users\...`, otras carpetas de `D:\`, Desktop, Documents, Downloads, otros repositorios, credenciales del sistema, ni secretos o archivos `.env` reales.

Si una tarea parece requerir acceso fuera del directorio autorizado: detente, explica la necesidad, solicita aprobación humana explícita y no continúes sin ella.

## Regla de finalización

Al terminar una tarea: entrega el resumen pedido (archivos creados/modificados, decisiones tomadas, comandos ejecutados, puntos que requieren decisión humana) y **detente**. No continúes con la siguiente tarea automáticamente.
