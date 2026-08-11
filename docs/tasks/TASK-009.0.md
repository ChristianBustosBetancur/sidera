# TASK-009.0 — Diseño de la Vista Explorar (skill tree inmersivo)

## Naturaleza de esta TASK

Documento de diagnóstico/diseño, autoría de Claude en su rol de UX/arquitecto frontend (`CLAUDE.md`). No pasa por el runner de agentes, no modifica código, no toca dataset ni engine. Define dirección visual/UX y el alcance de una primera implementación acotada (`TASK-009.1`), que una TASK posterior ejecutará con Codex siguiendo el patrón habitual del repo.

## Decisión de producto (ya tomada, punto de partida de este documento)

`/grafo` y `/explorar` son **dos vistas separadas y permanentes**, no una sustituyendo a la otra:

- **`/grafo`** — vista técnica/académica: dependencias exactas, niveles topológicos, prerrequisitos, correquisitos, focus mode, panel de detalle. Sin cambios de esta TASK.
- **`/explorar`** — vista inmersiva: materias como habilidades/nodos, sensación de desbloqueo, recorrido y progreso, menos ruido de conexiones, composición propia. 2D, low-end first, móvil first-class.

## Datos reales del dataset (medidos, no estimados)

Todos los números de esta sección se recalcularon en esta sesión ejecutando la misma lógica de `apps/web/lib/curriculum-graph.ts` (`requirementEdges` + `deriveGraphLevel`, sin modificarla) sobre el snapshot compilado real (`packages/curriculum-snapshot/dist/data/unal-cs-2024-official`), vía script temporal en scratchpad (no se dejó en el repo). Coinciden exactamente con los ya citados en `TASK-008.0`.

- **60 nodos, 73 edges** — 71 prerrequisito, 2 correquisito.
- **Niveles topológicos 0–5**, distribución: nivel 0 → 8 materias, nivel 1 → 9, nivel 2 → 12, **nivel 3 → 17** (el más denso, casi 3× el promedio), nivel 4 → 11, nivel 5 → 3.
- **Salto de nivel por edge** (dato nuevo, no estaba en `TASK-008.0`): 56 de 73 edges (77%) conectan niveles adyacentes (`target = source + 1`); 15 (20%) saltan un nivel; solo 2 (3%) saltan dos. **Las conexiones son mayoritariamente locales** — esto es clave para el diseño de layout y de trazado de conexiones (§3, §4): no hay que resolver arcos largos con frecuencia.
- **8 agrupaciones**, tamaños muy desiguales (16:1): Matemáticas 16, Computación Aplicada 12, Algoritmos y Computación 9, Computación Científica 8, Ciencias Naturales y Estadística 6, Sistemas de Cómputo 5, Programación 3, Trabajo de Grado 1.
- **37% de edges intra-rama frente a 63% cruzando agrupaciones** — confirmado igual que en `TASK-008.0`. Cruces dominantes: Matemáticas → Computación Científica (13), Matemáticas → Algoritmos y Computación (9), Matemáticas → Ciencias Naturales (4), Ciencias Naturales → Computación Aplicada (4), Matemáticas → Computación Aplicada (4).
- **Matriz nivel × agrupación dispersa: 25 de 48 celdas ocupadas.**
- **8 puntos de entrada** (nivel 0, sin prerrequisitos): Cálculo diferencial, Geometría vectorial y analítica, Fundamentos de matemáticas, Fundamentos de programación, Química general, Biología molecular, Introducción al programa de Ciencias de la Computación, Trabajo de grado (este último aislado — su gate real es `MIN_COMPONENT_CREDITS`, que `curriculum-graph.ts` no traduce a edge).
- **Nodos hub** (más materias los tienen como requisito directo — dato nuevo, calculado esta sesión): Fundamentos de matemáticas discretas (9), Cálculo en varias variables (8), Álgebra lineal (6), Probabilidad (6), Cálculo diferencial (4), Programación orientada a objetos (4).
- **Cuellos de botella reales** (alcance transitivo descendente — dato nuevo): Cálculo diferencial desbloquea transitivamente 31 materias; Cálculo integral 25; Fundamentos de matemáticas 24; Fundamentos de matemáticas discretas 19; Fundamentos de programación 19. Estos 5 nodos son, en la práctica, las "puertas" reales del plan.

## Punto de partida verificado en el código

- **Rutas existentes**: `/` (Vista Plan, `apps/web/app/page.tsx` → `curriculum-view.tsx`) y `/grafo` (`apps/web/app/grafo/page.tsx` → `graph-view.tsx`). No existe un header/nav compartido: cada vista tiene un único enlace de vuelta/ida a la otra, dentro de su propio `<header>`.
- **Colisión de naming a resolver antes de publicar `/explorar`**: `curriculum-view.tsx` ya usa el texto **"Explorar grafo interactivo"** como CTA hacia `/grafo` (línea 394), y `graph-view.tsx` ya usa **"Arrastra para explorar el grafo"** como hint de drag. Introducir `/explorar` como nombre propio de una vista nueva convive mal con ese uso ya existente de "explorar" como verbo apuntando a `/grafo`. No es bloqueante para este diseño, pero **debe resolverse en la implementación** (ver `TASK-009.1`, ajuste de copy mínimo) para no confundir al usuario sobre cuál "explorar" es cuál.
- **Estado compartido entre vistas, verificado en código**: `TrajectoryProvider` envuelve toda la app en `layout.tsx` — el progreso (completada/en curso, `useTrajectory()`, Context + `localStorage` versionado) **ya es global**. `/explorar` lo hereda gratis, sin código nuevo.
- **Estado NO compartido, verificado en código**: `selectedId` (foco/selección) es `useState` local dentro de `GraphView`, no vive en Context. Hoy, seleccionar una materia en `/grafo` y navegar a `/explorar` no preserva la selección. Esto es correcto y deseable — cada vista puede tener su propia semántica de foco sin acoplarse.
- **`box-sizing: border-box`** está en el reset global (`globals.css:15`, selector universal) — cualquier acento de borde/anillo en los nodos nuevos no cambia el *border-box* del elemento, relevante para el equivalente de `measureEdges` en la vista nueva.
- **Cero dependencias más allá de `next`/`react`** en `apps/web/package.json` — SVG, HTML/CSS y Canvas 2D son todas nativas del navegador; ninguna opción tecnológica de §10 requiere instalar nada.
- **Helpers de dominio reutilizables sin cambios**: `buildCurriculumGraph`/`graphLevels` (`curriculum-graph.ts`), `deriveVersionCourseState` y `calculateSatisfiedPlanProgress` (`curriculum-engine`), `coursesById`/`versionCoursesById`/`requirementLines`/`blockingReasons` (`curriculum-data.ts`), `hasExceededDragThreshold`/`shouldSuppressClick` (`pointer-gestures.ts`), `useTrajectory()` (`trajectory.tsx`).
- **Paleta de agrupación ya validada**: los 8 hex de `TASK-008.2` (verificados por distancia perceptual ΔE76 ≥30 entre todos los pares y contraste ≥3:1 contra los cuatro fondos de estado) se reutilizan tal cual — cero trabajo nuevo de color.

## 1. Composición final

Comparación de tres composiciones concretas contra los datos reales de arriba, no contra el nombre bonito:

### A — Constelación académica (posiciones libres, tipo starfield)

Nodos posicionados libremente, conexiones como líneas de constelación, profundidad como distancia radial u otra métrica libre.

- **En contra**: un layout verdaderamente libre para 60 nodos y 73 edges normalmente se resuelve con un algoritmo de fuerzas (force-directed) — eso es una **dependencia nueva** (ej. `d3-force`), prohibida explícitamente. Sin física de fuerzas, un layout "libre" a mano para 60 nodos con jerarquía real de prerrequisitos degenera rápido en caos o en re-descubrir manualmente un layout topológico disfrazado. Con 63% de edges cruzando agrupación y un nodo (Cálculo diferencial) que desbloquea transitivamente 31 materias, un mapa sin eje de lectura pierde la respuesta a "qué puedo cursar ahora" — contradice el principio de producto "la funcionalidad académica siempre tiene prioridad" (`PRODUCT.md`).

### B — Árbol/ruta de habilidades (nivel topológico como eje, sin columnas rígidas)

Conserva `graphLevels` (ya calculado, cero lógica nueva) como eje general de progresión, pero los nodos de un mismo nivel no se apilan en una columna recta — se desplazan/zigzaguean con un offset determinista.

- **A favor**: reutiliza el dato que ya existe sin tocar `curriculum-graph.ts`. Con 77% de edges conectando niveles adyacentes (dato medido arriba), la mayoría de las curvas de conexión son cortas — barato de trazar, legible sin arcos largos. Responde directamente a "sensación de desbloqueo" (una ruta que avanza) sin sacrificar el orden real de prerrequisitos.
- **En contra**: el nivel 3 tiene 17 nodos — un solo camino serpenteante no cabe; necesita envolver en sub-filas cortas dentro de la banda de cada nivel (no una fila rígida, pero tampoco una única curva). Es más trabajo de diseño de detalle que A, pero determinista y barato de calcular (sin física).

### C — Mapa híbrido de zonas + caminos (agrupación como territorio real)

Zonas visuales sueltas (halos/regiones) agrupando nodos por `groupingId`, con caminos de prerrequisito cruzando libremente entre zonas.

- **En contra**: esto es exactamente lo que `TASK-008.0` ya midió y descartó para `/grafo`, y los números no cambian aquí — 63% de edges cruzan agrupación, la matriz nivel×agrupación tiene 25/48 celdas ocupadas (muy dispersa), y Trabajo de Grado es una agrupación de **un solo nodo** aislado en nivel 0. Una "zona" territorial para una agrupación de un nodo no es una zona, es un punto — y la mayoría de las zonas se solaparían o tendrían huecos verticales enormes por nivel. La misma evidencia que descartó carriles rígidos en `/grafo` descarta zonas-contenedor reales aquí.

### Recomendación: **B, con toques atmosféricos de C a nivel de nodo (no de zona)**

Ruta/camino con nivel topológico como eje (B) es la única de las tres que no requiere una dependencia nueva, que aprovecha que las conexiones son mayoritariamente locales (dato medido), y que no contradice la evidencia ya establecida sobre agrupación como acento, no partición (`TASK-008.0`, reconfirmado con los mismos números aquí). La "sensación de territorio" de C se incorpora **solo como halo/acento en el nodo individual** (§5), nunca como fondo de zona — exactamente el mismo principio que ya rige `/grafo` desde `TASK-008.0`/`TASK-008.2`, aplicado ahora a una forma de nodo distinta.

## 2. Forma del nodo

Opciones evaluadas: círculo, hexágono, medallón, cápsula, nodo compacto + label externo.

- **Círculo puro**: la forma más barata en CSS (`border-radius: 50%`), rompe con claridad la sensación de "tarjeta de formulario" de `/grafo`. Muy poco espacio interno para texto.
- **Hexágono**: fuertemente asociado a "skill tree" (muchos juegos usan panales hexagonales), pero requiere `clip-path` o pseudo-elementos y, sobre todo, un algoritmo de teselado/empaquetado para 60 hexágonos sin huecos ni solapes — complejidad de layout adicional no justificada frente al beneficio.
- **Cápsula (píldora)**: más cercana a lo que ya existe en `/grafo` — poco salto visual real.
- **Medallón (círculo + anillo de acento)**: círculo base + un anillo/borde secundario para portar estado o agrupación sin pintar el relleno completo — mismo costo que el círculo puro más un `box-shadow`/borde adicional, sensación de "insignia/logro" reconocible.
- **Nodo compacto + label externo**: el texto (código, nombre) vive **fuera** de la forma, debajo, como etiqueta plana — resuelve el problema de que un círculo pequeño no puede contener texto legible.

### Recomendación: **medallón con label externo debajo**

Círculo con anillo de acento (barato, `border-radius: 50%` + `box-sizing: border-box` como ya hace `.courseCard`, así que el equivalente de `measureEdges` sigue midiendo el mismo *border-box* sin importar el grosor del anillo) + candado/check reutilizados literalmente de `TASK-008.1` (glifos CSS puros, sin emoji, ya accesibles) dentro o sobre el medallón + código de la materia como label externo corto.

**Qué se ve siempre**: forma del medallón con color/relleno de estado, anillo de "disponible" si aplica, candado/check/marcador de en-curso, código de la materia como label corto debajo.

**Qué aparece al seleccionar**: nombre completo, halo/acento de agrupación resaltado, conexiones directas iluminadas (prerrequisito/correquisito), créditos y tipo (obligatoria/electiva) como resumen inline si el espacio lo permite.

**Qué queda en panel/detail sheet**: exactamente la misma batería de información que ya tiene `/grafo` (código, nombre, créditos, tipo, estado, requisitos, por qué está bloqueada, acciones de trayectoria) — se reutiliza la **arquitectura de información**, no necesariamente el mismo CSS, tal como pide el encargo ("no copiar toda la implementación visual del grafo").

## 3. Layout sin columnas rígidas

Se mantiene `graph.graphLevels` como eje general (mismo dato, cero cambios en `curriculum-graph.ts`), pero dentro de cada nivel:

- Offset horizontal/vertical determinista por nodo (función pura del índice del nodo dentro de su nivel — sin física, sin iteración, sin dependencia nueva), suficiente para romper la sensación de columna recta.
- Niveles con muchos nodos (nivel 3 → 17) se envuelven en sub-filas cortas dentro de la banda del nivel, en vez de una única fila o una única curva imposible de leer.
- Como el 77% de edges conecta niveles adyacentes (dato medido), la mayoría de las curvas de conexión siguen siendo cortas incluso con el offset — el "camino" se lee sin arcos largos frecuentes.
- El orden lógico (profundidad de dependencia real) nunca se altera: el offset es puramente visual, no cambia qué nivel ocupa cada nodo ni la semántica curricular.

## 4. Conexiones — no las 73 con la misma fuerza

Reutilizando el mismo mecanismo de dos tipos ya modelados por el dominio (prerrequisito sólido / correquisito discontinuo — el dominio no modela un tercer tipo, no se inventa uno):

- **Reposo**: opacidad muy baja (más tenue que el reposo actual de `/grafo`), a propósito — "menos ruido de conexiones" es un requisito explícito de `/explorar`, a diferencia de `/grafo` donde las conexiones son el contenido principal.
- **Hover/tap** (sin selección completa, solo en dispositivos con `hover: hover`): las conexiones que tocan ese nodo suben a una opacidad intermedia, como previsualización.
- **Focus/selección**: mismo mecanismo de foco ya probado y revisado de accesibilidad en `TASK-008.1` (conexiones relacionadas a opacidad plena, el resto atenuado) — se retunean los valores concretos para el nuevo lienzo, no se reinventa el mecanismo.
- **Camino hacia adelante**: al seleccionar un nodo, las aristas donde ese nodo es *fuente* (lo que desbloquea) pueden diferenciarse visualmente de aquellas donde es *destino* (lo que lo desbloqueó a él) — ambos conjuntos ya están disponibles como datos (`edge.sourceId`/`edge.targetId` contra `selectedId`, igual que `/grafo` ya calcula `relatedIds`); es una diferenciación de estilo condicional, no un dato nuevo.
- **Camino recorrido**: aristas donde ambos extremos están `COMPLETED` (ya derivable de `states`, el mismo mapa que ya alimenta `useTrajectory()`) pueden recibir un trazo distinto incluso en reposo, para visualizar territorio ya recorrido sin UI adicional — ver también §7.

## 5. Agrupaciones — halo de nodo, no zona

Se reutiliza tal cual la paleta de 8 colores ya validada en `TASK-008.2` (ΔE76 ≥30 entre todos los pares, contraste ≥3:1 contra los cuatro fondos de estado) — cero trabajo de color nuevo.

- Acento en el **anillo del medallón** o un halo/`box-shadow` suave y pequeño alrededor del nodo — nunca fondo de zona (ver §1-C, misma evidencia de `TASK-008.0` que ya descartó carriles/zonas para `/grafo`).
- Un `box-shadow` con radio de difuminado moderado sobre un elemento pequeño (~2.5-3rem) es un costo de render completamente distinto a un `blur()`/`backdrop-filter` sobre un área grande — no es el "blur masivo" que `PERFORMANCE.md` prohíbe, pero **debe verificarse empíricamente en un dispositivo de gama baja real** antes de darlo por aceptable a los 60 nodos simultáneos (ver Riesgos).
- Nombre de agrupación completo solo en el panel de detalle (no flotando en el lienzo) — si se quiere una leyenda de lienzo, se reutiliza el mismo patrón compacto/colapsable de `TASK-008.2`, pero no es requisito de esta fase.

## 6. Estado visual — domina sobre agrupación

Se reutilizan los cuatro estados ya derivados por `deriveVersionCourseState` (`curriculum-engine`), sin estados nuevos, rediseñados sobre el medallón:

- **Bloqueada**: relleno apagado + candado CSS reutilizado literalmente de `TASK-008.1` (sin emoji, monocromo, determinista).
- **Disponible**: único estado con anillo vivo — mismo principio "único contorno perimetral completo" que ya rige en `/grafo`.
- **En curso**: relleno parcial (cuña/gradiente dentro del círculo) + marcador, evitando depender solo de color — mismo principio de redundancia de forma que exige el criterio 15 de `TASK-008.1`.
- **Completada**: check CSS (`\2713`) reutilizado, relleno suave.

Debe seguir siendo legible sin hover, en móvil, con `prefers-reduced-motion` (se extiende el mismo bloque `@media` ya usado en `/grafo`, sin animación nueva), y sin depender solo de color — igual exigencia que ya se cumplió en `TASK-008.1`/`TASK-008.2`, aplicada a la forma nueva. Riesgo a validar: el medallón es más pequeño que la tarjeta actual, así que el candado/check deben probarse a esa escala (ver Riesgos).

## 7. Progreso — discreto, sin duplicar Vista Plan

Vista Plan ya tiene una barra de progreso horizontal con porcentaje/texto/proyección (`curriculum-view.module.css`, `progressBarPresentation`) — `/explorar` **no debe repetir esa forma visual**.

- **Territorio recorrido**: el hecho de que los nodos completados se vean distintos (relleno + check) ya es progreso emergente, sin UI adicional — gratis, viene del mismo `states` map.
- **Camino iluminado**: el "camino recorrido" de §4 (aristas entre nodos completados) refuerza la misma idea sin UI nueva.
- **Porcentaje global discreto (opcional)**: si aporta, puede reutilizar `calculateSatisfiedPlanProgress` (ya existe, ya alimenta Vista Plan, cero cálculo nuevo) mostrado como texto simple (ej. "62%" en la cabecera), **nunca como barra/track** — la forma debe ser deliberadamente distinta a la de Vista Plan para no duplicarla visualmente. No es requisito del MVP.
- Progreso por agrupación sigue fuera de alcance (ya diferido en `TASK-008.0 §10`).

## 8. Interacción — mínima

- **Tap/click en nodo**: selecciona/deselecciona (mismo patrón toggle que `/grafo`, mismo `aria-current`).
- **Reset/volver al origen**: un botón, igual que "Volver al inicio" en `/grafo`.
- **Pan**: se reutilizan literalmente `hasExceededDragThreshold`/`shouldSuppressClick` de `pointer-gestures.ts` (funciones puras, sin DOM, ya extraídas y listas para reutilizar) — drag por mouse/pen, scroll nativo en táctil, igual que `/grafo`.
- **Zoom**: **no incluido en el MVP**. Con la densidad real por nivel (máximo 17 nodos) y el mismo patrón de scroll horizontal de `/grafo`, no hay evidencia de que se necesite; añadirlo implica gestos de pellizco y transformación de coordenadas — complejidad real que no se justifica sin antes ver el layout funcionando.
- **Teclado**: `Escape` para salir de foco (mismo espíritu de las tres salidas ya probadas en `/grafo`) + orden de tabulación y activación con Enter/Espacio gratis si los nodos son `<button>` reales, igual que hoy.
- **Gestos móviles**: scroll nativo, sin captura de pan táctil — misma restricción por `event.pointerType` que ya aplica en `/grafo`.

**Nota explícita sobre el bug conocido**: reutilizar `pointer-gestures.ts` (funciones matemáticas puras) **no** reintroduce el bug móvil/tablet de `/grafo` — ese bug es de arquitectura de scroll/foco/DOM, no de las funciones de umbral de arrastre. `/explorar` puede reutilizar el helper sin heredar el problema, pero tampoco debe asumirse "curada" sin prueba en dispositivo real (ver Riesgos).

## 9. Responsive

- **Desktop**: lienzo amplio, más aire por nodo dado el viewport disponible.
- **Tablet**: densidad propia, no comprimida desde desktop ni heredada mecánicamente del breakpoint `72rem` de `/grafo` — el layout de `/explorar` es estructuralmente distinto (ruta de medallones, no columnas de tarjetas), así que el modo de fallo del bug conocido podría no aplicar, pero eso **debe verificarse**, no asumirse.
- **Móvil**: composición propia, no "desktop apretado". Dado que el brief lo permite explícitamente, la orientación del recorrido puede rotar a vertical de arriba hacia abajo en vez de columnas horizontales — más natural en un viewport angosto y alto.

## 10. Tecnología

Comparación de SVG puro / HTML-CSS puro / híbrido SVG+HTML / Canvas 2D:

- **SVG puro**: pierde la accesibilidad nativa de elementos HTML interactivos (habría que reimplementar roles ARIA, foco de teclado, etc. a mano) — la misma razón por la que `TASK-008.0 §17` ya lo descartó para `/grafo`.
- **HTML/CSS puro**: los nodos son accesibles de forma nativa, pero dibujar curvas arbitrarias entre elementos posicionados dinámicamente por CSS puro no es viable — no sirve para las conexiones.
- **Híbrido SVG+HTML** (igual que `/grafo`): nodos en HTML (semántica y foco nativos), conexiones en un `<svg>` superpuesto con `<path>` calculados vía `getBoundingClientRect()` — técnica ya probada, cero dependencia nueva, cero técnica nueva que depurar. El costo de remedir en resize ya está resuelto (`ResizeObserver` + debounce) y es reutilizable como patrón.
- **Canvas 2D**: potencialmente más barato para pintar muchos elementos en una sola superficie, y más flexible para curvas/halos — pero pierde **toda** la accesibilidad nativa del DOM: cada nodo pasa a ser una región de píxeles sin semántica, y habría que reconstruir desde cero hit-testing, navegación por teclado, foco visible y ARIA. Dado que este repo trata la accesibilidad como requisito real y verificado (contraste WCAG exigido y medido en `TASK-008.1`/`TASK-008.2`), y que 60 nodos + 73 edges no están ni remotamente cerca de la escala donde Canvas aportaría una ventaja de rendimiento medible frente al híbrido ya probado, cambiar de técnica no se justifica.

### Recomendación: **híbrido SVG+HTML**, mismo patrón que `/grafo`, piel y estructura de nodo distintas

No hay diferencia de dependencias entre las cuatro opciones (todas nativas) — el criterio de desempate es accesibilidad + reutilización de un patrón ya probado, y ambos favorecen claramente al híbrido.

## 11. Rendimiento

Mismo dispositivo de referencia (`PERFORMANCE.md`, Samsung J6 Prime o equivalente). Prohibiciones explícitas del encargo, todas respetadas por diseño: sin partículas continuas, sin blur masivo (el halo de nodo es un `box-shadow` acotado a un elemento pequeño, no un `blur()`/`backdrop-filter` de área grande — categoría de costo distinta, pero pendiente de medir en dispositivo real), sin filtros SVG costosos (`feGaussianBlur`/`feTurbulence`, etc.), sin WebGL, sin Three.js, sin shaders. Se extiende el mismo bloque `@media (prefers-reduced-motion: reduce)` ya probado en `/grafo`. El cálculo de layout (nivel + offset determinista) es estático, no por frame — misma clase de costo asintótico que ya funciona hoy a 60 nodos en `/grafo`.

## 12. Propuesta de `TASK-009.1` — primera implementación real

**Alcance de dataset**: **las 60 materias reales**, no un subconjunto. La técnica híbrida ya está probada barata a esta escala en `/grafo`; usar un subconjunto arriesgaría demostrar un layout de juguete que no sobrevive a la densidad real (nivel 3 con 17 nodos, hubs con hasta 31 materias de alcance transitivo) — precisamente lo que hay que demostrar que funciona.

**Archivos** (mismo patrón de `/grafo`, ningún archivo de dominio/engine/dataset tocado):

- `apps/web/app/explorar/page.tsx` — nuevo, mismo patrón que `apps/web/app/grafo/page.tsx`.
- `apps/web/app/explorar-view.tsx` — nuevo.
- `apps/web/app/explorar-view.module.css` — nuevo.
- Ajuste de copy mínimo en `apps/web/app/curriculum-view.tsx` (el CTA "Explorar grafo interactivo" hacia `/grafo`, para resolver la colisión de naming de la sección "Punto de partida") — único archivo existente tocado, y solo texto.

**Qué se implementa**:
- Layout de nivel + offset determinista dentro de cada nivel (§3), sin física, sin dependencia nueva.
- Medallón con anillo/halo de agrupación + candado/check/marcador de estado reutilizados de `TASK-008.1` (§2, §6).
- Conexiones híbridas SVG con los tres estados mínimos: reposo tenue, focus (selección), tipos prerrequisito/correquisito (§4) — se difiere "camino hacia adelante"/"camino recorrido" diferenciados como posible extensión, no bloqueante para demostrar que la vista se siente distinta.
- Selección/foco, reset, pan por arrastre (mouse/pen) + scroll táctil nativo, `Escape` (§8).
- Panel de detalle — puede reutilizar el mismo componente/arquitectura de información que `/grafo` (no la misma piel CSS) para no duplicar trabajo de accesibilidad ya resuelto.
- Responsive mínimo: desktop + un layout de móvil deliberadamente distinto (no la misma tabla comprimida) — tablet puede heredar temporalmente el comportamiento de desktop si el tiempo no alcanza para una tercera densidad, documentándolo como pendiente explícito, no como bug.

**Qué queda fuera de `TASK-009.1`**:
- Zoom.
- Porcentaje global de progreso (opcional, diferido).
- Diferenciación fina de "camino hacia adelante" vs "camino recorrido" en las conexiones (queda en reposo/focus simple).
- Leyenda de agrupaciones en el lienzo (el detalle de nodo ya muestra la agrupación).
- Cualquier corrección del bug móvil/táctil de `/grafo` — no se hereda su arquitectura, pero tampoco se persigue arreglarlo aquí ni allá.
- Cambios a `curriculum-graph.ts`, `packages/**`, dataset, Vista Plan, `/grafo`.

**Criterios de aceptación** (borrador para que la TASK de implementación los precise con hex/contraste concretos, mismo rigor que `TASK-008.1`):

1. `/explorar` existe como ruta nueva, `/grafo` y Vista Plan quedan sin cambios de comportamiento.
2. Las 60 materias se renderizan usando `buildCurriculumGraph`/`graphLevels` sin modificar `curriculum-graph.ts`.
3. Cada nodo expone visualmente sus cuatro estados posibles con redundancia de forma, no solo color (mismo principio que criterio 15 de `TASK-008.1`).
4. Texto de nodo (código, label) cumple contraste ≥4.5:1 en estado no atenuado; acentos no textuales (anillo, halo) ≥3:1.
5. El layout no es una cuadrícula de columnas idéntica a `/grafo` — offset visual verificable dentro de cada nivel.
6. Las conexiones distinguen prerrequisito/correquisito y tienen al menos reposo tenue + foco.
7. Selección, reset y pan funcionan con teclado y con mouse/pen; scroll táctil nativo en móvil.
8. `prefers-reduced-motion` anula cualquier transición nueva.
9. El copy "Explorar grafo interactivo" en Vista Plan se actualiza para no colisionar con el nombre de la vista nueva.
10. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` — PASS.
11. Cero cambios en `packages/**`, dataset, `curriculum-view.module.css` (salvo el copy del punto 9), lógica de `/grafo`.
12. `apps/web/AGENTS.md`, `apps/web/CLAUDE.md`, `.claude/settings.json` fuera de cualquier commit.

## Riesgos principales

- **Nivel 3 (17 nodos)** es el punto de mayor riesgo de layout — envolver en sub-filas sin que se sienta apretado o caótico necesita iteración visual real, no se resuelve solo en el papel.
- **Tablet/móvil es un terreno no probado**: aunque `/explorar` no hereda la arquitectura de scroll/foco de `/grafo`, eso no garantiza que no desarrolle su propio problema análogo — requiere prueba en dispositivo real antes de darlo por resuelto, igual disciplina que ya se aplicó (y no se cerró) para el bug de `/grafo`.
- **Halo por nodo × 60 nodos simultáneos**: el argumento de que un `box-shadow` pequeño es barato es teóricamente sólido pero no está medido en un dispositivo de gama baja real — debe verificarse antes de darlo por aceptable en producción.
- **Colisión de naming** ("Explorar grafo interactivo" ya existe apuntando a `/grafo`) genera confusión real si no se ajusta el copy al publicar `/explorar` — ya incluido como criterio de aceptación explícito en `TASK-009.1`.
- **Candado/check a escala de medallón**: los glifos CSS de `TASK-008.1` están probados en tarjetas de ~5-6.5rem de alto; en un medallón más pequeño necesitan reescalarse y volver a verificarse legibles, no asumirse que "el mismo CSS funciona igual de bien más chico".

## Condición de terminación

Este documento constituye la entrega de diagnóstico/diseño de `TASK-009.0`. No se abre run de agentes, no se modifica código, no hay commit/push/merge/deploy. Queda pendiente de aprobación humana antes de redactar la implementación concreta de `TASK-009.1` con criterios de aceptación finales (hex, contraste, tamaños exactos).
