# TASK-009.1.2 — Multi-root vertical skill tree over the real DAG

## Naturaleza de esta TASK

Especificación de implementación, autoría de Claude en su rol de UX/arquitecto frontend (`CLAUDE.md`). No modifica `docs/tasks/TASK-009.1.md` ni `docs/tasks/TASK-009.1.1.md` — ambos quedan como **evidencia histórica** de iteraciones que pasaron todas sus validaciones técnicas y llegaron a `HUMAN_GATE`, pero fueron rechazadas en revisión visual humana.

## Motivo

- `TASK-009.1` (layout por grid/`ROW_SIZE` + barycenter): validaciones PASS, `claude-review` PASS, **rechazada en `HUMAN_GATE` visual** — se leía como "`/grafo` con medallones".
- `TASK-009.1.1` (layout continuo, sin grid, medallones grandes, edges casi invisibles): validaciones PASS, `claude-review` PASS en el primer intento, **rechazada de nuevo en `HUMAN_GATE` visual** — seguía leyendo como un DAG ordenado, no como un skill tree.

Diagnóstico acumulado: ambas iteraciones priorizaron **dibujar bien un DAG**. Lo que el producto necesita es **leer como skill tree**, manteniendo el DAG real debajo. Ese es un cambio de composición, no de ajuste de parámetros — por eso esta TASK reemplaza el mecanismo de layout en vez de refinarlo.

`TASK-009.1.2` define la primera composición explícitamente diseñada como **multi-root vertical skill tree sobre DAG real**.

## Principio

> **Skill tree visual, DAG estructural.**

El DAG real (60 materias, 73 edges, bifurcaciones, reconvergencias, dependencias cruzadas) no se altera ni se simplifica. Lo que cambia es cómo se traduce a pantalla.

## Decisiones aprobadas

### Orientación

Top-down: `visualDepth 0` arriba, profundidad creciente hacia abajo. Fundamentos visibles al entrar, scroll vertical natural, sin scroll programático inicial, sin inversión CSS, sin riesgo añadido de foco/hidratación/móvil.

Si una iteración posterior decide invertir a bottom-up, se acompañará de un control de navegación al origen ("Volver a fundamentos") — **fuera de alcance aquí**.

### `visualDepth` — separado de `graphLevel`

Regla general derivada de **requirement types**, nunca de `academicCode` ni de nombre de materia:

```
esGateDeCréditos(req) =
  req.type ∈ { MIN_TOTAL_CREDITS, MIN_COMPONENT_CREDITS,
               MIN_GROUPING_CREDITS, MIN_GROUPING_COURSES }
  // exactamente los cuatro tipos que curriculum-graph.ts devuelve como []

tieneRequisitoDeCurso(req) =                       // recursivo sobre ALL/ANY/AT_LEAST
  req es COURSE_COMPLETED | COURSE_COMPLETED_OR_CONCURRENT
  ∨ (req es ALL|ANY|AT_LEAST ∧ algún child cumple)

MAX_EDGE_LEVEL = max(graph.graphLevels.values())   // hoy 5

visualDepth(node):
  req = node.requirements
  si req existe ∧ ¬tieneRequisitoDeCurso(req) ∧ contiene esGateDeCréditos(req):
      return MAX_EDGE_LEVEL + 1                    // estrato final
  return graph.graphLevels.get(node.id)
```

**Verificado contra el dataset real**: los cuatro tipos no-edge aparecen **una sola vez** en las 60 definiciones (`MIN_COMPONENT_CREDITS` en Trabajo de grado, línea 168), y el campo `requirements:` explícito aparece también una sola vez. Además `requirementFor()` ignora `prerequisites`/`corequisites` cuando `requirements` está definido, así que el aislamiento de ese nodo es estructural.

**Único nodo afectado hoy: Trabajo de grado (3010664)** — `graphLevel 0`, `visualDepth 6`, **cero edges artificiales**. Su gate real (34 créditos del componente disciplinar) se explica en el panel de detalle. La regla es general: si el dataset incorporara mañana otro nodo con gate de créditos y sin prerrequisitos de curso, recibiría el mismo tratamiento sin tocar código.

### Multi-root — sin super-root, sin backbone artificial

No existe raíz única ni cadena central obligatoria. Los puntos de entrada reales son raíces independientes y **nunca se conectan entre sí**.

Nivel 0 queda con **7 raíces** (Trabajo de grado desciende al estrato final). Colocación centro-hacia-afuera por rank de centralidad — `centralidad = alcanceTransitivo + outDegree`, métricas reales medidas sobre el dataset:

| Rank | Root | Centralidad | x |
|---|---|---|---|
| 0 | Cálculo diferencial (1000004-M) | 35 | 0 |
| 1 | Fundamentos de matemáticas (3010334) | 26 | +1 |
| 2 | Fundamentos de programación (3010435) | 22 | −1 |
| 3 | Geometría vectorial y analítica (1000008-M) | 14 | +2 |
| 4–6 | Biología molecular, Química general, Intro. al programa CS | bajo | −2, +3, −3 |

La centralidad decide **solo cercanía al centro visual**, nunca parentesco.

### Stagger vertical

Aplicado a todos los estratos (mismo mecanismo, no un caso especial de nivel 0):

```
staggerY(n) = ((hash(n.academicCode) % 3) − 1) × STAGGER_REM     // −1, 0, +1
STAGGER_REM ≈ 1.1rem
```

Cota obligatoria: el stagger debe mantenerse **≤10% de `LEVEL_STEP`** para que jamás pueda confundirse con un cambio de estrato. Determinista, sin aleatoriedad. Rompe la fila administrativa perfecta sin implicar dependencia ni nivel distinto.

### Centro visual emergente

```
barycenter(n) = visualDepth(n) == 0
                  ? posiciónCentroAfuera(rankCentralidad(n))
                  : media( x(p) para p ∈ predecesores reales de n )

attraction(n) = FACTOR_MAX × (centralidad(n) / centralidadMáx)
x_raw(n)      = barycenter(n) × (1 − attraction(n)) + microOffset(n)
y(n)          = visualDepth(n) × LEVEL_STEP + staggerY(n)
```

`FACTOR_MAX` (`EXPLORER_CENTER_ATTRACTION_MAX`): **valor inicial 0.20**, rango razonable 0.15–0.25. Constante **exclusivamente de presentación**, aislada en un único lugar, ajustable en `HUMAN_GATE`. No es regla de dominio y **nunca debe dominar sobre el barycenter** — de ahí el tope bajo.

La espina central **emerge** donde varias ramas reconvergen y donde los hubs reales concentran dependencias. No se elige a mano ninguna cadena.

## Precisión 1 — Footprint determinista, `explorer-layout.ts` puro

`explorer-layout.ts` debe permanecer una **función pura**. Queda explícitamente prohibido:

- `getBoundingClientRect()` u otra medición DOM dentro del layout;
- medición de texto vía canvas;
- cualquier ciclo render → medir → recalcular layout.

La resolución de colisiones se basa en un **footprint visual conservador y determinista**, declarado como constantes:

```
NODE_DIAMETER_REM      // diámetro del medallón
LABEL_WIDTH_REM        // ancho CSS fijo del label (máximo 2 líneas, controlado por CSS)
NODE_FOOTPRINT_REM     // max(NODE_DIAMETER_REM, LABEL_WIDTH_REM)
MIN_GAP_REM            // NODE_FOOTPRINT_REM + aire mínimo
```

El label tiene ancho controlado por CSS y máximo 2 líneas, así que el footprint es conocido de antemano — no hace falta medirlo en runtime. Esto corrige directamente la debilidad señalada por `claude-review` en la iteración anterior (el test de colisión validaba solo el diámetro del medallón, no el ancho real con etiqueta).

**Debe ser testeable en `explorer-layout.test.ts`** con el footprint completo, no solo con el diámetro.

### Resolución de colisiones 1D

```
por cada estrato:
  ordenar nodos por x_raw                     // preserva el orden orgánico
  barrido único izquierda → derecha:
      si x[i] − x[i−1] < MIN_GAP_REM:
          x[i] = x[i−1] + MIN_GAP_REM
  (opcional) recentrar el estrato restando la media de su desplazamiento
```

Propiedad obligatoria: **nunca reordena, solo separa** — el orden izquierda-derecha derivado del barycenter se conserva íntegro. Complejidad `O(n log n)` por estrato, dominada por el estrato más denso (17 nodos). Trivial a esta escala.

## Precisión 2 — Stems compartidos, una sola geometría

**Problema a evitar**: si varias edges dibujan exactamente el mismo segmento superpuesto, el stroke y la opacidad se acumulan y el tramo compartido se ve más oscuro que el resto — artefacto visual, no intención.

**Solución**: el stem se genera **una sola vez por nodo origen** cuando ese nodo tiene múltiples edges salientes. Es un elemento SVG propio, no la suma de varias edges pisándose.

```
origen
  |
  |     ← branch stem: UNA sola geometría visual, generada una vez
  ●  stemEnd
 /|\    ← cada edge real arranca visualmente en stemEnd y se separa
```

Reglas obligatorias:

- El stem **no es una edge curricular**: no modifica el DAG, no aparece en `graph.edges`, no altera prerrequisitos ni estados.
- Es **geometría visual pura**, derivada de forma determinista de la posición de un único nodo.
- **Cada edge real sigue existiendo individualmente** como su propio `<path>`, con sus propios datos y su propia semántica.
- **Selección/focus debe seguir reflejando las relaciones reales**, nunca la agrupación visual del stem.
- La intensidad de un stem durante la selección puede derivarse de la **máxima relevancia de las edges reales que representa** visualmente.

**Stem de salida (bifurcación): obligatorio.**
**Stem de entrada (reconvergencia): nice-to-have** — se implementa si resulta simple y estable; si complica el MVP, se difiere sin bloquear.

## Nodos, estados y conexiones

Sin cambios respecto a lo ya aprobado en `TASK-009.1.1`:

- Medallones grandes (~5.5rem), nombre de materia como protagonista, código secundario.
- **Agrupación = único anillo permanente** (paleta de `TASK-008.2`, sin cambios).
- **Estado = relleno + glifo**; `IN_PROGRESS` cualitativo (fondo `#e6eef7`, indicador `#245f86`, texto `#14181c`; los 8 anillos verificados ≥3:1, mínimo 3.44:1).
- **Selección = único outline exterior adicional.** Nunca anillos dobles ni triples.
- Bloqueados lejanos pueden tener menor presencia por opacidad, pero siguen accesibles (foco, teclado, lectores de pantalla).
- Paths verticales curvos con lenguaje de rama; reposo muestra estructura suficiente para leer el árbol; la selección revela el DAG real con jerarquía por distancia (directo > distancia 2 > distancia 3+ > no relacionado casi invisible).

## Responsive

Desktop, tablet y móvil **comparten orientación vertical top-down** — cambian solo las constantes de espaciado, no el mecanismo:

| | `LEVEL_STEP` | `MIN_GAP_REM` | Scroll |
|---|---|---|---|
| Desktop | mayor | mayor | vertical principal; horizontal secundario si el estrato más denso excede el viewport |
| Tablet | medio | medio | igual |
| Móvil | menor | menor, nunca por debajo del footprint | vertical principal; se minimiza el pan horizontal reduciendo el gap, sin comprimir hasta colisionar |

El lienzo **puede** exceder el ancho del viewport en el estrato de 17 nodos — es aceptable y esperado; no se comprime ni se envuelve en grid. Desaparece la bifurcación desktop-horizontal / móvil-vertical y con ella el `mobileOffset` cíclico que `claude-review` marcó como "`ROW_SIZE` encubierto".

## Criterio visual principal

Al abrir `/explorar`, **antes de leer un solo nombre**, debe leerse: *"esto es un árbol de habilidades"*.

No debe recordar a: columnas de `/grafo`, salida de Graphviz, grid, ni diagrama administrativo.

Debe percibirse: raíces, bifurcaciones, ramas, reconvergencias, progresión vertical, territorio recorrido y territorio futuro.

*Game feel, no game skin*: sin fantasy, sin partículas, sin hojas, sin iconos inventados por materia, sin glow pesado, sin estética RPG genérica. La personalidad viene de la geometría real del currículo, los nombres reales, la paleta de agrupaciones y los estados reales.

## Archivos previstos

| Archivo | Acción |
|---|---|
| `apps/web/lib/explorer-layout.ts` | reescritura del mecanismo: `visualDepth`, centralidad, roots centro-afuera, stagger, atracción, colisión 1D por footprint |
| `apps/web/lib/explorer-layout.test.ts` | tests actualizados: colisión con footprint completo (no solo diámetro), `visualDepth` de gate de créditos, orden preservado por la pasada de colisión |
| `apps/web/app/explorar-view.tsx` | stems de salida, paths verticales, eliminación de `rowSizeForWidth`/`mobileOffset`, explicación del gate de créditos en detalle |
| `apps/web/app/explorar-view.module.css` | composición vertical, footprint de label controlado por CSS (ancho fijo, máx. 2 líneas) |
| `apps/web/app/explorar/page.tsx` | sin cambios previstos |

Sin cambios en `curriculum-graph.ts`, `packages/**`, dataset, engine, `/grafo` ni Vista Plan (más allá de los enlaces ya autorizados en `TASK-009.1`).

## Criterios de aceptación

1. `/explorar` se lee como skill tree antes de leer texto: raíces arriba, progresión vertical hacia abajo, bifurcaciones y reconvergencias perceptibles.
2. Orientación top-down: `visualDepth 0` arriba, sin scroll programático inicial, sin inversión CSS.
3. Múltiples raíces reales visibles en el estrato superior; **ninguna conectada artificialmente con otra**; sin super-root; sin backbone elegido a mano.
4. `visualDepth` implementado como regla general por requirement type, **sin hardcode por `academicCode` ni por nombre**.
5. Trabajo de grado aparece en el estrato final (`visualDepth 6`), con **cero edges**, y su gate real (`MIN_COMPONENT_CREDITS`, 34 créditos del componente disciplinar) explicado en el panel de detalle.
6. `explorer-layout.ts` es una función pura: sin `getBoundingClientRect`, sin medición de texto, sin ciclo render→medir→relayout.
7. La resolución de colisiones usa el footprint declarado (`NODE_FOOTPRINT_REM`/`MIN_GAP_REM`, incluyendo ancho de label), verificado en `explorer-layout.test.ts` — no solo el diámetro del medallón.
8. La pasada de colisión nunca reordena nodos dentro de un estrato, solo los separa (verificable por test).
9. El stem de bifurcación se genera **una sola vez por nodo origen**, sin superposición acumulativa de stroke/opacidad; cada edge real sigue siendo un `<path>` individual.
10. El stem no aparece en `graph.edges` ni altera el DAG; selección y focus siguen reflejando exclusivamente relaciones curriculares reales.
11. Stagger vertical ≤10% de `LEVEL_STEP`, determinista, sin aleatoriedad.
12. `FACTOR_MAX` aislado como constante de presentación única, valor inicial 0.20, sin dominar sobre el barycenter.
13. Las 60 materias reales están presentes (sin subconjunto, sin mock).
14. Agrupación sigue siendo único anillo permanente; estado = relleno + glifo; selección = único outline adicional; `IN_PROGRESS` mantiene ≥3:1 con los 8 anillos.
15. Cero colisión de nodos y labels en desktop, tablet y móvil.
16. Desktop, tablet y móvil comparten orientación vertical; scroll vertical es el recorrido principal en los tres.
17. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` — PASS.
18. Cero cambios en `curriculum-graph.ts`, `packages/**`, dataset, engine.
19. Sin dependencias nuevas, sin force-directed, sin WebGL, sin Three.js, sin zoom, sin glow pesado.
20. `docs/tasks/TASK-009.1.md` y `docs/tasks/TASK-009.1.1.md` permanecen sin modificar.
21. `apps/web/AGENTS.md`, `apps/web/CLAUDE.md`, `.claude/settings.json` fuera de cualquier commit.

## Nice-to-haves recortables

- Stem de entrada para reconvergencias (el de salida es obligatorio).
- Pasada adicional de intercambio adyacente para reducir cruces, si aporta sin complicar.

## Fuera de alcance

- Bottom-up y su control de navegación al origen.
- Zoom, halo/glow difuminado, leyenda de agrupaciones en el lienzo, porcentaje global de progreso.
- Variación de tamaño de nodo por importancia.
- Corrección del bug móvil/táctil conocido de `/grafo`.

## Condición de terminación

Este documento constituye la especificación de implementación de `TASK-009.1.2`. No se implementa código en esta entrega; no hay commit, push, merge ni deploy. Queda pendiente de lanzamiento tras aprobación humana explícita.
