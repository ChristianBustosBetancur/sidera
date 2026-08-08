# Sidera

Sidera es una herramienta para explorar y entender planes curriculares: qué materias se pueden cursar, qué las bloquea y cómo avanza el progreso hacia el grado.

## Estado del proyecto

Sidera está en desarrollo activo y todavía no está listo para producción. No contiene datos curriculares reales de ninguna institución; todos los datos presentes son ficticios y mínimos. Las interfaces y los contratos pueden cambiar sin aviso.

## Alcance del núcleo

El modelo de dominio soporta múltiples universidades y múltiples programas académicos mediante la jerarquía `University → AcademicProgram → CurriculumPlan → PlanVersion`, con `Course` como catálogo institucional compartido. Inicialmente, Sidera se está construyendo para explorar planes curriculares.

## Estructura del monorepo

- `apps/web` — aplicación para estudiantes.
- `apps/admin` — panel administrativo curricular.
- `packages/curriculum-domain` — entidades y tipos del dominio, sin dependencias de runtime.
- `packages/curriculum-schema` — contratos y validación estructural (Zod).
- `packages/curriculum-engine` — prerrequisitos, desbloqueos y progreso.

Existen paquetes adicionales que aún están en construcción.

## Requisitos

- Node.js 24.x.
- pnpm 11.x; la versión exacta la fija el campo `packageManager` de `package.json`.

## Instalación y comandos

Instala las dependencias:

```bash
pnpm install
```

Ejecuta cada validación por separado:

```bash
pnpm lint
```

```bash
pnpm typecheck
```

```bash
pnpm test
```

```bash
pnpm build
```

## Ejecución de las aplicaciones

Para iniciar la aplicación para estudiantes:

```bash
pnpm --filter web dev
```

Para iniciar el panel administrativo:

```bash
pnpm --filter admin dev
```

`pnpm dev` inicia ambas aplicaciones mediante Turborepo. Como ambas usan `next dev` sin un puerto explícito, la segunda toma automáticamente un puerto alternativo de forma no determinista; para fijar el panel administrativo en el puerto 3001, usa:

```bash
pnpm --filter admin dev -- --port 3001
```

## Seguridad y secretos

No deben subirse secretos ni archivos `.env` reales al repositorio. `.env` está ignorado por git y solo se versionan archivos de ejemplo. Consulta [docs/SECURITY.md](docs/SECURITY.md) para conocer las reglas de seguridad.

## Licencia

Sidera se distribuye bajo la licencia [MIT](LICENSE).
