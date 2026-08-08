# TASK-003.0 — Renombrado del proyecto a Sidera

## Objetivo

Renombrar el proyecto de **Curriculum Universe** a **Sidera** dentro del repositorio, y dejarlo preparado para el renombrado manual posterior de la carpeta física. Sin cambios funcionales.

## Contexto mínimo

- `CLAUDE.md` y `AGENTS.md` — contienen la sección "Restricción de entorno" a actualizar.
- `package.json` raíz y los `package.json` de cada package — metadatos y namespace.
- `AGENTS.md` — reglas de alcance para Codex.

## Decisiones aprobadas

- Nombre oficial del producto: **Sidera**.
- Nombre futuro del repositorio público: **sidera**.
- Namespace de packages: `@curriculum-universe/*` → `@sidera/*`.
- Los nombres descriptivos internos **no cambian**: `curriculum-domain`, `curriculum-schema`, `curriculum-engine`, `curriculum-validator`, `curriculum-snapshot`, `curriculum-importer`, `database`.
- La ruta autorizada futura en `CLAUDE.md` y `AGENTS.md` será `D:\Dev\sidera`.
- El renombrado físico de la carpeta lo hará **una persona, manualmente, después del commit**.

## Alcance permitido

- Nombres visibles del producto en documentación y en los placeholders de `apps/web` y `apps/admin`.
- Namespace de los siete packages: campo `name` de cada `package.json`.
- Dependencias workspace que referencien el namespace anterior.
- Todos los `import` que referencien `@curriculum-universe/...`.
- `pnpm-lock.yaml`, como consecuencia del cambio de nombres (regenerado por `pnpm install`, no editado a mano).
- Metadatos raíz que usen el nombre anterior (campo `name` del `package.json` raíz).
- Documentación que mencione explícitamente "Curriculum Universe".
- Sección "Restricción de entorno" de `CLAUDE.md` y `AGENTS.md`: la ruta autorizada pasa a `D:\Dev\sidera`.

**Cláusula transitoria obligatoria.** La ruta autorizada se actualiza a `D:\Dev\sidera` **antes** de que la carpeta exista con ese nombre. Para evitar un bloqueo autoinfligido, ambos documentos deben indicar explícitamente que, hasta que se complete el renombrado manual, `D:\Dev\curriculum-universe` sigue siendo la ruta válida y equivalente. Esa nota transitoria se eliminará en una tarea posterior, una vez completado el renombrado.

## Fuera de alcance

- **Ejecutar el renombrado físico** `D:\Dev\curriculum-universe` → `D:\Dev\sidera`. Lo hace una persona, después del commit.
- Acceder, leer, modificar o borrar cualquier ruta fuera del repositorio, incluido el store global de pnpm.
- Cambios en la lógica funcional, en los tipos del dominio, en el engine o en los esquemas: solo cambian los identificadores de paquete en los `import`.
- Añadir funcionalidades, refactors o mejoras no solicitadas.
- Renombrar los nombres internos de los packages o los directorios `packages/*`.
- Crear el repositorio en GitHub, hacer `push`, `LICENSE`, `README.md` o CI (eso es TASK-003.1).
- Cambios en el modelo curricular.
- Introducir `University`, `AcademicProgram` o cualquier estructura institucional (ver el registro de decisión futura al final).
- TASK-003.1, TASK-004 o cualquier tarea posterior.

## Archivos permitidos

```
package.json                                   (name raíz)
packages/*/package.json                        (name + dependencias workspace)
packages/*/src/**                              (solo especificadores de import)
apps/web/app/**                                (solo textos visibles del producto)
apps/admin/app/**                              (solo textos visibles del producto)
CLAUDE.md                                      (nombre del producto + restricción de entorno)
AGENTS.md                                      (nombre del producto + restricción de entorno)
docs/**                                        (menciones a "Curriculum Universe")
pnpm-lock.yaml                                 (regenerado, no editado a mano)
```

Ningún otro archivo debe modificarse.

## Referencias que deben renombrarse

Hay 26 archivos con referencias al nombre anterior. Agrupadas por tipo:

1. **Namespace de packages** (`@curriculum-universe/` → `@sidera/`):
   - campo `name` de los siete `packages/*/package.json`;
   - dependencia de `curriculum-schema` sobre `curriculum-domain`;
   - dependencia de `curriculum-engine` sobre `curriculum-domain`;
   - todos los `import` en `packages/curriculum-schema/src/**` y `packages/curriculum-engine/src/**`, incluidos los archivos de prueba.
2. **Metadatos raíz**: campo `name` de `package.json` (`curriculum-universe` → `sidera`).
3. **Textos visibles del producto**: `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`, `apps/admin/app/layout.tsx`, `apps/admin/app/page.tsx` (títulos, metadatos y encabezados).
4. **Documentación**: `CLAUDE.md`, `AGENTS.md`, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, y las menciones en `docs/tasks/TASK-002.md` y `docs/tasks/TASK-003.md`.
5. **Restricción de entorno**: la ruta autorizada en `CLAUDE.md` y `AGENTS.md`, con la cláusula transitoria descrita arriba.
6. **Lockfile**: `pnpm-lock.yaml`, regenerado mediante `pnpm install`.

Nota sobre las tareas ya cerradas (`TASK-001.md`, `TASK-001.1.md`, `TASK-002.md`, `TASK-003.md`): actualizar únicamente el nombre del producto y los especificadores de paquete. **No** reescribir sus decisiones, criterios ni historial.

## Criterios de aceptación

- No queda ninguna aparición de `@curriculum-universe/` en el repositorio (excluyendo `node_modules/`, `dist/`, `.next/` y `.git/`).
- No queda ninguna aparición de "Curriculum Universe" ni de `curriculum-universe` salvo, si acaso, en contextos donde se documente deliberadamente el nombre anterior.
- Los siete packages conservan sus nombres descriptivos internos y sus directorios; solo cambia el namespace.
- Las dependencias workspace resuelven correctamente tras `pnpm install`.
- `pnpm-lock.yaml` está regenerado por pnpm, no editado a mano.
- Los textos visibles de `apps/web` y `apps/admin` dicen Sidera.
- La sección "Restricción de entorno" de `CLAUDE.md` y `AGENTS.md` indica `D:\Dev\sidera` e incluye la cláusula transitoria.
- **No se ejecutó ningún renombrado de carpeta** ni se accedió a rutas externas al repositorio.
- Ningún cambio de lógica: el diff de `packages/*/src/**` afecta exclusivamente a especificadores de import.
- Las cinco órdenes de validación se ejecutan sin errores y la suite de pruebas sigue pasando con el mismo número de tests que antes del renombrado.

## Comandos de validación

```
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Condición exacta de terminación

La tarea termina cuando los criterios de aceptación se cumplen y los comandos de validación se ejecutan sin errores.

Codex **no** hace commit y **no** hace push. Implementa, valida, revisa su propio diff, entrega el resumen indicado en `AGENTS.md` —confirmando explícitamente que no renombró ninguna carpeta ni accedió a rutas externas— y se detiene.

El commit lo realiza una persona después de la revisión humana, todavía en `D:\Dev\curriculum-universe`. Solo después de ese commit se cierran Claude y Codex y se renombra la carpeta según la sección siguiente.

## Renombrado manual posterior de la carpeta (lo ejecuta una persona)

Después del commit de TASK-003.0, y **no antes**:

1. Cerrar Claude Code y Codex.
2. Renombrar `D:\Dev\curriculum-universe` → `D:\Dev\sidera`.
3. Regenerar solo estado local del proyecto que sea necesario (`node_modules/`, `.turbo/`, `*.tsbuildinfo`). Todo está ignorado por Git y es reconstruible. **No** tocar stores globales de pnpm ni nada fuera del proyecto.
4. Abrir ambos agentes en `D:\Dev\sidera`.
5. Ejecutar: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
6. Comprobar `git status` y `git log`: el historial debe estar intacto, porque Git no almacena el nombre del directorio de trabajo.

Una vez confirmado, la cláusula transitoria de `CLAUDE.md` y `AGENTS.md` podrá eliminarse en una tarea posterior.

---

## Decisión arquitectónica futura (registro — NO implementar en TASK-003.0)

Sidera **no debe quedar acoplada únicamente a Ciencias de la Computación**.

- Lanzamiento inicial: Universidad Nacional de Colombia → Ciencias de la Computación.
- Jerarquía mínima prevista: `University` → `AcademicProgram` → `CurriculumPlan` → `PlanVersion`.
- **No** se introducirán: `Faculty`, `Department`, `Campus`, `Degree`, `School`, SNIES, país/región ni ninguna otra estructura administrativa. Solo `University` y `AcademicProgram` se considerarán en la tarea específica posterior.
- El núcleo (`curriculum-domain`, `curriculum-schema`, `curriculum-engine`, `curriculum-validator`, `curriculum-snapshot`) debe mantenerse **genérico** y no contener nunca lógica específica de Ciencias de la Computación, que será simplemente el primer programa soportado.

Esta expansión se estudiará e incorporará en una tarea separada, después del renombrado. **No forma parte del alcance de TASK-003.0.**
