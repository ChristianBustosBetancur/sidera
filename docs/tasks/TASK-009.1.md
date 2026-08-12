# TASK-009.1 — Primera implementación de la Vista Explorar

## Naturaleza de esta TASK

Primera implementación acotada y real de `/explorar`, derivada de las decisiones cerradas en `TASK-009.0` y refinadas en la revisión posterior de esa misma sesión (layout por barycenter, DAG explícito, estados sin cuantificar avance inexistente). Forma acordada: **componente + estilos + un helper de layout local**, sin tocar dominio, engine, dataset ni `/grafo`. Sigue el patrón habitual del repo (Codex implementa, revisión humana antes de commit).

## Objetivo y alcance exacto

Demostrar que `/explorar` se siente **distinta** a `/grafo` — no "las mismas columnas con círculos" — usando **las 60 materias reales** desde el primer corte, con:

- currículo modelado visualmente como lo que es: un **DAG con bifurcaciones y reconvergencias**, nunca forzado a parecer árbol puro;
- niveles topológicos (`graph.graphLevels`, sin cambios) como profundidad lógica, con posición horizontal/vertical dentro de cada nivel derivada de **adyacencia real** (barycenter), no de agrupación ni de orden de aparición en el dataset;
- medallones uniformes (mismo tamaño para las 60 materias — ninguna jerarquía visual nueva por importancia);
- agrupación como único anillo permanente; estado como relleno + glifo; selección como único outline adicional;
- conexiones en reposo muy tenues, plenas solo al seleccionar;
- 2D, sin dependencias nuevas, sin física, sin WebGL/Three.js.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/web/app/explorar/page.tsx` | **Nuevo** — mismo patrón mínimo que `apps/web/app/grafo/page.tsx` |
| `apps/web/app/explorar-view.tsx` | **Nuevo** — componente principal |
| `apps/web/app/explorar-view.module.css` | **Nuevo** |
| `apps/web/lib/explorer-layout.ts` | **Nuevo** — helper puro de geometría (algoritmo de §Layout); no decide estados, prerrequisitos ni desbloqueos, solo dónde dibujar lo que `curriculum-graph.ts`/`curriculum-engine` ya deciden |
| `apps/web/app/curriculum-view.tsx` | **Modificado, solo texto** — el CTA `"Explorar grafo interactivo"` (línea ~394, hacia `/grafo`) cambia de copy para no colisionar con el nombre propio de la vista nueva (ej. `"Ver grafo de dependencias"`), y se añade un segundo enlace hacia `/explorar` junto al existente hacia `/grafo` |
| `apps/web/app/grafo/graph-view.tsx` | **Modificado, solo el `<header>`** — se añade un enlace hacia `/explorar` junto al existente hacia `/` (`"Ver plan por componentes"`); cero cambios de lógica, layout, scroll o focus mode |

Nada en `packages/**`, `curriculum-graph.ts`, dataset, `curriculum-view.module.css` (salvo el copy), `graph-view.module.css`.

## Algoritmo de layout

**Niveles**: `graph.graphLevels` (0–5), sin cambios en `curriculum-graph.ts` — se reutiliza el mismo dato que ya consume `/grafo`.

**Orden dentro de cada nivel — barycenter forward/backward, sin física, sin dependencia**:

```
// Nivel 0 — sin predecesores, orden inicial estable
orden[0] = nodosDelNivel(0) ordenados por academicCode

// Pasada hacia adelante — nivel 1 a 5
para L en 1..5:
  para cada nodo en nivel L:
    predecesores = orígenes de edges donde este nodo es destino
                   (cualquier nivel de origen; ya tiene x() calculada)
    barycenter(nodo) = predecesores.length > 0
      ? promedio( x(p) para p en predecesores )
      : posición estable de respaldo (por academicCode)
  orden[L] = nodos del nivel L ordenados por barycenter ascendente,
             desempate estable por academicCode
  asignar x() según ese orden (columna dentro de la banda del nivel, con wrap de fila)

// Pasada hacia atrás — nivel 4 a 0 (refina con los hijos ya posicionados)
para L en 4..0 (descendente):
  para cada nodo en nivel L:
    sucesores = destinos de edges donde este nodo es origen
    barycenter(nodo) = sucesores.length > 0
      ? promedio( x(s) para s en sucesores )
      : mantener x() de la pasada anterior
  reordenar nivel L por ese barycenter, desempate por x() previa (estabilidad)
  reasignar x()
```

Una pasada adelante + una atrás (mínimo estándar de la técnica de Sugiyama para reducción de cruces en grafos por capas). Sin iteración hasta convergencia, sin librería — a esta escala (60 nodos, 73 edges) es una función pura de ~50-60 líneas.

**Wrap de fila dentro de una banda de nivel** (evita colisión por construcción, no por detección en runtime):

```
NODE_SIZE = 3.5rem
NODE_SPACING_X = 4.5rem
ROW_HEIGHT = 5.5rem
BRICK_OFFSET = NODE_SPACING_X / 2

para cada nodo, índice i dentro del orden ya calculado del nivel:
  row = floor(i / ROW_SIZE)
  col = i % ROW_SIZE
  offsetX = (row impar) ? BRICK_OFFSET : 0
  x = col * NODE_SPACING_X + offsetX
  y = row * ROW_HEIGHT
```

`ROW_SIZE` es el único parámetro que varía por breakpoint (ver Responsive) — el algoritmo de orden (barycenter) es idéntico en todos los tamaños de pantalla; solo cambia cómo se envuelve la secuencia resultante.

### Ejemplo con datos reales (verificado contra `unal-cs-2024-official/index.ts`, no inventado)

```
Nivel 0        A                                    B
          Cálculo diferencial              Fund. de matemáticas
          (1000004-M)                      (3010334)
               |  \___________________________  |
               |                            \    |
               |                             \   |
Nivel 1        C                              D                E
          Cálculo integral            Fund. de análisis   Fund. mat. discretas
          (1000005-M)                 (3010389)           (3010390)
          pred: A                     pred: A, B          pred: B
               |
               |
Nivel 2        F
          Cálculo en varias variables
          (1000006-M)
          pred: C
```

`bary(D) = promedio(x(A), x(B))` posiciona a D entre sus dos padres — lectura visual correcta de una reconvergencia real, sin decidirlo a mano.

**Nivel 3 (17 nodos, el más denso)**: mismo wrap de fila, aplicado al orden ya reducido por barycenter (no al orden por agrupación). Limitación aceptada y documentada: el salto de una fila a la siguiente no preserva perfectamente la adyacencia espacial en el borde del wrap — costo real de encajar 17 nodos en un ancho de columna legible, no oculto. `ROW_SIZE` para este nivel es ajustable en implementación (4 como valor de partida; subirlo a 5-6 reduce el número de filas y el número de bordes de wrap).

**Costo computacional**: 2 pasadas × 73 edges (acumular barycenters) + 2 pasadas × ordenar ~10 nodos promedio por nivel (`O(n log n)`, trivial) — unas pocas centenas de operaciones, calculadas una sola vez al montar la vista, no por frame. Mismo orden de magnitud (menor) que lo que `measureEdges` de `/grafo` ya recalcula en cada resize hoy.

## Nodo — medallón (uniforme, sin variación de tamaño por importancia)

- **Tamaño**: 3.5rem de diámetro, uniforme para las 60 materias — ningún hub (ej. Cálculo diferencial, que desbloquea transitivamente 31 materias) recibe tratamiento visual especial; las métricas de conectividad ya calculadas se usan solo para *verificar* que el layout resultante tenga sentido, nunca para cambiar semántica ni tamaño.
- **Qué se ve siempre**: relleno de estado + glifo de estado, anillo delgado (2-3px) de color de agrupación (paleta ya validada en `TASK-008.2`, reutilizada tal cual), código de la materia como label externo corto debajo.
- **Agrupación = único anillo permanente.** Nunca hay un segundo anillo de estado compitiendo.
- **Estado = relleno + glifo**, sin cuantificar avance inexistente:

  | Estado | Relleno | Glifo/señal |
  |---|---|---|
  | `blocked` | apagado | candado CSS (reutilizado literal de `TASK-008.1`, sin emoji, monocromo, determinista) |
  | `available` | claro | contorno propio, único estado con señal "viva" claramente accionable |
  | `in_progress` | acento sólido propio (no degradado, no `conic-gradient`, no insinuación de porcentaje) | punto/marca estática |
  | `completed` | suave | check CSS (`\2713`, reutilizado) |

- **Selección = único outline exterior adicional** (`box-shadow: 0 0 0 3px <color>`, mismo patrón que `.selected` en `/grafo`) — nunca dos anillos permanentes simultáneos.

## Conexiones

- **Reposo**: las 73 edges se renderizan a opacidad muy baja (≈0.06-0.08) — textura ambiental, no compiten por atención. Prerrequisito sólido / correquisito discontinuo, misma distinción que ya existe en el dominio (no se inventa un tercer tipo).
- **Selección**: edges relacionadas al nodo seleccionado (`sourceId`/`targetId === selectedId`) suben a opacidad plena; el resto baja aún más (≈0.02) — mismo mecanismo de foco ya probado y revisado de accesibilidad en `TASK-008.1`, valores retuneados para el nuevo lienzo.
- **Paths curvos**: misma técnica de curva cúbica que `/grafo` ya usa (`M start C mid,start mid,end end`), medidos igual que `measureEdges` (refs por nodo + `getBoundingClientRect()` + `ResizeObserver` con debounce). Sin librería nueva.

## Responsive

Mismos umbrales ya establecidos en la app (`47rem`, `72rem`), por consistencia — el mecanismo de cada breakpoint se implementa y prueba de forma independiente, no se copia de `/grafo`.

- **Desktop (`>72rem`)**: bandas de nivel en scroll horizontal, `ROW_SIZE = 4`, panel de detalle floating.
- **Tablet (`47rem`–`72rem`)**: scroll horizontal se mantiene, `ROW_SIZE = 2-3` (bandas más angostas), panel como bottom sheet — implementación y prueba propias, no asumidas iguales a `/grafo` por parecido visual.
- **Móvil (`≤47rem`)**: **scroll vertical nativo**, sin heredar el canvas horizontal de `/grafo` — los niveles fluyen de arriba hacia abajo. `ROW_SIZE` **no se fija en 1**: se permite `1` o `2` según el ancho real disponible, con la condición de que:
  - no haya colisiones (misma garantía por construcción de la fórmula de wrap);
  - los labels sigan legibles a ese ancho;
  - no se sienta como una lista lineal plana (con `ROW_SIZE=2` cuando el ancho lo permite, la sensación de "camino" con leve zigzag se conserva incluso en móvil);
  - la topología siga entendible (el orden por barycenter no cambia, solo cómo se envuelve).

## Performance

| Elemento | Costo esperado |
|---|---|
| 60 botones HTML + labels | trivial — misma escala que las 60 tarjetas ya probadas en `/grafo` |
| 73 `<path>` SVG | trivial — `/grafo` ya renderiza estos mismos 73 hoy |
| Layout por barycenter | trivial, una sola vez al montar (ver costo computacional arriba) |
| Selección (toggle de clases) | trivial — mismo mecanismo de `relatedIds` ya probado |
| Anillo de agrupación (`border`, 2-3px) | trivial — no es `box-shadow`/`filter` |

**Explícitamente fuera por rendimiento no verificado** (igual que ya se decidió en la ronda anterior): halo/glow con `box-shadow` difuminado, zoom. Ninguno entra en este alcance.

`prefers-reduced-motion` anula cualquier transición nueva — mismo bloque `@media` ya probado en `/grafo`, extendido.

## Criterios de aceptación

1. `/explorar` existe como ruta nueva; `/grafo` y Vista Plan sin cambios de comportamiento (solo el copy/enlace del punto 9).
2. Las 60 materias se posicionan vía `graph.graphLevels` + `explorer-layout.ts` (barycenter forward/backward), sin modificar `curriculum-graph.ts`.
3. El orden dentro de cada nivel demuestra reducción de cruces verificable en al menos el ejemplo de reconvergencia documentado (Fundamentos de análisis entre sus dos padres) y en el resto del dataset real.
4. Cero colisión de medallones verificable en los 6 niveles, incluido el nivel 3 (17 nodos), en los tres regímenes de `ROW_SIZE` (desktop/tablet/móvil).
5. Los cuatro estados se distinguen por relleno + glifo, no solo color ni degradado; `IN_PROGRESS` no insinúa ningún porcentaje de avance.
6. Un único anillo permanente (agrupación) y un único outline adicional (selección) — nunca ambos como anillos de estado simultáneos.
7. Texto (código/label) ≥4.5:1 en estado no atenuado; anillo de agrupación y contorno de "disponible" ≥3:1 contra el fondo del medallón.
8. Conexiones en reposo ≤0.08 de opacidad; relacionada a la selección sube a opacidad plena; no relacionada baja a ≤0.02.
9. El CTA `"Explorar grafo interactivo"` en Vista Plan se actualiza para no colisionar con el nombre de `/explorar`; ambas vistas (`/grafo`, Vista Plan) enlazan a `/explorar` y viceversa.
10. Selección, limpiar selección, pan (mouse/pen) y `Escape` funcionan; scroll táctil nativo en móvil; `Tab`/`Enter`/`Espacio` operan sobre los medallones como elementos nativos.
11. Móvil (`≤47rem`) usa scroll vertical nativo, sin canvas horizontal heredado de `/grafo`; `ROW_SIZE` es 1 o 2 según ancho real, sin colisiones ni pérdida de legibilidad de labels.
12. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` — PASS.
13. Cero cambios en `packages/**`, dataset, `curriculum-graph.ts`, `curriculum-view.module.css` (salvo el copy), lógica/CSS de `/grafo` más allá del enlace nuevo en el header.
14. Sin dependencias nuevas en `package.json`. Sin `filter`/`backdrop-filter` de área grande, sin partículas, sin animación continua.
15. `apps/web/AGENTS.md`, `apps/web/CLAUDE.md`, `.claude/settings.json` fuera de cualquier commit.

## Nice-to-haves recortables (no bloquean el cierre de esta TASK)

- **Tramo compartido tipo "tronco" antes de bifurcar**: edges con el mismo nodo origen pueden pasar por un punto de tronco común (`stemEnd`, función determinista de la posición del nodo origen únicamente) antes de curvar hacia su destino individual — cada edge sigue siendo un `<path>` propio con su semántica intacta, sin fusión de datos. Si complica la geometría, el comportamiento móvil o la validación de los criterios de arriba, **se difiere a `TASK-009.2` sin bloquear el resto**.
- Ajuste fino de `ROW_SIZE` por nivel (en vez de un único valor global) si la visual lo pide.
- Mediana en vez de promedio para el barycenter, si el promedio no reduce cruces lo suficiente en la práctica.

## Fuera de alcance (explícito, para `TASK-009.2+`)

- Zoom.
- Halo/glow con `box-shadow` difuminado por nodo (pendiente de verificación en dispositivo de gama baja real).
- Diferenciación de "camino hacia adelante" vs. "camino recorrido" en las conexiones.
- Leyenda de agrupaciones en el lienzo.
- Porcentaje global de progreso.
- Cualquier variación de tamaño de nodo por importancia/conectividad.
- Cualquier corrección del bug móvil/táctil conocido de `/grafo`.

## Condición de terminación

Este documento constituye la especificación de implementación de `TASK-009.1`, derivada y aprobada a partir de `TASK-009.0`. No se implementa código en esta entrega; no hay commit, push, merge ni deploy. Queda pendiente de lanzamiento (runner de agentes) tras aprobación humana explícita.
