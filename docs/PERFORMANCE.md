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

## Pendiente futuro

Definir presupuestos de rendimiento medibles (tamaño de bundle, tiempo de interactividad, FPS mínimo en modo rendimiento, etc.) en una tarea posterior. No se definen en este documento.
