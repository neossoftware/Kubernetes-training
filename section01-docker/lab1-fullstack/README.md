# Lab 1 — Fullstack Containerizado

> **Módulo:** Introducción a Docker  
> **Objetivo:** Orquestar dos contenedores (API + Frontend) con Docker Compose, entendiendo redes internas, dependencias entre servicios y healthchecks.

---

## Arquitectura del lab

```
┌─────────────────────────────────────────────────┐
│               Red: lab1-net (bridge)             │
│                                                  │
│   ┌──────────────────┐   ┌──────────────────┐   │
│   │   lab1-frontend  │   │    lab1-api       │   │
│   │   nginx:alpine   │   │   node:alpine     │   │
│   │   puerto 80      │──▶│   puerto 3000     │   │
│   └──────────────────┘   └──────────────────┘   │
│           │                                      │
└───────────┼──────────────────────────────────────┘
            │
     Host: localhost
      :8081 (frontend)
      :3000 (api)
```

Los dos contenedores viven en la misma red virtual `lab1-net`. Desde dentro de esa red se hablan por nombre de servicio (`api`, `frontend`), sin exponer puertos innecesarios al exterior.

---

## Estructura del proyecto

```
lab1-fullstack/
├── docker-compose.yml   ← orquestación de los dos servicios
├── api/
│   ├── Dockerfile       ← imagen Node.js multi-stage
│   ├── index.js
│   └── README.md        ← documentación de la API
└── frontend/
    ├── Dockerfile       ← imagen React + Nginx multi-stage
    ├── nginx.conf
    ├── src/
    └── README.md        ← documentación del Frontend
```

---

## docker-compose.yml — análisis línea a línea

### Servicio `api`

```yaml
api:
  build:
    context: ./api
    dockerfile: Dockerfile
  container_name: lab1-api
  environment:
    NODE_ENV: production
    PORT: 3000
  ports:
    - "3000:3000"
  networks:
    - lab1-net
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/hello"]
    interval: 30s
    timeout: 5s
    retries: 3
    start_period: 10s
```

| Campo | Qué hace |
|---|---|
| `build.context` | Le dice a Docker dónde está el código fuente para construir la imagen |
| `container_name` | Nombre fijo del contenedor (en vez del nombre aleatorio que asigna Docker) |
| `environment` | Variables de entorno inyectadas en el contenedor al arrancar |
| `ports` | Mapeo `host:contenedor` — expone el puerto 3000 al exterior |
| `networks` | Conecta el contenedor a la red `lab1-net` |
| `restart: unless-stopped` | Docker reinicia el contenedor si se cae, a menos que lo hayas detenido tú manualmente |

**El `healthcheck`:**

```yaml
healthcheck:
  test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/hello"]
  interval: 30s      ← cada cuánto sondea
  timeout: 5s        ← tiempo máximo de respuesta
  retries: 3         ← intentos antes de marcar unhealthy
  start_period: 10s  ← tiempo de gracia al arrancar (no cuenta como fallo)
```

Docker ejecuta ese `wget` periódicamente. Si falla 3 veces seguidas, el contenedor pasa a estado `unhealthy`. El servicio `frontend` depende de que este healthcheck pase antes de arrancar.

---

### Servicio `frontend`

```yaml
frontend:
  build:
    context: ./frontend
    dockerfile: Dockerfile
    args:
      VITE_API_URL: http://localhost:3000
  container_name: lab1-frontend
  ports:
    - "8081:80"
  networks:
    - lab1-net
  depends_on:
    api:
      condition: service_healthy
  restart: unless-stopped
```

| Campo | Qué hace |
|---|---|
| `build.args` | Pasa `VITE_API_URL` al `Dockerfile` en tiempo de build (se incrusta en el JS compilado) |
| `ports: "8081:80"` | El frontend queda disponible en `http://localhost:8081` |
| `depends_on` | Docker Compose no arranca el frontend hasta que la API esté `healthy` |

> **`condition: service_healthy`** es más estricto que `depends_on` simple.  
> Sin `condition`, Docker Compose solo espera a que el contenedor de la API *arranque* — no a que la app dentro esté lista para recibir peticiones. Con `service_healthy` espera a que el healthcheck pase.

---

### Red: `lab1-net`

```yaml
networks:
  lab1-net:
    driver: bridge
```

Una red **bridge** es una red virtual privada dentro del host. Los contenedores conectados a ella:

- Se ven entre sí por nombre de servicio (`api`, `frontend`) como si fueran hostnames
- Están **aislados** del resto de contenedores del sistema que no estén en esta red
- Solo los puertos declarados en `ports:` quedan expuestos al host

> **¿Por qué no usar la red por defecto de Docker?**  
> La red `default` de Docker no tiene resolución DNS por nombre de servicio. Con una red nombrada (`lab1-net`) puedes hacer `curl http://api:3000` desde el contenedor frontend sin conocer la IP.

---

## Manos a la obra

### 1. Construir y levantar todo

```bash
cd lab1-fullstack
docker compose up --build
```

`--build` fuerza la reconstrucción de las imágenes aunque ya existan. Útil cuando cambiaste el código.

Para correr en segundo plano:

```bash
docker compose up --build -d
```

### 2. Ver el estado de los servicios

```bash
docker compose ps
```

Espera ver ambos en estado `running (healthy)` / `running`:

```
NAME             STATUS                   PORTS
lab1-api         Up X seconds (healthy)   0.0.0.0:3000->3000/tcp
lab1-frontend    Up X seconds             0.0.0.0:8081->80/tcp
```

### 3. Probar

| URL | Qué abre |
|---|---|
| `http://localhost:8081` | Interfaz React (frontend) |
| `http://localhost:3000/api/hello` | Health check de la API |
| `http://localhost:3000/api/products` | API directa (JSON) |

### 4. Ver logs

```bash
# Todos los servicios juntos
docker compose logs -f

# Solo la API
docker compose logs -f api

# Solo el frontend
docker compose logs -f frontend
```

### 5. Verificar la red interna

Desde el contenedor frontend, comprobar que puede hablar con la API por nombre:

```bash
docker exec lab1-frontend wget -qO- http://api:3000/api/hello
```

Este comando funciona porque ambos contenedores están en `lab1-net` y Docker resuelve `api` al IP interno del contenedor de la API.

### 6. Detener

```bash
# Detiene y elimina los contenedores (las imágenes se conservan)
docker compose down

# Detiene, elimina contenedores Y borra las imágenes construidas
docker compose down --rmi local
```

---

## Rebuilds parciales

Si solo modificas la API, no necesitas reconstruir el frontend:

```bash
docker compose up --build api
```

Docker Compose reconstruye solo el servicio indicado y reinicia los que dependían de él.

---

## Conceptos clave

| Concepto | Por qué importa |
|---|---|
| **`depends_on` + `service_healthy`** | Garantiza orden de arranque real, no solo que el proceso exista |
| **Red bridge nombrada** | Permite DNS por nombre de servicio entre contenedores |
| **`build.args`** | Única forma de pasar variables a Vite en build time desde Compose |
| **`restart: unless-stopped`** | Comportamiento similar a un servicio del sistema operativo |
| **`container_name` fijo** | Facilita `docker exec` y `docker logs` sin buscar el ID |

---

## Próximo lab

En el **Lab 2** desplegaremos este mismo stack en Kubernetes: la API y el Frontend se convertirán en `Deployments`, y usaremos `Services` para la comunicación interna y `Ingress` para exponerlos al exterior.
