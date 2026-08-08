# PRODUCT.md — Curriculum Universe

## Problema

Los estudiantes de Ciencias de la Computación tienen dificultad para entender su currículo: qué materias pueden cursar, qué las bloquea, qué llevan aprobado y cómo avanzan hacia el grado. Esta información suele estar dispersa en PDFs o sistemas administrativos poco usables.

## Usuario principal

Estudiante de Ciencias de la Computación (o carrera afín) que necesita planificar su avance académico.

## Flujo principal

1. El estudiante abre la aplicación y ve su currículo representado como árbol de habilidades/materias.
2. Identifica visualmente el estado de cada materia: bloqueada, disponible, en curso, aprobada.
3. Consulta prerrequisitos, correquisitos y créditos de una materia específica.
4. Sigue su progreso académico general frente al plan.

## MVP

- Visualización del árbol curricular (materias, prerrequisitos, correquisitos, créditos).
- Estados de materia: bloqueada, disponible, en curso, aprobada.
- Cálculo de progreso académico del estudiante.
- Funcionamiento rápido en dispositivos móviles de gama baja (ver `docs/PERFORMANCE.md`).

## Fuera del MVP inicial

- Universo interactivo 3D (capa visual cósmica).
- Panel administrativo completo de gestión curricular.
- Importación masiva desde CSV/Excel.
- Cuentas de usuario, autenticación, sincronización en la nube.
- Comunidad / contenido generado por usuarios.
- PWA con soporte offline completo.

## Principios de producto

- La funcionalidad académica siempre tiene prioridad sobre los efectos visuales.
- La experiencia cósmica/3D es una mejora opcional, nunca un requisito para usar la app.
- La app debe ser útil y rápida incluso sin la capa visual avanzada.
