# TASK-008.0 — Diagnóstico y diseño: Vista Explorar como "skill tree"

## Naturaleza de esta TASK

**Documento de diseño, no de implementación.** Autoría de Claude en su rol de UX/arquitecto frontend (`CLAUDE.md`). No pasa por el runner de agentes (`tools/agent/run.mjs`), no tiene `reviewers`, no modifica código. El resultado son decisiones de dirección visual/UX que una TASK posterior (ver §18) implementará de forma acotada, con Codex, siguiendo el patrón habitual.

## Objetivo

Responder qué significa "Vista Explorar / skill tree" para Sidera, a partir de lo que **ya existe y funciona** en `/grafo`, sin rediseñar desde cero y sin tocar dominio, dataset ni motor. Es una evolución de piel visual y de agrupamiento sobre la arquitectura actual, no un grafo nuevo.

## Punto de partida verificado en el código (no supuesto)

Leído directamente de `apps/web/app/graph-view.tsx`, `graph-view.module.css` y `apps/web/lib/curriculum-graph.ts`:

- Layout: columnas por **nivel topológico del grafo** (`graphLevels`, derivado por profundidad de dependencias directas — nunca "semestre"), con `overflow-x: auto` y pan por arrastre (mouse/pen; táctil usa scroll nativo).
- Nodos: `<article>` HTML/CSS por materia (`courseCard`), con estado derivado (`BLOCKED` / `AVAILABLE` / `IN_PROGRESS` / `COMPLETED`) vía `deriveVersionCourseState` de `curriculum-engine`.
- Conexiones: un único `<svg>` superpuesto, con `<path>` calculados en JS a partir de `getBoundingClientRect()` de los nodos (`measureEdges`, con `ResizeObserver`). Dos tipos: prerrequisito (línea sólida) y correquisito (discontinua).
- Modo foco: selección de un nodo atenúa (`opacity`) todo lo no relacionado; tres salidas ya implementadas — botón "Salir del foco", `Escape`, click en zona vacía del canvas.
- Panel de detalle: `aside` flotante en desktop (`position: fixed`, ancho fijo), bottom sheet en `≤72rem` (`position: fixed`, `max-height: 45vh` tras TASK-006.4.1).
- Persistencia: trayectoria compartida entre vistas vía `useTrajectory()` (Context + `localStorage` versionado).
- Breakpoints estructurales ya establecidos: `47rem` (compactación de columnas/tarjetas) y `72rem` (cambio floating↔bottom sheet, `dimmed` 0.1↔0.35).
- Transiciones ya existentes: `opacity`/`box-shadow` en 120ms, con `@media (prefers-reduced-motion: reduce)` que las anula.
- Bug abierto (no en `KNOWN_ISSUES.md`, documentado en `docs/tasks/TASK-006.4.1.md`): en móvil/tablet, al seleccionar una materia se pierde sensación de contexto vertical. Dos intentos de reparación (TASK-006.4, 006.4.1); una instrumentación diagnóstica se revirtió por completo. Sin evidencia de dispositivo real disponible hoy.

## Respuestas

### 1. Qué significa "skill tree" aquí

No es un árbol de habilidades tipo RPG con ramas radiales o layout libre. Es una **relectura visual** del grafo de prerrequisitos ya existente: mismos niveles topológicos, mismos cuatro estados, mismas relaciones — pero con lenguaje visual de progresión (nodo bloqueado con candado, nodo disponible resaltado, camino que se "abre" hacia adelante) en vez de tarjetas de formulario planas. El modelo de datos y el algoritmo de niveles (`curriculum-graph.ts`) no cambian.

### 2. Qué se conserva del `/grafo` actual

Todo el comportamiento funcional: SVG nativo sin librerías; niveles topológicos como eje de layout; pan por arrastre solo mouse/pen + scroll táctil nativo; modo foco con sus tres salidas; panel de detalle floating/bottom-sheet; los cuatro estados derivados del motor; trayectoria compartida y persistida; open canvas sin marco. Nada de esto se rediscute en esta fase.

### 3. Qué cambia visualmente

- Piel del nodo: de tarjeta de formulario a nodo con identidad de estado más fuerte (candado en bloqueada, contorno marcado en disponible, relleno de progreso en curso, marca de completada) — con CSS puro, sin iconos externos ni imágenes.
- Conexiones: mismo SVG, trazo con más carácter de "camino" (grosor/color), sin animación continua.
- Identidad visual de **rama temática** en el nodo (ver §5), que hoy no existe — actualmente todas las materias del mismo nivel se muestran sin distinción de agrupación. Es acento de color, **no** reordenamiento del layout.

### 4. Propuesta de layout

> **Corrección de una propuesta anterior de este mismo documento.** La primera redacción de §4/§5 proponía carriles físicos por agrupación dentro de cada columna de nivel. Al medir el dataset real esa propuesta quedó **descartada**: los datos la contradicen (evidencia en §5). Se registra aquí en vez de reescribirla en silencio.

Se conserva el eje horizontal = nivel de grafo (columnas, scroll horizontal), **sin partición geométrica adicional**. Las agrupaciones curriculares **no** se convierten en carriles, franjas ni filas: se expresan como **identidad visual del nodo** (acento de color e indicador contenido), de modo que el ojo pueda seguir una rama a través de los niveles por color, sin imponerle una geometría que sus dependencias reales no respetan.

La agrupación es **guía visual, no regla estructural**.

### 5. Ramas temáticas — sin inventar información curricular

Las ramas son exactamente las agrupaciones (`grouping`) ya definidas en el dominio/dataset — las 8 del Acuerdo 0018 (Matemáticas, Programación, Ciencias Naturales y Estadística, Algoritmos y Computación, Computación Científica, Sistemas de Cómputo, Computación Aplicada, Trabajo de Grado). No se inventan categorías nuevas, no se recategoriza ninguna materia por criterio propio. En el dataset actual **las 60 materias tienen agrupación** (0 sin asignar); aun así, una materia sin agrupación conocida debe mostrarse explícitamente como "sin rama" — nunca se le asigna una por inferencia.

#### Evidencia medida sobre el dataset oficial (`unalCs2024Official`)

Medido ejecutando `buildCurriculumGraph` sobre el snapshot real, no estimado:

- **60 nodos**, **73 edges**, **0 ciclos**, **0 materias sin agrupación**.
- **27 edges intra-rama (37%)** frente a **46 edges que cruzan agrupaciones (63%)**.
- Los cruces dominantes salen de un proveedor transversal: Matemáticas → Computación Científica (13), Matemáticas → Algoritmos y Computación (9), Matemáticas → Ciencias Naturales y Estadística (4), Ciencias Naturales y Estadística → Computación Aplicada (4), Matemáticas → Computación Aplicada (4).
- **Desequilibrio fuerte de tamaños**, de 16:1:

  | Rama | Nodos | Niveles que abarca |
  |---|---|---|
  | Matemáticas | 16 | 0–3 |
  | Computación Aplicada | 12 | 1–5 |
  | Algoritmos y Computación | 9 | 0–4 |
  | Computación Científica | 8 | 2–4 |
  | Ciencias Naturales y Estadística | 6 | 0–3 |
  | Sistemas de Cómputo | 5 | 3–4 |
  | Programación | 3 | 0–2 |
  | Trabajo de Grado | 1 | 0 |

- La matriz nivel × rama es **dispersa: 25 celdas ocupadas de 48 posibles**, 9 de ellas con una sola materia.

**Por qué esto descarta los carriles**: con el 63% de las relaciones cruzando agrupaciones, unos carriles por rama obligarían a la mayoría de las aristas a atravesar carriles ajenos, y la dispersión de la matriz dejaría huecos verticales en más de la mitad de las celdas. El resultado sería más ruido visual, no menos — lo contrario del objetivo. Matemáticas se comporta como proveedor transversal del plan, no como rama paralela, y Trabajo de Grado es un nodo aislado en nivel 0 (su gate es `MIN_COMPONENT_CREDITS`, que `curriculum-graph.ts` no traduce a edges).

#### Paleta: jerarquía estado > agrupación

**La señal visual primaria es el estado** (bloqueada / disponible / en curso / completada). La agrupación es **secundaria** y debe expresarse de forma contenida: borde o acento lateral, indicador pequeño, tono discreto. Está descartado usar 8 colores fuertes compitiendo entre sí — con 8 ramas el riesgo de paleta ilegible es real.

Los valores hex definitivos **no se fijan en este documento**: requieren validación de contraste. Lo que sí queda fijado es la jerarquía **estado > agrupación**, que TASK-008.1 debe respetar al proponer la paleta concreta.

### 6. Bloqueada / disponible / en curso / completada

Se conservan exactamente los cuatro estados que ya deriva `curriculum-engine` (`DerivedCourseState`). No se añaden estados nuevos. Se refuerzan con iconografía mínima 2D vía CSS/SVG inline simple (candado, contorno, relleno parcial, check) — sin librería de iconos, sin imágenes.

### 7. Prerrequisitos y correquisitos

Se conserva la distinción actual (sólida vs. discontinua) y la leyenda ya existente. No se introduce un tercer tipo de relación — el dominio solo modela estos dos.

### 8. Focus mode

Sin cambios de comportamiento. Las tres salidas actuales (botón, `Escape`, click en zona vacía) se conservan intactas; esta fase solo puede afectar su piel visual, no su lógica.

### 9. Panel de detalle

No se rediseña en esta fase. Sigue floating en desktop / bottom sheet en táctil, tal como quedó tras TASK-006.4.1. Tocar su comportamiento de scroll/posicionamiento está explícitamente fuera de alcance aquí (ver §restricciones y bug móvil).

### 10. Progreso visual de ramas

Descartados los carriles (§4), el progreso por rama ya no tiene un contenedor visual propio en el canvas. Sigue siendo deseable — reutilizando `calculateSatisfiedPlanProgress` de `curriculum-engine`, el mismo dato que ya alimenta las barras EXP de la Vista Plan, sin cálculo nuevo ni cambios en el motor — pero necesita un anfitrión visual (leyenda de ramas, panel lateral o cabecera) que **no está decidido**. Queda como mejora posterior, explícitamente fuera de TASK-008.1.

### 11. Profundidad ligera

`box-shadow` sutil de 1–2 niveles y, como mucho, un gradiente CSS de dos paradas para diferenciar disponible/bloqueada. Nada de `backdrop-filter` ni `filter: blur()` costoso — son caros en GPUs débiles y no aportan valor funcional (`PERFORMANCE.md`).

### 12. Efectos baratos

Solo transiciones on-interaction (`opacity`, `box-shadow`, `transform` simple) en el orden de 120–200ms, igual que hoy. Ningún efecto en loop ni partícula permanente — ya prohibido explícitamente en `PERFORMANCE.md`.

### 13. Estrategia mobile

No se toca la lógica de drag/scroll/focus existente. Cualquier cambio de esta fase es visual (piel de nodo, carriles de rama) dentro de los breakpoints ya establecidos (`47rem`, `72rem`), sin nuevas heurísticas de scroll o de foco que puedan interactuar con el bug abierto.

### 14. Estrategia low-end

Dispositivo de referencia: Samsung J6 Prime (`PERFORMANCE.md`). Nodos en CSS plano, sin `filter`/`backdrop-filter`, sin gradientes radiales grandes ni SVG denso adicional. La primera implementación (§18) no depende de "modo rendimiento" nuevo — hereda el ya implícito en las reglas de `PERFORMANCE.md` (sin loops, sin partículas). Un modo rendimiento explícito que desactive glow/gradiente queda como mejora futura, no requisito de esta fase.

### 15. `prefers-reduced-motion`

Se extiende el bloque `@media (prefers-reduced-motion: reduce)` ya existente en `graph-view.module.css` para cubrir cualquier transición nueva (hover, glow), siguiendo el mismo patrón que ya aplica a `.courseCard` y a los edges.

### 16. Cómo evitar caos con ~60 materias

Se mantiene el mecanismo que ya funciona con el dataset real: columnas por nivel + scroll horizontal + modo foco para atenuar lo no relacionado. La jerarquía visual de estados (§3) es lo que reduce el ruido percibido: con "disponible" como único estado de contorno vivo, la pregunta operativa —qué puedo cursar ahora— se responde sin recorrer los 60 nodos. El acento de rama (§5) añade una segunda pista de lectura sin cambiar la densidad real. Filtrar o resaltar por rama, y colapsar ramas no relevantes, son mejoras futuras razonables, explícitamente **no** incluidas en la primera implementación acotada.

### 17. SVG vs. HTML/CSS vs. híbrido

Se conserva el híbrido actual: nodos en HTML/CSS (accesibilidad nativa de botones y foco de teclado) + SVG solo para las líneas de conexión. No se migra a SVG puro (perdería accesibilidad de los controles) ni a Canvas/WebGL (contradice las restricciones de esta fase y no aporta nada que el híbrido actual no resuelva).

### 18. Primera implementación acotada posterior — `TASK-008.1`

Redactada en `docs/tasks/TASK-008.1.md`. Forma acordada: **JSX mínimo + CSS**.

`groupingId` **no está hoy en el DOM** — `GraphCourseCard` renderiza código, nombre, créditos, obligatoria/electiva y estado, nunca la agrupación. Por eso una implementación estrictamente solo-CSS no puede expresar la identidad de rama de §5: ningún selector alcanza un dato ausente del marcado. El cambio de JSX se limita a **exponer `groupingId` como `data-grouping`** en el nodo; todo lo demás es CSS.

Contenido: re-piel de `.courseCard` con jerarquía clara de los cuatro estados, acento secundario por agrupación, y peso diferenciado de las aristas según relevancia. Fuera de esa TASK: panel de detalle, modo foco, drag/scroll, flechas/markers SVG, filtros por rama, progreso por rama, dataset, motor, Vista Plan.

## Restricciones de esta fase (aplican también a TASK-008.1 y siguientes)

- 2D primero. Sin Three.js. Sin WebGL obligatorio. Sin 3D real. Sin partículas complejas.
- Sin dependencias nuevas.
- Sin tocar `packages/curriculum-engine`, `packages/curriculum-domain`, `packages/curriculum-schema`, `packages/curriculum-snapshot`, ni el dataset.
- Sin tocar la Vista Plan (`curriculum-view.tsx`, `curriculum-view.module.css`).
- Rendimiento primero: cualquier decisión que compita entre "más vistoso" y "más barato en el J6 Prime" se resuelve a favor de lo barato.

## Bug móvil/tablet — tratamiento en este diseño

- **No es bloqueante** para iniciar esta fase ni TASK-008.1.
- **No se intenta arreglar aquí.** Sigue documentado como pendiente (ver `docs/tasks/TASK-006.4.1.md`; no está aún en `docs/KNOWN_ISSUES.md` — sería razonable moverlo ahí en una TASK futura, pero eso no es parte de esta).
- El diseño **no depende** de que el bug esté resuelto: las decisiones de §13 son puramente visuales sobre el layout existente.
- **No se introduce** ninguna decisión nueva de scroll, `scrollIntoView`, `focus()`, gesto táctil o posicionamiento del panel — exactamente la misma prohibición que ya rigió TASK-006.4.1, para no agravar el problema abierto.
- Queda explícito: **cualquier cambio a la lógica de scroll/foco/gesto móvil** requiere una TASK específica con evidencia de dispositivo real, no esta fase de diseño visual.

## Fuera de alcance (de esta TASK-008.0 en sí)

- Cualquier cambio de código. Este documento no toca ningún archivo de `apps/**` ni `packages/**`.
- Resolver el bug móvil/tablet o el hydration mismatch de `KNOWN_ISSUES.md`.
- Definir presupuestos de rendimiento medibles (FPS, bundle size) — sigue pendiente en `PERFORMANCE.md`.
- Decidir Libre Elección o cualquier otra cuestión normativa del motor.

## Condición de terminación

Este documento constituye la entrega de TASK-008.0. No se abre ningún run de agentes, no se modifica código, no hay push ni merge. Queda pendiente de aprobación humana antes de redactar TASK-008.1 con alcance de implementación concreto.
