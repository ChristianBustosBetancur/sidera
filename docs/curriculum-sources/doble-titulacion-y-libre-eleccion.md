# Doble Titulación y Libre Elección — marco normativo y límites del modelo

Este documento fija qué representa Sidera y qué no, para que nadie confunda una
estimación de la aplicación con un acto administrativo de la Universidad.

## Estado de verificación de las fuentes

| Fuente | Estado |
|---|---|
| Acuerdo 155 de 2014 del CSU (Doble Titulación), arts. 2, 3 y 6 | **Aportado por el usuario. No verificado directamente**: el portal `legal.unal.edu.co` exige reCAPTCHA y no se puede leer con herramientas automáticas. |
| Acuerdo 038 de 2020 (Matemáticas) | Transcrito en `packages/curriculum-snapshot`. El PDF no está en el repositorio. |
| Acuerdo 0018 de 2024 (Computación) | Transcrito en `docs/curriculum-sources/acuerdo-0018-2024-materias.md`. |
| Resolución 13 de 2020 | **No verificada.** Ninguna regla implementada depende de ella. |
| Acuerdo 008 de 2008 (Estatuto Estudiantil) | **No verificado.** Su artículo 46 trata de reingresos y **no** sustenta el traslado de excedentes. |
| Traslado de excedentes a Libre Elección | Descrito en guías de facultad y en la evaluación de la Reforma Académica de 2007. **Mecanismo plausible, no confirmado en el articulado.** |

Mientras una fuente siga sin verificar, lo que Sidera muestre a partir de ella
se rotula como estimación.

## Las tres cosas que nunca deben confundirse

**1. Cálculo interno de excedentes hacia Libre Elección.** Es aritmética de
Sidera dentro de un plan: los créditos optativos que una agrupación ya no puede
reconocer —su cupo es `requeridos − obligatorias`— se acumulan en el componente
de Libre Elección. Es determinista y reproducible, y no consulta a nadie.

**2. Simulación del cumplimiento curricular del segundo programa.** Con Doble
Titulación activa, Sidera evalúa el plan simulado con sus propios requisitos y
créditos. Sirve para explorar una trayectoria, no para acreditarla.

**3. Reconocimiento oficial para Doble Titulación.** Según el Acuerdo 155 de
2014, el comité asesor del segundo programa estudia equivalencias y
convalidaciones y determina los créditos pendientes por componente y
agrupación. **Sidera no hace eso ni lo anticipa.**

Compartir un código de asignatura no es una homologación. Tener un excedente no
es un crédito reconocido. Una simulación no es un cumplimiento.

## Qué garantiza la implementación

- Las correspondencias compartidas exigen identidad de código **y** de créditos
  en ambos catálogos; nunca se sincroniza por semejanza de nombres.
- Los créditos se evalúan con el contexto independiente de cada plan: una misma
  asignatura puede cubrir cupo en un programa y ser excedente en el otro.
- Ningún crédito se cuenta dos veces dentro de un plan: la identidad
  `bruto = reconocido + excedente` se mantiene por construcción.
- Las materias En curso alimentan solo la proyección, nunca lo aprobado.
- En un plan simulado, una matrícula real de la carrera de origen se conserva y
  se advierte; no se convierte en disponibilidad académica.

## Dónde la interfaz podría inducir a confusión

Revisado y anotado, para que se vigile en futuras iteraciones:

1. **La barra de Libre Elección parece un avance acreditado.** Se mitiga con la
   etiqueta «Estimado» y la nota junto a la barra. Riesgo residual: alguien
   puede leer «4 / 28 créditos» como créditos ya reconocidos.
2. **«Doble Titulación · Vinculada» puede leerse como inscripción formal.** Es
   seguimiento personal; la inscripción al programa es un trámite aparte que
   Sidera no realiza ni refleja.
3. **El desglose nombra la agrupación de origen**, lo que podría sugerir que la
   asignatura cambió de tipología. No cambia: conserva su agrupación y su
   carácter de optativa; solo sus créditos sobrantes se contabilizan aparte.
4. **La proyección de Libre Elección en el plan simulado** depende de una
   matrícula que existe en la otra carrera. Es condicional por partida doble:
   por estar en curso y por pertenecer a un plan simulado.

## Fuera de alcance deliberado

Sidera no modela materias de Libre Elección, no registra externas, no hace
equivalencias entre códigos distintos y no representa trámites administrativos.
Si en el futuro se incorpora el dictamen de un comité asesor, deberá entrar como
un dato propio y distinguible de esta estimación, nunca sustituyéndola en
silencio.
