# Matemáticas y Doble Titulación: informe de revisión

## Alcance y fuente

Se continúa en `feat/mathematics-program`, desde `origin/main`
`7d5c707b7c3da344dd6bad040b260c9ab342c0b5`. El checkout inicial era
`feat/scroll-to-top`, HEAD `8f7c7b863e7d9966ab5ba6118d6455aab02ed470`.

La [auditoría normativa](acuerdo-0038-2020-auditoria.md) distingue datos
confirmados, interpretación de Trabajo de Grado y verificación pendiente de
modificaciones posteriores. Se transcribieron 63 asignaturas del PDF suministrado,
con referencia a artículo y página, sin mezclar versiones. Son 140 créditos
exigidos: 48 de Fundamentación, 64 disciplinares y 28 de Libre Elección.
La oferta optativa completa no se suma como obligación.

3007744 es un requisito externo registrable como aprobado, sin créditos en
Matemáticas. Los dos correquisitos de Análisis vectorial y el umbral de 40
créditos disciplinares se evalúan mediante el engine. 3006947 permanece como
modalidad pendiente de verificación, sin una segunda obligación ni créditos
inventados. Libre Elección continúa explícitamente sin cursos modelados.

## Reutilización y datos del estudiante

Las tres vistas conservan una sola implementación. Se parametrizan catálogo,
índices, referencias y modelos precalculados. No se modifican la cámara, sus
gestos, filtros, búsqueda, algoritmo de layout ni reconciliación existente.
El selector global conserva programa activo al navegar y recargar.

El formato local 2 separa marcas por versión del plan y mantiene hechos
compartidos aparte. Importa completadas y en curso de Computación desde la clave
anterior, sin borrarla ni sobrescribirla. Conserva marcas explícitas Sin marcar.
No reemplaza un formato nuevo/desconocido o corrupto y comunica el fallo de
persistencia. No hay backend, cuentas ni migraciones de datos remotos.

El coordinador puro de Doble Titulación reconoce 28 correspondencias internas
verificadas por código completo, identidad y créditos, más 3007744 como
cumplimiento externo. No equipara 3006934 y 3010394 por su parecido temático.
Activar siempre requiere previsualización y confirmación. Los estados diferentes,
incluido Sin marcar explícito, requieren elección. Cancelar no aplica nada;
confirmar aplica exactamente la instantánea mostrada.

Cada plan recalcula créditos y requisitos con el engine existente. Las
invalidaciones de En curso no eliminan completadas ni hechos compartidos. Al
desactivar se conservan las últimas trayectorias y las futuras ediciones se
separan. No representa reconocimiento administrativo de homologaciones.

## Presentación final

Vino Editorial identifica el programa: #6B3044, malva #955B70, detalle #D7C5C9,
fondo #F8F7F5 y pistas/bordes #EAE8E5. Las superficies son neutras. Las
declaraciones cromáticas están centralizadas en `globals.css`; los módulos
reutilizan variables, sin duplicar la paleta entre vistas.

| Agrupación, en orden visual | Color | Créditos |
| --- | --- | ---: |
| Matemática | #285C63 | 36 |
| Fundamentación en Física | #95741C | 8 |
| Geometría Básica | #197B89 | 4 |
| Análisis y Topología | #376B9D | 28 |
| Álgebra y Lógica | #66508D | 16 |
| Matemática Aplicada | #317F79 | 8 |
| Electivas Disciplinares | #B9572E | 4 |
| Trabajo de Grado | #4C5158 | 8 |

Las barras de agrupación, tarjetas, medallones, leyendas, filtros y fichas usan
esa misma identidad. Los nombres siguen en encabezados, leyendas, filtros y
fichas; el color no sustituye el texto ni los símbolos de estado. Las aristas
conservan su significado. El orden es configuración visual explícita y no
modifica niveles ni dependencias.

Las barras agregadas usan pizarra #52647A, oliva grisáceo #68634A y gris #66656B,
con grosor de .85rem frente a .5rem de las agrupaciones. Libre Elección no
muestra un relleno ficticio: sigue no modelada. El progreso global conserva el
vino. Se verificaron 0%, 11% y 100% con cifras visibles y pistas neutras. Las
marcas En curso siguen diferenciadas del progreso realmente aprobado.

Computación conserva su snapshot de 146 créditos, orden y reglas de color; los
selectores nuevos de color se restringen a identificadores de Matemáticas.

## Validación

- `pnpm lint`: aprobado.
- `pnpm typecheck`: aprobado.
- `pnpm test`: 261 pruebas, 20 archivos, todas aprobadas.
- `pnpm build`: aprobado, las tres rutas estáticas generadas.
- `git diff --check`: aprobado.
- Navegador integrado local, sin navegador personal: Plan, Mapa y Trayectoria
  en ambos programas a 360×800, 375×812, 390×844, 430×932, 768×1024 y 1440×900.
  Matriz de 36 combinaciones sin desbordamiento horizontal.
- Se revisaron selector, colores, orden, búsqueda por código, autocomplete,
  filtros, fichas, navegación móvil y Vista completa. Conflictos, cancelación,
  confirmación, requisito externo, desactivación y persistencia se comprobaron
  en el navegador y se complementan con pruebas puras.
- En Trayectoria móvil, una ficha cerrada preservó exactamente escala 1.3,
  x=-1969.1, y=-152.60000000000002, selección y scrollY=334 tras panorámica.
  En Mapa también se comprobó la conservación de escala 1.3 al cerrar ficha.
- Sin errores de consola capturados ni errores de hidratación observados.
  Grafos/layouts siguen precalculados por catálogo; no se añade trabajo al pan.
  No se afirma haber probado multitouch físico ni realizado un benchmark móvil.

Las capturas y la matriz de evidencia local quedan en
`node_modules/.cache/mathematics-program/`, fuera del stage. Las verificaciones
normativas pendientes y la revisión funcional en dispositivo real siguen
identificadas; no se presenta la transcripción como normativa consolidada vigente.

## Entrega y protección local

La entrega autorizada es commit, push y PR hacia `main` para revisión. CI y
Preview se consultan después del push, sin solicitar accesos adicionales para
una Preview protegida. No se autoriza merge, actualización de `main`, ni
despliegue manual a producción. Los hashes, PR y resultado remoto se incluyen
en el informe de entrega del chat.

Los cuatro archivos locales protegidos conservan sus SHA256 iniciales:
`.claude/settings.json`, `.claude/launch.json`, `apps/web/next-env.d.ts` y
`apps/admin/next-env.d.ts`. No se incluyen en commits; `.agent/**` permanece
fuera del alcance.

## Archivos creados o modificados

- `apps/web/app/app-shell.tsx`
- `apps/web/app/curriculum-view.module.css`
- `apps/web/app/curriculum-view.tsx`
- `apps/web/app/explorar-view.module.css`
- `apps/web/app/explorar-view.tsx`
- `apps/web/app/globals.css`
- `apps/web/app/graph-view.module.css`
- `apps/web/app/graph-view.tsx`
- `apps/web/app/layout.tsx`
- `apps/web/app/plan-context-bar.tsx`
- `apps/web/lib/academic-change-dialog.tsx`
- `apps/web/lib/academic-storage.test.ts`
- `apps/web/lib/academic-storage.ts`
- `apps/web/lib/curriculum-data.ts`
- `apps/web/lib/curriculum-graph.ts`
- `apps/web/lib/mathematics-integration.test.ts`
- `apps/web/lib/program-presentation.ts`
- `apps/web/lib/program-selector.module.css`
- `apps/web/lib/program-selector.tsx`
- `apps/web/lib/programs.test.ts`
- `apps/web/lib/programs.ts`
- `apps/web/lib/trajectory-change-dialog.module.css`
- `apps/web/lib/trajectory.tsx`
- `apps/web/package.json`
- `docs/ARCHITECTURE.md`
- `docs/DOMAIN.md`
- `docs/curriculum-sources/acuerdo-0038-2020-auditoria.md`
- `docs/curriculum-sources/mathematics-review.md`
- `packages/curriculum-domain/src/index.ts`
- `packages/curriculum-domain/src/requirements.ts`
- `packages/curriculum-engine/src/evaluation.ts`
- `packages/curriculum-engine/src/index.ts`
- `packages/curriculum-engine/src/multi-program.test.ts`
- `packages/curriculum-engine/src/multi-program.ts`
- `packages/curriculum-engine/src/types.ts`
- `packages/curriculum-schema/src/academic-records.ts`
- `packages/curriculum-schema/src/index.ts`
- `packages/curriculum-schema/src/requirements.ts`
- `packages/curriculum-schema/src/source-course.ts`
- `packages/curriculum-snapshot/src/data/unal-mathematics-2020/index.ts`
- `packages/curriculum-snapshot/src/data/unal-mathematics-2020/source-catalog.test.ts`
- `packages/curriculum-snapshot/src/data/unal-mathematics-2020/source-catalog.ts`
- `packages/curriculum-snapshot/src/index.ts`
- `pnpm-lock.yaml`
