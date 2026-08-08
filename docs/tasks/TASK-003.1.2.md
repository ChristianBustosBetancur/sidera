# TASK-003.1.2 — Public repository presentation cleanup

## Objetivo

Dejar la portada pública de Sidera centrada en el **producto**, antes de volver a publicar el repositorio en GitHub:

1. Renombrar `docs/SECURITY.md` a `docs/AGENT_SECURITY.md` para que GitHub deje de presentarlo como Security Policy pública.
2. Actualizar todas las referencias internas a la nueva ruta, sin dejar enlaces rotos.
3. Reescribir `README.md` para que responda primero qué es Sidera y qué problema resuelve, y sólo después cómo se ejecuta y cómo está organizado.

Es una tarea de **documentación y presentación**. No hay lógica nueva, ni cambios de dominio, ni de código funcional, ni de configuración, ni de CI, ni despliegue, ni datos.

Continúa TASK-003.1 (primera publicación) y TASK-003.1.1 (fix de typecheck, ya implementada y commiteada en `c16057e`).

## Contexto mínimo

- `docs/PRODUCT.md` — problema, usuario, flujo principal, MVP y fuera-de-MVP. **Fuente de verdad** para lo que el README puede afirmar sobre el producto.
- `docs/DOMAIN.md` — vocabulario del dominio. Fuente de verdad para el modelo curricular.
- `docs/ARCHITECTURE.md` — estructura del monorepo.
- `README.md` actual.
- `docs/SECURITY.md` actual.
- Este documento (las decisiones de abajo son vinculantes).

## Problema de presentación pública que resuelve

**1. GitHub destaca un documento interno como política de seguridad pública.**

GitHub detecta `SECURITY.md` en la raíz, en `.github/` o en **`docs/`**, y lo promociona como "Security policy" en la portada del repositorio. La detección es **por nombre de archivo, no por contenido**.

El contenido real de `docs/SECURITY.md` es seguridad **operativa para agentes** (Claude, Codex): prohibición de credenciales de producción, de secretos versionados, de acciones destructivas automáticas y de despliegues automáticos, más principios de mínimo privilegio y revisión humana. No hay canal de disclosure, ni alcance de vulnerabilidades, ni proceso de reporte — porque Sidera no está en producción y no acepta reportes todavía.

El resultado es una portada que anuncia una política pública que no existe.

**2. El README dedica una sección propia de nivel 2 a seguridad.**

`README.md` tiene hoy una sección `## Seguridad y secretos` de 3 líneas más encabezado, en penúltima posición, dedicada a reglas internas. Es desproporcionado para la puerta de entrada de un producto.

**3. El README no explica el producto.**

Estructura actual: una frase de descripción → `## Estado del proyecto` → `## Alcance del núcleo` → `## Estructura del monorepo` → requisitos → comandos → seguridad → licencia.

Un lector nuevo se encuentra una advertencia sobre el estado antes de saber qué es la cosa, y pasa directamente a la lista de paquetes sin que nadie le haya explicado qué problema resuelve Sidera, qué experiencia busca ofrecer, ni cómo se relacionan materias, prerrequisitos y progreso. No hay ninguna sección que responda "¿qué es esto?".

## Decisiones aprobadas

Aprobadas por decisión humana. **No se re-discuten ni se sustituyen por alternativas "mejores".**

### A. Renombrar `docs/SECURITY.md` → `docs/AGENT_SECURITY.md`

Debe hacerse preservando el historial:

```bash
git mv docs/SECURITY.md docs/AGENT_SECURITY.md
```

El **contenido** del documento no cambia salvo su título de nivel 1, que debe reflejar el nuevo nombre y propósito (ver "Tratamiento de AGENT_SECURITY").

Esta decisión **revierte explícitamente** lo establecido en `docs/tasks/TASK-003.1.md:189`, que decía que `docs/SECURITY.md` *"no se mueve"*. La reversión está aprobada por decisión humana: en aquel momento no se había previsto el efecto de portada de GitHub. Ver "Referencias que deben actualizarse" para el tratamiento de esa línea.

### B. No se crea ningún `SECURITY.md` sustituto

Prohibido crear `SECURITY.md` en la raíz, `.github/SECURITY.md` o un nuevo `docs/SECURITY.md`.

Motivo: Sidera no está en producción, no tiene canal de disclosure y no acepta reportes de vulnerabilidad. Una política vacía es peor que ninguna. Si en el futuro hace falta, se escribirá una real en su propia tarea.

### C. Todas las referencias internas se actualizan

No debe quedar ninguna referencia a `docs/SECURITY.md` que apunte a un archivo inexistente. Ver la lista verificada en "Referencias que deben actualizarse".

### D. El README se reescribe con foco en producto

Estructura exacta en la sección correspondiente. La primera impresión debe dejar claro que Sidera permite explorar un plan curricular de forma navegable, entendiendo qué materias existen, cuáles están disponibles, cuáles bloqueadas, qué requisito falta, cómo se relacionan entre sí y cómo progresa el estudiante.

### E. Rigor estricto sobre el estado real

**El README no debe afirmar como existente nada que hoy sea sólo visión.**

Estado verificado del repositorio en el momento de escribir esta tarea:

| Componente | Estado real |
|---|---|
| `packages/curriculum-domain` | **implementado** — entidades, identificadores y expresiones de requisito |
| `packages/curriculum-schema` | **implementado** — validación estructural con Zod |
| `packages/curriculum-engine` | **implementado** — evaluación de requisitos, elegibilidad, diagnósticos y derivación de estado de materia |
| `packages/curriculum-validator` | **stub** — `export {};` |
| `packages/curriculum-snapshot` | **stub** — `export {};` |
| `packages/curriculum-importer` | **stub** — `export {};` |
| `packages/database` | **stub** — `export {};` |
| `apps/web` | **placeholder** — página con "Aplicación web en preparación" |
| `apps/admin` | **placeholder** — página con "Aplicación administrativa en preparación" |
| Datos | ficticios y mínimos; ningún dato institucional real |
| Suite de pruebas | 4 archivos, 34 pruebas |

**Prohibido afirmar que existen:** datos institucionales reales publicados, IA funcional, autenticación, pagos, despliegue productivo, editor administrativo completo, interfaz visual final, visualización 3D funcional, o soporte terminado para todas las universidades.

**Obligatorio distinguir** en el texto entre lo que ya existe en dominio/engine, lo que el producto busca ofrecer, y lo que sigue en construcción. La sección "Qué busca ofrecer" debe marcar visiblemente qué punto está implementado y cuál no.

Puede mencionarse la idea visual del plan como grafo o universo curricular **como intención de producto**, nunca como interfaz existente. `docs/PRODUCT.md` sitúa el universo 3D explícitamente fuera del MVP inicial; el README no puede contradecir eso.

### F. Modelo curricular: breve y enlazado

Puede explicarse que la arquitectura ya modela `University → AcademicProgram → CurriculumPlan → PlanVersion`, con `Course` como identidad institucional compartida dentro de una universidad y `VersionCourse` como su aparición contextual dentro de una versión de plan — de ahí que dos `VersionCourse` con el mismo `CourseId` puedan tener requisitos distintos.

**Máximo un párrafo corto más el esquema de jerarquía.** El detalle vive en `docs/DOMAIN.md`, que debe enlazarse. Prohibido convertir el README en documentación del dominio.

### G. Seguridad: sin sección propia

Prohibido crear en el README una sección `## Seguridad`, `## Seguridad y secretos` o equivalente. La sección actual desaparece.

Si se menciona, debe ser **una sola línea dentro de `## Documentación`**, sin destacar.

### H. Licencia: `LICENSE` es la fuente de verdad

Prohibido copiar el texto de la licencia al README o crear una sección extensa. GitHub ya detecta y muestra la licencia desde `LICENSE`.

Se permite, como máximo, una referencia breve y discreta a `LICENSE`. También es válido no mencionarla. `LICENSE` **no se modifica**.

### I. Sin badges

Prohibido añadir badges de CI, coverage, npm, versión, licencia o build. La portada permanece limpia hasta que exista una razón clara.

### J. Sin apertura formal a contribuciones

Prohibido añadir `CONTRIBUTING.md`, guía de contributors, plantillas de issue o de PR, o código de conducta. El README puede indicar que el proyecto está en desarrollo activo, pero **no** invita formalmente a contribuir.

### K. La documentación técnica permanece separada

El README es la puerta de entrada al producto. `PRODUCT.md`, `ARCHITECTURE.md` y `DOMAIN.md` siguen siendo las fuentes para el detalle. Prohibido duplicar fragmentos extensos de esos documentos.

## Estructura exacta propuesta del README

Encabezados en este orden. El contenido descrito es el contrato; la redacción concreta queda a criterio del implementador dentro de esos límites.

```
# Sidera

    Una o dos frases. Qué es y para quién.
    Sin badges. Sin cita de licencia.

## Qué es Sidera

    Centrado en la experiencia del estudiante: abrir su plan curricular
    y entender de un vistazo en qué punto está y qué puede cursar.
    Puede mencionar la intención visual (plan como estructura navegable /
    universo curricular) SIEMPRE marcada como objetivo, no como hecho.

## El problema

    Por qué leer un plan curricular como lista, tabla o PDF dificulta
    entender dependencias y progreso: los prerrequisitos hay que rastrearlos
    a mano, el estado de cada materia no es visible, y saber qué falta para
    desbloquear algo exige reconstruir la cadena mentalmente.
    3-6 líneas. Sin adjetivos de marketing.
    Alineado con la sección "Problema" de docs/PRODUCT.md.

## Qué busca ofrecer

    Lista corta y concreta. Cada punto DEBE indicar si ya existe o está
    en desarrollo. Base sugerida:

    - explorar un plan curricular como estructura navegable;
    - visualizar dependencias entre materias;
    - identificar materias disponibles y bloqueadas;
    - explicar qué requisito concreto impide cursar una materia;
    - representar el progreso del estudiante frente al plan;
    - soportar distintos programas y versiones de plan.

    Marcado obligatorio según §E: la evaluación de requisitos, la
    elegibilidad, los diagnósticos de bloqueo y la derivación de estado
    existen hoy en curriculum-engine; la visualización y la navegación
    todavía no.

## Modelo curricular

    Un párrafo + la jerarquía
    University → AcademicProgram → CurriculumPlan → PlanVersion,
    con Course (identidad institucional compartida) y VersionCourse
    (aparición contextual en una versión de plan).
    Enlace a docs/DOMAIN.md para el detalle.
    Máximo un párrafo y el esquema.

## Estado actual

    - desarrollo activo, no listo para producción;
    - dominio y engine implementados y todavía evolucionando;
    - resto de paquetes y aplicaciones en construcción;
    - sin datos institucionales reales; los presentes son ficticios y mínimos;
    - interfaces visuales aún en construcción;
    - los contratos internos pueden cambiar sin aviso.

    Va DESPUÉS de explicar el producto, no antes.

## Ejecutar Sidera

    Requisitos: Node.js 24.x; pnpm 11.x (versión exacta fijada por el campo
    packageManager de package.json).

    pnpm install
    pnpm --filter web dev      → aplicación para estudiantes
    pnpm --filter admin dev    → panel administrativo

    Conservar la nota sobre puertos del README actual mientras siga siendo
    válida (pnpm dev arranca ambas apps con next dev sin puerto explícito;
    la segunda toma un puerto alternativo de forma no determinista; para
    fijar admin en 3001 se usa `pnpm --filter admin dev -- --port 3001`).

    Puede advertirse que ambas apps son hoy páginas placeholder.

## Desarrollo

    pnpm lint
    pnpm typecheck
    pnpm test
    pnpm build

    Más una explicación MÍNIMA de la estructura del monorepo (apps/ y
    packages/). Puede reutilizarse la lista actual del README, ampliada
    para no dar por implementados los paquetes que son stubs.
    No convertir esta sección en documentación extensa.

## Documentación

    - Producto: docs/PRODUCT.md
    - Arquitectura: docs/ARCHITECTURE.md
    - Dominio curricular: docs/DOMAIN.md
    - Rendimiento: docs/PERFORMANCE.md
    - Seguridad operativa para agentes: docs/AGENT_SECURITY.md

    La línea de AGENT_SECURITY va aquí, como una más, sin destacar (§G).
    Opcionalmente, una referencia breve a LICENSE (§H).
```

Notas vinculantes sobre la estructura:

- **No** debe existir una sección `## Seguridad` ni `## Seguridad y secretos`.
- **No** debe existir una sección `## Licencia` extensa.
- `## Estado actual` va después de `## Qué es Sidera`, `## El problema` y `## Qué busca ofrecer`, nunca antes.
- Las secciones `## Estado del proyecto` y `## Alcance del núcleo` del README actual desaparecen; su contenido útil se reparte entre `## Estado actual` y `## Modelo curricular`.

## Tratamiento de LICENSE

- `LICENSE` **no se modifica** en esta tarea.
- No se copia su texto al README.
- No se crea una sección `## Licencia` con contenido extenso.
- Se permite, como máximo, una referencia breve a `LICENSE` dentro de `## Documentación` o al pie.
- Omitir toda mención en el README es una opción válida y aceptada.

## Tratamiento de AGENT_SECURITY

- Renombrado con `git mv docs/SECURITY.md docs/AGENT_SECURITY.md`, preservando historial.
- **Único cambio de contenido permitido:** el título de nivel 1, que pasa de `# SECURITY.md — Seguridad` a un título que refleje el nuevo nombre y propósito, por ejemplo `# AGENT_SECURITY.md — Seguridad operativa para agentes`.
- El resto del documento (reglas para agentes, principios, nota final) **no se toca**: no se reescribe, no se amplía, no se reordena.
- No se crea ningún sustituto (§B).
- Tras el rename, GitHub no debe detectar ninguna Security Policy en el repositorio. Es el efecto buscado.

## Archivos permitidos

Lista fijada tras buscar todas las referencias en archivos versionados (`git grep -n "SECURITY"`):

```
docs/SECURITY.md → docs/AGENT_SECURITY.md   (renombrado con git mv; sólo cambia el título H1)
README.md                                    (reescrito)
CLAUDE.md                                    (1 referencia, línea 11)
AGENTS.md                                    (2 referencias, líneas 9 y 32)
docs/tasks/TASK-003.1.md                     (3 referencias, líneas 15, 189 y 343)
docs/tasks/TASK-003.1.1.md                   (3 referencias, líneas 178, 268 y 470)
```

**Un renombrado y cinco archivos modificados.** Ningún archivo nuevo. Ningún otro archivo debe crearse ni modificarse.

Si la búsqueda previa a implementar revelara una referencia adicional no listada aquí, **añadirla es parte del alcance** — el criterio es que no queden enlaces rotos. Si esa referencia estuviera en un archivo fuera de `docs/`, `README.md`, `CLAUDE.md` o `AGENTS.md`, **detenerse y reportar** antes de tocarlo.

## Referencias que deben actualizarse

Verificadas con `git grep -n "SECURITY"` sobre archivos versionados.

**Actualización directa de ruta** — sustituir `docs/SECURITY.md` por `docs/AGENT_SECURITY.md`:

| Archivo | Línea | Contenido actual |
|---|---|---|
| `CLAUDE.md` | 11 | `` - `docs/SECURITY.md` `` (lectura obligatoria) |
| `AGENTS.md` | 9 | `` - `docs/SECURITY.md` `` (lectura obligatoria) |
| `AGENTS.md` | 32 | ``- Ver `docs/SECURITY.md` para el resto de reglas.`` |
| `docs/tasks/TASK-003.1.1.md` | 268 | mención dentro de la nota del protocolo, que ya anticipa el rename |

**Tratamiento especial — el README:**

`README.md:76` contiene hoy el enlace dentro de la sección `## Seguridad y secretos`. Esa sección **desaparece** (§G); el enlace reaparece como una línea dentro de `## Documentación`. No es una sustitución de ruta, es una reubicación.

**Tratamiento especial — registros históricos:**

`docs/tasks/TASK-003.1.md` y `docs/tasks/TASK-003.1.1.md` son **registros de tareas ya completadas**. Sus menciones describen decisiones tomadas en su momento y no deben reescribirse como si nunca hubieran existido. En particular:

- `docs/tasks/TASK-003.1.md:189` dice que `docs/SECURITY.md` **"no se mueve"**. Esa decisión queda revertida por esta tarea (§A). **No borrar la línea.** Añadir junto a ella una nota breve indicando que la decisión fue revertida por TASK-003.1.2 y el motivo (el efecto de portada de GitHub no se había previsto).
- `docs/tasks/TASK-003.1.md:15` y `:343` describen el README anterior. Actualizar únicamente la **ruta** del documento; no reescribir la descripción histórica.
- `docs/tasks/TASK-003.1.1.md:178` y `:470` mencionan esta tarea como pendiente. Actualizar la ruta; opcionalmente señalar que quedó cubierta por TASK-003.1.2.

El criterio: **ninguna ruta rota, ningún registro histórico falsificado.**

## Fuera de alcance

- Cualquier cambio en `packages/**`, `apps/**`, `tests/**`.
- `package.json` (raíz o de cualquier paquete), `pnpm-lock.yaml`, `pnpm-workspace.yaml`.
- Cualquier `tsconfig.json`, `turbo.json`, `vitest.config.mts`, `eslint.config.mjs`.
- `.github/workflows/**` y cualquier configuración de CI.
- `LICENSE` (§H).
- `.gitignore`, `.gitattributes`.
- Modelo de dominio, engine, schemas, datos, deployment.
- Implementar cualquier funcionalidad.
- Crear `SECURITY.md` en cualquier ubicación (§B).
- Crear `CONTRIBUTING.md`, código de conducta, plantillas de issue o PR (§J).
- Añadir badges de cualquier tipo (§I).
- Reescribir el contenido de `docs/AGENT_SECURITY.md` más allá del título H1.
- Reescribir `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/DOMAIN.md` o `docs/PERFORMANCE.md`.
- Corregir la deuda de los `*.test.ts` emitidos en `dist/` — tarea independiente, sigue abierta.
- Crear cualquier TASK posterior.
- Commit, push, PR, merge, tag, release.

## Criterios de aceptación

1. `docs/SECURITY.md` ya no existe; `docs/AGENT_SECURITY.md` sí.
2. El rename se hizo con `git mv` y el historial del archivo se preserva (`git log --follow docs/AGENT_SECURITY.md` muestra los commits anteriores).
3. El único cambio de contenido en ese documento es el título de nivel 1.
4. No existe `SECURITY.md` en la raíz, en `.github/` ni en `docs/`.
5. `git grep -n "docs/SECURITY.md"` no devuelve ninguna referencia viva a una ruta inexistente.
6. Todos los enlaces de tipo `[texto](docs/...)` del README apuntan a archivos que existen.
7. El README contiene, en este orden, las secciones: `## Qué es Sidera`, `## El problema`, `## Qué busca ofrecer`, `## Modelo curricular`, `## Estado actual`, `## Ejecutar Sidera`, `## Desarrollo`, `## Documentación`.
8. El README **no** contiene ninguna sección `## Seguridad` ni `## Seguridad y secretos`.
9. El README **no** contiene badges de ningún tipo.
10. El README **no** reproduce el texto de la licencia ni contiene una sección extensa dedicada a ella.
11. El README no afirma como existente ninguno de los elementos prohibidos en §E, y distingue explícitamente lo implementado de lo que está en desarrollo.
12. El README enlaza `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/DOMAIN.md` y `docs/PERFORMANCE.md`, y menciona `docs/AGENT_SECURITY.md` únicamente dentro de `## Documentación`.
13. Los comandos que aparecen en el README existen realmente como scripts del repositorio.
14. `docs/tasks/TASK-003.1.md:189` conserva la decisión original más una nota de reversión; no ha sido borrada ni reescrita.
15. El estado del árbol de trabajo cumple, **semánticamente**, todo lo siguiente:
    - `docs/SECURITY.md` ya no existe;
    - `docs/AGENT_SECURITY.md` existe;
    - Git reconoce el cambio como un rename al inspeccionar el índice o el diff con detección de renames activa, cuando corresponda;
    - sólo están modificados los archivos listados en "Archivos permitidos";
    - no hay archivos adicionales ni sin seguimiento.

    **No se exige ninguna representación textual concreta** en la salida de `git status`. Git puede mostrar el rename como una entrada `R`, o como una eliminación más una adición, según el estado del índice y la heurística de detección de renames. Cualquiera de esas formas es aceptable mientras se cumplan las cinco condiciones anteriores.
16. Ningún archivo fuera de alcance fue modificado.

## Validaciones

**Nota sobre los comandos:** los comandos que siguen son **ejemplos ilustrativos**, no obligatorios. El implementador debe usar los equivalentes seguros del shell disponible y respetar `AGENTS.md` y `docs/AGENT_SECURITY.md`. Ninguna operación debe salir de `D:\Dev\sidera`. Si una operación está bloqueada por política, usar una alternativa permitida (renombrar en lugar de borrar) o **detenerse y pedir aprobación humana**; no darla por cumplida. Lo que se valida es el estado final y la evidencia, no un comando concreto.

### 1. Rename y ausencia de sustituto

```bash
git log --follow --oneline docs/AGENT_SECURITY.md
```
Debe mostrar el historial previo del archivo, no un único commit de creación.

```bash
ls SECURITY.md .github/SECURITY.md docs/SECURITY.md
```
Los tres deben fallar con "No such file or directory".

### 2. Sin referencias rotas

```bash
git grep -n "docs/SECURITY.md"
```
Debe devolver vacío, o únicamente menciones históricas que el propio texto marque explícitamente como ruta antigua.

```bash
git grep -n "AGENT_SECURITY"
```
Debe mostrar las referencias actualizadas en `CLAUDE.md`, `AGENTS.md`, `README.md` y los archivos de tareas.

### 3. Enlaces del README

Extraer los destinos y comprobar que cada archivo existe:

```bash
grep -oE "\]\(([^)]+)\)" README.md
```
Verificar uno a uno. Cero enlaces rotos.

### 4. Estructura del README

```bash
grep -n "^#" README.md
```
Comprobar el orden exigido por el criterio 7 y la ausencia de secciones de seguridad y de licencia extensa (criterios 8 y 10).

### 5. Sin badges

```bash
grep -nE "!\[|shields\.io|badge" README.md
```
Debe devolver vacío.

### 6. Comandos reales

Contrastar cada comando citado en el README contra los scripts declarados:

```bash
git grep -n "\"scripts\"" -- package.json
```
`pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm --filter web dev`, `pnpm --filter admin dev` deben corresponder a scripts existentes.

### 7. Rigor sobre el estado real

Revisión manual del README contra la tabla de §E. Ningún paquete stub ni aplicación placeholder puede presentarse como funcional. Ninguna de las capacidades prohibidas puede aparecer como existente.

### 8. Estado del repositorio

```bash
git status --porcelain
```

Comprobación **semántica**, no textual. Debe verificarse que:

- `docs/SECURITY.md` ya no existe y `docs/AGENT_SECURITY.md` sí;
- Git reconoce el cambio como un rename al inspeccionar el índice o el diff con detección de renames activa, cuando corresponda;
- sólo aparecen los archivos listados en "Archivos permitidos";
- no hay archivos adicionales ni sin seguimiento.

**No se exige una forma concreta de salida.** Según el estado del índice y la detección de renames, Git puede representar el cambio como una entrada `R`, o como una eliminación (`D`) más una adición (`A` / `??`). Ambas son aceptables. Si se quiere ver la forma `R`, basta con inspeccionar el índice tras haber añadido los cambios, o usar detección explícita de renames:

```bash
git diff --find-renames --stat HEAD
```

En cualquier caso, lo que se valida es el estado final, no la representación.

```bash
git diff --stat
```
Ningún archivo fuera de alcance.

### 9. No regresión

Esta tarea no toca código, pero el árbol debe seguir sano:

```bash
pnpm lint
```
```bash
pnpm typecheck
```
```bash
pnpm test
```
Los tres deben pasar. `pnpm build` es opcional aquí: nada de lo tocado afecta a la compilación.

## Condición exacta de terminación

La tarea termina cuando **todas** estas condiciones se cumplen a la vez:

1. El renombrado está hecho con `git mv` y el historial preservado.
2. No existe ningún `SECURITY.md` en la raíz, en `.github/` ni en `docs/`.
3. No queda ninguna referencia rota a `docs/SECURITY.md`.
4. El README cumple la estructura exigida y los criterios 7 a 13.
5. Los registros históricos de tareas conservan sus decisiones originales, con nota de reversión donde corresponde (criterio 14).
6. El estado del árbol cumple el criterio de aceptación 15: `docs/SECURITY.md` no existe, `docs/AGENT_SECURITY.md` sí, Git reconoce el rename cuando corresponde, sólo están modificados los archivos permitidos y no hay archivos sin seguimiento. Sin exigencia sobre la forma textual de la salida de `git status`.
7. `pnpm lint`, `pnpm typecheck` y `pnpm test` pasan.
8. Se ha entregado el resumen: archivos renombrados y modificados, estructura final del README, resultado de las validaciones 1 a 9, y lista explícita de afirmaciones del README que fueron contrastadas contra el estado real del repositorio.

**No se hace commit. No se hace push. No se abre PR. No se hace merge.** Son pasos humanos posteriores.

**No se continúa con ninguna otra tarea.** No se crea TASK-003.1.3 ni ninguna otra.

Si cualquier validación falla, o si aparece una referencia en un archivo fuera de los previstos: **detenerse, reportar con la salida literal, y no ampliar el alcance sin nueva aprobación humana.**
