# KNOWN_ISSUES.md — Hallazgos pendientes, no bloqueantes

Documento para problemas reales, ya investigados, que se dejan deliberadamente sin resolver por falta de una vía de verificación segura — no por falta de esfuerzo. Cada entrada debe permitir a alguien retomar la investigación sin repetir trabajo ya hecho.

## Hydration mismatch en `<html>` (apps/web)

**Estado: abierto. No resuelto. No aplicado ningún parche.**

**Origen**: observado manualmente por el humano tras TASK-005.1 (primera vista curricular). Investigado en TASK-005.1.1, que terminó en `STOPPED` (`repair-budget-exhausted`) sin fix, por decisión explícita de no aplicar una corrección especulativa.

### Reproducción

- Se reproduce en Chrome normal.
- Se reproduce también en modo incógnito — **descarta una extensión de navegador** como causa.
- React reporta un hydration mismatch en `RootLayout` (`apps/web/app/layout.tsx:12:5`).

### Evidencia observada

```
Server: <html lang="es">
Client: <html lang="es" className="">
```

El servidor produce exactamente `<html lang="es">` (verificado también por curl contra `pnpm --filter web dev` — coincide con lo reportado como "Server:"). El cliente, tras hidratar, añade un `className=""` que el servidor nunca envió.

### Investigaciones realizadas

1. **HTML servido**: confirmado limpio, sin `class`/`className`, en dev (`curl` contra `pnpm --filter web dev`).
2. **`agentRules`** (función de Next 16 que genera `AGENTS.md`/`CLAUDE.md`): descartada por búsqueda en el código fuente instalado de `next` — solo existe bajo `next/dist/server/**` y `next/dist/build/**`, cero apariciones en `next/dist/client/**`. Es una función de servidor/build-time, no instrumenta el navegador.
3. **Código de la aplicación** (`layout.tsx`, `globals.css`, `curriculum-view.tsx`, `curriculum-view.module.css`): sin ninguna referencia a `documentElement`, `html.className`, `useTheme`, `next-themes`, ni manipulación de `color-scheme` vía JS. El único `color-scheme: light` está en CSS puro.
4. **`next.config.*`**: no existe en `apps/web`. Corre con la configuración por defecto de Next 16.3.0.
5. **Runtime compilado de `layout.tsx`** (verificado por Codex en TASK-005.1.1): produce únicamente `{ lang: "es" }` — ningún `className` en la salida compilada.
6. **`next/dist/client/components/navigation-devtools.js`**: investigado como pista concreta. Descartado — no añade `className` al elemento raíz.
7. **Fast Refresh y el overlay de desarrollo de Next**: descartados como origen, sin evidencia de que instrumenten `<html>`.

### Causas descartadas (con evidencia, no por suposición)

- Extensión de navegador (se reproduce en incógnito).
- `agentRules`.
- Código propio de `apps/web`, actual o histórico.
- `navigation-devtools.js`.
- Fast Refresh / overlay de Next.

### Por qué se deja abierto en vez de forzar un fix

- Ni el Controller (Claude) ni Codex tienen acceso a un navegador real o headless en este entorno (`chromium-cli`, Playwright y Puppeteer no están instalados; sin red para instalarlos).
- El sandbox de Codex (`workspace-write`) no puede siquiera abrir un puerto local (`listen EPERM`) — ni pudo ejecutar su propio smoke test de verificación.
- Un hydration mismatch solo lo reporta React en tiempo de ejecución, en un DOM real; no es observable por análisis estático ni por `curl`.
- Aplicar `suppressHydrationWarning` sin una causa raíz confirmada ocultaría el síntoma sin entender el problema, y está explícitamente prohibido como parche especulativo.

### Cómo retomarlo

La vía más directa: reproducir en un navegador real con DevTools abierto, capturar el stack/componente completo que React señala como origen del `className` inesperado (no solo el resumen `<html>` server/client), y a partir de ahí aplicar un fix dirigido — o, si el origen resulta ser instrumentación de Next.js exclusiva de modo desarrollo y verificada como tal, evaluar entonces si `suppressHydrationWarning` en `<html>` (documentado con la causa real) es la corrección correcta.

### Impacto conocido

No se ha observado ningún efecto funcional visible más allá del warning en consola — la vista de TASK-005.1 funciona correctamente (contenido, interacción, estado, progreso). Se trata como cosmético/de consola hasta que se demuestre lo contrario.
