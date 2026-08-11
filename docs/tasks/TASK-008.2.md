# TASK-008.2 — Identidad de color de agrupación + leyenda en `/grafo`

## Naturaleza de esta TASK

Documento de diagnóstico/diseño acotado, autoría de Claude en su rol de UX/arquitecto frontend (`CLAUDE.md`). No pasa por el runner de agentes en esta forma; no modifica código. Define alcance y criterios de aceptación para una implementación posterior, siguiendo el mismo patrón que separó `TASK-008.0` (diseño) de `TASK-008.1` (implementación).

## Objetivo

Dar más presencia visual a la identidad de agrupación curricular en `/grafo` — hoy un borde lateral de 5px poco perceptible en una malla de 60 tarjetas — sin convertir `/grafo` en la Vista Explorar/skill tree (`TASK-009.0`, vista separada) y sin romper la jerarquía **estado > agrupación** ya establecida en `TASK-008.0`/`TASK-008.1`.

## Relación con otras TASK

- **No depende de, ni bloquea, `TASK-009.0`** (Vista Explorar). Son iniciativas independientes: esta toca `/grafo`; esa crea `/explorar` como vista nueva.
- **Extiende, no contradice, `TASK-008.1`** (ya commiteada en `f8e180d`). Reutiliza sus mismos estados, sus mismas reglas de contraste, y el atributo `data-grouping` que esa TASK ya expuso en el DOM.

## Punto de partida verificado en el código

Leído directamente de `apps/web/app/graph-view.tsx` y `apps/web/app/graph-view.module.css` en HEAD (`f8e180d`):

- `data-grouping={versionCourse.groupingId}` ya está en el `<article>` de cada tarjeta (`graph-view.tsx:84`) — no requiere cambio de JSX para leer la agrupación por CSS.
- La identidad de agrupación actual es **un único borde lateral de 5px** por `[data-grouping="..."]` (8 reglas, `graph-view.module.css:353-383`), con esta paleta (post-ajuste de contraste verde del último commit):

  | Agrupación | Hex actual |
  |---|---|
  | Matemáticas | `#5c6a78` |
  | Programación | `#7a5c26` |
  | Ciencias Naturales y Estadística | `#77516a` |
  | Algoritmos y Computación | `#375f79` |
  | Computación Científica | `#63578c` |
  | Sistemas de Cómputo | `#3f6771` |
  | Computación Aplicada | `#7a5240` |
  | Trabajo de Grado | `#5a5f63` |

- `.courseCard` usa `box-sizing: border-box` (heredado del reset global, `globals.css:15`, selector universal). **Esto importa para el alcance**: cambiar el grosor de cualquier borde no cambia el tamaño del *border-box* del elemento — `getBoundingClientRect()` (base de `measureEdges`) devuelve las mismas coordenadas exteriores sin importar el grosor del borde. Ampliar o mover el acento de color es seguro respecto al criterio ya vigente "no alterar `measureEdges`".
- `.available` ya usa un `outline: 3px solid #17704c; outline-offset: 1px` — el único estado con anillo perimetral. El `outline` se dibuja *fuera* del border-box con un hueco de 1px (`outline-offset`), así que cualquier acento que viva **en el borde** de la tarjeta queda visualmente separado del anillo de "disponible" por ese hueco — no se superponen ni compiten por el mismo trazo.
- La sección `.controls` (`graph-view.tsx:313-321`) ya renderiza una leyenda (`.legend`) con dos muestras (prerrequisito/correquisito) usando `flex-wrap: wrap` — patrón directamente reutilizable para una leyenda de agrupaciones.
- Existe legado visual con el que no colisionar: el candado CSS (`.blocked::before/::after`) y el check (`.completed::after`) ocupan la esquina superior derecha de la tarjeta (`top: ~0.6rem; right: ~0.65rem`). Cualquier acento nuevo debe evitar esa esquina.

## Restricciones (heredadas del encargo)

- No convertir `/grafo` en skill tree; no cambiar layout (columnas por nivel topológico se mantienen intactas).
- No tocar lógica, engine, dataset, scroll ni focus mode.
- No añadir dependencias.
- Estado sigue dominando sobre agrupación.
- CSS estático: sin blur, sin filtros SVG, sin animación continua, sin efectos GPU costosos.
- No depender solo del color (criterio de accesibilidad ya vigente desde `TASK-008.1`, criterio 15).

## Variantes evaluadas para la firma cromática de agrupación

### A — Borde lateral reforzado (evolución del actual)

Aumentar el `border-left` de 5px a ~8-9px y subir la saturación de la paleta.

- **A favor**: cambio mínimo, cero riesgo de interferir con el `outline` de "disponible" (solo toca el borde izquierdo, no todo el perímetro), cero nuevas reglas de posicionamiento.
- **En contra**: en una malla de columnas donde las tarjetas se leen de arriba hacia abajo dentro de cada nivel, un borde *lateral* es la dimensión menos escaneable — el ojo recorre la columna verticalmente, no lateralmente. Es probable que sencillamente ampliar el grosor no resuelva la "poca presencia" que motivó esta TASK.

### B — Franja superior (`border-top`)

Sustituir el acento de `border-left` por un `border-top` de ~4px en la misma paleta (más saturada), dejando el resto del borde en el tono neutro de estado que ya existe hoy.

- **A favor**: el borde superior es la línea que el ojo cruza primero al leer cada tarjeta descendiendo por una columna — mucho más escaneable que un borde lateral fino. No compite con la esquina superior derecha (candado/check quedan intactos). Con `box-sizing: border-box` no cambia el tamaño del nodo. Con el anillo de "disponible" separado por `outline-offset: 1px`, no hay superposición visual (verificado arriba).
- **En contra**: es un cambio de geometría, no solo de color — toca una propiedad (`border-top-width`) que hoy vale `1px` en todos los estados; hay que fijar ese valor por separado del resto del borde (`border-top-width` explícito, no el shorthand `border`).

### C — Cap/acento de esquina

Un pequeño triángulo o chip decorativo (pseudo-elemento `position: absolute`, sin afectar el flujo) en una esquina de la tarjeta.

- **A favor**: más "vistoso", conceptualmente cercano a una insignia de área.
- **En contra**: las dos esquinas superiores ya están ocupadas o cerca de estarlo (derecha: candado/check; izquierda: normalmente libre, pero en pantallas pequeñas el margen es ajustado). Añade un pseudo-elemento más a mantener sin ganar legibilidad frente a B. Es la opción con más riesgo de sentirse decorativa sin aportar lectura rápida.

## Recomendación: **Variante B — franja superior**, sin acento lateral adicional

Se sustituye el `border-left: 5px solid <hue>` actual por:

```css
.courseCard {
  /* border-left vuelve a 1px, mismo tono neutro que el resto del borde */
}

.courseCard[data-grouping="..."] {
  border-top-width: 4px;
  border-top-color: <hue-mas-saturado>;
}
```

en `≤47rem` se reduce a 3px para proporción con la tarjeta compacta (`min-height: 5rem`), mismo patrón que ya usa el breakpoint móvil para otros ajustes de tamaño.

Un solo acento geométrico, no dos — evita el ruido de "franja arriba + franja al lado" que iría en contra de "no pintar toda la tarjeta del color del área".

## Paleta ajustada — más saturada, sin verde, verificada por contraste

Paleta HSL calculada evitando la banda verde (90°-150°, reservada semánticamente a "completada"), separando cada matiz por ≥20° del vecino más próximo, y verificada contra los tres fondos de tarjeta reales de `TASK-008.1` (blanco/`bloqueada` `#eceeed`/`completada` `#eef4f0`) como indicador **no textual** (criterio ≥3:1):

| Agrupación | Hex propuesto | vs. blanco | vs. bloqueada | vs. completada |
|---|---|---|---|---|
| Matemáticas | `#356282` | 6.52:1 | 5.59:1 | 5.85:1 |
| Programación | `#866327` | 5.49:1 | 4.71:1 | 4.92:1 |
| Ciencias Naturales y Estadística | `#81376e` | 7.76:1 | 6.66:1 | 6.96:1 |
| Algoritmos y Computación | `#2d4680` | 9.13:1 | 7.84:1 | 8.19:1 |
| Computación Científica | `#603f8d` | 8.10:1 | 6.95:1 | 7.26:1 |
| Sistemas de Cómputo | `#226e77` | 5.89:1 | 5.05:1 | 5.28:1 |
| Computación Aplicada | `#964c2c` | 6.24:1 | 5.35:1 | 5.59:1 |
| Trabajo de Grado | `#7b323e` | 8.87:1 | 7.61:1 | 7.95:1 |

Todos superan holgadamente el mínimo de 3:1 exigido para indicadores no textuales — hay margen para que Codex ajuste tono fino en implementación sin volver a caer por debajo del umbral. Ningún valor cae en la banda verde; Matemáticas y Algoritmos quedan ambos en familia fría (azul/índigo) de forma deliberada — son las dos ramas "cuantitativas" del plan y no hay obligación de alejarlas más, siempre que su diferencia de tono (205° vs. 222°) y luminancia sea perceptible, algo que Codex debe confirmar visualmente en implementación.

## Leyenda de agrupaciones

Se extiende la sección `.controls` existente (no se crea una nueva), añadiendo un segundo bloque de leyenda con las 8 agrupaciones — mismo patrón `<span><i class="swatch"/> Nombre</span>` que ya usan prerrequisito/correquisito, con `flex-wrap: wrap`.

**Colapso en móvil**: se envuelve en `<details>`/`<summary>` nativo de HTML (cero JS, cero dependencia, accesible/operable por teclado por defecto del navegador) — abierto por defecto en desktop (`≤72rem` puede forzarse cerrado vía CSS si el espacio lo justifica, a decidir en implementación con el dataset real de 8 filas). Contenido: nombre oficial completo de cada agrupación (`grouping.name`, ya existente en dominio) + su franja de color — sin abreviar ni inventar etiquetas cortas.

Esto es el único cambio de JSX de esta TASK, además del `data-grouping` que ya existe: una lista estática de 8 entradas derivada de `groupings` (ya presente en el snapshot que la página ya consume), sin nuevo estado, sin nueva lógica.

## Estados — sin cambios

Los cuatro estados (bloqueada/disponible/en curso/completada) conservan exactamente su tratamiento visual de `TASK-008.1` (fondo, borde de estado, `outline` de disponible, candado, check, gradiente de en-curso, badge). Esta TASK no toca ninguna de esas reglas — solo `border-left`/`border-top` de agrupación y la leyenda nueva.

## Responsive

- **Desktop (`>72rem`)**: franja superior de 4px visible en las 60 tarjetas; leyenda de 8 entradas en `.controls`, `flex-wrap` permite que ocupe 1-2 líneas adicionales sin desbordar.
- **Táctil/tablet (`≤72rem`)**: sin cambio de comportamiento táctil (fuera de alcance, como en `TASK-008.1`); franja se mantiene.
- **Móvil (`≤47rem`)**: franja reducida a 3px acorde a la tarjeta compacta (`min-height: 5rem`); leyenda de agrupaciones colapsada tras `<details>` para no empujar el contenido del grafo fuera del viewport inicial.

## Rendimiento

Exactamente el mismo perfil que `TASK-008.1`: reglas CSS estáticas por atributo (`[data-grouping="..."]`), sin `filter`/`backdrop-filter`, sin gradientes nuevos, sin SVG adicional, sin animación en loop. `<details>` nativo no tiene coste de JS. Cumple `PERFORMANCE.md` (referencia J6 Prime) sin necesidad de "modo rendimiento" nuevo.

## Alcance exacto de implementación (para la TASK que ejecute esto)

**Archivos**:
- `apps/web/app/graph-view.module.css` — único archivo con cambios de estilo.
- `apps/web/app/graph-view.tsx` — un bloque JSX nuevo y estático (leyenda de agrupaciones dentro de `.controls`, envuelta en `<details>`), iterando sobre `groupings` ya disponible en el snapshot que el componente ya importa. Ningún nuevo `useState`, ningún nuevo handler.

**Dentro de alcance**:
- Reemplazar las 8 reglas `[data-grouping="..."] { border-left-color: ... }` por `border-top-width`/`border-top-color` (más `border-left-width` revertido a 1px, tono neutro de estado).
- Actualizar los 8 valores hex a la paleta más saturada (tabla arriba), o a valores que Codex ajuste dentro del mismo criterio de contraste si detecta un problema de contraste no cubierto aquí.
- Breakpoint `≤47rem`: `border-top-width` a 3px.
- Nuevo bloque de leyenda de agrupaciones en `.controls`, con `<details>` colapsable en móvil.
- CSS de la leyenda (swatches, `flex-wrap`, colapso).

**Fuera de alcance** (explícitamente prohibido):
- Cualquier cambio a `.blocked`/`.available`/`.in_progress`/`.completed` o a sus pseudo-elementos (candado/check/dot).
- Cualquier cambio a `measureEdges`, drag/scroll, focus mode, panel de detalle.
- Cualquier cambio a `curriculum-graph.ts`, `packages/**`, dataset.
- Filtrar o resaltar nodos por agrupación (interacción) — la leyenda es solo lectura, no un control.
- Tocar `apps/web/AGENTS.md` / `apps/web/CLAUDE.md` (autogenerados por `next dev`, no son producto) o `.claude/settings.json`.

## Criterios de aceptación

1. Las 60 tarjetas muestran una franja superior de color de agrupación (4px desktop, 3px en `≤47rem`), sustituyendo el `border-left` de 5px actual.
2. Los 8 valores hex de agrupación cumplen contraste **≥3:1** contra el fondo de tarjeta de cada uno de los cuatro estados (blanco/disponible, `#eceeed`/bloqueada, gradiente de en-curso, `#eef4f0`/completada), en estado **no atenuado** (mismo criterio 14 de `TASK-008.1`).
3. Ningún valor de agrupación cae en la banda verde reservada al estado "completada"/"disponible" (mismo espíritu del criterio "estado > agrupación").
4. El `outline` de 3px de "disponible" sigue siendo el único contorno perimetral completo; la franja de agrupación no lo sustituye ni se confunde visualmente con él (verificación visual humana).
5. El candado CSS (`.blocked`) y el check (`.completed`) conservan posición y legibilidad exactas de `TASK-008.1` — sin solaparse con la franja superior.
6. `measureEdges` sigue midiendo las mismas coordenadas de borde: ningún nodo cambia de tamaño exterior (verificable comparando `getBoundingClientRect()` antes/después, o visualmente confirmando que las líneas de conexión siguen ancladas correctamente).
7. Aparece una leyenda de las 8 agrupaciones (nombre completo + muestra de color) dentro de `.controls`, sin abreviaturas inventadas.
8. En `≤47rem` la leyenda de agrupaciones está envuelta en `<details>`/`<summary>` nativo, colapsada por defecto, operable por teclado sin JS adicional.
9. Los cuatro estados (bloqueada/disponible/en curso/completada) permanecen visualmente indistinguibles de como quedaron en `f8e180d` salvo por la franja superior sustituyendo al borde lateral.
10. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` — PASS.
11. Cero cambios en `apps/web/lib/curriculum-graph.ts`, `packages/**`, dataset, drag/scroll, focus mode.
12. `apps/web/AGENTS.md`, `apps/web/CLAUDE.md`, `.claude/settings.json` quedan fuera de cualquier commit de esta TASK.

## Fuera de alcance (de esta TASK-008.2 en sí)

- Filtrar/resaltar por agrupación (interacción) — mencionado como mejora futura en `TASK-008.0 §16`, sigue sin decidirse.
- Progreso por agrupación (`TASK-008.0 §10`) — sigue pendiente, sin anfitrión visual decidido.
- Resolver el bug móvil/táctil conocido — no se toca aquí, igual que en `TASK-008.1`.
- Vista Explorar (`TASK-009.0`) — iniciativa completamente separada.

## Condición de terminación

Este documento constituye la entrega de diagnóstico/diseño de `TASK-008.2`. No se abre run de agentes, no se modifica código, no hay commit/push/merge/deploy. Queda pendiente de aprobación humana antes de ejecutar la implementación descrita en "Alcance exacto de implementación".
