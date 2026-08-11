# TASK-006.3 — Prepare Vercel Preview

## Objetivo

Dejar documentado, antes de disparar el primer Vercel Preview Deployment, que `feat/curriculum-visualization` es la rama usada para overs de vista previa y que `main` sigue siendo producción. Es una tarea exclusivamente de documentación — **cero cambios de código, UI o comportamiento.**

## Reviewers requeridos

```reviewers
claude-review
```

`docs/AGENT_REVIEW_POLICY.md`: "Documentación, configuración sencilla, specs" → `claude-review` únicamente.

## Contexto mínimo

- No existe hoy ningún documento de despliegue en `docs/`. Los documentos existentes (`PRODUCT.md`, `ARCHITECTURE.md`, `DOMAIN.md`, `PERFORMANCE.md`, `AGENT_SECURITY.md`, `AGENT_REVIEW_POLICY.md`, `KNOWN_ISSUES.md`) no cubren despliegue/entornos.
- Rama activa: `feat/curriculum-visualization`, con TASK-005.x/TASK-006.x ya aceptadas visualmente en Chrome real (open canvas, progress bars, preview badge).
- `apps/web/app/layout.tsx` ya muestra el badge "Sidera Preview · En desarrollo" (TASK-006.2) — coherente con que esta rama se use para Preview.

## Decisiones aprobadas

1. **Nuevo documento `docs/DEPLOYMENT.md`**, que registre explícitamente:
   - `main` es producción.
   - `feat/curriculum-visualization` es la rama usada para Vercel Preview Deployments mientras esta fase de visualización esté en curso.
   - Un Preview Deployment se genera automáticamente por Vercel al recibir un push a esta rama (o al abrir un PR hacia `main`, según cómo quede configurado el proyecto en Vercel) — sin que este documento prescriba la configuración exacta de Vercel, que es responsabilidad del humano fuera de este repositorio.
   - El badge "Sidera Preview · En desarrollo" (TASK-006.2) es la señal visual en la propia app de que esa build no es producción.
   - Ningún Preview Deployment implica merge a `main` — el merge sigue siendo una decisión humana explícita y separada.
2. **Cero cambios de código.** No se toca ningún archivo bajo `apps/**`, `packages/**`, `tools/**`. Esta tarea es puramente un archivo Markdown nuevo.
3. **Sin configuración de Vercel en el repositorio** (sin `vercel.json`, sin variables de entorno, sin workflows de CI/CD nuevos) — la configuración de Vercel Preview la hace el humano en la plataforma de Vercel, fuera del alcance de esta tarea.
4. **Sin cambios de UI, comportamiento, ni dependencias.**

## Alcance permitido

```
docs/DEPLOYMENT.md    (nuevo)
```

Ningún otro archivo debe modificarse.

## Fuera de alcance

- Cualquier cambio bajo `apps/**`, `packages/**`, `tools/**`.
- Crear o modificar `vercel.json`, workflows de CI/CD, variables de entorno.
- Push, merge, o cualquier cambio en `main`.
- Disparar el propio despliegue — eso lo hace el humano en Vercel después de esta tarea.

## Criterios de aceptación

- `docs/DEPLOYMENT.md` existe y documenta claramente: `main` = producción, `feat/curriculum-visualization` = rama de Preview, y que el merge a `main` sigue siendo una decisión humana separada.
- Ningún archivo fuera de `docs/DEPLOYMENT.md` queda modificado.
- Cero cambios de código, UI, o dependencias.
- La secuencia de validación se ejecuta sin errores (debe pasar trivialmente, al no haber cambios de código).

## Comandos de validación

```
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Condición exacta de terminación

La tarea termina cuando `docs/DEPLOYMENT.md` existe con el contenido descrito y la secuencia de validación se ejecuta sin errores. Codex entrega el resumen indicado en `AGENTS.md` y se detiene, sin iniciar ninguna tarea posterior.
