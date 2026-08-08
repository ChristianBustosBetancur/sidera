# TASK-003.2 — Minimal Claude/Codex workflow

## Objetivo

Construir la automatización **mínima** que encadene el ciclo `Codex implementa → validación → Claude revisa → repair loop → puerta humana`, reduciendo el copy/paste manual y las aprobaciones repetitivas, sin introducir una plataforma agentic.

Objetivo final aspiracional:

```bash
pnpm agent TASK-004.1
```

Prioridades, en este orden: **simplicidad, seguridad, auditabilidad, facilidad de modificación.** Un orquestador de ~200 líneas legibles vale más que una arquitectura de 2000.

Esta tarea **no** crea TASK-004 ni ninguna tarea de producto.

## Hallazgos de entorno (verificados, no supuestos)

Inspección real de la máquina y del repositorio en el momento de escribir esta tarea:

| Elemento | Estado verificado |
|---|---|
| Node (Windows) | `v24.18.0` en `D:\NodeJS\node.exe` |
| pnpm (Windows) | `11.16.0` en `D:\NodeJS\pnpm.ps1` |
| git (Windows) | `2.54.0.windows.1`; `core.autocrlf=true` |
| `git worktree` | soportado; hoy sólo el worktree principal `D:/Dev/sidera [main]` |
| Remoto | `origin` → `https://github.com/ChristianBustosBetancur/sidera.git` |
| CI | `.github/workflows/ci.yml`, job `Validate`: `install → lint → typecheck → test → build` |
| Permisos de Claude | `.claude/settings.json` versionado: `defaultMode: default`, `disableBypassPermissionsMode: disable`, `ask` en `Edit`/`Bash`/`PowerShell`, `deny` sobre `Agent`, `.env`, `secrets/**`, `rm`, `git clean`, `git reset --hard`, `git push --force` |
| Reglas de agentes | `AGENTS.md` (Codex) y `CLAUDE.md` (Claude), ambos limitados a `D:\Dev\sidera` |
| **`claude` CLI** | **NO está en PATH** (verificado en Bash y PowerShell) |
| **`codex` CLI** | **NO está en PATH** (verificado en Bash y PowerShell) |
| **Docker** | **NO instalado** |
| **WSL** | `wsl.exe` presente en `C:\Windows\system32\wsl.exe`; **ninguna distribución instalada** |
| npm global | `C:\Users\...\AppData\Roaming\npm` no existe → ningún CLI instalado globalmente por npm |

**Consecuencia directa:** no se ha verificado ni un solo flag de los CLI de Claude o Codex, porque ninguno está instalado. Esta especificación **no asume ningún modo headless, flag, formato de salida ni archivo de configuración de esos CLI.** Todo eso se determina en la Fase 0, con los binarios reales, ya dentro de WSL.

## Decisiones aprobadas

Aprobadas por decisión humana. **No se re-discuten ni se sustituyen por alternativas "mejores".**

### A. El aislamiento real es obligatorio: WSL2 es el baseline

La automatización completa **sólo se ejecuta dentro de un entorno aislado real**. WSL2 es la vía elegida: `wsl.exe` ya está presente en el host, no hay Docker instalado, y añadir una distribución minimiza el software adicional frente a instalar Docker Desktop.

**El Nivel A (worktree hermano en Windows) queda descartado como arquitectura objetivo.** Se documenta únicamente como *fallback manual de desarrollo*: sirve para que un humano trabaje o depure a mano, **nunca** para ejecutar Claude o Codex de forma automática. Un `git worktree` aísla el alcance del repositorio, no el proceso; no es una frontera de seguridad.

### B. La copia de trabajo de los agentes vive dentro del filesystem de WSL

Ruta conceptual: `~/sidera-agent`, dentro de la distribución.

**Prohibido** ubicarla en `/mnt/d/...` o en cualquier ruta de Windows montada. Dos razones, ambas de peso: el rendimiento de I/O a través del límite de filesystems es malo para `node_modules`, y montar el disco de Windows reintroduce exactamente el acceso al host que queremos eliminar.

`D:\Dev\sidera` sigue siendo el repositorio humano, en Windows, **separado**. Los agentes no lo ven.

### C. Presupuesto de reparación: intento inicial + máximo 2 reparaciones

Después, `STOPPED` e intervención humana. Techo duro, no configurable desde la tarea.

### D. `HUMAN_GATE` obligatorio antes de cualquier merge a `main`

### E. Protección de rama en GitHub: requisito humano documentado

Se documenta como requisito de infraestructura. **No se implementa ni se configura desde el orquestador.**

### F. El orquestador carece de la capacidad, no sólo del permiso

No contiene código para: merge a `main`, push directo a `main`, ni force push. No es una regla que deba respetar; es una capacidad que no posee.

### G. Los hooks de git son defensa adicional, nunca sustituto

Pueden usarse dentro del entorno aislado como capa extra. **No se presentan como reemplazo del aislamiento WSL ni de la protección de rama de GitHub.** Son cooperativos con quien controla el repositorio local.

### H. Diseño minimalista

Node sin dependencias mientras siga siendo razonable; estado en JSON; logs y artefactos en `.agent/`, ignorado por Git. Prohibido introducir LangGraph, Temporal, Redis, base de datos, vector database, colas, microservicios o agentes especializados adicionales.

### I. Fase 0 bloqueante: verificación real de los CLI

**No se inventan flags.** Detalle completo en la Fase 0.

### J. Degradación explícita, nunca simulada

Si alguno de los CLI no soporta automatización no interactiva fiable, el workflow **degrada de forma explícita a automatización parcial** y lo declara en su documentación y en su salida. **Prohibido simular que la integración existe**: nada de envolver un paso manual en una interfaz que aparente ser automática, ni de asumir un veredicto que no se ha obtenido.

### K. Observabilidad en vivo — el workflow nunca es una caja negra

Durante cualquier ejecución real, el runner **muestra en terminal**, de forma legible y actualizada continuamente cuando corresponda:

- TASK actual;
- rama actual;
- `mode`: `full` | `partial`;
- fase actual;
- intento actual y máximo;
- agente o proceso activo en ese momento;
- tiempo transcurrido;
- cada transición de estado;
- cada comando de validación que se ejecuta;
- `PASS` / `FAIL` de cada validación;
- archivos modificados, cuando puedan determinarse de forma segura;
- blockers estructurados producidos por `REVIEW`;
- motivo al entrar en `STOPPED`;
- indicación visible de que **Ctrl+C detiene el workflow**.

**Límite estricto de lo que se observa.** La observabilidad se restringe a **eventos operativos y artefactos observables**: comandos, archivos, diffs, resultados, estados y veredictos.

**Prohibido mostrar, capturar o intentar extraer razonamiento privado o chain-of-thought de Claude o de Codex.** No se añaden flags, prompts ni post-procesado orientados a obtener ese material. Si un CLI lo emitiera por su cuenta, no se persiste ni se muestra como parte de la observabilidad del runner.

Los mismos eventos relevantes se **persisten en `.agent/runs/**`**, de modo que una ejecución pueda auditarse después con el mismo detalle con que se vio en vivo. Lo que se muestra y lo que se guarda no divergen.

### L. Human abort seguro

El humano puede detener una ejecución **en cualquier momento** con Ctrl+C. El runner **maneja `SIGINT` explícitamente**; no delega en la terminación por defecto del proceso.

Ante un aborto humano, en este orden:

1. detener el proceso hijo activo (Claude, Codex o validación);
2. no iniciar ningún proceso nuevo;
3. **no** ejecutar rollback automático;
4. **no** ejecutar `git reset --hard`, `git clean` ni ningún equivalente destructivo;
5. preservar **exactamente** el working tree existente;
6. capturar, cuando sea posible: `git status`, `git diff`, fase, intento, proceso activo y timestamp;
7. registrar `stopReason = "HUMAN_ABORT"`;
8. pasar el workflow a `STOPPED`;
9. terminar limpiamente el runner.

**"Parar" significa congelar el estado, no borrar trabajo.** Un aborto que destruyera cambios sería peor que no poder abortar: convertiría Ctrl+C en una tecla peligrosa y desincentivaría supervisar la ejecución, que es justo lo contrario de lo que busca la decisión K.

Una ejecución detenida **no puede reanudarse en silencio**. Requiere una acción humana explícita posterior — `--resume` si esa interfaz se aprueba durante la implementación.

### M. Una TASK por ejecución

El workflow **nunca inicia automáticamente otra TASK** al terminar la actual.

Cada ejecución termina necesariamente en `HUMAN_GATE` o en `STOPPED`. **No existe transición automática desde `HUMAN_GATE` hacia otra TASK**, ni encadenamiento, ni cola de tareas, ni modo desatendido de varias tareas seguidas.

## Entorno aislado — arquitectura objetivo

```
┌─ Windows (host) ────────────────────────────────────────┐
│                                                          │
│  D:\Dev\sidera          repositorio humano, rama main    │
│      ↑                  merge, push, aprobación          │
│      │ git fetch (iniciado por el humano)                │
│      │                                                   │
│  ┌───┴──────────────────────────────────────────────┐   │
│  │ WSL2 — distribución dedicada                      │   │
│  │                                                   │   │
│  │   ~/sidera-agent      clon de trabajo del agente  │   │
│  │                       rama task/<TASK-ID>         │   │
│  │   Node 24 · pnpm 11 · git                         │   │
│  │   claude CLI · codex CLI                          │   │
│  │   .agent/ (estado + artefactos)                   │   │
│  └───────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### Configuración de la distribución

La distribución es **dedicada a Sidera**. No se reutiliza una existente ni se usa para otra cosa.

Medidas de contención a establecer **y verificar** en la Fase 0 (se enumeran como configuración objetivo, no como hechos comprobados — no hay distribución instalada todavía):

- **Sin acceso al disco de Windows.** Deshabilitar el automontaje en `/etc/wsl.conf` para que no existan `/mnt/c` ni `/mnt/d`. Es la medida que más contención aporta: sin ella, el filesystem completo del host está a un `cd` de distancia.
- **Sin interoperabilidad con binarios de Windows.** Deshabilitar interop y la herencia del `PATH` de Windows, para que desde la distribución no puedan lanzarse ejecutables del host.
- **Usuario no root** para el trabajo del agente.
- **Credenciales propias de la distribución.** Los CLI de Claude y Codex se autentican dentro de WSL, con sus credenciales confinadas ahí. Nunca se mapea el perfil de usuario de Windows.
- **Sin secretos de producción**, sin `.env` reales, sin acceso a infraestructura desplegada.
- **Toolchain mínima:** git, Node 24, pnpm 11, los dos CLI de agente. Nada más.

Advertencia honesta que debe constar en la documentación: **WSL2 es una frontera de aislamiento sustancialmente mejor que un worktree, pero no equivale a una VM endurecida ni a un contenedor con políticas estrictas.** Con la configuración anterior el riesgo es razonable para este uso; sin ella, WSL2 con automontaje e interop activos es apenas mejor que el Nivel A.

### Cómo viaja el código entre WSL y Windows

El clon de `~/sidera-agent` se obtiene desde `origin` (GitHub), no copiando desde `D:\Dev\sidera`. Así los dos árboles quedan genuinamente separados.

Para que el humano revise e integre el resultado sin que el agente empuje nada:

- **Vía primaria: `git fetch` iniciado por el humano.** El repositorio de Windows añade el clon de WSL como remoto de sólo lectura y **trae** la rama de la tarea. El agente nunca hace `push`; el humano hace `fetch`. La dirección del flujo invierte el riesgo.
- **Vía alternativa: exportar un parche.** El orquestador ya escribe `30-diff.patch` en cada intento; puede aplicarse manualmente.

**Cuál de las dos es la vía oficial queda abierta** (ver "Decisiones humanas abiertas"): la vía `fetch` requiere que el repositorio Windows pueda alcanzar una ruta del filesystem de WSL, algo que debe verificarse en la práctica antes de comprometerse.

## Máquina de estados

```
                  ┌──────────────┐
    pnpm agent →  │  IMPLEMENT   │ ←──────────────┐
                  └──────┬───────┘                │
                         ↓                        │
                  ┌──────────────┐                │
                  │   VALIDATE   │                │
                  └──────┬───────┘                │
                    ok   │   fallo                │
              ┌──────────┴──────────┐             │
              ↓                     ↓             │
       ┌──────────────┐      (blockers de         │
       │    REVIEW    │       validación)         │
       └──────┬───────┘             │             │
         PASS │ FAIL                └─────────────┤
              │   └───────────────────────────────┤
              ↓                                   │
       ┌──────────────┐                  attempt < 3
       │  HUMAN_GATE  │                           │
       └──────────────┘                  attempt = 3 → STOPPED
                                                  │
                                           ┌──────────────┐
                                           │   STOPPED    │
                                           └──────────────┘
```

Estados exactos: `IMPLEMENT`, `VALIDATE`, `REVIEW`, `HUMAN_GATE`, `STOPPED`. Ninguno más.

`attempt` empieza en 1. Un `FAIL` incrementa y vuelve a `IMPLEMENT`. Al alcanzar `attempt = 3` sin PASS —tras **2 reparaciones**— pasa a `STOPPED`.

`HUMAN_GATE` y `STOPPED` son **terminales para el orquestador**.

## Estado

`.agent/state.json`, ignorado por Git, dentro de `~/sidera-agent`:

```json
{
  "task": "TASK-004.1",
  "phase": "IMPLEMENT",
  "attempt": 1,
  "branch": "task/TASK-004.1",
  "startedAt": "2026-08-08T12:00:00.000Z",
  "updatedAt": "2026-08-08T12:04:31.000Z",
  "lastVerdict": null,
  "mode": "full",
  "activeProcess": null,
  "stopReason": null
}
```

`mode` ∈ `{"full", "partial"}` — registra si el run se ejecutó con automatización completa o degradada (decisión J). Un run degradado debe ser identificable a posteriori sin ambigüedad.

`activeProcess` — qué se está ejecutando ahora mismo (`"codex"`, `"claude"`, `"pnpm typecheck"`, …) o `null`. Alimenta la observabilidad en vivo (decisión K) y el registro de aborto (decisión L).

`stopReason` — `null` mientras el run no esté en `STOPPED`. Valores previstos: `"HUMAN_ABORT"` (decisión L), `"repair-budget-exhausted"`, `"unparseable-verdict"`, `"empty-blockers"`.

Un único run activo. Si existe un estado con `phase` no terminal, `pnpm agent <TASK-ID>` **se niega a arrancar** y exige `--resume` o `--reset` explícito.

## Transporte de contexto

Todo por **archivos en disco**. Es lo que hace el sistema auditable.

```
.agent/
  state.json
  runs/TASK-004.1/2026-08-08T12-00-00Z/
      00-task.md                 ← copia de docs/tasks/TASK-004.1.md
      attempt-1/
        10-implement-prompt.md   ← lo que se le pasó a Codex
        11-implement-output.log  ← lo que devolvió
        20-validate.json         ← resultado por validación
        21-validate.log          ← salida literal
        30-diff.patch            ← git diff main...task/TASK-004.1
        31-status.txt            ← git status --porcelain
        40-review-prompt.md      ← lo que se le pasó a Claude
        41-review-output.md      ← lo que devolvió
        42-verdict.json          ← veredicto parseado
      attempt-2/
        05-blockers.md           ← blockers de la vuelta anterior
        ...
      events.jsonl               ← registro operativo del run (decisión K)
      abort.json                 ← sólo si hubo Ctrl+C (decisión L)
```

`events.jsonl` contiene, una línea JSON por evento, lo mismo que el operador vio en terminal: transiciones de estado, comandos ejecutados con su resultado, cambios de intento, agente activo y timestamps. Es lo que permite auditar después una ejecución con el mismo detalle con que se observó en vivo.

**Codex recibe en `IMPLEMENT`:** la tarea completa, la rama, y —desde el intento 2— los blockers previos. Sin historial conversacional acumulado.

**Claude recibe en `REVIEW`:** la tarea, el diff, `git status --porcelain` y los resultados de validación. **No recibe la salida de Codex**: la revisión es sobre el resultado, no sobre el relato del implementador. Decisión deliberada.

## Contrato de veredicto

Claude termina su revisión con un bloque JSON, como último bloque cercado:

```json
{
  "verdict": "FAIL",
  "blockers": [
    { "file": "packages/curriculum-engine/src/state.ts", "issue": "..." }
  ],
  "nonBlocking": ["..."]
}
```

`verdict` ∈ `{"PASS", "FAIL"}`. El orquestador extrae el **último** bloque ```json y lo parsea.

- Sin bloque JSON, o no parsea, o `verdict` inválido → `STOPPED` con motivo `unparseable-verdict`. **Prohibido inferir el veredicto con heurísticas de texto.** Un review ambiguo es un fallo del sistema, no un PASS.
- `FAIL` con `blockers` vacío → `STOPPED`. No es accionable.

## Validaciones

Las mismas que la CI, en el mismo orden, dentro de WSL:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Cada una se registra con su código de salida y su salida literal. **A la primera que falla se detiene la secuencia** y su salida se convierte en blockers para Codex, sin pasar por REVIEW: no tiene sentido gastar una revisión sobre código que no compila.

## Permisos

### Codex — implementador

**Permitido dentro de `~/sidera-agent`:** leer y escribir archivos del repo; ejecutar `pnpm` y las validaciones; `git status`, `diff`, `log`, `add`, `commit`; trabajar sobre `task/<TASK-ID>`.

**Bloqueado:** `git push` en cualquier forma; `git checkout main`, `merge`, `rebase`, `reset --hard`, `clean`; cualquier operación sobre `origin`; lectura fuera del clon; modificación de su propia configuración de permisos; `.env*`, `secrets/**`, credenciales; producción.

### Claude — revisor

**Permitido:** leer todo el clon; ejecutar validaciones; `git status`, `diff`, `log`.

**Bloqueado: toda escritura.** Sin `Edit`, sin `Write`, sin `add`, sin `commit`. El revisor señala; no arregla. Es lo que mantiene honesta la revisión.

### Capas de cumplimiento, por orden de fuerza

1. **Aislamiento WSL2** — la frontera real. Todo lo demás es defensa en profundidad.
2. **Protección de rama en GitHub** — barrera definitiva contra un push a `main`. Requisito humano (decisión E).
3. **Mecanismos de sandbox/aprobación propios de cada CLI** — a determinar en la Fase 0.
4. **Hooks de git** (`pre-push` que rechaza todo push; `pre-commit` que rechaza commits en `main`) — defensa adicional (decisión G).
5. **Reglas en prosa** (`AGENTS.md`, `CLAUDE.md`) — sólo cooperativas.
6. **El orquestador carece de código para push/merge/checkout main** (decisión F).

## Qué sigue requiriendo humano

Invariante, no configurable:

- Aprobación final de cualquier tarea (`HUMAN_GATE`).
- Merge a `main`, y push a `origin`.
- `git fetch` desde el clon de WSL al repositorio de Windows.
- Ampliación de permisos de cualquier agente.
- Decisiones arquitectónicas de alto impacto (principio 12 de `docs/ARCHITECTURE.md`).
- Creación y aprobación de las TASK.
- Desbloqueo de un run en `STOPPED`.
- Instalación y configuración de la distribución WSL.
- Configuración de la protección de rama en GitHub.

**ChatGPT / GPT-5.6 Sol no se automatiza.** Sigue siendo la capa donde el humano discute producto y arquitectura y decide qué TASK crear. No se integra en el orquestador, no se invoca por CLI, no recibe artefactos automáticamente. El sistema empieza en una TASK ya aprobada.

## Implementación por fases

Cada fase es un incremento verificable. **No se empieza una fase sin haber cerrado la anterior.**

### FASE 0 — Preparar y verificar entorno y CLI (BLOQUEANTE)

**Producto: un documento de hechos verificados. Cero código.**

**0.1 — Entorno WSL.** Instalar la distribución dedicada. Aplicar la configuración de contención (sin automontaje, sin interop, usuario no root). Instalar git, Node 24 y pnpm 11 **dentro** de la distribución. Clonar el repositorio en `~/sidera-agent` desde `origin`. Verificar que `pnpm install --frozen-lockfile` y las cinco validaciones pasan ahí.

**0.2 — Verificación de los CLI.** Instalarlos dentro de WSL y comprobar con los binarios reales, para **cada uno**:

1. **Instalación y versión** exactas.
2. **Modo no interactivo:** ¿existe? ¿Cuál es la invocación literal?
3. **Entrada del prompt:** ¿argumento, stdin, archivo?
4. **Salida:** ¿estructurada o parseable de forma fiable? ¿Puede forzarse un formato?
5. **Códigos de salida:** ¿distinguen éxito de fallo de forma fiable? El repair loop depende de esto.
6. **Working directory:** ¿puede fijarse al clon sin arrastrar configuración del host?
7. **Mecanismos reales de sandbox y aprobaciones:** qué ofrece cada CLI de forma nativa y cómo se configura sin interacción.
8. **Credenciales:** dónde se guardan, cómo se autentican, y confirmación de que quedan confinadas a la distribución.

**0.3 — Verificar el camino de vuelta.** Comprobar en la práctica si `D:\Dev\sidera` puede hacer `git fetch` desde el clon de WSL. Si no, la vía oficial pasa a ser el parche.

**Salida de la fase:** `docs/AGENT_WORKFLOW.md` con todos estos hechos. Si algún CLI carece de modo no interactivo fiable → **detenerse y reportar**; el diseño degrada a `mode: "partial"` (decisión J) antes de escribir nada.

### FASE 1 — Runner mínimo y máquina de estados

Sin agentes todavía. Sólo el esqueleto:

- `tools/agent/run.mjs` con las cinco fases, el archivo de estado, la creación del árbol de artefactos y la creación de rama.
- `IMPLEMENT` y `REVIEW` son *stubs* que no invocan nada: escriben sus prompts en disco y devuelven un resultado simulado **explícitamente marcado como simulado**.
- Reglas de reanudación (`--resume` / `--reset`).
- **Observabilidad en vivo (decisión K)** y **manejo de `SIGINT` (decisión L)**: se implementan aquí, no al final. Un runner que sólo se puede observar y detener después de tener agentes reales conectados es un runner que se estrena a ciegas.

**Verificable:** el ciclo transita correctamente, el estado persiste, los artefactos y `events.jsonl` aparecen, la terminal refleja fase/intento/proceso, Ctrl+C deja el run en `STOPPED` con `stopReason: "HUMAN_ABORT"`, y el ciclo completo termina en `HUMAN_GATE`.

### FASE 2 — Codex + VALIDATE

- Invocación real de Codex con la invocación verificada en la Fase 0.
- Ejecución real de las cinco validaciones, captura de códigos de salida y salidas.
- Corte a la primera validación fallida y conversión de su salida en blockers.
- `REVIEW` sigue siendo un stub.

**Verificable:** Codex produce un diff real y las validaciones se ejecutan de verdad.

### FASE 3 — Claude REVIEW + repair loop

- Invocación real de Claude con el contexto de revisión.
- Parseo del veredicto y aplicación estricta del contrato (incluida la parada por `unparseable-verdict`).
- Repair loop completo con el techo de 2 reparaciones.
- Hooks de git como defensa adicional.

**Verificable:** un FAIL vuelve a Codex con blockers accionables; un PASS llega a `HUMAN_GATE`.

### FASE 4 — Pruebas T1–T5

Sobre tareas desechables, nunca sobre trabajo real.

- **T1 — Mecánica del bucle.** Tarea diminuta que sólo toca documentación. Verifica transiciones, estado, artefactos y parada en `HUMAN_GATE`.
- **T2 — Validación real.** Tarea que añade una función pura minúscula con su prueba. Verifica que las cinco validaciones se ejecutan de verdad y que el diff que llega a Claude es el real.
- **T3 — Repair loop y parada dura.** Tarea **imposible de satisfacer** (criterios de aceptación contradictorios). Verifica que `attempt` incrementa, que los blockers llegan a Codex, y que **el sistema se detiene tras exactamente 2 reparaciones** terminando en `STOPPED` sin tocar `main` ni `origin`. Es la prueba más importante: **un sistema de reparación automática que no sabe rendirse es peligroso.**
- **T4 — Barreras (prueba negativa).** Intentar `git push` desde el clon y comprobar que el `pre-push` lo rechaza; intentar un commit en `main` y comprobar que el `pre-commit` lo rechaza. Comprobar que desde la distribución no se alcanza el filesystem de Windows.
- **T5 — Human abort (decisión L).** Lanzar un run, esperar a que haya cambios en el working tree y un proceso hijo activo, y pulsar **Ctrl+C**. Verificar: el proceso hijo termina; no arranca ninguno nuevo; **el working tree conserva exactamente los cambios hechos hasta ese instante**; `state.json` queda en `STOPPED` con `stopReason: "HUMAN_ABORT"`; existe `abort.json` con fase, intento, proceso activo y timestamp; el runner sale limpiamente; y un `pnpm agent` posterior **se niega a continuar** sin acción humana explícita.

  Comprobación adicional obligatoria: **el aborto no ejecutó ningún rollback destructivo.** Contrastar `git status` y `git diff` antes y después del Ctrl+C — deben coincidir.

  Se ejecuta reutilizando la tarea de T2; no requiere arquitectura de pruebas adicional.

**Sólo tras T1–T5 se usa el sistema con TASK-004.1.**

## Archivos a crear

```
tools/agent/run.mjs              — orquestador (objetivo ≤ 250 líneas, sin dependencias)
tools/agent/config.json          — invocaciones de los CLI, rellenadas tras la Fase 0
tools/agent/prompts/implement.md — plantilla del prompt de Codex
tools/agent/prompts/review.md    — plantilla del prompt de Claude, con el contrato JSON
.githooks/pre-push               — rechaza todo push desde el clon del agente
.githooks/pre-commit             — rechaza commits en main
docs/AGENT_WORKFLOW.md           — hechos de la Fase 0, operación, límites del aislamiento
```

Modificados:

```
package.json     — script "agent": "node tools/agent/run.mjs"
.gitignore       — + .agent/
AGENTS.md        — rol implementador; entorno de ejecución en WSL
CLAUDE.md        — rol revisor; entorno de ejecución en WSL
```

Generados en ejecución, ignorados: `.agent/state.json`, `.agent/runs/**`.

**No se toca:** `packages/**`, `apps/**`, `tests/**`, `turbo.json`, cualquier `tsconfig.json`, `pnpm-lock.yaml`, `.github/workflows/**`, `LICENSE`, `docs/AGENT_SECURITY.md`.

## Criterios de aceptación

1. La Fase 0 está documentada con hechos verificados; ningún flag de CLI aparece en el código sin haber sido comprobado con el binario real.
2. La distribución WSL está configurada sin automontaje del disco de Windows y sin interop, con usuario no root, y `~/sidera-agent` clonado desde `origin`.
3. Las cinco validaciones pasan dentro de WSL.
4. `pnpm agent <TASK-ID>` ejecuta el ciclo completo y termina siempre en `HUMAN_GATE` o `STOPPED`.
5. El orquestador no introduce ninguna dependencia externa.
6. `tools/agent/run.mjs` es legible de una sentada y no supera las ~250 líneas.
7. El estado vive en `.agent/state.json`, ignorado por Git, con exactamente los cinco estados definidos y el campo `mode`.
8. Cada run deja un árbol de artefactos completo y legible bajo `.agent/runs/`.
9. El presupuesto de 2 reparaciones es un techo duro; T3 lo demuestra.
10. Un veredicto no parseable produce `STOPPED`, nunca `PASS`.
11. El orquestador no contiene código capaz de hacer `push`, `merge` ni `checkout main`.
12. Los hooks rechazan push y commits en `main`; T4 lo demuestra.
13. El rol revisor no puede escribir.
14. `docs/AGENT_WORKFLOW.md` documenta los límites reales del aislamiento WSL2 y declara que el Nivel A (worktree en Windows) es **sólo fallback manual**, nunca arquitectura de ejecución automática.
15. Si el sistema degrada a automatización parcial, lo declara explícitamente en su salida y en `state.mode`; en ningún caso simula una integración inexistente.
16. `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build` siguen pasando en el repositorio de Windows.
17. **Observabilidad (decisión K):** durante T1 y T2 debe demostrarse que **el operador sabe en todo momento qué fase, qué intento y qué proceso están activos sin inspeccionar ningún archivo interno**, sólo mirando la terminal. La terminal muestra además que Ctrl+C detiene el workflow.
18. **Sin razonamiento privado:** el runner no muestra, captura ni intenta extraer chain-of-thought de Claude o Codex. La observabilidad se limita a comandos, archivos, diffs, resultados, estados y veredictos.
19. **Auditabilidad (decisión K):** los eventos relevantes de cada run quedan persistidos en `.agent/runs/**` (`events.jsonl`), con el mismo detalle que se vio en vivo.
20. **Human abort (decisión L):** T5 demuestra que Ctrl+C lleva el run a `STOPPED` con `stopReason: "HUMAN_ABORT"` **conservando los cambios realizados hasta ese instante**, y que un run abortado no se reanuda sin acción humana explícita.
21. **Sin rollback destructivo:** el aborto no ejecuta `git reset --hard`, `git clean` ni equivalente. `git status` y `git diff` coinciden antes y después del Ctrl+C. El orquestador no contiene código capaz de ejecutar esas operaciones.
22. **Una TASK por ejecución (decisión M):** cada ejecución termina en `HUMAN_GATE` o `STOPPED`; el orquestador no contiene ninguna transición automática hacia otra TASK, ni cola, ni encadenamiento.
23. T1, T2, T3, T4 y T5 pasan, con evidencia registrada.

## Fuera de alcance

- Crear `TASK-004` o cualquier tarea de producto.
- Integrar ChatGPT / GPT-5.6 Sol.
- LangGraph, Temporal, Redis, bases de datos, vector databases, colas, microservicios, agentes especializados adicionales.
- Docker o cualquier contenedor: la vía elegida es WSL2 (decisión A).
- Adoptar el Nivel A como arquitectura de ejecución automática.
- Servidor, dashboard, interfaz web o TUI para el orquestador.
- Ejecución concurrente de varios runs.
- Métricas, telemetría, análisis de costes.
- Automatizar merge, push o apertura de PR.
- Configurar la protección de rama en GitHub (requisito humano, decisión E).
- Modificar `packages/**`, `apps/**`, `tests/**`, `turbo.json`, tsconfig, `pnpm-lock.yaml`, CI o `LICENSE`.
- Corregir la deuda de los `*.test.ts` emitidos en `dist/`.

## Condición exacta de terminación

La tarea termina cuando:

1. Las fases 0 a 4 están cerradas en orden.
2. Los archivos listados existen y los modificados están actualizados.
3. Los 23 criterios de aceptación se cumplen.
4. T1–T5 pasan con evidencia.
5. `git status --porcelain` muestra sólo los archivos permitidos, sin artefactos de `.agent/`.
6. Se ha entregado el resumen: archivos creados/modificados, hallazgos de la Fase 0, evidencia de T1–T5, y decisiones que requieran humano.

**No se hace commit, push, PR ni merge.** **No se continúa con TASK-004.**

Puntos de parada obligatoria:

- Si la Fase 0 revela que un CLI carece de modo no interactivo fiable → **detenerse y reportar**; degradar a `mode: "partial"` sólo con aprobación humana explícita.
- Si la configuración de contención de WSL no puede aplicarse tal como se especifica → **detenerse y reportar**; no ejecutar agentes automáticamente en un entorno menos contenido del acordado.
- Si el camino de vuelta (`fetch` desde WSL) no funciona → **detenerse y reportar** antes de fijar la vía del parche como oficial.
