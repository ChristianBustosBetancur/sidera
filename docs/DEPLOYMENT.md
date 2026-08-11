# DEPLOYMENT.md — Entornos y despliegues

## Producción

La rama `main` corresponde a producción. Incorporar cambios a `main` requiere una decisión humana explícita; ningún despliegue de vista previa autoriza ni implica ese merge.

## Vercel Preview

Mientras esté en curso la fase de visualización curricular, `feat/curriculum-visualization` es la rama usada para Vercel Preview Deployments.

Vercel genera automáticamente un Preview Deployment al recibir un push a esta rama o al abrir un pull request hacia `main`, según la configuración que el responsable humano establezca en el proyecto de Vercel. Este documento registra el propósito de las ramas, pero no prescribe esa configuración externa.

La aplicación muestra el badge **Sidera Preview · En desarrollo**, incorporado en TASK-006.2, como señal visual de que la build desplegada no corresponde a producción.

Un Preview Deployment sirve únicamente para revisar cambios. No dispara ni implica un merge a `main`: el merge a producción es una acción humana explícita, separada del despliegue de vista previa.

## Responsabilidad de configuración

La configuración del proyecto y de los Preview Deployments se realiza por una persona responsable directamente en Vercel. Este repositorio no incorpora para este fin `vercel.json`, variables de entorno ni workflows nuevos de CI/CD.

## Estado de la conexión

El proyecto ya está conectado a Vercel. Cada push a `feat/curriculum-visualization` genera un Preview Deployment; `main` permanece como rama de producción.
