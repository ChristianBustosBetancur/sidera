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

## Composición de la interfaz de estudiante

`Root layout → AppShell → navegación + PlanContextBar + contenido de ruta`

El shell centraliza la navegación global, la resolución de la ruta activa, la barra lateral de escritorio, el panel lateral de táctil y la barra de contexto y progreso. Las vistas no implementan navegación global propia ni repiten el contexto institucional del plan: cada una comunica su función.

Los nombres visibles y los nombres técnicos no coinciden, y no es necesario que lo hagan. `Mapa de Prerrequisitos` se sirve desde `/grafo` y `Trayectoria Curricular` desde `/explorar`; los archivos y componentes conservan sus nombres técnicos.

### PlanContextBar

- Consume el mismo estado de trayectoria que las vistas, mediante el proveedor compartido.
- Reutiliza los helpers de progreso existentes en lugar de recalcular reglas curriculares, de modo que no introduce una segunda fuente de verdad.
- Mantiene separados los créditos aprobados de los que están en curso: el porcentaje y la barra representan únicamente lo aprobado.
- Es `sticky`, no `fixed`: permanece dentro del flujo del documento, del que dependen las medidas de viewport y el desplazamiento programático que usa Trayectoria Curricular.

### Trayectoria Curricular

- El plan se representa como un grafo dirigido acíclico real, con varias raíces.
- La profundidad visual se deriva de forma independiente del nivel lógico cuando la estructura lo requiere.
- Las aristas y las bifurcaciones se dibujan en SVG; los nodos son elementos HTML posicionados sobre el mismo sistema de coordenadas.
- Los filtros no recalculan el layout ni reordenan el plan: los nodos permanecen en el DOM y solo cambia su presentación.
- El foco sobre una materia seleccionada domina sobre la presentación de los filtros; ambos sistemas no se superponen.

### Reconciliación de trayectoria

Vive en `packages/curriculum-engine` como función pura, no en la capa de React: recibe la trayectoria, el cambio solicitado y el contexto curricular, y devuelve la trayectoria resultante junto con las materias retiradas y las incoherencias detectadas.

Recorre las materias marcadas hasta alcanzar un punto fijo. Cada ronda solo retira marcas, nunca las añade, de modo que el proceso termina siempre y su resultado no depende del orden de recorrido.

No propaga por las aristas del grafo, y es una decisión deliberada: las aristas representan dependencias entre materias, pero no los requisitos agregados por créditos o por número de materias de una agrupación. Reevaluar cada materia marcada con el evaluador real cubre también esos umbrales, las alternativas y los correquisitos sin reimplementar su semántica.

Como es pura, el mismo cálculo sirve para anticipar el impacto de un cambio antes de aplicarlo.

El proveedor de trayectoria es el único coordinador en la capa de React y sigue siempre la misma secuencia: previsualizar, confirmar si hace falta, aplicar. Cuando un cambio no retira ninguna materia en curso se aplica de inmediato; cuando retira alguna, la reconciliación previsualizada queda en espera y se aplica **tal cual** al confirmar, sin recalcularse, de modo que el resultado coincide con el que se mostró.

El diálogo de confirmación lo renderiza el propio proveedor, no cada vista. Las tres superficies que permiten marcar materias comparten así una única política sin implementar nada, y ninguna contiene lógica académica: se limitan a consumir lo que el motor ya calculó.

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
