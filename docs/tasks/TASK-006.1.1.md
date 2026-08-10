# TASK-006.1.1 — Immersive EXP Bars

## Objetivo

Iteración puramente visual sobre las barras de progreso de TASK-006.1: hoy se leen como una barra de progreso administrativa genérica (verde sólida). Esta tarea les da identidad de "EXP/energía" — gradiente con sensación de energía, animación lenta de flujo, una progresión cromática coherente según el nivel de progreso, y un acabado especial (pero sobrio) al llegar al 100% — sin tocar ni un número de la lógica de progreso ya aprobada y congelada en TASK-006.1.

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

## Lógica congelada — no se toca bajo ninguna circunstancia

- `calculatePlanProgress` (engine).
- `completedCredits`, `inProgressCredits`, cualquier valor numérico que ya se calcula.
- `progressBarPresentation` (en `apps/web/lib/curriculum-data.ts`) — ni su firma, ni su fórmula de capado, ni sus valores de retorno.
- El cálculo por componente/agrupación, y la ausencia de barra para Libre Elección (TASK-006.1).
- `apps/web/lib/curriculum-data.ts` **no se modifica en esta tarea** — todo lo necesario para esta iteración es presentación pura y vive en `curriculum-view.tsx`/`curriculum-view.module.css`.

Esta tarea es exclusivamente presentación. Si algo pareciera requerir tocar la lógica de progreso, **detente y repórtalo** en vez de hacerlo.

## Contexto mínimo

- `apps/web/app/curriculum-view.tsx` — componente `ProgressBar` (usa `progressBarPresentation` de `curriculum-data.ts`, ya devuelve `completedRatio`, `inProgressRatio`, `completedPercent`, `completedText`, `inProgressText`, `ariaLabel`). Se usa en tres sitios: progreso del plan, cada `ComponentSection`, cada `GroupingSection`.
- `apps/web/app/curriculum-view.module.css` — clases actuales: `.progressBar`, `.progressText`, `.progressTrack` (pista, `background:#e1e6e2`), `.progressCompleted` (segmento sólido `background: var(--brand)`), `.progressInProgress` (ámbar `#c29431` con `repeating-linear-gradient` diagonal).
- `apps/web/app/globals.css` — paleta existente (`--brand`, `--brand-soft`, `--ink`, `--muted`, etc.) para mantener coherencia de identidad.
- No hay ningún bloque `@media (prefers-reduced-motion: reduce)` en `curriculum-view.module.css` hoy — hay que añadirlo.

## Decisiones aprobadas

1. **Clase visual derivada del porcentaje, puramente presentacional.** `ProgressBar` (en `curriculum-view.tsx`) puede calcular, a partir de `presentation.completedPercent` (ya existente, sin recalcular nada), una clase CSS de "etapa" con estos cortes: `0–24` frío/azul profundo, `25–49` cian/turquesa, `50–74` esmeralda/verde energético, `75–99` violeta/púrpura, `100` estado especial dorado/ámbar. Esta función es nueva, vive en `curriculum-view.tsx` (no en `curriculum-data.ts`), no le importa ninguna otra cosa que el número ya calculado, y **no cambia lo que se muestra como texto** (créditos/porcentaje/aria-label siguen viniendo de `progressBarPresentation` sin cambios).
2. **Progresión cromática coherente, no cinco barras distintas.** Los colores de las cinco etapas deben leerse como una progresión (p. ej. azul → cian → esmeralda → violeta → dorado es una transición de hue natural) — evitar saltos de tono que rompan la sensación de continuidad. Los valores hexadecimales exactos quedan a criterio de Codex dentro de ese espíritu; no hace falta igualar literalmente los tonos mencionados en el pedido original si hay una combinación mejor coherente con `--brand`/la paleta actual.
3. **Segmento COMPLETED con gradiente + glow sutil + movimiento lento.** `.progressCompleted` pasa de `background: var(--brand)` sólido a un `linear-gradient` de 2-3 paradas dentro de la familia de color de su etapa, con `background-size` mayor al 100% (p. ej. `200% 100%`) para poder animar `background-position`. Glow: un `box-shadow` **pequeño y suave** (no `filter: blur` grande, no sombra grande) en el tono de la etapa. Animación: **una sola** `@keyframes` compartida por todas las etapas (solo cambian los colores del gradiente por etapa, no el mecanismo de animación), que anima `background-position` de un extremo a otro, con una duración de varios segundos (p. ej. entre 4s y 8s), `linear`, `infinite` — debe percibirse como "energía moviéndose lentamente", nunca como parpadeo.
4. **Prohibido animar `width`, `filter: blur` de radio grande, JS (`requestAnimationFrame`), canvas, WebGL, o más de una animación simultánea por segmento.** Solo `background-position`/`transform`/`opacity` vía CSS, tal como pide el humano.
5. **Etapa 100% ("dominada")**: además de su propio gradiente dorado/ámbar de la etapa, puede tener un acabado ligeramente especial — por ejemplo un brillo/realce sutil adicional vía un pseudo-elemento (`::after`) con su propio gradiente de highlight, estático o con la misma familia de animación lenta que el resto (nunca una segunda animación de tipo distinto compitiendo por atención). Nada de confetti, pulsaciones fuertes, ni efectos costosos — "elegante", no "celebración".
6. **IN_PROGRESS conserva y refuerza su diferencia con COMPLETED.** El patrón diagonal ya existente (`repeating-linear-gradient`) se mantiene como mecanismo (la diferencia **no depende solo del color**, ya cumplido desde TASK-006.1). Puede añadirse un desplazamiento muy leve y lento del patrón (mismo tipo de animación de `background-position`, pero con timing/dirección distinguible de COMPLETED) — opcional, no obligatorio si complica el resultado. El color ámbar/coral actual se conserva o ajusta dentro de esa familia, pero siempre debe leerse inequívocamente como "no aprobado todavía".
7. **`@media (prefers-reduced-motion: reduce)` obligatorio**, nuevo en este archivo: anula toda animación (`animation: none`) en `.progressCompleted`, `.progressInProgress`, y cualquier pseudo-elemento de highlight de la etapa 100%, dejando el gradiente/color de la etapa **estático pero visualmente presente** — no se pierde la identidad cromática, solo el movimiento.
8. **Accesibilidad y texto sin cambios.** `presentation.completedText`, `presentation.inProgressText`, `presentation.ariaLabel` (ya existentes) se siguen renderizando exactamente igual. La barra nunca es la única fuente de información — ya se cumple, no se toca esa parte del JSX salvo para añadir el/los `className` de etapa.
9. **Responsive**: la altura de `.progressTrack` no debe crecer de forma notable respecto al valor actual (`0.65rem`) — cualquier ajuste debe ser menor. Sin overflow horizontal nuevo. Debe seguir viéndose bien en los breakpoints ya existentes (`47rem`, `22rem`).
10. **Rendimiento**: todas las barras de progreso de la página (plan + cada componente + cada agrupación) reutilizan la **misma** `@keyframes` para el segmento completado (decisión 3) — no se define una animación distinta por etapa ni por instancia.
11. **Sin dependencias nuevas. Sin cambios en `packages/**`, en `/grafo`, ni en ningún otro archivo fuera del alcance permitido.**

## Alcance permitido

```
apps/web/app/curriculum-view.tsx          (solo para calcular y aplicar la clase de etapa a partir de completedPercent — sin tocar progressBarPresentation ni ningún cálculo)
apps/web/app/curriculum-view.module.css   (todo el trabajo visual: gradientes, glow, animación, etapas, reduced-motion, responsive)
```

**`apps/web/lib/curriculum-data.ts` no se toca.** Ningún otro archivo debe modificarse. En particular: nada bajo `packages/**`, `apps/web/app/graph-view.*`, `apps/web/lib/curriculum-graph.ts`, `apps/admin/**`, `tools/agent/**`, ni ningún `package.json`.

## Fuera de alcance

- Cualquier cambio en `calculatePlanProgress`, `progressBarPresentation`, o cualquier valor numérico de progreso (sección "Lógica congelada").
- "Mi Progreso" completo, página nueva, proyección futura.
- Motivos visuales alrededor de materias, árbol de habilidades, aura global, partículas ambientales, sonido, 3D.
- Cambios en `/grafo` o en el algoritmo del grafo.
- Barra de progreso para Libre Elección (sigue sin mostrarse, decisión ya cerrada en TASK-006.1).
- El hydration mismatch de `docs/KNOWN_ISSUES.md`.
- Cualquier dependencia nueva, librería de animación, canvas, WebGL, JS con `requestAnimationFrame`.

## Criterios de aceptación

1. Las barras dejan de sentirse como una barra de progreso administrativa genérica (gradiente + glow sutil en vez de color sólido plano).
2. El segmento COMPLETED tiene identidad visual de "energía/EXP" (gradiente + glow sutil).
3. Existe movimiento sutil perceptible (animación de `background-position`, varios segundos de duración, no parpadeante).
4. El estilo del segmento COMPLETED cambia coherentemente según 5 rangos de `completedPercent` (0–24/25–49/50–74/75–99/100), como una progresión de color, no como cinco estilos desconectados.
5. La etapa 100% tiene un acabado especial pero sobrio (sin confetti, sin pulsaciones fuertes, sin animación llamativa).
6. IN_PROGRESS sigue siendo inequívocamente distinto de COMPLETED, sin depender solo del color (patrón diagonal ya existente, conservado).
7. Ningún cálculo académico cambia: `completedCredits`, `inProgressCredits`, `requiredCredits`, `ratio`, texto y `aria-label` de cada barra son idénticos byte a byte a los de TASK-006.1.
8. Cero dependencias nuevas en cualquier `package.json`.
9. `@media (prefers-reduced-motion: reduce)` elimina toda animación, conservando el color/gradiente de la etapa de forma estática y toda la información textual.
10. Responsive: sin overflow horizontal nuevo, altura de la barra no crece notablemente.
11. Todas las barras de la página reutilizan la misma `@keyframes` para el segmento completado.
12. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pasan sin errores.
13. `apps/web/lib/curriculum-data.ts` queda sin modificar.
14. Ningún archivo fuera de "Alcance permitido" queda modificado.

## Comandos de validación

```
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Condición exacta de terminación

La tarea termina cuando los criterios de aceptación se cumplen y la secuencia de validación se ejecuta sin errores — o cuando Codex reporta explícitamente que lograr el efecto pedido requeriría tocar la lógica de progreso congelada, sin hacerlo por su cuenta. Codex entrega el resumen indicado en `AGENTS.md`, describiendo explícitamente qué animación/color implementó, el comportamiento de cada rango, y cómo se maneja `prefers-reduced-motion`, y se detiene, sin iniciar ninguna tarea posterior.
