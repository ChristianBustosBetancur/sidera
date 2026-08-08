# ACUERDO 0018 DE 2024 — Ciencias de la Computación — Universidad Nacional de Colombia, Sede Medellín

> **FUENTE OFICIAL CURADA — no es una fuente normativa independiente.**
> Este documento es una **transcripción estructurada y curada** de datos suministrados por un humano a partir del Acuerdo 0018 de 2024. El **Acuerdo 0018 de 2024 es la única autoridad normativa**; este archivo existe únicamente para que el dataset de Sidera (`packages/curriculum-snapshot`) tenga una fuente trazable y versionada dentro del repositorio. Ante cualquier discrepancia, el Acuerdo original prevalece sobre este documento.
>
> No incluye datos de la "Propuesta de Malla Curricular Ciencias de la Computación". No se ha inventado, inferido ni completado ningún dato ausente en lo suministrado — donde falta información, se deja explícitamente ausente y se marca como tal.

## Plan

| Campo | Valor |
|---|---|
| Programa | Ciencias de la Computación |
| Universidad | Universidad Nacional de Colombia |
| Sede | Medellín |
| Norma | Acuerdo 0018 de 2024 |
| `provenance` | `official` |
| `lifecycle` | `draft` |
| `requiredCredits` | `146` |

## Componentes y Agrupaciones

### Componente de Fundamentación — `requiredCredits: 61`

- Matemáticas — `requiredCredits: 44`
- Programación — `requiredCredits: 9`
- Ciencias Naturales y Estadística — `requiredCredits: 8`

### Componente de Formación Disciplinar o Profesional — `requiredCredits: 56`

- Algoritmos y Computación — `requiredCredits: 19`
- Computación Científica — `requiredCredits: 16`
- Sistemas de Cómputo — `requiredCredits: 6`
- Computación Aplicada — `requiredCredits: 7`
- Trabajo de Grado — `requiredCredits: 8`

### Componente de Libre Elección — `requiredCredits: 29`

Sin agrupaciones. El Acuerdo no presenta una agrupación de materias bajo este componente en los datos suministrados — no se inventa una.

---

## Materias

Convención: `código | nombre | créditos | mandatory`, seguido de sus prerrequisitos/correquisitos si los hay. "Sin requisito indicado" significa que la fuente no declara ninguno para esa materia — no que se haya omitido.

### Agrupación: Matemáticas

| Código | Nombre | Créditos | mandatory | Prerrequisitos | Correquisitos |
|---|---|---|---|---|---|
| 1000004-M | Cálculo diferencial | 4 | true | — | — |
| 1000005-M | Cálculo integral | 4 | true | 1000004-M Cálculo diferencial | — |
| 1000006-M | Cálculo en varias variables | 4 | true | 1000005-M Cálculo integral | — |
| 1000008-M | Geometría vectorial y analítica | 4 | true | — | — |
| 1000003-M | Álgebra lineal | 4 | true | 1000008-M Geometría vectorial y analítica | — |
| 1000007-M | Ecuaciones diferenciales | 4 | true | 1000003-M Álgebra lineal | — |
| 3010334 | Fundamentos de matemáticas | 4 | true | — | — |
| 3010390 | Fundamentos de matemáticas discretas | 4 | true | 3010334 Fundamentos de matemáticas | — |
| 3010389 | Fundamentos de análisis | 4 | true | 3010334 Fundamentos de matemáticas; 1000004-M Cálculo diferencial | — |
| 3006934 | Probabilidad | 4 | true | 1000005-M Cálculo integral | — |
| 3006994 | Introducción al análisis real | 4 | false | 3010389 Fundamentos de análisis | — |
| 3006993 | Grupos y anillos | 4 | false | 3010390 Fundamentos de matemáticas discretas | — |
| 3011247 | Combinatoria Intermedia | 4 | false | 3010390 Fundamentos de matemáticas discretas | — |
| 3006900 | Introducción a la teoría de grafos | 4 | false | 3010390 Fundamentos de matemáticas discretas | — |
| 3009257 | Teoría elemental de números | 4 | false | 3010390 Fundamentos de matemáticas discretas | — |
| 3006905 | Matemáticas especiales | 4 | false | 1000007-M Ecuaciones diferenciales | 1000006-M Cálculo en varias variables |

### Agrupación: Programación

| Código | Nombre | Créditos | mandatory | Prerrequisitos | Correquisitos |
|---|---|---|---|---|---|
| 3010435 | Fundamentos de programación | 3 | true | — | — |
| 3007744 | Programación orientada a objetos | 3 | true | 3010435 Fundamentos de programación | — |
| 3007741 | Estructura de datos | 3 | true | 3007744 Programación orientada a objetos | — |

### Agrupación: Ciencias Naturales y Estadística

| Código | Nombre | Créditos | mandatory | Prerrequisitos | Correquisitos |
|---|---|---|---|---|---|
| 3006929 | Inferencia estadística | 4 | true | 3006934 Probabilidad | — |
| 1000019-M | Física mecánica | 4 | false | 1000004-M Cálculo diferencial | — |
| 1000018-M | Física moderna | 3 | false | 1000006-M Cálculo en varias variables | — |
| 3006829 | Química general | 3 | false | — | — |
| 3006817 | Biología molecular | 4 | false | — | — |
| 3007826 | Termodinámica general | 4 | false | 1000004-M Cálculo diferencial | — |

### Agrupación: Algoritmos y Computación

| Código | Nombre | Créditos | mandatory | Prerrequisitos | Correquisitos |
|---|---|---|---|---|---|
| 3010393 | Introducción a la teoría de la computación | 4 | true | 3010390 Fundamentos de matemáticas discretas; 3007741 Estructura de datos | — |
| 3010392 | Introducción a algoritmos | 4 | true | 3007741 Estructura de datos; 3010390 Fundamentos de matemáticas discretas; 3006934 Probabilidad | — |
| 3008082 | Criptografía y seguridad | 4 | true | 3006934 Probabilidad | — |
| 3006995 | Programación lineal y optimización combinatórica | 4 | false | 1000006-M Cálculo en varias variables; 1000003-M Álgebra lineal; 3010390 Fundamentos de matemáticas discretas | — |
| 3010426 | Teoría de lenguajes de programación | 3 | false | 3010435 Fundamentos de programación; 3010390 Fundamentos de matemáticas discretas | — |
| 3006894 | Introducción al álgebra computacional | 4 | false | 3006993 Grupos y anillos | — |
| 3010590 | Tópicos avanzados en criptografía | 4 | false | 3008082 Criptografía y seguridad | — |
| 3010591 | Tópicos especiales en algoritmos | 4 | false | 3010392 Introducción a algoritmos | — |
| 3011112 | Introducción al programa de Ciencias de la Computación | 2 | false | — | — |

### Agrupación: Computación Científica

| Código | Nombre | Créditos | mandatory | Prerrequisitos | Correquisitos |
|---|---|---|---|---|---|
| 3006886 | Análisis numérico | 4 | true | 3010389 Fundamentos de análisis; 1000005-M Cálculo integral | 1000007-M Ecuaciones diferenciales |
| 3010391 | Geometría aplicada | 4 | true | 1000003-M Álgebra lineal; 1000006-M Cálculo en varias variables | — |
| 3006909 | Programación científica | 4 | false | 1000003-M Álgebra lineal | — |
| 3006888 | Diseño Geométrico Asistido por Computadora | 4 | false | 1000006-M Cálculo en varias variables; 3010391 Geometría aplicada | — |
| 3011075 | Modelamiento matemático | 4 | false | 1000007-M Ecuaciones diferenciales | — |
| 3006884 | Álgebra lineal aplicada | 4 | false | 1000006-M Cálculo en varias variables; 1000003-M Álgebra lineal | — |
| 3006996 | Programación no lineal | 4 | false | 3010389 Fundamentos de análisis; 1000006-M Cálculo en varias variables; 1000003-M Álgebra lineal | — |
| 3010588 | Computación gráfica y visualización científica | 4 | false | 3010391 Geometría aplicada; 3007744 Programación orientada a objetos | — |

### Agrupación: Sistemas de Cómputo

| Código | Nombre | Créditos | mandatory | Prerrequisitos | Correquisitos |
|---|---|---|---|---|---|
| 3007867 | Sistemas operativos | 3 | false | 3010426 Teoría de lenguajes de programación | — |
| 3007865 | Redes y telecomunicaciones I | 3 | false | 3007867 Sistemas operativos | — |
| 3007866 | Redes y telecomunicaciones II | 3 | false | 3007867 Sistemas operativos | — |
| 3007847 | Base de datos I | 3 | false | 3007741 Estructura de datos; 3010390 Fundamentos de matemáticas discretas | — |
| 3007848 | Base de datos II | 3 | false | 3007847 Base de datos I | — |

### Agrupación: Computación Aplicada

| Código | Nombre | Créditos | mandatory | Prerrequisitos | Correquisitos |
|---|---|---|---|---|---|
| 3009754 | Física computacional | 3 | false | 1000019-M Física mecánica | — |
| 3006830 | Bioinformática | 4 | false | 3006817 Biología molecular | — |
| 3006988 | Fundamentos de sistemas de información geográfica | 3 | false | 3010435 Fundamentos de programación | — |
| 3010476 | Introducción a la inteligencia artificial | 3 | false | 3007847 Base de datos I; 3006934 Probabilidad | — |
| 3007854 | Técnicas en aprendizaje estadístico | 3 | false | 3010476 Introducción a la inteligencia artificial | — |
| 3009150 | Redes neuronales artificiales y algoritmos bio-inspirados | 3 | false | 3010476 Introducción a la inteligencia artificial | — |
| 3009151 | Introducción a la robótica | 3 | false | 3010476 Introducción a la inteligencia artificial | — |
| 3010589 | Realidad virtual y aumentada | 4 | false | 3010391 Geometría aplicada; 3007744 Programación orientada a objetos | — |
| 3011063 | Aprendizaje automático | 4 | false | 3006934 Probabilidad; 1000006-M Cálculo en varias variables; 3007744 Programación orientada a objetos | — |
| 3006935 | Procesos estocásticos | 4 | false | 3006934 Probabilidad | — |
| 3006926 | Estadística bayesiana | 4 | false | 3006929 Inferencia estadística | — |
| 3010604 | Introducción a analítica | 4 | false | 3006929 Inferencia estadística | — |

### Agrupación: Trabajo de Grado

| Código | Nombre | Créditos | mandatory | Requisito |
|---|---|---|---|---|
| 3010664 | Trabajo de grado | 8 | true | Haber aprobado 34 créditos (60%) del total de créditos exigidos en el Componente de Formación Disciplinar o Profesional. |

**Nota sobre el requisito de Trabajo de Grado**: la fuente lo expresa como un umbral de créditos aprobados dentro de un componente específico — no como una condición de curso a curso. Se modela únicamente con lo que `RequirementExpression` pueda representar fielmente (créditos mínimos aprobados en el Componente de Formación Disciplinar o Profesional). No se modela ningún requisito administrativo (aprobación de comité, propuesta radicada, director asignado, etc.) porque la fuente suministrada no lo especifica y `RequirementExpression` no tiene forma de representarlo.

**Dato incompleto, explícitamente excluido**: la fuente menciona también `3010665 — Cursos de posgrado` dentro de esta sección, pero el fragmento suministrado no permite determinar con seguridad sus créditos, obligatoriedad ni requisitos. **No se transcribe como `VersionCourse`** en el dataset — queda como dato pendiente, no inventado.

---

## Trazabilidad

- **Fuente normativa**: Acuerdo 0018 de 2024, Ciencias de la Computación, Universidad Nacional de Colombia, Sede Medellín. Es la única autoridad; este documento no la sustituye.
- **Naturaleza de este documento**: transcripción curada, no oficial por sí misma, preparada para uso interno del dataset de Sidera.
- **Cobertura**: componentes, agrupaciones y materias tal como fueron suministrados para esta iteración. No incluye el Componente de Libre Elección a nivel de materias (sin agrupación declarada), ni `3010665 Cursos de posgrado` (datos insuficientes).
- **Exclusión explícita**: no se ha usado la "Propuesta de Malla Curricular Ciencias de la Computación" para completar ningún dato de este documento.
