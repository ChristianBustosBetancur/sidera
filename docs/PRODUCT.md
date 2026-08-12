# PRODUCT.md — Sidera

## Problema

Los estudiantes de Ciencias de la Computación tienen dificultad para entender su currículo: qué materias pueden cursar, qué las bloquea, qué llevan aprobado y cómo avanzan hacia el grado. Esta información suele estar dispersa en PDFs o sistemas administrativos poco usables.

## Usuario principal

Estudiante de Ciencias de la Computación (o carrera afín) que necesita planificar su avance académico.

## Superficies

La aplicación se organiza en tres superficies con propósitos distintos, no en dos variantes del mismo grafo.

### Plan

Vista principal del plan académico. Presenta el currículo por componentes y agrupaciones, el estado de cada materia y el progreso por créditos. Es donde el estudiante registra su trayectoria.

### Mapa de Prerrequisitos

Vista técnica de relaciones. Responde a "qué exige esta materia y qué depende de ella": prerrequisitos, correquisitos y relaciones directas entre asignaturas. Su unidad de lectura es la relación entre dos materias.

### Trayectoria Curricular

Vista exploratoria del recorrido. Responde a "por dónde voy y hacia dónde puedo seguir": el plan como recorrido dirigido desde los fundamentos hacia las ramas avanzadas, con el estado actual de cada materia y sus conexiones. Su unidad de lectura es el camino, no la relación aislada.

## Navegación

Las tres superficies viven dentro de un marco de navegación común, con la ruta activa siempre señalada. La navegación no se repite dentro de cada vista.

## Flujo principal

1. El estudiante abre la aplicación y ve su plan curricular con el estado de cada materia.
2. Identifica visualmente ese estado: bloqueada, disponible, en curso, aprobada.
3. Consulta prerrequisitos, correquisitos y créditos de una materia específica.
4. Sigue su progreso académico general frente al plan, visible de forma persistente en todas las superficies.

## Contexto y progreso persistentes

La aplicación mantiene visible el programa y la versión de plan activos junto al progreso del estudiante, de modo que nunca haya duda sobre qué plan se está consultando.

La semántica del progreso es deliberada:

- los créditos **aprobados** son los que cuentan como progreso satisfecho;
- los créditos **en curso** se muestran por separado;
- una materia en curso **no** infla el porcentaje de avance, porque todavía no está aprobada.

## Búsqueda y filtros en Trayectoria Curricular

- Búsqueda local por nombre, código y agrupación, indiferente a mayúsculas y tildes.
- Filtros de selección múltiple por estado académico y por agrupación.
- Entre categorías las condiciones se combinan de forma restrictiva; dentro de una misma categoría, cualquier valor seleccionado es suficiente.
- Al filtrar se destacan además los destinos directos —a un solo paso— de las materias encontradas, como contexto de recorrido; no implican que esas materias queden disponibles.
- Filtrar cambia la presentación, nunca la estructura: el plan no se recalcula ni se reordena.

## MVP

- Visualización del plan curricular (materias, prerrequisitos, correquisitos, créditos).
- Estados de materia: bloqueada, disponible, en curso, aprobada.
- Cálculo de progreso académico del estudiante.
- Funcionamiento rápido en dispositivos móviles de gama baja (ver `docs/PERFORMANCE.md`).

## Fuera del MVP inicial

- Universo interactivo 3D (capa visual cósmica).
- Panel administrativo completo de gestión curricular.
- Importación masiva desde CSV/Excel.
- Cuentas de usuario, autenticación, sincronización en la nube.
- Selección de universidad, sede, programa o versión de plan desde la interfaz.
- Exportación, compartición e importación de trayectorias.
- Comunidad / contenido generado por usuarios.
- PWA con soporte offline completo.

## Principios de producto

- La funcionalidad académica siempre tiene prioridad sobre los efectos visuales.
- La experiencia cósmica/3D es una mejora opcional, nunca un requisito para usar la app.
- La app debe ser útil y rápida incluso sin la capa visual avanzada.
