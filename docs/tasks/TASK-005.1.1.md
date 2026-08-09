# TASK-005.1.1 — Diagnosticar y corregir hydration mismatch en `<html>`

## Objetivo

Diagnosticar y corregir un hydration mismatch real, observado manualmente por el humano en Chrome normal **y en incógnito** (por lo tanto no es una extensión) tras TASK-005.1:

```
Server: <html lang="es">
Client: <html lang="es" className="">
```

Es una tarea prerequisito antes de TASK-005.2: no se avanza con nueva UI sobre una base con un mismatch de hidratación sin resolver.

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

## ⚠️ Límite honesto de mi propio diagnóstico — leer antes de investigar

No tengo navegador disponible en este entorno (sin `chromium-cli`, sin Playwright/Puppeteer instalados, sin red para instalarlos — `EAI_AGAIN` al intentarlo). Un hydration mismatch solo lo reporta React **en tiempo de ejecución en un DOM real**, comparando el HTML servido contra lo que el árbol de React produciría al hidratar — `curl` no ejecuta JavaScript y no puede observarlo. Por eso lo que sigue es diagnóstico estático, verificado pero **parcial**, no una reproducción visual confirmada. Si Codex tiene alguna forma de ejecutar un navegador real o headless en su entorno, debe usarla para confirmar antes de aplicar cualquier fix.

## Hechos verificados (antes de escribir esta tarea)

1. **El HTML servido por el servidor es exactamente el esperado.** Levanté `pnpm --filter web dev` y pedí `/` con `curl`: la etiqueta es literalmente `<html lang="es">`, sin `class` ni `className`. Coincide con el "Server:" reportado por el humano — el servidor no es la fuente del problema.
2. **`agentRules` (la función de Next 16 que genera `AGENTS.md`/`CLAUDE.md`) queda descartada.** Verificado por búsqueda en el código fuente instalado de `next`: `agentRules` solo aparece bajo `next/dist/server/**` y `next/dist/build/**`; cero apariciones bajo `next/dist/client/**`. Es una función de servidor/build-time que escribe archivos en disco; no instrumenta el runtime del navegador.
3. **Ningún código de la aplicación toca `documentElement` ni asigna `className` al `<html>`.** Búsqueda exhaustiva en `apps/web/app/**` (incluyendo `layout.tsx`, `globals.css`, `curriculum-view.tsx`, `curriculum-view.module.css`): sin resultados para `documentElement`, `html.className`, `useTheme`, `next-themes`, `color-scheme` manipulado por JS. El único `color-scheme: light` está en CSS puro (`globals.css`), no en JS.
4. **`apps/web` no tiene `next.config.*`.** El proyecto corre con la configuración por defecto de Next 16.3.0 (instalado; `package.json` fija `^16.1.6`). Ningún ajuste propio interviene.
5. **Pista sin confirmar**: el runtime cliente de Next incluye `next/dist/client/components/navigation-devtools.js` — un módulo de dev tools de navegación que no he podido inspeccionar en profundidad ni descartar como origen del `className=""`. Es el candidato más concreto que tengo, no una conclusión.

## Protocolo de investigación (vinculante, en este orden)

1. **Confirmar la reproducción** con las herramientas disponibles en tu entorno. Si tienes acceso a un navegador real o headless (Playwright, Puppeteer, `chromium-cli`, o equivalente), úsalo para observar el warning de hidratación directamente y capturar el stack/component que React señala. Si no lo tienes, continúa con investigación estática, pero dilo explícitamente en el resumen final — no asumas confirmación que no tuviste.
2. **Revisar el runtime cliente de dev de Next** (`node_modules/next/dist/client/dev/**`, `node_modules/next/dist/client/components/navigation-devtools.js`, y cualquier código que envuelva el árbol raíz o el elemento `<html>` durante `hydrateRoot` en modo desarrollo) buscando dónde se podría originar un `className` en el elemento raíz.
3. **Comparar dev vs producción**: ¿el problema depende de `process.env.NODE_ENV !== "production"` (código de Fast Refresh, indicador de dev tools, overlay de errores)? Si el código sospechoso está condicionado a modo desarrollo, compilar y arrancar en modo producción (`next build && next start`) para ver si el mismatch reportado por el humano desaparece ahí. Documenta el resultado.
4. **Revisar de nuevo `layout.tsx`, `globals.css` y cualquier Client Component** por si el diagnóstico estático de esta tarea pasó algo por alto — no asumas que los hechos 1-3 de arriba son infalibles solo porque los verifiqué yo; repítelos si tienes dudas.
5. **Si la causa es del propio código de la aplicación**: corregirla directamente ahí. Es el caso más simple y el preferido si aplica.
6. **Si la causa es una instrumentación de Next.js exclusiva de modo desarrollo, verificada y no evitable de otra forma**: la corrección puede incluir `suppressHydrationWarning` **únicamente en el elemento `<html>`** de `layout.tsx`, con un comentario en el código que documente la causa raíz verificada (no una sospecha) y por qué no afecta a producción. Antes de llegar aquí, comprobar si existe una opción de configuración de Next (p. ej. relacionada con `devIndicators` u otro ajuste documentado del propio framework) que desactive la instrumentación en su origen — preferir eso sobre silenciar el warning.
7. **Prohibido**: usar `suppressHydrationWarning` como atajo sin haber completado los pasos 1-6, o aplicarlo a un elemento distinto de `<html>`, o aplicarlo "por si acaso" a varios elementos.

## Decisiones aprobadas

1. **Alcance mínimo**: esta tarea diagnostica y corrige el hydration mismatch. No rediseña la UI de TASK-005.1, no toca lógica curricular (`packages/curriculum-*`), no añade dependencias.
2. **`suppressHydrationWarning` solo con justificación real**, documentada en un comentario junto a su uso, y limitada exactamente al elemento `<html>`. Nunca como parche por defecto.
3. **El fix vive en `apps/web`** — `layout.tsx`, y `next.config.ts`/`.js`/`.mjs` (nuevo, si el fix requiere una opción de configuración de Next en vez de tocar el layout). Ningún otro archivo de `apps/web/app/**` debería necesitar cambios, pero si la investigación real revela que el origen está en otro archivo de `apps/web`, ese archivo entra en el alcance — repórtalo explícitamente si ocurre.
4. **Smoke test añadido, sin dependencia nueva**: dado que un hydration mismatch no es observable sin navegador, y no hay `jsdom`/`playwright`/equivalente instalado en el repo (verificado: ninguno presente en `node_modules`), el smoke test de esta tarea es un **guardián de regresión sobre el HTML servido**, no una prueba completa de hidratación:
   - Construye la app (`next build`), arráncala en modo producción, pide `/` por HTTP, y verifica que la etiqueta `<html ...>` no contenga `class=` ni ningún atributo inesperado más allá de `lang="es"`.
   - Se implementa como script Node mínimo usando únicamente módulos ya disponibles (`node:child_process`, `node:http` o `fetch` nativo) — sin instalar nada.
   - Se declara en el bloque `validations` de esta misma TASK (ver abajo), aprovechando TASK-005.0.1 ya cerrada.
   - **Este test no prueba que el mismatch del navegador esté resuelto** — solo que el servidor sigue sirviendo HTML limpio. Debe quedar documentado como tal en el propio script o en un comentario cercano, para que nadie lo confunda con una prueba de hidratación real.
5. **Sin ocultar el error**: si tras el protocolo de investigación la causa no queda clara, **no se aplica ningún fix a ciegas**. Se reporta como blocker con todo lo investigado, no se cierra la tarea con una solución no verificada.

## Validaciones adicionales

```validations
node tools/agent/selftest.mjs
```

(Se mantiene como regresión general del runner, ya cubierta desde TASK-005.0.1. El smoke test HTTP de esta tarea, descrito en la decisión 4, se añade como comando adicional propio una vez el propio Codex decida su ruta/nombre de archivo exactos — declararlo en `docs/tasks/TASK-005.1.1.md` no es posible antes de que el archivo exista; Codex debe **añadir ese comando a este mismo bloque `validations` como parte de su implementación**, editando este documento únicamente en esa línea. Si Codex no lo hace, `claude-review` debe marcarlo como blocker.)

## Contexto mínimo

- `docs/tasks/TASK-005.1.md` — la tarea que introdujo `layout.tsx` en su forma actual y `curriculum-view.tsx`.
- `apps/web/app/layout.tsx`, `apps/web/app/globals.css`, `apps/web/app/curriculum-view.tsx` — todo el código cliente actual de `apps/web`.
- `docs/tasks/TASK-005.0.1.md` — formato del bloque `validations`, ya implementado y disponible.
- `AGENTS.md` — reglas de alcance para Codex.
- Este documento (los hechos verificados y el protocolo de investigación son vinculantes).

## Alcance permitido

```
apps/web/app/layout.tsx           (fix, si aplica ahí)
apps/web/next.config.ts           (nuevo, solo si el fix requiere una opción de configuración de Next)
apps/web/scripts/**                (nuevo — smoke test HTTP de la decisión 4; ruta exacta a criterio de la implementación)
apps/web/package.json              (solo si el smoke test necesita un script npm para invocarse; sin dependencias nuevas)
docs/tasks/TASK-005.1.1.md         (únicamente para añadir el comando del smoke test al bloque `validations`, decisión 4)
```

Si la investigación real revela que el origen está en otro archivo de `apps/web/app/**` no listado arriba, ese archivo entra en alcance — debe reportarse explícitamente por qué.

Ningún archivo fuera de esto debe modificarse. En particular: nada bajo `packages/**`, `apps/admin/**`, ni ninguna dependencia nueva en ningún `package.json`.

## Fuera de alcance

- Rediseñar la vista curricular de TASK-005.1.
- Tocar `packages/curriculum-domain`, `curriculum-schema`, `curriculum-engine` o `curriculum-snapshot`.
- Añadir cualquier dependencia nueva (Playwright, jsdom, next-themes, etc.).
- `suppressHydrationWarning` sin justificación documentada, o fuera del elemento `<html>`.
- Grafo de prerrequisitos, niveles derivados — TASK-005.2.
- TASK-005.2 o cualquier tarea posterior.

## Criterios de aceptación

- El protocolo de investigación se siguió y quedó documentado en el resumen final de Codex, incluyendo si se confirmó visualmente o solo por análisis estático.
- La causa raíz aplicada al fix está identificada de forma concreta, no es una suposición sin verificar.
- Si se usó `suppressHydrationWarning`, está limitado al elemento `<html>` y acompañado de un comentario que documenta la causa raíz verificada.
- El smoke test HTTP existe, pasa, y queda declarado en el bloque `validations` de este documento.
- El smoke test dice explícitamente (en código o comentario) que verifica el HTML servido, no la hidratación en el navegador.
- Ninguna dependencia nueva fue añadida.
- Ninguna lógica curricular ni archivo de `packages/**` fue modificado.
- La vista de TASK-005.1 sigue funcionando igual (mismo contenido, misma interacción) tras el fix.
- `node tools/agent/selftest.mjs` pasa completo.
- Las cuatro validaciones estándar pasan.
- Ningún archivo fuera de "Archivos permitidos" queda modificado.

## Comandos de validación

```
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Condición exacta de terminación

La tarea termina cuando el protocolo de investigación se completó, el fix (o el reporte honesto de causa no confirmada, si aplica según la decisión 5) está aplicado, los criterios de aceptación se cumplen, y la secuencia de validación —incluida `node tools/agent/selftest.mjs` y el smoke test HTTP nuevo— se ejecuta sin errores. Codex entrega el resumen indicado en `AGENTS.md`, detallando la causa raíz encontrada y cómo se confirmó, y se detiene, sin iniciar TASK-005.2 ni ninguna otra tarea.
