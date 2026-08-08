# TASK-003.1 — Public repository readiness

## Objetivo

Dejar el repositorio Sidera listo para su **primera publicación pública en GitHub**: licencia MIT, README público mínimo y profesional, CI básica de validación, y política determinista de finales de línea.

Es una tarea de **infraestructura de repositorio**. No hay lógica nueva, ni cambios de dominio, ni cambios de código funcional, ni despliegue, ni datos.

Esta tarea **no** crea el repositorio en GitHub, **no** configura `origin` y **no** hace push. Eso son pasos manuales humanos posteriores, listados al final.

## Contexto mínimo

- `docs/PRODUCT.md` — qué es Sidera y para quién.
- `docs/ARCHITECTURE.md` — estructura del monorepo (apps y paquetes).
- `docs/AGENT_SECURITY.md` — reglas sobre secretos y despliegue; el README debe apuntar aquí.
- `AGENTS.md`, `CLAUDE.md` — reglas de alcance de agentes.
- Este documento (las decisiones de abajo son vinculantes).

Estado real verificado del repositorio en el momento de escribir esta tarea:

| Hecho | Valor |
|---|---|
| Rama actual | `main` |
| Remotos configurados | **ninguno** |
| `README.md`, `LICENSE`, `.gitattributes`, `.github/` | **no existen** |
| `package.json` (raíz) | `name: sidera`, `private: true`, `packageManager: pnpm@11.16.0` |
| Scripts raíz | `build`, `dev`, `lint`, `typecheck`, `test` |
| Workspaces | `apps/*`, `packages/*` (`pnpm-workspace.yaml`) |
| Orquestador | Turborepo (`turbo.json`: `build`, `dev`, `lint`, `typecheck`) |
| Runner de pruebas | Vitest en la raíz (`vitest.config.mts`), incluye `tests/**` y `packages/**/src/**` |
| Node local | v24.18.0 |
| pnpm local | 11.16.0 |
| `apps/web`, `apps/admin` | existen; scripts `build`, `dev`, `lint`, `typecheck` (ambos `next dev`) |
| `packages/*` | `curriculum-domain`, `curriculum-schema`, `curriculum-engine`, `curriculum-validator`, `curriculum-snapshot`, `curriculum-importer`, `database` |
| `.gitignore` | cubre `node_modules/`, `.pnpm-store/`, `.turbo/`, `.next/`, `dist/`, `coverage/`, `*.tsbuildinfo`, `.env`, `.env.*` (con `!.env.example`), `pnpm-debug.log*` |
| `core.autocrlf` local | `true` → origen de los avisos `LF will be replaced by CRLF` |
| Atributos de línea | `text: unspecified`, `eol: unspecified` (no hay `.gitattributes`) |
| Archivos versionados fuera de `src` | `.claude/settings.json` (versionado a propósito) |

## Decisiones aprobadas

Aprobadas por decisión humana. **No se re-discuten ni se sustituyen por alternativas "mejores".**

### A. Identidad y visibilidad

- Nombre del proyecto: **Sidera**.
- Carpeta local oficial: `D:\Dev\sidera`.
- Nombre del repositorio público futuro: **`sidera`**.
- Visibilidad: **público**.
- Licencia: **MIT**.
- Mantenido por su autor. **No** se abren contribuciones externas todavía.

### B. Sin infraestructura externa

Esta tarea **no** introduce despliegue, Vercel, Supabase, Docker, releases, publicación de paquetes ni ninguna conexión a infraestructura externa. La CI **solo valida el repositorio**.

### C. Los agentes no hacen merge a `main`

Ningún agente puede hacer merge automático a `main`. La CI **no** puede escribir en el repositorio (ver decisión G).

### D. Gestor de paquetes en CI: `pnpm/action-setup` + `actions/setup-node`

Se evaluaron las tres alternativas pedidas:

| Opción | Veredicto | Motivo |
|---|---|---|
| `actions/setup-node` **solo** | **Descartada** | No puede instalar pnpm. `cache: pnpm` necesita pnpm ya presente en el `PATH` para resolver la ruta del store. |
| **corepack** (`corepack enable` en un `run`) | **Descartada** | Corepack está en desuso y desvinculado de las distribuciones recientes de Node; en CI exige `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` y su interacción con `cache: pnpm` depende del orden de pasos (el `cache` de `setup-node` se resuelve antes que cualquier `run` propio). Más piezas, más frágil, sin ninguna ventaja aquí. |
| **`pnpm/action-setup` + `actions/setup-node` con `cache: pnpm`** | **APROBADA** | Es el camino documentado y el más reproducible. `pnpm/action-setup@v4` **lee la versión desde el campo `packageManager` de `package.json`**, así que la versión de pnpm **no se duplica en el workflow**: cero configuración redundante. |

Consecuencia vinculante: en `ci.yml`, **`pnpm/action-setup` va ANTES de `actions/setup-node`**, y **no** se pasa el input `version` a `pnpm/action-setup`. La versión de pnpm vive en un único sitio: `package.json` → `packageManager`.

### E. Versión de Node

- CI fija `node-version: "24"` directamente en `ci.yml`.
- **No** se añade `.nvmrc`, **no** se añade `engines` a `package.json`, **no** se toca `package.json`.

Motivo: la lista de archivos permitidos se mantiene mínima. Se acepta conscientemente que la versión de Node aparezca en dos sitios (`ci.yml` y la prosa del README). Si en el futuro esa duplicación molesta, `.nvmrc` + `node-version-file` es la evolución natural, pero **no en esta tarea**.

### F. Estrategia de cache

- **Sí**: cache del store de pnpm, vía `actions/setup-node` con `cache: pnpm`. Se cachea el store, con clave derivada de `pnpm-lock.yaml`. Es una sola línea y no requiere `actions/cache` explícito.
- **No**: cache de Turborepo en CI. Ni `actions/cache` sobre `.turbo`, ni remote cache.

Motivo del "no": el remote cache exigiría secretos (prohibido, decisión G) y, sobre todo, **queremos que cada ejecución de CI valide de verdad**. Un `.turbo` persistido produciría `FULL TURBO` y un verde que no ha ejecutado nada. En CI la validación real vale más que los segundos ahorrados.

### G. Lo que la CI tiene prohibido

La CI **no** debe: desplegar, publicar, modificar el repositorio, usar secretos, ejecutar migraciones ni conectarse a infraestructura externa.

Traducción técnica **obligatoria** en el workflow:

- `permissions: contents: read` a nivel de workflow (el token no puede escribir).
- Ningún uso de `secrets.*` (`GITHUB_TOKEN` incluido más allá del checkout implícito).
- Ningún paso `git push`, `git commit`, `gh`, `npm publish`, `docker`, ni llamadas de red fuera de la instalación de dependencias.
- Ningún `pnpm dev` (es persistente: colgaría el job).

### H. Política de finales de línea

Se adopta **LF en el índice y en el árbol de trabajo, en todas las plataformas**, mediante `.gitattributes` con `* text=auto eol=lf`.

Motivo: `core.autocrlf=true` local es el origen de los avisos repetidos `LF will be replaced by CRLF`. Un `.gitattributes` con `eol=lf` **tiene prioridad sobre `core.autocrlf`** y elimina el problema de raíz para cualquier persona o agente que clone el repositorio, sin depender de la configuración local de nadie.

Excepción: los scripts nativos de Windows (`*.bat`, `*.cmd`) requieren CRLF real y se declaran explícitamente, aunque hoy no exista ninguno en el repositorio.

### I. Sin badges

**No** se añade ningún badge al README en esta tarea, tampoco el de estado de CI: el repositorio todavía no existe y su URL (`owner/sidera`) aún no está determinada. Un badge apuntando a una URL inexistente se renderiza roto en la primera impresión pública, que es justo lo que esta tarea intenta evitar.

### J. Sin documentación de contribución

El README **no** debe incluir sección de "Contributing", ni instrucciones para colaboradores externos, ni enlaces a archivos que esta tarea no crea. No se abren contribuciones todavía.

### K. Titular del copyright — **confirmado**

`LICENSE` lleva esta línea, exacta y literal:

```
Copyright (c) 2026 Christian Bustos Betancur
```

Valor confirmado por decisión humana. **El implementador la transcribe tal cual**: no la deduce del `git config`, no la abrevia, no la reordena y no le añade correo, URL ni ningún otro dato.

Año: **2026**.

## Alcance permitido

### 1. `LICENSE` (nuevo)

Texto **literal e íntegro** de la licencia MIT (plantilla estándar OSI/SPDX `MIT`), sin modificaciones de redacción, con `<año>` = `2026` y `<titular>` = `Christian Bustos Betancur` (decisión K). Sin extensión de archivo. En la raíz.

### 2. `README.md` (nuevo)

Contenido mínimo especificado más abajo, en la sección "Contenido mínimo esperado del README".

### 3. `.gitattributes` (nuevo)

Contenido exacto:

```gitattributes
* text=auto eol=lf

*.bat text eol=crlf
*.cmd text eol=crlf

*.png  binary
*.jpg  binary
*.jpeg binary
*.gif  binary
*.webp binary
*.ico  binary
*.woff binary
*.woff2 binary
*.pdf  binary
```

Tras crearlo debe ejecutarse `git add --renormalize .`. Como el índice ya almacena LF, **esa operación debe resultar en cero cambios de contenido**; si produjera un diff masivo, hay que detenerse y reportarlo antes de continuar (ver criterio de aceptación 12).

### 4. `.github/workflows/ci.yml` (nuevo)

Diseño exacto especificado más abajo.

### 5. `.gitignore` (ajuste mínimo)

Añadir **únicamente** estas entradas, al final del archivo, sin reordenar ni reescribir lo existente:

```gitignore
.claude/settings.local.json
.DS_Store
Thumbs.db
```

Justificación entrada por entrada:

- `.claude/settings.local.json` — ajustes locales por máquina del agente. `.claude/settings.json` **sigue versionado a propósito**; solo se ignora la variante `.local`.
- `.DS_Store`, `Thumbs.db` — basura del explorador de archivos; higiene estándar en un repositorio público.

**No** añadir nada más. La configuración de `.env` ya es correcta (`.env`, `.env.*`, `!.env.example`) y **no se toca**.

## Fuera de alcance

- Crear el repositorio en GitHub, configurar `origin`, hacer push. **Son pasos humanos.**
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CODEOWNERS`, plantillas de issue o de PR.
- Releases, changelog, versionado semántico, publicación de paquetes.
- Deploy, Vercel, Supabase, Docker, cualquier infraestructura externa.
- Cobertura obligatoria, umbrales de coverage, informes de coverage.
- Badges de cualquier tipo (decisión I).
- Documentación de contribuciones externas (decisión J).
- Dependabot, CodeQL, análisis de seguridad automático, `SECURITY.md` en la raíz (ya existe `docs/SECURITY.md` y **no se mueve**).
  **Nota de reversión:** TASK-003.1.2 revirtió esta decisión porque no se había previsto que GitHub presentaría `docs/SECURITY.md` como una política de seguridad pública; el documento pasó a `docs/AGENT_SECURITY.md`.
- Matriz de sistemas operativos o de versiones de Node en CI. Un solo runner, una sola versión.
- Cualquier cambio en `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.json`, `vitest.config.mts` o `eslint.config.mjs`.
- Cualquier cambio en `apps/**`, `packages/**`, `tests/**`, `docs/**` (salvo este propio archivo, que ya existe).
- Corregir el solapamiento de puertos entre `apps/web` y `apps/admin` (ver "Limitación conocida"): **se documenta, no se arregla**.
- `University` / `AcademicProgram` o cualquier otra tarea de dominio.
- `TASK-004` o cualquier tarea posterior.

## Archivos permitidos

```
LICENSE                        (nuevo)
README.md                      (nuevo)
.gitattributes                 (nuevo)
.github/workflows/ci.yml       (nuevo)
.gitignore                     (+3 líneas, ajuste mínimo)
```

**Exactamente 5 archivos: 4 nuevos y 1 modificado.** Ningún otro archivo debe crearse ni modificarse. En particular: ningún `package.json`, ni `pnpm-lock.yaml`, ni nada bajo `apps/`, `packages/`, `tests/` o `docs/`.

## Diseño exacto de CI

Archivo: `.github/workflows/ci.yml`. Un único workflow, un único job, un único runner.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  validate:
    name: Validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v5
        with:
          node-version: "24"
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - run: pnpm lint

      - run: pnpm typecheck

      - run: pnpm test

      - run: pnpm build
```

Reglas vinculantes sobre este diseño:

1. **Orden de pasos**: `checkout` → `pnpm/action-setup` → `setup-node`. Invertir los dos últimos rompe `cache: pnpm`, porque `setup-node` necesita el binario `pnpm` para resolver la ruta del store.
2. **`pnpm/action-setup` sin input `version`**: hereda `pnpm@11.16.0` de `packageManager`. No duplicar la versión.
3. **Orden de comandos**: `install` → `lint` → `typecheck` → `test` → `build`. Cada uno en su propio `run`, para que el log señale con precisión qué falló.
4. **`--frozen-lockfile` explícito**, aunque CI lo aplique por defecto: hace que la intención sea legible y que el fallo sea inequívoco si el lockfile se desincroniza.
5. **`permissions: contents: read`** obligatorio (decisión G).
6. **Ningún `secrets.*`, ningún paso de escritura, ningún `pnpm dev`.**
7. **Versiones de las actions**: usar las majors indicadas. Si alguna etiqueta no existiese al implementar, usar la **major existente más alta** de esa action y **reportarlo en el resumen**. No inventar versiones ni fijar SHAs en esta tarea.

## Estrategia de Node / pnpm

| Pieza | Fuente de verdad única | Dónde se declara |
|---|---|---|
| Versión de pnpm | `package.json` → `"packageManager": "pnpm@11.16.0"` | Leída automáticamente por `pnpm/action-setup@v4`. **No aparece en `ci.yml`.** |
| Versión de Node | `ci.yml` → `node-version: "24"` | Reflejada en prosa en el README (decisión E). |

Requisito documentado para desarrollo local: **Node.js 24.x** y **pnpm 11.x**. El README indica que la versión exacta de pnpm es la del campo `packageManager` y que basta con tener pnpm 11 instalado; no se exige corepack ni ninguna herramienta adicional.

## Estrategia de cache

- **Store de pnpm**: cacheado por `actions/setup-node` con `cache: pnpm`. Clave derivada de `pnpm-lock.yaml`. Es todo el cache que esta tarea configura.
- **Turborepo**: **sin cache en CI**, ni local persistido ni remoto. Cada ejecución valida de verdad (decisión F).
- **Sin `actions/cache` explícito.** Si aparece uno en el diff, la implementación está fuera de alcance.

## Política de line endings

1. `.gitattributes` con `* text=auto eol=lf` normaliza todo el texto a LF en índice **y** en árbol de trabajo, con prioridad sobre el `core.autocrlf=true` local. Esto elimina de forma permanente los avisos `LF will be replaced by CRLF`.
2. `*.bat` y `*.cmd` se declaran `eol=crlf` porque el intérprete de comandos de Windows lo requiere.
3. Los formatos binarios se marcan `binary` para que git nunca intente normalizarlos ni mostrarlos como texto.
4. Tras crear el archivo, ejecutar `git add --renormalize .`. **Debe resultar en cero cambios** (el índice ya es LF). Si produjera cambios, detenerse y reportar antes de seguir.
5. Opcional para la persona, **no** para el agente: `git config core.autocrlf false` en local. Con `.gitattributes` en su sitio ya no es necesario, pero deja la configuración local coherente con el repositorio.

## Contenido mínimo esperado del README

`README.md`, en la raíz. Tono profesional, sobrio, honesto sobre el estado real. Sin badges, sin emojis decorativos, sin promesas de roadmap.

Secciones mínimas, en este orden:

1. **Título**: `# Sidera`.
2. **Qué es** (1–3 frases): herramienta para explorar y entender planes curriculares — qué materias se pueden cursar, qué las bloquea y cómo avanza el progreso hacia el grado.
3. **Estado del proyecto**, explícito y sin ambigüedad:
   - está **en desarrollo activo**, no listo para producción;
   - **no contiene datos curriculares reales** de ninguna institución; todos los datos presentes son ficticios y mínimos;
   - las interfaces y contratos pueden cambiar sin aviso.
4. **Alcance del núcleo**: el modelo de dominio soporta **múltiples universidades y múltiples programas académicos** (`University → AcademicProgram → CurriculumPlan → PlanVersion`, con `Course` como catálogo institucional compartido). Inicialmente se está construyendo para explorar planes curriculares.
5. **Estructura del monorepo**, mínima — exactamente estas cinco entradas, con una línea cada una:
   - `apps/web` — aplicación para estudiantes.
   - `apps/admin` — panel administrativo curricular.
   - `packages/curriculum-domain` — entidades y tipos del dominio, sin dependencias de runtime.
   - `packages/curriculum-schema` — contratos y validación estructural (Zod).
   - `packages/curriculum-engine` — prerrequisitos, desbloqueos y progreso.

   Una única frase puede indicar que existen paquetes adicionales aún en construcción, sin enumerarlos.
6. **Requisitos**: Node.js 24.x y pnpm 11.x (la versión exacta de pnpm la fija el campo `packageManager` de `package.json`).
7. **Instalación y comandos**, en bloques `bash` separados:

   ```bash
   pnpm install
   ```

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

8. **Ejecución de las aplicaciones** (los scripts `dev` ya existen en ambas apps):

   ```bash
   pnpm --filter web dev
   ```

   ```bash
   pnpm --filter admin dev
   ```

   Debe indicarse que `pnpm dev` arranca ambas a la vez mediante Turborepo, y la limitación conocida de puertos descrita abajo.
9. **Seguridad y secretos**: aviso breve de que **no deben subirse secretos ni archivos `.env` reales** al repositorio; `.env` está ignorado por git y solo se versionan archivos de ejemplo. Enlace a `docs/AGENT_SECURITY.md`.
10. **Licencia**: MIT, con enlace a `LICENSE`.

**Prohibido en el README**: sección de contribución, badges, roadmap con fechas, instrucciones de deploy, referencias a Vercel/Supabase/Docker, y cualquier dato institucional real (nombre de universidad o de programa concreto).

### Limitación conocida a documentar (no a corregir)

`apps/web` y `apps/admin` usan ambas `next dev` sin puerto explícito. Al arrancar las dos simultáneamente con `pnpm dev`, la segunda toma un puerto alternativo automáticamente, de forma no determinista. El README debe mencionarlo en una frase y ofrecer la salida explícita:

```bash
pnpm --filter admin dev -- --port 3001
```

**No** se modifican los scripts de `apps/*/package.json` para arreglarlo: eso es un cambio funcional, fuera de alcance. Queda registrado como candidato a tarea futura.

## Criterios de aceptación

1. Existe `LICENSE` en la raíz con el texto MIT íntegro y sin alterar, año `2026` y titular **confirmado por decisión humana** (decisión K).
2. Existe `README.md` con las 10 secciones mínimas, en orden, y sin ninguno de los contenidos prohibidos.
3. El README no contiene ningún badge, ninguna sección de contribución y ningún dato institucional real.
4. Existe `.gitattributes` con el contenido exacto especificado.
5. Existe `.github/workflows/ci.yml` con el diseño exacto especificado: un job, `ubuntu-latest`, `permissions: contents: read`, `concurrency` con `cancel-in-progress`.
6. En `ci.yml`, `pnpm/action-setup` precede a `actions/setup-node`, y **no** se le pasa el input `version`.
7. `ci.yml` ejecuta exactamente `install`, `lint`, `typecheck`, `test`, `build`, en ese orden, cada uno en su propio paso.
8. `ci.yml` no contiene: `secrets.`, `git push`, `git commit`, `gh `, `publish`, `deploy`, `docker`, `vercel`, `supabase`, `migrate`, `pnpm dev`, `actions/cache`.
9. `.gitignore` incorpora exactamente las 3 entradas nuevas indicadas, sin reordenar ni eliminar nada de lo existente, y `.claude/settings.json` **sigue versionado**.
10. El diff se limita **exactamente** a los 5 archivos permitidos: 4 nuevos, 1 modificado.
11. No hay cambios en `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.json`, `vitest.config.mts`, `eslint.config.mjs`, ni en `apps/**`, `packages/**`, `tests/**`, `docs/**`.
12. `git add --renormalize .` no produce cambios de contenido en archivos ya versionados.
13. `git diff --check` no reporta nada.
14. La secuencia local de validación se ejecuta sin errores y la suite de pruebas pasa completa.
15. `git status` no muestra el repositorio con ningún remoto configurado: `git remote -v` sigue **vacío**.
16. No se ha hecho commit ni push.

## Comandos de validación local

```bash
pnpm install --frozen-lockfile
```

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

Verificaciones específicas de esta tarea:

```bash
git status --porcelain --untracked-files=all
```

```bash
git add --renormalize . && git status --porcelain
```

```bash
git diff --check
```

```bash
git remote -v
```

Interpretación esperada:

- `git status --porcelain --untracked-files=all` → exactamente 5 entradas (`.gitattributes`, `.github/workflows/ci.yml`, `LICENSE`, `README.md` como no versionados; `.gitignore` como modificado).
- `git add --renormalize .` → **sin cambios de contenido** en archivos ya versionados.
- `git diff --check` → salida vacía.
- `git remote -v` → **salida vacía**.

La CI no puede verificarse localmente sin un remoto. Se valida en el primer push, en los pasos manuales.

## Condición exacta de terminación

La tarea termina cuando:

- los 5 archivos permitidos existen o están modificados según lo especificado, y ningún otro;
- los criterios de aceptación 1–16 se cumplen;
- la secuencia local de validación se ejecuta sin errores;
- `git remote -v` sigue vacío;
- no se ha hecho commit ni push.

El implementador entrega el resumen indicado en `AGENTS.md` —confirmando explícitamente el número de archivos tocados, que no modificó `package.json` ni `pnpm-lock.yaml` ni ningún archivo de `apps/`, `packages/`, `tests/` o `docs/`, y qué versiones de actions usó— y **se detiene**, sin crear el repositorio, sin configurar `origin`, sin hacer push y sin iniciar ninguna otra tarea.

El commit lo realiza una persona después de la revisión humana.

## Pasos manuales posteriores (los ejecuta una persona, no un agente)

Solo después de revisar y **commitear** los cambios de esta tarea.

### 1. Crear el repositorio público `sidera` en GitHub

Con GitHub CLI, sin crear commit inicial remoto ni README automático:

```bash
gh repo create sidera --public --description "Herramienta para explorar y entender planes curriculares." --disable-wiki
```

Alternativa por interfaz web: **New repository** → nombre `sidera` → **Public** → **no** marcar "Add a README file", "Add .gitignore" ni "Choose a license" (los tres ya existen en local y crearlos allí provocaría historias divergentes).

### 2. Añadir `origin`

```bash
git remote add origin https://github.com/<usuario>/sidera.git
```

Verificar:

```bash
git remote -v
```

### 3. Primer push

Confirmar antes que la rama local es `main` y que el árbol está limpio:

```bash
git status
```

Push inicial estableciendo el upstream:

```bash
git push -u origin main
```

### 4. Comprobación posterior al push

- La pestaña **Actions** debe mostrar el workflow `CI` ejecutándose sobre `main`, en verde.
- GitHub debe detectar y mostrar **MIT** como licencia del repositorio.
- El README debe renderizarse correctamente en la portada.
- Confirmar que **no** se ha subido ningún `.env` ni ningún secreto:

```powershell
git ls-files | Select-String -Pattern '\.env'
```

(debe devolver, como mucho, archivos `.env.example`).

### 5. Protección de `main` (recomendado, decisión C)

En **Settings → Branches → Add branch ruleset** para `main`: exigir pull request antes de merge y exigir que la comprobación de estado `Validate` pase. Esto es lo que hace cumplir técnicamente que ningún agente pueda hacer merge automático a `main`.

Queda registrado como recomendación operativa; **no** forma parte del alcance implementable de esta tarea.
