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
- Agrupamiento visual por **rama temática** dentro de cada columna de nivel (ver §5), que hoy no existe — actualmente todas las materias del mismo nivel se listan sin distinción de agrupación.

### 4. Propuesta de layout

Se conserva el eje horizontal = nivel de grafo (columnas, scroll horizontal). Se añade un agrupamiento vertical **dentro** de cada columna por agrupación curricular (carril/franja de color por `grouping`), de modo que el ojo pueda seguir una "rama" (p. ej. Matemáticas) a través de los niveles sin necesitar una topología nueva ni recalcular nada. Es una capa de presentación sobre datos que el motor ya expone.

### 5. Ramas temáticas — sin inventar información curricular

Las ramas son exactamente las agrupaciones (`grouping`) ya definidas en el dominio/dataset — las 8 del Acuerdo 0018 (Matemáticas, Programación, Ciencias Naturales y Estadística, Algoritmos y Computación, Computación Científica, Sistemas de Cómputo, Computación Aplicada, Trabajo de Grado). No se inventan categorías nuevas, no se recategoriza ninguna materia por criterio propio. Una materia sin agrupación conocida se muestra explícitamente como "sin rama", igual que el resto del producto ya representa referencias no resueltas — nunca se le asigna una por inferencia.

### 6. Bloqueada / disponible / en curso / completada

Se conservan exactamente los cuatro estados que ya deriva `curriculum-engine` (`DerivedCourseState`). No se añaden estados nuevos. Se refuerzan con iconografía mínima 2D vía CSS/SVG inline simple (candado, contorno, relleno parcial, check) — sin librería de iconos, sin imágenes.

### 7. Prerrequisitos y correquisitos

Se conserva la distinción actual (sólida vs. discontinua) y la leyenda ya existente. No se introduce un tercer tipo de relación — el dominio solo modela estos dos.

### 8. Focus mode

Sin cambios de comportamiento. Las tres salidas actuales (botón, `Escape`, click en zona vacía) se conservan intactas; esta fase solo puede afectar su piel visual, no su lógica.

### 9. Panel de detalle

No se rediseña en esta fase. Sigue floating en desktop / bottom sheet en táctil, tal como quedó tras TASK-006.4.1. Tocar su comportamiento de scroll/posicionamiento está explícitamente fuera de alcance aquí (ver §restricciones y bug móvil).

### 10. Progreso visual de ramas

Cada carril de rama puede mostrar un indicador corto de progreso (satisfecho/requerido) **reutilizando** `calculateSatisfiedPlanProgress` de `curriculum-engine` — el mismo dato que ya consume la Vista Plan para las barras EXP. Sin cálculo nuevo, sin tocar el motor.

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

Se mantiene el mecanismo que ya funciona con el dataset real: columnas por nivel + scroll horizontal + modo foco para atenuar lo no relacionado. El agrupamiento por rama (§4) reduce ruido percibido sin cambiar la densidad real de nodos. Colapsar/plegar ramas no relevantes es una mejora futura razonable, explícitamente **no** incluida en la primera implementación acotada.

### 17. SVG vs. HTML/CSS vs. híbrido

Se conserva el híbrido actual: nodos en HTML/CSS (accesibilidad nativa de botones y foco de teclado) + SVG solo para las líneas de conexión. No se migra a SVG puro (perdería accesibilidad de los controles) ni a Canvas/WebGL (contradice las restricciones de esta fase y no aporta nada que el híbrido actual no resuelva).

### 18. Primera implementación acotada posterior (propuesta, no iniciada)

`TASK-008.1`, con el mismo patrón que TASK-006.4.1: alcance limitado a `apps/web/app/graph-view.module.css` (y, si es imprescindible para exponer `grouping` por nodo o el progreso por rama, cambios mínimos y explícitamente acotados en `graph-view.tsx` — nunca en `curriculum-graph.ts`, `packages/**` ni el dataset). Contenido: re-piel de `.courseCard` hacia estética de nodo de estado (candado/contorno/relleno/check), agrupamiento visual por rama dentro de cada columna, indicador de progreso por rama reutilizando el motor existente. Fuera de esa TASK: panel de detalle, modo foco, drag/scroll, dataset, motor, Vista Plan.

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
