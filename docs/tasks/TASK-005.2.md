# TASK-005.2 — Grafo de prerrequisitos/correquisitos con niveles derivados

## Objetivo

Añadir a `apps/web` una segunda vista: un grafo visual de las 60 materias del plan oficial, conectadas por sus relaciones reales de prerrequisito y correquisito, organizado por **niveles derivados de la profundidad del propio grafo** — nunca semestres, nunca ningún calendario académico que el dataset no tenga.

## Reviewers requeridos

```reviewers
claude-review
codex-qa
```

## Contexto mínimo

- `docs/tasks/TASK-005.1.md` y `apps/web/app/curriculum-view.tsx` — la primera vista ya cerrada. Esta tarea no la modifica, pero puede reutilizar sus datos derivados (`coursesById`, `versionCoursesById`, `evaluationContext`) para no duplicar lógica; extraerlos a un módulo compartido si conviene.
- `docs/curriculum-sources/acuerdo-0018-2024-materias.md` — decisión ya tomada por el humano sobre esta capa: "profundidad topológica del grafo de prerrequisitos" como nivel derivado, **nunca** llamado semestre.
- `packages/curriculum-domain/src/requirements.ts` — forma de `RequirementExpression`: `COURSE_COMPLETED`, `COURSE_COMPLETED_OR_CONCURRENT` son las únicas hojas que representan una arista materia→materia. `MIN_TOTAL_CREDITS`, `MIN_COMPONENT_CREDITS`, `MIN_GROUPING_CREDITS`, `MIN_GROUPING_COURSES` son umbrales de créditos, no aristas hacia una materia concreta.
- `packages/curriculum-engine/src/index.ts` — `deriveVersionCourseState`, mismo motor que TASK-005.1, se reutiliza igual.
- `docs/PERFORMANCE.md` — dispositivo de referencia gama baja, sin animaciones en bucle, JS inicial limitado.

## Decisiones aprobadas

1. **Nomenclatura obligatoria**: el nivel derivado se llama en UI, código y comentarios **"Nivel del grafo"** o **"Nivel derivado"** — nunca "Semestre", "Nivel académico" ni ninguna palabra que sugiera calendario oficial. Cualquier aparición de "semestre" en esta vista es un defecto de la tarea.
2. **Definición exacta del nivel derivado**: para una `VersionCourse`, es la longitud de la cadena más larga de prerrequisitos/correquisitos materia-a-materia que la preceden — `nivel(x) = 0` si `x` no tiene ninguna hoja `COURSE_COMPLETED`/`COURSE_COMPLETED_OR_CONCURRENT` en su `requirements` (recorriendo `ALL`/`ANY`/`AT_LEAST` recursivamente); en caso contrario, `nivel(x) = 1 + max(nivel(d))` para cada materia `d` referenciada directamente por esas hojas.
3. **Los umbrales de créditos no generan aristas ni afectan el nivel**: `MIN_TOTAL_CREDITS`, `MIN_COMPONENT_CREDITS`, `MIN_GROUPING_CREDITS`, `MIN_GROUPING_COURSES` no apuntan a una materia concreta, así que no participan en el cálculo de `nivel`. **Consecuencia explícita y esperada**: Trabajo de Grado, cuyo único requisito es `MIN_COMPONENT_CREDITS`, calculará `nivel = 0` igual que una materia sin ningún prerrequisito — no es un error, es el límite honesto de esta métrica. La tarjeta de Trabajo de Grado en el grafo debe mostrar su requisito real de créditos como texto (igual que ya hace TASK-005.1), precisamente para que nadie confunda "Nivel 0" con "puede cursarse primero".
4. **Grafo dibujado con SVG nativo, sin librería de grafos/layout.** SVG es una tecnología del navegador, no una dependencia de terceros — coherente con "cero dependencias visuales nuevas". Los nodos se posicionan con layout propio (columnas por nivel derivado, CSS Grid o flexbox dentro de cada columna); las aristas se dibujan como `<line>`/`<path>` en un `<svg>` superpuesto, calculando las coordenadas de los nodos vía `getBoundingClientRect()` en un efecto de layout, recalculado solo al montar y al cambiar de tamaño (con debounce razonable) — nunca en cada frame ni con animación continua.
5. **Correquisitos visualmente distintos de prerrequisitos**: por ejemplo, línea sólida para `COURSE_COMPLETED`, discontinua para `COURSE_COMPLETED_OR_CONCURRENT`. Debe existir una leyenda visible que lo explique.
6. **Aristas directas únicamente**: se dibuja la relación inmediata materia→materia declarada en `requirements`, no el cierre transitivo completo. Con 60 nodos, dibujar todas las transitivas sería denso e ilegible.
7. **Interacción de foco**: al seleccionar (click/tap) una materia, se resaltan sus aristas y materias directamente relacionadas (de las que depende y las que dependen de ella); el resto se atenúa visualmente en vez de ocultarse, para no perder la estructura general. Sin esta interacción, un grafo de 60 nodos con todas las aristas visibles a la vez es difícil de leer, especialmente en móvil.
8. **Sin ciclos esperados, pero manejo defensivo**: el cálculo de nivel debe detectar un ciclo (si existiera, por dato inconsistente) y reportarlo (p. ej. consola o un estado de error visible), sin recursión infinita ni cuelgue del navegador.
9. **Reutiliza el motor real**: el estado de cada materia (`AVAILABLE`/`BLOCKED`/`COMPLETED`/`IN_PROGRESS`) se deriva con `deriveVersionCourseState`, igual que TASK-005.1 — sin reimplementar elegibilidad en esta vista.
10. **Trayectoria independiente de TASK-005.1**: esta vista mantiene su propia trayectoria en estado local de React, separada de la del árbol Componente→Agrupación. Compartir estado entre vistas queda fuera de alcance — no es un olvido, es un límite explícito de esta tarea.
11. **Nueva ruta navegable**, enlazada desde la vista existente y viceversa (p. ej. `/` para el árbol, `/grafo` para esta vista, con un enlace visible en cada una hacia la otra). Next.js App Router ya soporta esto sin configuración adicional.
12. **Sin dependencias nuevas de ningún tipo.** Sin librerías de grafos, de layout, de gestos táctiles ni de animación.
13. **Rendimiento**: sin animaciones en bucle; el contenedor del grafo puede tener scroll horizontal contenido (`overflow-x` en el propio contenedor, nunca en la página) si el número de niveles lo requiere — es un patrón esperado en un grafo por niveles, a diferencia del árbol de TASK-005.1.

## Alcance permitido

```
apps/web/app/graph-view.tsx            (nuevo)
apps/web/app/graph-view.module.css     (nuevo)
apps/web/app/grafo/**                  (nueva ruta, o la que se use para exponer la vista)
apps/web/app/page.tsx                  (enlace hacia la nueva vista)
apps/web/app/curriculum-view.tsx       (únicamente para añadir el enlace de vuelta, o extraer helpers compartidos sin cambiar su comportamiento)
apps/web/lib/**                        (opcional — helpers compartidos de datos/nivel derivado, si evita duplicación)
```

Ningún otro archivo debe modificarse. En particular: nada bajo `packages/**`, `apps/admin/**`, `tools/agent/**`, ni ningún `package.json` (cero dependencias nuevas, decisión 12).

## Fuera de alcance

- Resolver el hydration mismatch de `docs/KNOWN_ISSUES.md` — explícitamente prohibido en esta tarea.
- Compartir trayectoria/estado entre la vista de árbol y la de grafo (decisión 10).
- Cierre transitivo completo de aristas (decisión 6).
- Cualquier librería de grafos, D3, gestos táctiles (pinch-zoom, pan) más allá de scroll nativo.
- Persistencia, backend, cuentas de usuario.
- Modificar `packages/curriculum-domain`, `curriculum-schema`, `curriculum-engine`, `curriculum-snapshot` — si algo pareciera faltar, **detente y pregunta**.
- TASK-005.3 o cualquier tarea posterior.

## Criterios de aceptación

- Las 60 materias aparecen como nodos, organizados en columnas por "Nivel del grafo" (nunca "Semestre") calculado según la decisión 2.
- Las aristas directas de prerrequisito y correquisito se dibujan y son visualmente distinguibles entre sí, con leyenda.
- Trabajo de Grado aparece en Nivel 0 con su requisito de créditos visible como texto — verificable manualmente que no se etiqueta ni se sugiere como "disponible desde el inicio".
- Seleccionar una materia resalta sus relaciones directas sin ocultar el resto del grafo.
- El estado de cada materia (`AVAILABLE`/`BLOCKED`/`COMPLETED`/`IN_PROGRESS`) proviene de `deriveVersionCourseState`, no de lógica propia de esta vista.
- Ningún ciclo provoca recursión infinita; si se detectara uno, se reporta de forma visible sin colgar la página.
- La palabra "semestre" no aparece en ningún archivo de esta tarea (código, comentarios, ni texto de UI).
- Cero dependencias nuevas en cualquier `package.json`.
- La vista de TASK-005.1 sigue funcionando exactamente igual; ambas vistas están enlazadas entre sí.
- `pnpm --filter web dev` sirve ambas rutas sin errores de consola nuevos más allá del hydration mismatch ya documentado en `docs/KNOWN_ISSUES.md`.
- Ningún archivo fuera de "Archivos permitidos" queda modificado.
- La secuencia de validación se ejecuta sin errores.

## Comandos de validación

```
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Condición exacta de terminación

La tarea termina cuando los criterios de aceptación se cumplen y la secuencia de validación se ejecuta sin errores. Codex entrega el resumen indicado en `AGENTS.md` y se detiene, sin iniciar TASK-005.3 ni ninguna otra tarea.
