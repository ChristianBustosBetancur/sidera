# Funcionalidades futuras

Ideas registradas para no perderlas. **Ninguna está definida ni aprobada**, y
nada del código actual depende de ellas. Cuando alguna se aborde, necesitará su
propio diagnóstico, su contrato y su aprobación.

## Buscador de asignaturas de Libre Elección

Hoy una asignatura de Libre Elección se registra a mano. En el futuro podría
elegirse de un catálogo.

El modelo ya está preparado para ello: un registro tiene identificador propio y
estable, independiente del código académico —que es opcional—, y lleva un campo
`origin` cuyo único valor actual es `"manual"`. Una asignatura elegida de un
buscador entraría como un `origin` nuevo por el mismo camino de registro,
persistencia y cálculo, sin rehacer nada.

Fuera de alcance mientras tanto: validar contra catálogos oficiales, integrar
servicios externos y homologar códigos entre programas.

## Vista general combinada de dos programas

Explorar una visualización que permita entender conjuntamente el avance de
Ciencias de la Computación y Matemáticas cuando se usa Doble Titulación.

**Su comportamiento, sus reglas y su diseño están sin definir.** Queda anotada
únicamente como idea. En particular, habría que decidir antes qué significa
«avance conjunto» cuando cada plan tiene sus propios créditos, requisitos y
componente de Libre Elección, y cómo se presentaría sin sugerir un
reconocimiento institucional que Sidera no puede afirmar —ver
`docs/curriculum-sources/doble-titulacion-y-libre-eleccion.md`—.

No se ha introducido ninguna dependencia técnica para ella.
