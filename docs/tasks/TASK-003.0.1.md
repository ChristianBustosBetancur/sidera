# TASK-003.0.1 — Cierre de la cláusula transitoria de ruta autorizada

## Objetivo

Eliminar de `CLAUDE.md` y `AGENTS.md` la autorización transitoria de `D:\Dev\curriculum-universe`, dejando `D:\Dev\sidera` como **única** ruta autorizada del proyecto. Sin cambios funcionales.

## Contexto mínimo

- El renombrado físico `D:\Dev\curriculum-universe` → `D:\Dev\sidera` ya fue **completado y validado** por una persona.
- El repositorio está limpio y el historial de Git permanece intacto.
- `CLAUDE.md` y `AGENTS.md` contienen, en su sección "Restricción de entorno", una **cláusula transitoria** introducida en TASK-003.0 que mantenía viva la ruta antigua para evitar un bloqueo autoinfligido durante el renombrado. Esa condición ya no aplica.
- TASK-003.0 previó explícitamente esta tarea de cierre (ver `docs/tasks/TASK-003.0.md`, sección "Renombrado manual posterior de la carpeta").

Ubicación exacta del texto a eliminar (una única línea en cada archivo, idéntica en ambos):

```
CLAUDE.md:33   **Cláusula transitoria:** ... D:\Dev\curriculum-universe ...
AGENTS.md:38   **Cláusula transitoria:** ... D:\Dev\curriculum-universe ...
```

## Alcance permitido

Exclusivamente estos dos archivos:

```
CLAUDE.md
AGENTS.md
```

Y dentro de ellos, exclusivamente:

- La eliminación del párrafo de la cláusula transitoria en la sección "Restricción de entorno".

## Fuera de alcance

- Cualquier otro archivo del repositorio, incluidos `docs/tasks/TASK-003.0.md` y el resto de `docs/**`. Las menciones históricas a `curriculum-universe` en tareas ya cerradas son **registro histórico** y no se tocan.
- Reescribir, reordenar, reformular, resumir o "mejorar" cualquier otra regla de `CLAUDE.md` o `AGENTS.md`.
- Añadir rutas autorizadas, excepciones, matices o cualquier ampliación de permisos.
- Código, `package.json`, lockfile, configuración, CI, scripts.
- Ejecutar operaciones de archivos fuera del repositorio.
- `git commit` y `git push`.
- Cualquier tarea posterior (TASK-003.1, TASK-004, etc.).

## Implementación requerida

1. En `CLAUDE.md`, eliminar el párrafo completo de la cláusula transitoria (y la línea en blanco sobrante que quede), dejando la sección "Restricción de entorno" con esta estructura y sin ningún otro cambio de redacción:
   - la frase que declara `D:\Dev\sidera` como único directorio autorizado;
   - el párrafo de prohibiciones (`C:\Users\...`, otras carpetas de `D:\`, Desktop, Documents, Downloads, otros repositorios, credenciales del sistema, secretos y `.env` reales);
   - el párrafo de escalada (detenerse, explicar, pedir aprobación humana explícita, no continuar sin ella).
2. Aplicar exactamente la misma eliminación en `AGENTS.md`.

La implementación es **estrictamente sustractiva**. No se añade ningún texto nuevo y no se modifica ninguna otra línea de esos dos archivos: ni redacción, ni orden, ni formato, ni puntuación. La única operación permitida es la eliminación de la cláusula transitoria (y de la línea en blanco sobrante que quede).

## Criterios de aceptación

1. `CLAUDE.md` autoriza únicamente `D:\Dev\sidera`.
2. `AGENTS.md` autoriza únicamente `D:\Dev\sidera`.
3. No existe ninguna autorización activa para `D:\Dev\curriculum-universe` en ningún archivo del repositorio.
4. Permanecen intactas, literalmente, las prohibiciones sobre:
   - `C:\Users\...`
   - otras carpetas de `D:\`
   - Desktop, Documents, Downloads
   - otros repositorios
   - archivos `.env` reales
   - secretos y credenciales del sistema
   - operaciones destructivas y ejecución fuera del directorio autorizado
5. Permanece intacta la regla de escalada: ante una necesidad de acceso externo, detenerse y pedir aprobación humana explícita.
6. No se han ampliado permisos de ningún tipo respecto al estado anterior.
7. El diff modifica **exclusivamente** `CLAUDE.md` y `AGENTS.md`.
8. El diff es **exclusivamente sustractivo**: no contiene ninguna línea añadida ni modificada en `CLAUDE.md` ni en `AGENTS.md`.
9. No hay commit ni push.

## Comandos de validación

```
git status
git diff --stat
git diff
```

Comprobación de que no queda autorización activa a la ruta antigua (las únicas coincidencias admisibles son las menciones históricas dentro de `docs/tasks/`):

```
git grep -n "curriculum-universe" -- CLAUDE.md AGENTS.md
```

Este comando debe devolver **cero** resultados.

## Condición exacta de terminación

La tarea termina cuando se cumplen los criterios de aceptación y `git diff --stat` muestra únicamente `CLAUDE.md` y `AGENTS.md`.

No se hace commit ni push. Se entrega el resumen indicado en `CLAUDE.md` / `AGENTS.md` (archivos modificados, decisiones tomadas, comandos ejecutados, puntos que requieren decisión humana) y se **detiene**. El commit lo realiza una persona tras la revisión humana.
