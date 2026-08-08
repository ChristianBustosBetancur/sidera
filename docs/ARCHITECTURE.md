# ARCHITECTURE.md — Sidera

## Visión general

Monorepo con separación estricta entre interfaz, dominio y datos. La lógica curricular no depende de ningún framework de UI.

La raíz conceptual institucional es `University`: de ella dependen `AcademicProgram → CurriculumPlan → PlanVersion` y el catálogo compartido de `Course`.

## Aplicaciones

- `apps/web` — aplicación usada por estudiantes.
- `apps/admin` — panel administrativo curricular (edición, validación, publicación de versiones).

## Paquetes de dominio (independientes de React/Next.js)

- `packages/curriculum-domain` — entidades y tipos del dominio.
- `packages/curriculum-engine` — lógica de prerrequisitos, desbloqueos y progreso.
- `packages/curriculum-schema` — contratos y validación estructural.
- `packages/curriculum-validator` — validación del grafo curricular.
- `packages/curriculum-snapshot` — generación de snapshots inmutables para el cliente.
- `packages/curriculum-importer` — importación CSV/Excel.
- `packages/database` — acceso a datos y contratos de persistencia.

## Principios de separación

- Los datos curriculares nunca se escriben directamente dentro de componentes visuales.
- La lógica curricular (prerrequisitos, desbloqueos, progreso) es independiente de React, Next.js y de la interfaz, y se ejecuta localmente en el dispositivo.
- El 3D es completamente opcional y se carga solo como mejora progresiva; nunca es una dependencia del flujo funcional.
- La misma lógica de dominio se usa desde frontend, backend, importadores y pruebas, sin duplicación.
- Los paquetes TypeScript internos pueden exponer sus tipos desde source mediante package exports mientras el runtime sigue consumiendo artefactos compilados, cuando esto sea necesario para que el typecheck del monorepo sea reproducible desde un checkout limpio. No es una regla automática para todos los paquetes: se aplica cuando existe una dependencia de workspace real que lo requiere.

## Publicación y versionado (principios, no implementación)

- Las versiones curriculares publicadas son inmutables.
- Corregir una versión publicada produce una nueva versión; no se edita in-place.
- Toda modificación curricular requiere validación y aprobación humana antes de publicarse.
- La información oficial, propuesta, archivada y comunitaria se mantiene claramente separada en todo momento.
- El cliente consume snapshots publicados, no el estado editable en vivo.

## Notas

Este documento describe principios y estructura de alto nivel. El esquema de base de datos, la API concreta y los detalles de implementación de snapshots se definen en tareas posteriores, no aquí.

## Decisiones de alto impacto

Cualquier decisión arquitectónica no cubierta explícitamente en este documento debe presentarse para aprobación humana antes de asumirse.
