# Kubernetes Ninja

Repositorio de laboratorios prácticos para aprender desde Docker hasta Kubernetes. Cada lab construye sobre el anterior, aumentando gradualmente la complejidad de orquestación.

---

## Laboratorios

| # | Nombre | Descripción | Stack | Orquestación | Estado |
|---|--------|-------------|-------|--------------|--------|
| 1 | [Fullstack Containerizado](./lab1-fullstack/) | API REST + frontend React corriendo en contenedores con red interna, healthchecks y arranque ordenado | Node.js · React · Nginx | Docker Compose | ✅ Listo |

---

## Prerrequisitos globales

- [Docker](https://docs.docker.com/get-docker/) ≥ 24
- [Docker Compose](https://docs.docker.com/compose/) ≥ 2 (incluido en Docker Desktop)

Cada lab puede tener prerrequisitos adicionales documentados en su propio `README.md`.

---

## Cómo usar este repositorio

Cada laboratorio es independiente y vive en su propio directorio. Para ejecutar un lab entra a su carpeta y sigue las instrucciones de su `README.md`.

```bash
# Ejemplo — Lab 1
cd lab1-fullstack
docker compose up --build
```

---

## Estructura del repositorio

```
kubernetes-ninja/
├── README.md               ← estás aquí
└── lab1-fullstack/         ← Lab 1: Docker Compose fullstack
    ├── docker-compose.yml
    ├── api/                ← Backend Node.js/Express
    └── frontend/           ← Frontend React + Nginx
```

---

## Hoja de ruta

| Lab | Tema | Descripción |
|-----|------|-------------|
| 2 | Kubernetes básico | Desplegar el stack del Lab 1 con `Deployment` + `Service` + `Ingress` |
| 3 | ConfigMaps y Secrets | Gestión de configuración y credenciales en Kubernetes |
| 4 | Persistent Volumes | Datos persistentes con `PVC` y `StorageClass` |
| 5 | Helm | Empaquetar el stack como un chart de Helm |
| 6 | CI/CD | Pipeline de build → push → deploy automático |
