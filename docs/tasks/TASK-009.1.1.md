# TASK-009.1.1 — Structural visual revision of /explorar after HUMAN_GATE

## Naturaleza de esta TASK

Especificación de implementación, autoría de Claude en su rol de UX/arquitecto frontend (`CLAUDE.md`), derivada de una revisión visual humana en `HUMAN_GATE` de `TASK-009.1`. No modifica `docs/tasks/TASK-009.1.md` — ese documento queda como **evidencia histórica** de la primera implementación de `/explorar`, que pasó todas las validaciones técnicas y llegó a `HUMAN_GATE`, pero fue rechazada en la revisión visual. Esta TASK es la especificación de la revisión estructural que la sustituye.

## Motivo

- `TASK-009.1` pasó `pnpm lint`/`typecheck`/`test`/`build` y `claude-review` (intento 2/3) sin blockers.
- El `HUMAN_GATE` visual **no aprobó** la composición resultante.
- El problema diagnosticado **no fue** el DAG, el algoritmo de barycenter, el dataset ni el engine — todos correctos y verificados. El problema fue el **mapeo geometría→pantalla**: columnas de nivel visibles con headers "Nivel X", un grid con wrap tipo ladrillo demasiado compacto, el código académico dominando visualmente sobre el nombre de la materia, y las 73 conexiones (aunque tenues) leyéndose como una nube gris uniforme. El resultado se sentía como "`/grafo` con círculos", no como un DAG curricular con lenguaje de skill tree.

Esta TASK reescribe exclusivamente ese mapeo visual. El DAG real, los cuatro estados, `graph.graphLevels`, el algoritmo de barycenter forward/backward y el alcance técnico de `TASK-009.1` (archivos, sin dependencias nuevas, sin tocar engine/dataset) se mantienen como base — se revisa cómo se traducen a composición en pantalla, no la lógica que los produce.

## Decisiones aprobadas

### 1. `IN_PROGRESS` — nueva paleta, contraste medido

El fondo `#245f86` original fallaba contraste (<3:1, hasta 1.17:1) contra varios anillos de agrupación cuando se usaba como relleno del medallón. Se reemplaza:

| Rol | Color |
|---|---|
| Fondo | `#e6eef7` |
| Indicador/marca interna | `#245f86` (reutilizado, cambia de rol: de fondo a marca) |
| Texto | `#14181c` |

**Contraste medido de los 8 anillos de agrupación contra el nuevo fondo `#e6eef7`**:

| Agrupación | Contraste |
|---|---|
| Matemáticas | 4.83:1 |
| Programación | **3.44:1** (mínimo) |
| Ciencias Naturales y Estadística | 5.03:1 |
| Algoritmos y Computación | 11.41:1 |
| Computación Científica | 3.70:1 |
| Sistemas de Cómputo | 5.03:1 |
| Computación Aplicada | 4.59:1 |
| Trabajo de Grado | 9.34:1 |

Mínimo de los 8: **3.44:1** — por encima del umbral de 3:1 exigido para indicadores no textuales, con margen real. Marca interna `#245f86` contra el nuevo fondo: 5.87:1. Texto `#14181c`: 15.24:1.

### 2. Layout — de grid con wrap a posición continua

Se elimina completamente:
- headers "Nivel X" visibles en el lienzo;
- el grid/wrap tipo ladrillo (`ROW_SIZE` + offset de fila);
- `ROW_SIZE` como arquitectura de layout en desktop/tablet.

Los niveles 0–5 (`graph.graphLevels`, sin cambios) siguen siendo la profundidad lógica — pero **invisible** en el lienzo; puede aparecer como dato secundario en el panel de detalle ("Profundidad: nivel N").

Barycenter forward/backward (sin cambios de algoritmo respecto a `TASK-009.1`) sigue siendo la base del orden dentro de cada nivel.

**Posición**:
- la profundidad topológica define el eje principal aproximado (X en desktop, Y en móvil), con espaciado significativamente mayor que en `TASK-009.1`;
- el orden por barycenter/adyacencia define la posición en el eje perpendicular, de forma **continua** — sin wrap de filas;
- sin filas rígidas: un nodo se posiciona a lo largo de una secuencia continua espaciada generosamente, no envuelto en una rejilla de `ROW_SIZE` columnas.

**Jitter — corregido respecto a la propuesta inicial**: no se usa ±1.25rem arbitrario como mecanismo principal de composición. Se respeta primero la geometría derivada del DAG (posición determinada por nivel + barycenter). Se permite **únicamente** un micro-offset determinista de **~±0.5–0.75rem** como desempate visual para romper alineaciones mecánicas — nunca a costa de empeorar la proximidad espacial entre nodos conectados, que es el objetivo real del barycenter.

### 3. Nivel 3 (17 nodos)

No se comprime ni se envuelve en grid. Ocupa más extensión continua del lienzo en su eje. El lienzo puede crecer (scroll, en el eje que corresponda) para respetar el espacio negativo — no se sacrifica aire por caber en un contenedor fijo.

### 4. Nodos

- Medallón objetivo: **~5.5rem** (sube desde 3.5rem).
- Siempre visible: nombre de la materia (máximo 2 líneas, truncado), estado, agrupación.
- Código académico: secundario, visualmente menor — visible, pero sin protagonismo.
- Se mantiene sin cambios: **agrupación = único anillo permanente**, **estado = relleno + glifo**, **selección = único outline exterior adicional**. Ningún anillo doble ni triple.

### 5. Conexiones

- **Reposo**: ~0.02–0.03 de opacidad para edges generales — textura mínima, no nube dominante.
- **Excepción con intención**: edges donde ambos extremos están `COMPLETED` pueden tener presencia ligeramente superior en reposo, para insinuar "camino recorrido" — sin dominar el lienzo, sin inventar semántica curricular nueva (se deriva del mismo `states` ya existente).
- **Selección**: el DAG relacionado "aparece", con jerarquía de opacidad por distancia (calculable con BFS trivial sobre 60 nodos/73 edges — costo insignificante a esta escala):

  | Distancia al nodo seleccionado | Opacidad objetivo |
  |---|---|
  | Edge directo (prerrequisito/dependiente inmediato) | máxima presencia |
  | Distancia 2 | ~55% |
  | Distancia 3+ | ~25% |
  | No relacionado | casi invisible |

- Debe distinguir visualmente antecedentes (lo que la materia requiere) de descendientes (lo que la materia desbloquea) — sin inventar un tercer tipo de relación curricular; el dominio sigue modelando solo prerrequisito/correquisito.

### 6. Paths

Curvas SVG cúbicas, mismo mecanismo que ya existe (sin librería nueva).

**Tramo compartido tipo tronco**: nice-to-have, no bloqueante. Se intenta solo si no complica estabilidad ni validación — es lo primero que se recorta si el tiempo o la implementación lo exigen.

### 7. Composición

- Se elimina el borde/caja visual fuerte alrededor del lienzo.
- Más espacio negativo.
- Sin zonas de nivel, sin carriles de agrupación (ninguna partición geométrica — la agrupación sigue siendo solo el anillo del nodo, igual que ya estableció `TASK-008.0`/`TASK-009.0`).
- Sin decoración fantasy, sin elementos visuales sin respaldo de dato real.

**Objetivo**: un DAG curricular con lenguaje de skill tree — *game feel, no game skin*.

### 8. Móvil

- Scroll vertical nativo (sin cambios respecto a `TASK-009.1`).
- Profundidad topológica en el eje vertical.
- Offsets laterales/zigzag derivados del orden del DAG (barycenter), no de un `ROW_SIZE` fijo por breakpoint.
- No debe leerse como lista lineal de círculos — debe conservar bifurcación visual con menos ancho disponible.
- No hereda el canvas horizontal-only de `/grafo`.

### 9. Alcance técnico — sin cambios respecto a `TASK-009.1`

No se toca: `curriculum-graph.ts`, `curriculum-engine`, dataset, `packages/**`. Sin dependencias nuevas, sin WebGL, sin Three.js, sin zoom, sin glow pesado.

## Criterios de aceptación

1. No aparecen headers "Nivel X" en el lienzo.
2. No existe layout perceptible de grid/ladrillo (sin filas ni columnas alineadas mecánicamente).
3. Los nombres de materia dominan visualmente sobre los códigos académicos.
4. Cero colisión de nodos y de sus labels, en los tres regímenes de ancho (desktop/tablet/móvil).
5. Las 60 materias reales están presentes (sin subconjunto, sin mock).
6. El reposo de conexiones no produce una nube dominante de las 73 edges — impresión visual de espacio abierto, no de malla saturada.
7. Seleccionar un nodo revela claramente su vecindad directa y, con jerarquía de opacidad por distancia, su cadena transitiva.
8. El nivel 3 (17 nodos) sigue siendo legible sin comprimirse en grid.
9. Móvil conserva bifurcación visual perceptible — no se lee como lista lineal de círculos.
10. Contraste medido de los 8 anillos de agrupación contra el nuevo fondo de `IN_PROGRESS` (`#e6eef7`) ≥3:1, con el mínimo real documentado (3.44:1).
11. Agrupación sigue siendo único anillo permanente; estado sigue siendo relleno + glifo; selección sigue siendo único outline adicional — sin anillos dobles/triples.
12. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` — PASS.
13. Cero cambios en `curriculum-graph.ts`, `packages/**`, dataset, engine.
14. Sin dependencias nuevas en `package.json`.
15. `apps/web/AGENTS.md`, `apps/web/CLAUDE.md`, `.claude/settings.json` fuera de cualquier commit.
16. `docs/tasks/TASK-009.1.md` permanece sin modificar — queda como evidencia histórica.

## Condición de terminación

Este documento constituye la especificación de implementación de `TASK-009.1.1`, aprobada a partir de la revisión visual de `HUMAN_GATE` de `TASK-009.1`. No se implementa código en esta entrega; no hay commit, push, merge ni deploy. Queda pendiente de lanzamiento (runner de agentes) tras aprobación humana explícita.
