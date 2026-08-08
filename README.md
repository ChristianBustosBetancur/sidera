# Sidera

Sidera es un producto en desarrollo para estudiantes que necesitan explorar y entender su plan curricular: qué materias existen, cómo se relacionan y qué pueden cursar según su progreso.

## Qué es Sidera

Sidera busca ofrecer una forma navegable de abrir un plan curricular y entender de un vistazo el avance del estudiante, las materias disponibles, las bloqueadas y los requisitos pendientes. La representación visual del plan como una estructura conectada es un objetivo del producto; la interfaz que la hará posible todavía está en construcción.

## El problema

Los planes curriculares suelen presentarse como listas, tablas o documentos PDF. En esos formatos, el estudiante debe rastrear prerrequisitos a mano, reconstruir cadenas de dependencias y comparar su historial con el plan para saber qué puede cursar. El estado de cada materia y el requisito concreto que falta para desbloquearla no son visibles de forma directa.

## Qué busca ofrecer

- **En desarrollo:** explorar un plan curricular como una estructura navegable.
- **En desarrollo:** visualizar las dependencias entre materias.
- **Implementado en `curriculum-engine`:** evaluar requisitos, determinar elegibilidad y derivar si una materia está disponible o bloqueada.
- **Implementado en `curriculum-engine`:** producir diagnósticos sobre el requisito concreto que impide cursar una materia.
- **En desarrollo:** representar el progreso del estudiante frente al plan mediante una interfaz visual.
- **Implementado en el modelo de dominio; experiencia y datos en desarrollo:** representar distintos programas y versiones de plan.

## Modelo curricular

La arquitectura ya modela la jerarquía curricular indicada abajo: el modelo de dominio está preparado para representar múltiples universidades, cada una con sus propios programas académicos, planes curriculares y versiones de plan. `Course` identifica una materia compartida dentro de una universidad y `VersionCourse` representa su aparición contextual en una versión de plan, por lo que dos apariciones con el mismo `CourseId` pueden tener requisitos distintos. Consulta [el dominio curricular](docs/DOMAIN.md) para el detalle.

`University → AcademicProgram → CurriculumPlan → PlanVersion`

## Estado actual

- Sidera está en desarrollo activo y no está listo para producción.
- `curriculum-domain`, `curriculum-schema` y `curriculum-engine` están implementados y todavía evolucionan.
- Los demás paquetes y las aplicaciones continúan en construcción.
- No hay datos institucionales reales; los datos presentes son ficticios y mínimos.
- Las interfaces visuales aún están en construcción.
- Los contratos internos pueden cambiar sin aviso.

## Ejecutar Sidera

Requisitos:

- Node.js 24.x.
- pnpm 11.x; la versión exacta está fijada por el campo `packageManager` de `package.json`.

Instala las dependencias:

```bash
pnpm install
```

Inicia la aplicación para estudiantes:

```bash
pnpm --filter web dev
```

Inicia el panel administrativo:

```bash
pnpm --filter admin dev
```

Ambas aplicaciones son actualmente páginas placeholder. `pnpm dev` inicia las dos mediante Turborepo; como usan `next dev` sin un puerto explícito, la segunda toma un puerto alternativo de forma no determinista. Para fijar el panel administrativo en el puerto 3001, usa:

```bash
pnpm --filter admin dev -- --port 3001
```

## Desarrollo

Sidera utiliza un workflow supervisado para validar los cambios antes de integrarlos.

Ejecuta las validaciones por separado:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

El monorepo separa aplicaciones y lógica curricular:

- `apps/web` y `apps/admin` contienen las interfaces placeholder.
- `packages/curriculum-domain`, `packages/curriculum-schema` y `packages/curriculum-engine` contienen el núcleo implementado de dominio, validación estructural y evaluación curricular.
- `packages/curriculum-validator`, `packages/curriculum-snapshot`, `packages/curriculum-importer` y `packages/database` son stubs en construcción.

## Documentación

- Producto: [docs/PRODUCT.md](docs/PRODUCT.md).
- Arquitectura: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- Dominio curricular: [docs/DOMAIN.md](docs/DOMAIN.md).
- Rendimiento: [docs/PERFORMANCE.md](docs/PERFORMANCE.md).
- Seguridad operativa para agentes: [docs/AGENT_SECURITY.md](docs/AGENT_SECURITY.md).
- La licencia se define en [LICENSE](LICENSE).
