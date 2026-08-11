# TASK-008.1 — Piel de nodos "skill tree" en la Vista Explorar

## Objetivo

Primera implementación acotada del diseño aprobado en `docs/tasks/TASK-008.0.md`: cambiar la **piel visual** de `/grafo` para que empiece a leerse como un árbol de progresión, sin alterar geometría, lógica, datos ni interacción.

El objetivo explícito **no** es "el mismo grafo con colores nuevos". Con la misma disposición de nodos, el resultado debe producir un cambio de lectura real:

- **jerarquía visual** — un estado domina la atención, no los cuatro por igual;
- **camino disponible evidente** — "qué puedo cursar ahora" se responde de un vistazo, sin recorrer los 60 nodos;
- **completadas como territorio recorrido** — presentes y legibles, pero deliberadamente sin protagonismo;
- **bloqueadas como territorio futuro** — inertes pero nunca ilegibles ni tratadas como ruido;
- **identidad sutil de rama** — una segunda pista de lectura, subordinada al estado.

Sin sacrificar legibilidad ni rendimiento. Ante conflicto entre "más vistoso" y "más barato en gama baja", gana lo barato (`docs/PERFORMANCE.md`).

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

UI interactiva con estado, grafo y rendimiento → fila "UI interactiva o compleja" de `docs/AGENT_REVIEW_POLICY.md`.

## Contexto verificado en el código

- Las clases de estado ya existen en el marcado: `GraphCourseCard` aplica `styles[state.toLowerCase()]` → `.blocked`, `.available`, `.in_progress`, `.completed`. **No hace falta JSX nuevo para los estados.**
- `groupingId` **no llega al DOM**. `GraphCourseCard` renderiza `academicCode`, nombre, `credits`, `mandatory` y el badge de estado — nunca la agrupación. Sin exponerlo, ningún selector CSS puede expresar la identidad de rama.
- Las aristas ya tienen clases por tipo y por foco: `.prerequisiteEdge`, `.corequisiteEdge`, `.edgeDimmed`, `.edgeFocused`. El restyling de peso/color es CSS puro.
- El dataset tiene 60 materias, **todas con `groupingId`** (0 sin agrupación), repartidas en 8 agrupaciones.
- Ya existe un bloque `@media (prefers-reduced-motion: reduce)` que anula transiciones en `.courseCard` y en las aristas.
- Breakpoints estructurales vigentes: `47rem` y `72rem`. `.dimmed` vale `0.1` en desktop y `0.35` en `≤72rem` (TASK-006.4.1).

## Decisiones aprobadas

1. **Cambio de JSX permitido: exactamente uno.** Exponer la agrupación en el DOM del nodo, preferentemente como `data-grouping={versionCourse.groupingId}` en el `<article>` de `GraphCourseCard`. Es un atributo de presentación: **no** añade estado, efectos, handlers, props derivadas ni cálculo. Ningún otro cambio de JSX está autorizado.

2. **Jerarquía de paleta: estado > agrupación.** El estado es la señal primaria y debe ser el contraste dominante. La agrupación es secundaria y contenida: acento lateral, borde o indicador pequeño, en tono discreto. **Prohibido** usar 8 colores saturados compitiendo entre sí; con 8 ramas eso produce una paleta ilegible. Un usuario debe poder responder "¿qué puedo cursar?" sin distinguir una sola rama.

3. **Los hex definitivos se proponen en esta TASK, no vienen dados.** Deben cumplir los criterios de contraste de la sección correspondiente. Si Codex encuentra que un color propuesto no alcanza el contraste exigido, lo ajusta y lo documenta en su resumen — no lo deja fallando.

4. **Los cuatro estados, con esta intención visual:**
   - **Bloqueada** — fondo apagado, texto en gris medio, contorno tenue, candado pequeño mediante pseudo-elemento (sin imagen, sin icono externo, sin dependencia). Inerte pero legible.

     **Prohibido usar el emoji U+1F512 (🔒) o cualquier otro carácter de la zona emoji.** Muchas plataformas lo renderizan a color con la fuente de emoji del sistema, ignorando la propiedad `color`, con apariencia distinta en cada dispositivo — no es determinista ni monocromo. El candado debe dibujarse con CSS (cajas y bordes en pseudo-elementos) o, en su defecto, con un carácter tipográfico simple que respete `color` y la fuente. Se admite SVG inline solo si CSS resulta insuficiente, y sin añadir dependencias.
   - **Disponible** — **el único estado con contorno vivo**: contorno marcado en color de acento y, como mucho, un `box-shadow` de una sola capa y radio corto. Es el ancla de atención de toda la vista.
   - **En curso** — insinuación de progreso parcial mediante franja lateral o `linear-gradient` de dos paradas, más un marcador junto al código. **Estático**: no representa avance real ni se anima.
   - **Completada** — fondo teñido suave, texto un punto atenuado, marca de verificación mediante pseudo-elemento. Deliberadamente menos protagonista que "disponible".

5. **Aristas — peso según relevancia, sin lógica nueva.** Se conserva **prerrequisito sólido** y **correquisito discontinuo**, y la leyenda existente sigue siendo verdadera. El peso diferenciado (grosor/opacidad) solo puede derivarse de información **ya presente en el marcado**. Si expresarlo exigiera cualquier cálculo, prop o clase nueva en `graph-view.tsx`, **se omite**: el restyling de color y grosor por tipo es suficiente para esta TASK, y la decisión 1 manda sobre esta.

6. **Cero cambios de comportamiento.** Se conservan idénticos: selección por click/tap, modo foco y sus **tres salidas** (botón "Salir del foco", `Escape`, click en zona vacía), atenuación de no relacionados, panel de detalle (flotante en desktop, bottom sheet en `≤72rem`), controles de trayectoria, persistencia en `localStorage`, pan por arrastre y scroll táctil nativo, botón "Volver al inicio", y el aviso de ciclos.

7. **Prohibido tocar scroll, foco o gestos.** Nada de `scrollIntoView`, manipulación de `scrollTop`/`scrollLeft`, cambios en `focus()`, handlers de puntero, ni en el posicionamiento del panel de detalle. Misma prohibición que rigió TASK-006.4.1, por la misma razón: hay un bug abierto en móvil/tablet y esta TASK no debe interactuar con él.

8. **El bug móvil/tablet no se intenta arreglar aquí** ni se considera bloqueante. Ver `docs/tasks/TASK-006.4.1.md`. Cualquier cambio en la lógica de scroll/foco/gesto móvil requiere una TASK específica con evidencia de dispositivo real.

9. **Sin dependencias nuevas.** Sin librerías de iconos, de color o de gráficos.

10. **Sin cambios estructurales de layout.** Se conservan las columnas por nivel topológico, el orden de los nodos, los anchos de columna, el `overflow-x`, y los breakpoints `47rem` / `72rem`. Prohibido introducir carriles, franjas o filas por agrupación — descartado con evidencia en TASK-008.0 §5 (63% de las aristas cruzan agrupaciones).

11. **Los cálculos de `measureEdges` no se tocan.** El CSS nuevo **no puede** cambiar la altura ni la anchura de los nodos de forma que invalide las posiciones medidas por `getBoundingClientRect()`. Los pseudo-elementos (candado, check) deben posicionarse **sin alterar el flujo** de la tarjeta.

## Alcance permitido

```
apps/web/app/graph-view.module.css     (la mayor parte del trabajo)
apps/web/app/graph-view.tsx            (SOLO el atributo data-grouping de la decisión 1)
```

Cualquier necesidad de tocar `apps/web/lib/curriculum-graph.ts`, `packages/**`, el dataset, `curriculum-view.*` o cualquier `package.json` es motivo para **detenerse y reportar**, no para proceder.

## Fuera de alcance

- Flechas SVG, `<marker>`, `<defs>`, filtros SVG.
- Glow, `blur`, `filter`, `backdrop-filter`, sombras multicapa.
- Partículas, animaciones continuas o en loop.
- Controles nuevos, filtros por rama, leyenda de ramas, colapsar ramas.
- Progreso por rama (necesita un anfitrión visual aún no decidido — TASK-008.0 §10).
- Cambios de layout estructural, de geometría o del algoritmo de niveles.
- Panel de detalle: contenido, posicionamiento o comportamiento.
- `packages/**`, dataset, motor, persistencia, Vista Plan.
- El bug móvil/tablet y el hydration mismatch de `docs/KNOWN_ISSUES.md`.

## Criterios de aceptación

### Marcado y alcance

1. El `<article>` de cada nodo expone la agrupación en el DOM (`data-grouping` o equivalente), y ese es el **único** cambio en `graph-view.tsx`.
2. `graph-view.tsx` no gana estado, handlers, props derivadas, cálculo ni imports nuevos.
3. Cero cambios en `apps/web/lib/curriculum-graph.ts`, `packages/**`, el dataset y la Vista Plan.
4. Cero dependencias nuevas.

### Jerarquía visual

5. Los cuatro estados son distinguibles entre sí **sin depender del color de agrupación** y sin leer el texto del badge.
6. "Disponible" es el único estado con contorno vivo, y es el elemento de mayor peso visual del canvas.
7. "Completada" tiene menos peso visual que "disponible"; "bloqueada" es el estado más apagado pero conserva el texto legible (criterio 13).
8. El acento de agrupación es visualmente **subordinado** al estado: cambiar de rama no altera la lectura del estado de un nodo.
9. Se conserva prerrequisito **sólido** y correquisito **discontinuo**; la leyenda existente sigue describiendo correctamente lo que se dibuja.

### Desktop (`>72rem`)

10. El panel de detalle conserva posición, ancho, `max-height`, fondo, borde, sombra y `z-index` exactamente como están hoy.
11. `.dimmed` conserva `opacity: 0.1` en desktop, **sin ninguna regla posterior que lo anule** (ver criterio 13 bis).
12. El pan por arrastre (mouse/pen) y el botón "Volver al inicio" funcionan igual que antes.

### Contraste y legibilidad

13. Todo el texto de los nodos cumple **contraste ≥ 4.5:1** contra su fondo **en estado normal (no atenuado)**, en los cuatro estados, incluido "bloqueada".

13 bis. **El contenido atenuado por el modo foco queda excluido del umbral 4.5:1 mientras está atenuado.** La atenuación (`.dimmed`) es un estado **temporal y secundario**, activo solo mientras el usuario mantiene una materia seleccionada, y reversible por las tres salidas del modo foco. Reducir el contraste es su propósito explícito: apartar lo no relacionado. Exigirle 4.5:1 sería contradictorio con conservarla, porque con `opacity: 0.35` ese umbral es inalcanzable incluso con negro puro sobre blanco.

   En consecuencia queda **prohibido** neutralizar la atenuación para satisfacer un umbral de contraste — en particular, prohibido cualquier `opacity: 1` sobre `.dimmed` (`.courseCard.dimmed` incluido) en cualquier breakpoint.

   **Contrapartida obligatoria**: la atenuación **nunca puede ser el único portador de una información**. Todo lo que un nodo comunica (código, nombre, créditos, estado, rama) debe seguir estando disponible sin depender de la atenuación, y debe recuperar su contraste pleno al salir del modo foco. El modo foco resalta una relación; no oculta datos ni sustituye a ninguna otra señal.

14. Los indicadores no textuales (contorno de disponible, acento de rama) cumplen **≥ 3:1** contra lo adyacente, evaluados igualmente **en estado no atenuado**.
15. Ningún estado se distingue **solo** por color: cada uno tiene además una diferencia de forma, contorno, glifo o peso tipográfico.
16. Con los 60 nodos del dataset real, la vista sigue siendo legible: sin colisiones de texto, sin truncamientos nuevos, sin desbordes.

### Móvil / táctil (`≤72rem` y `≤47rem`)

17. Se conserva el bottom sheet con `max-height: 45vh` y `.dimmed` con `opacity: 0.35`, **sin ninguna regla posterior que lo anule** (ver criterio 13 bis).
18. Se conservan los anchos de columna y el tamaño compacto de tarjeta de `≤47rem` sin desbordes ni recortes.
19. Las áreas táctiles conservan su altura mínima actual (`2.75rem` donde ya aplica).
20. Cero cambios en el scroll táctil nativo, en el pan, y en el comportamiento de foco.

### Low-end

21. Sin `filter`, `backdrop-filter`, `blur`, filtros SVG, sombras multicapa ni gradientes complejos. Se admite `linear-gradient` de dos paradas y `box-shadow` de una sola capa.
22. Sin animaciones continuas, en loop o automáticas. Las únicas transiciones son on-interaction, en el orden de 120–200ms.
23. El coste de pintura de los 60 nodos permanece estático: ninguna propiedad nueva provoca repintado o relayout continuo.

### `prefers-reduced-motion`

24. El bloque `@media (prefers-reduced-motion: reduce)` existente se extiende para cubrir **toda** transición nueva.
25. Con la preferencia activa, los cuatro estados y la identidad de rama siguen siendo completamente distinguibles: nada de la información visual depende del movimiento.

### Interacción y regresión

26. Selección, modo foco con sus tres salidas, atenuación, controles de trayectoria, persistencia y aviso de ciclos funcionan exactamente igual que antes.
27. Las aristas siguen alineadas con los nodos: el CSS nuevo no altera las dimensiones que `measureEdges` mide (decisión 11).
28. Los 100 tests existentes siguen pasando **sin modificarlos**.
29. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pasan sin errores.

## Comandos de validación

```
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Nota sobre verificación visual

Los criterios 5–20 son **visuales** y no los cubre la secuencia de validación automática: en este entorno no hay navegador real ni headless (ver `docs/KNOWN_ISSUES.md`). Codex debe verificar por análisis del CSS lo que sea verificable estáticamente — contraste calculable de los pares color/fondo declarados, ausencia de propiedades prohibidas, cobertura del bloque `prefers-reduced-motion` — y **declarar explícitamente en su resumen** qué criterios quedan pendientes de comprobación humana en dispositivo real. **Prohibido afirmar que un criterio visual se cumple sin evidencia.**

## Condición exacta de terminación

La tarea termina cuando los criterios de aceptación se cumplen y la secuencia de validación se ejecuta sin errores — o cuando Codex reporta explícitamente que necesita un cambio fuera del alcance permitido, sin hacerlo por su cuenta. Codex entrega el resumen indicado en `AGENTS.md`, incluida la declaración de criterios visuales pendientes, y se detiene sin iniciar ninguna tarea posterior.
