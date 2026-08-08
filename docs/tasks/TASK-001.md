# TASK-001 — Bootstrap técnico del monorepo

## Objetivo

Preparar la estructura técnica base del monorepo (workspace, build system, TypeScript, apps y packages vacíos) para que el desarrollo funcional pueda comenzar en tareas posteriores.

## Contexto mínimo

- `docs/ARCHITECTURE.md` — estructura de apps y packages prevista.
- `AGENTS.md` — reglas de alcance para Codex.

## Alcance permitido

- Configuración de workspace con pnpm.
- Configuración de Turborepo.
- Configuración base de TypeScript (tsconfig raíz + referencias).
- Creación de `apps/web` y `apps/admin` como aplicaciones Next.js mínimas (sin funcionalidad curricular).
- Estructura inicial (vacía o con esqueleto mínimo) de los packages: `curriculum-domain`, `curriculum-engine`, `curriculum-schema`, `curriculum-validator`, `curriculum-snapshot`, `curriculum-importer`, `database`.
- Configuración de ESLint.
- Configuración de Vitest a nivel de monorepo, incluyendo un único smoke test técnico mínimo que compruebe que la infraestructura de tests funciona (sin lógica curricular ni pruebas de dominio).
- Scripts raíz (`package.json`) para build, lint, test, dev.
- `.gitignore`.

## Archivos y directorios esperados

```
pnpm-workspace.yaml
turbo.json
package.json
tsconfig.json
.gitignore
.eslintrc* (o configuración ESLint equivalente)
apps/web/
apps/admin/
packages/curriculum-domain/
packages/curriculum-engine/
packages/curriculum-schema/
packages/curriculum-validator/
packages/curriculum-snapshot/
packages/curriculum-importer/
packages/database/
```

## Fuera de alcance

- Funcionalidades curriculares de cualquier tipo.
- Supabase.
- PostgreSQL.
- Esquema de base de datos.
- React Flow.
- Three.js.
- Autenticación.
- PWA / Service Worker.
- APIs.
- Datos curriculares reales.
- Implementación del motor curricular (`curriculum-engine` queda vacío o con esqueleto mínimo, sin lógica).
- Despliegue de cualquier tipo.
- GitHub Actions — fuera de alcance de TASK-001, sin excepciones.
- Prettier — no se instala todavía.
- TASK-002 o cualquier tarea posterior.

## Criterios de aceptación

- El monorepo instala correctamente con pnpm (`pnpm install`) sin errores.
- `apps/web` y `apps/admin` pueden arrancar en modo desarrollo sin errores (páginas mínimas/placeholder, sin funcionalidad curricular); esta comprobación es manual/puntual y no forma parte de la validación automática final.
- Todos los packages listados existen con su `package.json` propio y son reconocidos por el workspace.
- El build raíz (Turborepo) se ejecuta sin errores sobre todos los proyectos.
- El lint raíz se ejecuta sin errores sobre todos los proyectos.
- El typecheck raíz se ejecuta sin errores sobre todos los proyectos.
- Vitest se ejecuta correctamente a nivel raíz, incluyendo el smoke test técnico mínimo, el cual pasa (aunque no existan pruebas de dominio todavía).
- No existe ningún dato curricular real, esquema de base de datos, ni integración con Supabase/PostgreSQL en el repositorio.

## Comandos de validación

```
pnpm install
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

Adicionalmente, se puede comprobar de forma manual/puntual que ambas apps arrancan (`pnpm --filter web dev`, `pnpm --filter admin dev`), pero estos comandos no forman parte de la validación automática final ni de la condición de terminación, ya que dejan procesos activos.

## Condición exacta de terminación

La tarea se considera terminada cuando todos los criterios de aceptación se cumplen y la secuencia `pnpm install`, `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test` se ejecuta sin errores. Al terminar, Codex debe entregar el resumen indicado en `AGENTS.md` y detenerse, sin iniciar TASK-002 ni ninguna otra tarea.
