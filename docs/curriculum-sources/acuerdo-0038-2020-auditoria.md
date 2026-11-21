# Matemáticas: auditoría de fuente y de integración

Estado: catálogo, integración multiprograma y Doble Titulación implementados y validados para revisión en rama.
Fecha de consulta: 2026-11-20.

## Fuente y versión

- Fuente principal: PDF suministrado por el usuario, `Acuerdo 038 de 2020.pdf`, cinco páginas. No se modifica ni se incorpora al repositorio.
- Enlace normativo: https://legal.unal.edu.co/rlunal/home/doc.jsp?d_i=95409
- Consejo de la Facultad de Ciencias, Sede Medellín. Expedición: 15 de abril de 2020. Entrada en vigencia indicada en la portada: 26 de mayo de 2020.
- El artículo 3 deroga el Acuerdo 027 de 2019. La referencia al Acuerdo 012 de 2009 en los considerandos no convierte ese acuerdo en una versión posterior.
- Se buscaron modificaciones posteriores en fuentes institucionales. El portal normativo respondió una plantilla con verificación reCAPTCHA, sin el texto normativo; la consulta web no obtuvo el documento. La ficha institucional actual del programa confirma 140 créditos, pero no contiene un historial normativo completo: https://ciencias.medellin.unal.edu.co/pregrado-matematicas
- **Pendiente de verificación:** no se pudo confirmar exhaustivamente la existencia o ausencia de modificaciones posteriores. El catálogo representa exclusivamente la versión del Acuerdo 038 de 2020 suministrada. No se presenta como consolidación normativa vigente ni se mezclan otras versiones.

## Transcripción confirmada

`packages/curriculum-snapshot/src/data/unal-mathematics-2020/source-catalog.ts` conserva códigos completos, nombres, créditos, agrupación, obligatoriedad, prerrequisitos, correquisitos y página del PDF. La referencia común al artículo 1 está en `mathematicsSource`.

| Componente | Obligatorios | Optativos | Exigidos |
| --- | ---: | ---: | ---: |
| Fundamentación | 40 | 8 | 48 |
| Formación Disciplinar o Profesional | 48 | 16 | 64 |
| Libre Elección | 0 | 28 | 28 |
| Total | 88 | 52 | 140 |

Los 52 créditos de la última fila incluyen los 28 de Libre Elección; los optativos de los dos primeros componentes suman 24.

Agrupaciones: Física 8, Geometría Básica 4, Matemática 36, Electivas Disciplinares 4, Análisis y Topología 28, Álgebra y Lógica 16, Matemática Aplicada 8, Trabajo de Grado 8. No se inventan asignaturas para Libre Elección ni se suma toda la oferta optativa como exigencia del plan.

Hay diferencias reales con Computación aun cuando el código coincide. Por ejemplo, Álgebra lineal no tiene prerrequisito en esta tabla; Ecuaciones diferenciales exige Cálculo integral y Álgebra lineal; Introducción a la teoría de grafos aparece sin requisitos; Criptografía y seguridad exige Teoría básica de la probabilidad. Compartir identidad de curso nunca debe reemplazar los requisitos de su participación en cada plan.

### Dependencia externa

La página 5 exige `3007744`, Programación orientada a objetos, para `3010588`, Computación gráfica y visualización científica. Se conserva en `prerequisites` y se declara expresamente en `mathematicsExternalReferences`. No se convierte en una asignatura propia de Matemáticas ni se le asignan créditos del plan. El snapshot lo adapta a EXTERNAL_COURSE_COMPLETED y ofrece un registro de aprobación externo sin créditos en Matemáticas.

### Trabajo de Grado

La página 5 muestra dos códigos, `3006946` y `3006947`, con celdas combinadas de ocho créditos, obligatoriedad y requisito de 40 créditos disciplinares. No respalda dos obligaciones independientes de ocho créditos.

Interpretación técnica conservadora: modelar una única exigencia de ocho créditos con `3006946`, conservar el umbral de 40 créditos y registrar `3006947` como alternativa pendiente de verificación del modelo. No crear un segundo curso obligatorio ni adjudicarle créditos independientes. La alternativa debe informarse en la integración, sin falsear el total ni afirmar que ya está implementada.

### Pruebas de la transcripción

Siete pruebas verifican esquema explícito, unicidad, agrupaciones, 140 créditos, sumas de obligatoriedad por componente, referencias internas/externas, ambos correquisitos, diferencias frente a Computación, Trabajo de Grado y ausencia de ciclos. Las páginas 3, 4 y 5 fueron renderizadas y revisadas visualmente para contrastar las tablas con la extracción textual.

## Capacidades multiprograma existentes

| Capa | Lo que ya sirve | Trabajo necesario |
| --- | --- | --- |
| Dominio y schemas | Universidad, programa, plan, versión, curso institucional y participación por versión | Conservar identidades y contratos existentes; añadir solo un contrato explícito para el requisito externo si se aprueba |
| Engine | Contexto de evaluación por versión, progreso por componentes/agrupaciones, requisitos compuestos y reconciliación pura | Reutilizar evaluadores y reconciliación; no duplicar reglas |
| Grafo y layout | Reciben cursos y relaciones por parámetro | Generar un modelo por catálogo con el algoritmo existente; no copiar posiciones de Computación |
| Cámara y filtros | Genéricos, sin identidad académica fija | Reutilizarlos sin cambiar gestos, escalas ni rendimiento |
| Aplicación | Las tres vistas ya comparten componentes y proveedor | Sustituir importaciones directas de `unalCs2024Official` por contexto del programa activo |
| Persistencia | Formato 1 con `planVersionId`, marcas completadas/en curso y filtro de IDs de Computación | Migración compatible a registros separados por programa/versión; conservar la clave antigua |

Puntos concretos de acoplamiento: `curriculum-data.ts`, `trajectory-storage.ts`, `trajectory.tsx`, `curriculum-view.tsx`, `graph-view.tsx`, `explorar-view.tsx` y `plan-context-bar.tsx`. En Trayectoria, grafo, layouts y geometría se calculan actualmente al cargar el módulo sobre el snapshot de Computación. Deben seguir precalculados por catálogo, no recalcularse durante pan ni pinch.

## Separación propuesta del trabajo

### A. Incorporar Matemáticas y seleccionar programa

1. Adaptar el catálogo fuente al snapshot existente, con schemas y referencias documentales.
2. Registro pequeño de programas: snapshot, contexto e índices derivados, modelo de grafo/layout y acentos visuales.
3. Contexto global de programa activo; las tres implementaciones existentes consumen ese contexto. Sin nuevas copias de Plan, Mapa o Trayectoria.
4. Persistencia por programa y versión; migración de todas las marcas anteriores de Computación sin borrar la clave original.
5. Selector en el shell y variables visuales Vino Editorial para Matemáticas, conservando los estados académicos y la identidad de Computación.

### B. Doble Titulación, separado del catálogo y del motor

1. Correspondencias explícitas y verificadas por código completo, identidad y créditos; ninguna sincronización por semejanza de nombres.
2. Coordinador puro de cambios entre trayectorias. Invoca el mismo engine para cada plan y mantiene separados sus cálculos de créditos.
3. Registro compartido de hechos académicos distinto de sus efectos en cada plan. Las invalidaciones de una trayectoria no eliminan silenciosamente hechos compartidos ni completadas.
4. Previsualización de todas las consecuencias, resolución explícita de conflictos y aplicación atómica solo al confirmar. Cancelar no cambia nada.
5. Al desactivar, conservar las últimas trayectorias reflejadas y continuar de forma independiente; no restaurar automáticamente estados anteriores.

## Punto de decisión estructural antes de la integración

El contrato actual de requisitos referencia `VersionCourseId` y el engine restringe su índice a la versión activa. No existe un contrato para exigir un curso institucional externo sin incorporarlo artificialmente al plan. Tampoco existe persistencia de hechos compartidos entre planes.

Propuesta acotada para revisar antes de implementarla:

- Añadir un requisito externo explícito por `CourseId` y un contexto de hechos externos conocidos; su evaluación no suma créditos a Matemáticas. Conservar como error las referencias externas desconocidas.
- Mantener el contexto y la trayectoria del engine por plan. Añadir la coordinación de Doble Titulación como función pura separada, con resultado completo de previsualización y conflictos, sin sustituir la reconciliación existente.
- Guardar una instantánea versionada de registros por plan, preferencia activa y enlace opcional. Las marcas explícitas de «Sin marcar» se distinguen de la ausencia de registro para detectar conflictos. Migrar el formato anterior sin eliminarlo.
- Probar independencia, migración, conflictos, cancelación, confirmación, invalidaciones y persistencia antes de conectar la UI.

Esta ampliación del contrato externo y de la coordinación es el cambio estructural que requiere revisión; parametrizar las vistas no implica reconstruirlas. El usuario aprobó explícitamente esta ampliación acotada antes de implementarla. Se implementaron el requisito externo registrable sin créditos, la persistencia separada y el coordinador puro, conservando el engine y las tres vistas.

## Estado Git de esta fase

Inicio: `feat/scroll-to-top`, HEAD `8f7c7b863e7d9966ab5ba6118d6455aab02ed470`.
Rama de trabajo: `feat/mathematics-program`, basada en `origin/main` `7d5c707b7c3da344dd6bad040b260c9ab342c0b5`.
Los archivos protegidos no se modifican ni se preparan para commits. Al iniciar la auditoría no se había hecho commit, push ni PR de esta tarea. La entrega se limita a rama y PR de revisión; no autoriza merge ni producción.

## Correspondencias verificadas para Doble Titulación

Se cotejaron los códigos completos, nombres e idéntico crédito de los dos catálogos oficiales: 28 participaciones internas compartidas. La lista explícita está en `apps/web/lib/programs.ts`. Las diferencias tipográficas de 3010390 (matemática/matemáticas discretas) y de mayúsculas de 3006888 se conservan en cada transcripción; no cambian la identidad del código. No se equiparan Probabilidad 3006934 y Teoría básica de la probabilidad 3010394.

3007744 se añade solo como correspondencia externa verificada por el prerrequisito de 3010588 en el acuerdo de Matemáticas y su identidad en Computación. Sus tres créditos pertenecen únicamente a Computación. Matemáticas registra cumplimiento externo, sin créditos ni participación artificial. Un hecho compartido En curso no satisface un requisito externo de aprobación.

## Presentación aprobada: Vino Editorial

El ajuste posterior del usuario reemplaza la paleta inicial por vino #6B3044, malva #955B70, detalle sutil #D7C5C9 y superficies neutras #F8F7F5/#EAE8E5. La agrupación Matemática utiliza azul petróleo #285C63, Física #95741C y Geometría #197B89; las otras cinco conservan los tonos aprobados. Ocho acentos de agrupación se definen una sola vez y se reutilizan en Plan, Mapa, Trayectoria, leyendas, filtros y fichas. Los colores y símbolos de estado y las aristas mantienen su semántica. Computación conserva sus reglas visuales.

La configuración visual explícita de Matemáticas ordena Matemática, Física, Geometría; Análisis, Álgebra, Aplicada, Electivas y Trabajo de Grado. No se ordenan códigos ni se modifican cursos, requisitos o niveles topológicos. La prueba del registro comprueba esta separación.

La jerarquía de progreso distingue programa (vino), componentes agregados (pizarra #52647A, oliva grisáceo #68634A, gris #66656B) y agrupaciones (sus ocho colores). Las pistas son neutras, las barras de componente más gruesas, y se conservan cifras y el segmento de En curso. Libre Elección sigue sin cursos modelados ni un porcentaje ficticio.
