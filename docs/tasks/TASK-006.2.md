# TASK-006.2 — Preview Development Banner

## Objetivo

Añadir un aviso pequeño, elegante y no intrusivo que indique que esta versión de Sidera está en desarrollo — visible en ambas vistas (`/` y `/grafo`) sin tocar la estructura interna de ninguna de las dos.

Texto: **"Sidera Preview · En desarrollo"**, con el símbolo 🚧. Debe leerse como una nota discreta, no como una alerta.

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

## Inspección previa (hecha antes de escribir esta tarea)

`apps/web/app/layout.tsx` es el único punto de layout verdaderamente compartido entre `/` y `/grafo` — ya envuelve `{children}` con `<TrajectoryProvider>` desde TASK-005.4, y es donde vive `<html>`/`<body>`. **Es el lugar correcto para este badge**: se renderiza una sola vez y aparece en ambas rutas sin tocar `curriculum-view.tsx` ni `graph-view.tsx`.

`layout.tsx` es un **Server Component** (no tiene `"use client"`). El badge es contenido estático (sin estado, sin interacción), así que puede vivir ahí directamente sin convertir el layout en cliente.

`layout.tsx` no tiene hoy su propio módulo CSS (solo importa `./globals.css`). Siguiendo la convención ya usada en el resto de `apps/web` (cada ruta/componente tiene su `*.module.css`), lo natural es crear `apps/web/app/layout.module.css` para este badge, en vez de añadir estilos de componente a `globals.css` (que hoy solo contiene resets/tokens/estilos base, ninguna clase de componente).

## Decisiones aprobadas

1. **El badge se renderiza una sola vez, en `layout.tsx`**, como hermano de `<TrajectoryProvider>` dentro de `<body>` (antes o después, indistinto). No se toca `<html>` ni los atributos de `<body>` — sigue vigente la restricción de TASK-005.4 sobre esos dos elementos específicos (son el epicentro del hydration mismatch documentado en `docs/KNOWN_ISSUES.md`, que esta tarea **no investiga ni toca**). Añadir un elemento hermano dentro de `<body>` sí está permitido.
2. **Posicionamiento: pill pequeña, `position: fixed`, anclada a la esquina inferior izquierda del viewport.** Se elige esa esquina explícitamente para no competir visualmente con el panel de detalle flotante de `/grafo` (anclado arriba-derecha desde TASK-006.0.1) ni con los controles de navegación del grafo (arriba). Tamaño de texto pequeño, padding compacto, fondo sutil con buen contraste sobre `--paper`/`--brand`, borde o sombra suave — coherente con la paleta ya existente (`--brand`, `--surface`, `--line`, `--muted`). Sin colores de alerta (nada de rojo/naranja de advertencia).
3. **`pointer-events: none` en el badge.** Es puramente informativo, no interactivo — así se garantiza que nunca intercepta clicks, arrastres, ni ningún gesto de `/grafo` (pan/drag, selección, modo foco), sin importar dónde se posicione.
4. **Sin animaciones llamativas.** Puede tener, como mucho, una transición de aparición muy breve al cargar (opcional, no obligatoria) — nada en bucle, nada que distraiga.
5. **Responsive**: en móvil, el badge debe seguir siendo legible pero no puede ocupar un ancho desproporcionado ni solaparse con contenido interactivo relevante (en `/grafo`, verificar que no se solape con la región del grafo cuando el panel de detalle está apilado debajo en pantallas medianas/móvil — decisión 4 de TASK-006.0.1). Si hace falta, puede reducir tamaño/padding en el breakpoint móvil ya usado en cada vista, o mediante su propio `@media` en `layout.module.css`.
6. **`z-index` suficiente para quedar visible sobre el contenido**, pero como es no-interactivo (decisión 3) y pequeño, no debe tapar controles reales — verificar visualmente que no cubre el botón "Salir del foco"/"Volver al inicio" de `/grafo` ni ningún control de `/`.
7. **Nuevo archivo `apps/web/app/layout.module.css`** para los estilos del badge, importado desde `layout.tsx` junto al `import "./globals.css"` ya existente. No se añaden clases de componente a `globals.css`.
8. **No se toca ninguna lógica**: nada de `curriculum-engine`, `progressBarPresentation`, `calculatePlanProgress`, persistencia, trayectoria, algoritmo del grafo, ni ningún dato del dataset oficial. Es contenido estático de UI.
9. **Sin dependencias nuevas.**

## Alcance permitido

```
apps/web/app/layout.tsx           (añadir el badge como hermano de TrajectoryProvider dentro de <body>; NO tocar <html> ni atributos de <body>)
apps/web/app/layout.module.css    (nuevo — estilos del badge)
```

Ningún otro archivo debe modificarse. En particular: nada bajo `packages/**`, `apps/web/lib/**`, `apps/web/app/curriculum-view.tsx`, `apps/web/app/graph-view.tsx`, ni sus respectivos `.module.css`, `apps/admin/**`, `tools/agent/**`, ni ningún `package.json`.

## Fuera de alcance

- Cualquier cambio a `curriculum-view.tsx`, `graph-view.tsx`, o sus estilos — el badge se implementa exclusivamente desde el layout compartido.
- Cualquier cambio en `packages/curriculum-domain`, `curriculum-schema`, `curriculum-engine`, `curriculum-snapshot`, o en `apps/web/lib/curriculum-graph.ts`.
- Cambios a la trayectoria, persistencia, progreso, o cualquier lógica curricular.
- Resolver o investigar el hydration mismatch de `docs/KNOWN_ISSUES.md` — **explícitamente prohibido**; tampoco tocar `<html>`/atributos de `<body>`.
- Un banner grande, modal, overlay bloqueante, o alerta de color de advertencia.
- Configuración de Vercel, variables de entorno, despliegue — esta tarea es solo el commit local del badge; el push y la configuración de Preview los hace el humano después.

## Criterios de aceptación

1. El badge "Sidera Preview · En desarrollo" (con 🚧) aparece en `/` y en `/grafo` sin haber tocado `curriculum-view.tsx` ni `graph-view.tsx`.
2. Es una pill pequeña, fija en la esquina inferior izquierda del viewport, con estética coherente con la paleta existente — no parece una alerta.
3. `pointer-events: none` — no intercepta ningún click/drag/gesto de ninguna vista.
4. No se solapa con el panel de detalle flotante de `/grafo`, ni con sus controles de navegación, ni con ningún control de `/`.
5. Responsive: sigue siendo legible en móvil sin overflow horizontal ni solaparse con contenido interactivo.
6. `<html>` y los atributos de `<body>` quedan exactamente igual que antes (verificable en el diff).
7. Cero cambios en `packages/**`, en `apps/web/lib/**`, en `curriculum-view.tsx`/`graph-view.tsx` o sus estilos.
8. Cero dependencias nuevas en cualquier `package.json`.
9. Ningún archivo fuera de "Alcance permitido" queda modificado.
10. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pasan sin errores.

## Comandos de validación

```
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Condición exacta de terminación

La tarea termina cuando los criterios de aceptación se cumplen y la secuencia de validación se ejecuta sin errores. Codex entrega el resumen indicado en `AGENTS.md` y se detiene, sin iniciar ninguna tarea posterior.
