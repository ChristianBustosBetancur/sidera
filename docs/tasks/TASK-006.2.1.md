# TASK-006.2.1 — Ocultar el badge de preview en Production

## Objetivo

El badge "Sidera Preview · En desarrollo" (TASK-006.2) se renderiza **incondicionalmente** en toda ruta y en todo entorno. Antes de integrar a `main` —que es la rama de producción según `docs/DEPLOYMENT.md`— debe dejar de mostrarse en despliegues de producción, conservándose en desarrollo local y en Vercel Preview.

Cambio mínimo: **una condición**, en un archivo.

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

## Estado actual (inspeccionado antes de escribir esta tarea)

`apps/web/app/layout.tsx` es un **Server Component** (no tiene `"use client"`) y renderiza el badge sin ninguna condición:

```jsx
<body>
  <TrajectoryProvider>{children}</TrajectoryProvider>
  <aside className={styles.previewBadge}>
    <span aria-hidden="true">🚧</span> Sidera Preview · En desarrollo
  </aside>
</body>
```

Verificado además:
- `apps/web` **no usa `process.env` en ningún archivo** y **no hay `.env`** en el repo; toda la configuración vive en Vercel.
- Al ser Server Component, `layout.tsx` puede leer `process.env` en el servidor **sin prefijo `NEXT_PUBLIC_`**, sin exponer nada al cliente y sin JavaScript adicional en el bundle.
- Vercel inyecta `VERCEL_ENV` automáticamente en cada despliegue, con tres valores posibles: `production`, `preview`, `development`.

## Decisiones aprobadas

1. **Condición exacta, fijada por el humano:**
   ```js
   process.env.VERCEL_ENV !== "production"
   ```
   Cuando es verdadera se renderiza el badge; cuando es falsa, se renderiza `null`.

2. **Comportamiento requerido:**

   | Entorno | `VERCEL_ENV` | Badge |
   |---|---|---|
   | `pnpm dev` local | *(sin definir)* | **visible** |
   | Vercel Preview | `preview` | **visible** |
   | Vercel Production | `production` | **oculto** |

3. **Fallo abierto (fail-visible), deliberado.** Si `VERCEL_ENV` no estuviera definida en producción, el badge se mostraría. Es la dirección de fallo elegida a propósito: un aviso de "esto no es producción" es menos dañino sobrando que faltando. **Prohibido** invertir la condición a una lista blanca de entornos.

4. **En producción el badge se oculta por completo.** No se sustituye por otro badge, ni por una variante "Beta", ni por ningún texto alternativo.

5. **No se cambia el texto del badge** ni el emoji ni el `aria-hidden` del `<span>`.

6. **No se toca `apps/web/app/layout.module.css`.** La clase `.previewBadge` y todas sus reglas —incluida la variante de `≤47rem` y los `env(safe-area-inset-*)`— quedan exactamente como están, disponibles para reactivación futura.

7. **Prohibido**: añadir variables de entorno nuevas, crear archivos `.env`, usar cualquier variable con prefijo `NEXT_PUBLIC_`, o convertir `layout.tsx` en Client Component (`"use client"`).

8. **`<html lang="es">` y los atributos de `<body>` no se tocan** — restricción vigente desde TASK-005.4 por el hydration mismatch de `docs/KNOWN_ISSUES.md`, que esta tarea **no** investiga.

9. **Sin cambios en `packages/**`, `/grafo`, Vista Plan, dataset ni en ninguna otra parte de la UI.** Sin dependencias nuevas.

## Alcance permitido

```
apps/web/app/layout.tsx
```

**Un único archivo.** Ningún otro debe modificarse: ni `layout.module.css` (decisión 6), ni nada bajo `packages/**`, `apps/web/lib/**`, `apps/web/app/curriculum-view.*`, `apps/web/app/graph-view.*`, `apps/admin/**`, `tools/agent/**`, ni ningún `package.json`.

## Fuera de alcance

- Cambiar texto, emoji, estilos o posición del badge.
- Mostrar cualquier indicador alternativo en producción.
- Variables de entorno nuevas, `.env`, `NEXT_PUBLIC_*`, `vercel.json`.
- Convertir `layout.tsx` en Client Component.
- El hydration mismatch de `docs/KNOWN_ISSUES.md`, el bug móvil/tablet de selección, la banda 47–72rem y la barra horizontal del grafo — issues conocidos que **no bloquean este checkpoint**.
- Merge a `main`, push, o cualquier acción de despliegue.

## Tests

`apps/web` no tiene `jsdom` ni `@testing-library/react`, y no se añaden. El cambio es una condición sobre una variable de entorno dentro de un Server Component: **no es testeable con la infraestructura actual sin introducir dependencias nuevas**, y no se introducen.

Por tanto **no se añaden tests**, y los **100 existentes deben seguir pasando sin modificarse**.

Verificable por revisión de código, no por test — `claude-review` y `codex-qa` deben comprobarlo en el diff:
- que la condición es literalmente `process.env.VERCEL_ENV !== "production"`;
- que en producción se renderiza `null` y no un badge alternativo;
- que no aparece `NEXT_PUBLIC_`, ni `"use client"`, ni ficheros nuevos;
- que `layout.module.css` no fue modificado;
- que `<html>` y los atributos de `<body>` quedan intactos.

## Criterios de aceptación

1. El badge se renderiza solo cuando `process.env.VERCEL_ENV !== "production"`; en caso contrario se renderiza `null`.
2. En producción no aparece ningún indicador sustituto.
3. El texto, el emoji y el `aria-hidden` del badge quedan sin cambios.
4. `apps/web/app/layout.module.css` no se modifica.
5. No se añaden variables de entorno, archivos `.env`, ni variables `NEXT_PUBLIC_*`.
6. `layout.tsx` sigue siendo Server Component: no aparece `"use client"`.
7. `<html lang="es">` y los atributos de `<body>` quedan byte a byte idénticos.
8. Cero cambios en `packages/**`, `/grafo`, Vista Plan y dataset. Cero dependencias nuevas.
9. Los 100 tests existentes siguen pasando sin modificarse.
10. Ningún archivo fuera de "Alcance permitido" queda modificado.
11. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pasan sin errores.

## Comandos de validación

```
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Condición exacta de terminación

La tarea termina cuando los criterios de aceptación se cumplen y la secuencia de validación se ejecuta sin errores. Codex entrega el resumen indicado en `AGENTS.md` y se detiene, sin iniciar ninguna tarea posterior y sin realizar merge, push ni despliegue.
