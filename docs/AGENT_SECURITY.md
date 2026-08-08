# AGENT_SECURITY.md — Seguridad operativa para agentes

## Reglas para agentes (Claude y Codex)

- No usar credenciales de producción en agentes, bajo ninguna circunstancia.
- No guardar secretos (API keys, tokens, contraseñas, connection strings) en el repositorio, ni en código ni en archivos de configuración versionados.
- No ejecutar acciones destructivas automáticas (borrado de datos, drop de tablas, force push, etc.) sin aprobación humana explícita.
- No desplegar automáticamente a ningún entorno.

## Principios

- **Mínimo privilegio**: cada agente y cada credencial debe tener solo el acceso estrictamente necesario para la tarea activa.
- **Separación desarrollo/producción**: los entornos de desarrollo y producción deben mantenerse aislados; nunca se prueban cambios directamente contra producción.
- **Revisión humana**: toda acción de alto impacto (migraciones, publicación de versiones curriculares, cambios de infraestructura, despliegues) requiere revisión y aprobación humana explícita antes de ejecutarse.

## Nota

Este documento define principios generales. Configuración concreta de seguridad (roles, políticas de acceso a Supabase, manejo de variables de entorno) se define en tareas posteriores.
