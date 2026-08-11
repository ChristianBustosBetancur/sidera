# AGENT_REVIEW_POLICY.md — Selección de reviewers por TASK

Política versionada que determina **qué reviewers requiere cada TASK**. El Controller (Claude) la aplica al redactar la TASK y registra el resultado **explícitamente** en el propio documento de la TASK. El runner no infiere reviewers dinámicamente: lee lo que la TASK declara.

## Reviewers disponibles

| Id | Agente | Sesión | Sandbox | Rol |
|---|---|---|---|---|
| `claude-review` | Claude CLI | independiente | sin herramientas, sin lectura de archivos | Revisa el resultado contra los criterios de aceptación, usando **solo** la evidencia recibida (diff, status, validate). |
| `codex-qa` | Codex CLI | independiente de IMPLEMENT | `read-only` | Busca errores, casos borde, regresiones, falta de tests, y problemas de rendimiento/accesibilidad/móvil cuando corresponda. |
| `codex-data-audit` | Codex CLI | independiente de IMPLEMENT | `read-only` | Valida la fidelidad de un dataset contra sus documentos fuente. |

`claude-review` es **obligatorio en toda TASK**. Los otros dos son opcionales y se añaden según la tabla de selección.

### Diferencia deliberada de evidencia

`claude-review` es **evidence-only**: recibe diff, status y resultados de validación, y tiene prohibido leer archivos o ejecutar comandos. Esto mantiene la revisión centrada en el resultado, no en el relato del implementador (decisión de `docs/tasks/TASK-003.2.md`).

`codex-qa` y `codex-data-audit` son **read-only sobre el repositorio**: sí pueden leer archivos. Es justamente lo que los hace útiles — un auditor de datos que no puede abrir el documento fuente no puede verificar fidelidad. Esta diferencia es intencional, no una inconsistencia. (Ver la nota `nonBlocking` de la revisión de TASK-004.4, donde `claude-review` reportó correctamente que no podía verificar la transcripción por no tener acceso a la fuente: ese hueco es exactamente lo que `codex-data-audit` cubre.)

Ninguno de los tres escribe archivos, ejecuta operaciones de git, usa red adicional, MCP, búsqueda web ni credenciales.

## Tabla de selección

| Tipo de TASK | Reviewers requeridos |
|---|---|
| Documentación, configuración sencilla, specs | `claude-review` |
| UI pequeña o simple (layout estático, presentación) | `claude-review` |
| UI interactiva o compleja (estado, interacción, grafos, rendimiento) | `claude-review`, `codex-qa` |
| `curriculum-engine` / algoritmos | `claude-review`, `codex-qa` |
| `curriculum-domain` / `curriculum-schema` (dominio o esquema sensible) | `claude-review`, y `codex-qa` cuando el cambio tenga lógica o casos borde reales |
| Dataset, importación o fuentes curriculares | `claude-review`, `codex-data-audit` |
| `curriculum-importer` / `curriculum-validator` | `claude-review`, `codex-qa`, y `codex-data-audit` cuando la TASK toque datos o fuentes |
| Infraestructura del workflow (`tools/agent/`) | `claude-review`, y `codex-qa` cuando cambie la lógica del runner |

Cuando una TASK encaje en varias filas, se aplica la **unión** de los reviewers correspondientes.

Los cambios puramente mecánicos (añadir un campo obligatorio y actualizar fixtures, corregir la resolución de un import) se quedan en `claude-review` aunque toquen dominio o esquema: no hay lógica nueva que auditar. Ejemplos reales: TASK-004.2, TASK-004.3, TASK-004.5, TASK-004.6.

## Cómo lo declara una TASK

Todo documento de TASK incluye una sección con un bloque cercado de lenguaje `reviewers`, con un id por línea:

````markdown
## Reviewers requeridos

```reviewers
claude-review
codex-qa
```
````

Reglas:

- Ids válidos: `claude-review`, `codex-qa`, `codex-data-audit`. Un id desconocido detiene el run (`STOPPED`), no se ignora en silencio.
- Si una TASK no declara el bloque, el runner usa `claude-review` únicamente y lo indica en su salida. Es el comportamiento por defecto y coincide con el de todas las TASK anteriores a esta política.
- `claude-review` se ejecuta siempre, esté o no listado explícitamente.

## Gate agregado

Un run llega a `HUMAN_GATE` solo si:

1. `VALIDATE` completo está `PASS`; **y**
2. **todos** los reviewers requeridos devuelven `verdict: "PASS"`.

Si cualquier reviewer devuelve `FAIL`, sus blockers se acumulan con los del resto, vuelven a `IMPLEMENT` como reparación, y en la siguiente vuelta se ejecutan de nuevo `VALIDATE` completo y **todos** los reviewers requeridos — no solo el que falló.

El presupuesto de reparación no cambia: intento inicial + 2 reparaciones, después `STOPPED`.

## Contratos de salida

Los tres reviewers terminan su salida con un bloque JSON cercado, del que el runner toma el **último**. Un veredicto ausente, no parseable o con `verdict` inválido produce `STOPPED`, nunca `PASS` (decisión de `docs/tasks/TASK-003.2.md`; prohibido inferir el veredicto con heurísticas de texto).

`claude-review`:

```json
{"verdict":"PASS|FAIL","blockers":[{"file":"ruta","issue":"problema"}],"nonBlocking":[]}
```

`codex-qa`:

```json
{"verdict":"PASS|FAIL","blockers":[{"file":"ruta","issue":"problema"}],"risks":[],"missingTests":[]}
```

`codex-data-audit`:

```json
{"verdict":"PASS|FAIL","blockers":[{"file":"ruta","issue":"problema"}],"sourceMismatches":[],"inventedFields":[],"unresolvedReferences":[],"provenanceIssues":[]}
```

En los tres, `blockers` es el único campo que alimenta el repair loop. Los demás campos son informativos: se persisten en los artefactos del run y se muestran en el resumen, pero no bloquean el gate por sí solos.

## Qué no cambia esta política

Las prohibiciones y garantías existentes se mantienen intactas: sin `push`, sin `merge`, sin modificar `main`, sin operaciones destructivas, sin rollback automático, aislamiento del entorno, y ninguna transición automática hacia otra TASK. Añadir reviewers no relaja ninguna de ellas.

## Deuda conocida (registrada, no implementada)

Encontrada durante TASK-005.1.1 (investigación de un hydration mismatch que terminó en `STOPPED` sin fix — ver `docs/KNOWN_ISSUES.md`). Son limitaciones reales del runner/workflow, no de esa TASK en particular. Quedan aquí como registro explícito; ninguna se implementa hasta que se decida priorizarla.

1. **Una TASK no puede modificar su propio bloque `validations` (ni `reviewers`) esperando que afecte al run en curso.** El runner copia el documento de la TASK a `00-task.md` una sola vez, al inicio del run, antes del loop de intentos (`tools/agent/run.mjs`). Toda lectura posterior de `reviewers`/`validations` usa esa copia estática. Una instrucción de TASK que pida a Codex "declara X en este mismo documento y que tome efecto ahora" es mecánicamente imposible de cumplir. Ya ocurrió dos veces (TASK-005.0, con `selftest.mjs`; TASK-005.1.1, con un smoke test) y ambas costaron intentos de reparación completos sin ninguna posibilidad real de éxito.
2. **Falta un estado semántico entre `PASS` y "sigue reparando hasta agotar el presupuesto".** Una investigación que concluye honestamente "no encontré una causa raíz segura para cambiar código" es un resultado legítimo y distinto de "no se intentó" o "el fix está mal" — pero hoy ambos casos terminan igual: `FAIL` → reparación → eventualmente `STOPPED`. Un estado tipo `INCONCLUSIVE` / `ENVIRONMENT_BLOCKED`, terminal como `HUMAN_GATE` y `STOPPED` pero semánticamente distinto de un fallo, evitaría gastar presupuesto de reparación en una conclusión que no va a cambiar entre intentos.
3. **`REVIEW` evidence-only no puede distinguir "no hizo nada" de "investigó correctamente y no encontró un cambio seguro".** `claude-review`, `codex-qa` y `codex-data-audit` juzgan diff + status + validate — nunca el resumen ni el razonamiento de Codex (decisión deliberada de `docs/tasks/TASK-003.2.md`, para que la revisión sea sobre el resultado, no sobre el relato). Cuando el resultado correcto de una investigación es "sin cambios de código", esa misma regla que mantiene honesta la revisión le impide reconocer un resultado legítimamente vacío. Emparejado con el punto 2, esto es lo que hizo indistinguibles, para el runner, un intento de TASK-005.1.1 fallido de uno exitoso-pero-sin-fix.
