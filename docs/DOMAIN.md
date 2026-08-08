# DOMAIN.md — Conceptos del dominio curricular

Este documento define el vocabulario conceptual del dominio. No define esquema SQL ni estructura de tablas.

## Universidad

Institución que agrupa programas académicos y mantiene un catálogo compartido de materias.

## Programa académico

Programa perteneciente a una universidad que puede tener uno o varios planes curriculares.

## Plan curricular

Conjunto completo de materias, agrupaciones y reglas que conforman una carrera.

## Versión de plan

Instantánea de un plan curricular en un momento dado. Las versiones publicadas son inmutables (ver `docs/ARCHITECTURE.md`). Una corrección genera una nueva versión, nunca modifica una existente.

## Materia

Unidad curricular cursable, con créditos, prerrequisitos y correquisitos propios.

La pertenencia institucional sigue `University → Course`, mientras que la jerarquía curricular sigue `University → AcademicProgram → CurriculumPlan → PlanVersion`.

`Course` es la identidad institucional compartida de una materia. `VersionCourse` representa su participación contextual en una `PlanVersion`: conserva código académico, créditos, agrupación y requisitos. Por ello, dos `VersionCourse` con el mismo `CourseId` pueden tener requisitos diferentes.

## Agrupación

Conjunto de materias organizadas bajo un criterio común (por ejemplo, área temática o ciclo), usado para estructurar la visualización y las reglas del plan.

## Prerrequisito

Materia (o condición) que debe cumplirse **antes** de poder cursar otra materia.

## Correquisito

Materia que debe cursarse **en simultáneo** (o ya estar aprobada) junto con otra.

## Requisitos por créditos

Condición de desbloqueo basada en una cantidad mínima de créditos aprobados, en lugar de (o además de) materias específicas.

## Estado académico de una materia

Estado de una materia para un estudiante concreto: bloqueada, disponible, en curso, aprobada.

## Progreso

Medida del avance del estudiante frente a un plan curricular (versión específica), derivada de sus materias aprobadas/en curso y las reglas del plan.

## Snapshot

Representación inmutable y autocontenida de una versión de plan publicada, generada para ser consumida por el cliente (ver `packages/curriculum-snapshot`).

## Nota

El diseño del esquema de base de datos definitivo se abordará en una tarea futura, no en este documento.
