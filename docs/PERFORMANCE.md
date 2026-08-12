# PERFORMANCE.md — Rendimiento

## Dispositivo de referencia

Samsung J6 Prime (o equivalente: gama baja, RAM limitada, GPU débil) es el criterio real de aceptación de rendimiento. Si una función no funciona razonablemente bien en ese dispositivo, no cumple el estándar de rendimiento del producto.

## Modo rendimiento

Debe existir un modo pensado explícitamente para hardware limitado, que desactive o simplifique efectos visuales costosos manteniendo la funcionalidad académica completa.

## Reglas

- El 3D es opcional y se carga solo como mejora progresiva; nunca bloquea la carga ni el uso funcional de la app.
- El JavaScript inicial debe mantenerse limitado; funcionalidad no esencial se carga de forma diferida (lazy loading).
- Evitar efectos visuales permanentes/continuos (animaciones en loop, partículas constantes) que consuman batería o CPU sin aportar valor funcional.
- La navegación y los cálculos curriculares (progreso, desbloqueos, prerrequisitos) deben ejecutarse localmente en el dispositivo y ser rápidos incluso sin conexión de red rápida.

## Decisiones vigentes que afectan al rendimiento

Estas son decisiones tomadas, no mediciones. Los presupuestos medibles siguen pendientes.

- La navegación global —barra lateral, panel lateral táctil y su colapso— se resuelve con React y CSS, sin dependencias externas de interfaz.
- La barra de contexto permanece visible mediante `position: sticky`, sin escuchar eventos de desplazamiento.
- Los filtros de Trayectoria Curricular no eliminan nodos del DOM ni recalculan el layout del plan: solo cambian la presentación, de modo que filtrar no dispara un reflujo de la estructura.
- Los destinos directos de las materias encontradas se derivan recorriendo una sola vez las relaciones ya existentes, sin recorridos transitivos.
- La búsqueda y su lista de sugerencias se resuelven localmente sobre el plan cargado, sin librería externa ni peticiones de red.
- El desplazamiento táctil conserva el comportamiento nativo; el arrastre del lienzo solo se captura con puntero fino.
- Se evitan las animaciones continuas: los cambios de estado visual se aplican de forma inmediata en lugar de interpolarse.

## Pendiente futuro

Definir presupuestos de rendimiento medibles (tamaño de bundle, tiempo de interactividad, FPS mínimo en modo rendimiento, etc.) en una tarea posterior. No se definen en este documento.
