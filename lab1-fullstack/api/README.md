# Lab 1 — Fullstack en Contenedores

> **Módulo:** Introducción a Docker  
> **Objetivo:** Construir, analizar y ejecutar una imagen Docker de producción para una API REST Node.js, aplicando buenas prácticas desde el primer día.

---

## Qué vas a aprender

- Escribir un `Dockerfile` multi-stage para reducir el tamaño de la imagen final
- Ejecutar el proceso como usuario **no-root** dentro del contenedor
- Configurar un **HEALTHCHECK** nativo de Docker
- Mapear puertos y pasar variables de entorno en tiempo de ejecución
- Probar una API REST containerizada con `curl`

---

## Estructura del proyecto

```
lab1-fullstack/
├── api/
│   ├── Dockerfile      ← imagen de producción (lo que estudiaremos)
│   ├── index.js        ← API REST Express (CRUD de productos)
│   └── package.json
└── frontend/           ← se completa en labs posteriores
```

---

## La API

Servidor Express con una base de datos simulada en memoria que expone cinco endpoints:

| Método   | Ruta                  | Descripción              |
|----------|-----------------------|--------------------------|
| `GET`    | `/api/hello`          | Health check / info del pod |
| `GET`    | `/api/products`       | Listar todos los productos |
| `GET`    | `/api/products/:id`   | Obtener un producto por ID |
| `POST`   | `/api/products`       | Crear un producto        |
| `PUT`    | `/api/products/:id`   | Actualizar un producto   |
| `DELETE` | `/api/products/:id`   | Eliminar un producto     |

---

## El Dockerfile — análisis línea a línea

```dockerfile
# ── Stage 1: instalar dependencias ──────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
```

**Multi-stage build** — este primer stage se llama `deps` y su único trabajo es instalar dependencias con `npm ci` (reproducible, sin extras de desarrollo). La imagen de este stage **no llega al usuario final**.

> **¿A dónde copia `COPY package*.json ./`?**  
> Al directorio `/app` — porque `WORKDIR /app` ya está activo y hace que `.` sea sinónimo de `/app`. El glob `package*.json` captura de un golpe tanto `package.json` como `package-lock.json`.
>
> **¿Por qué copiar solo estos dos archivos antes que el resto del código?**  
> Por el sistema de **caché de capas** de Docker: si `package.json` no cambió entre builds, Docker reutiliza la capa del `npm ci` sin reinstalar nada. Solo cuando modificas dependencias se vuelve a correr esa instalación (que puede ser lenta). Si copiaras todo el código primero, cualquier cambio en un `.js` invalidaría la caché y forzaría una reinstalación innecesaria.
>
> **¿Qué diferencia hay entre `npm install` (local) y `npm ci --only=production` (Docker)?**  
> Son dos diferencias combinadas:
>
> | | `npm install` (local) | `npm ci --only=production` (Docker) |
> |---|---|---|
> | Versiones | Resuelve dentro del rango `^` de `package.json` | Usa **exactamente** lo que dice `package-lock.json` |
> | Si hay diferencias | Actualiza `package-lock.json` | **Falla** — garantiza reproducibilidad |
> | `node_modules` previo | Lo reutiliza | Lo borra y reinstala desde cero |
> | devDependencies | ✅ Instala (nodemon, jest, eslint…) | ❌ No instala — solo las de producción |
>
> En local necesitas todo para desarrollar. En la imagen Docker solo entra lo que la app necesita para correr — mismo resultado en tu máquina, en CI y en producción.

```dockerfile
# ── Stage 2: imagen final mínima ────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app
```

Empezamos desde cero con `node:20-alpine` (~50 MB vs ~900 MB de la imagen oficial). Todo lo del stage anterior queda descartado.

```dockerfile
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN chown -R appuser:appgroup /app
```

- `addgroup` / `adduser -S` → crea un usuario del sistema **sin contraseña ni home**, el mínimo privilegio posible.
- `COPY --from=deps` → trae solo los `node_modules` del stage anterior, no el toolchain completo.
- `chown` → el usuario `appuser` necesita ser dueño de los archivos antes de cambiar de contexto.

```dockerfile
USER appuser
EXPOSE 3000
```

- `USER appuser` → a partir de aquí **ninguna instrucción ni proceso del contenedor corre como root**.
- `EXPOSE 3000` → declaración documental; el puerto real se mapea al lanzar el contenedor con `-p`.

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s \
  CMD wget -qO- http://localhost:3000/api/hello || exit 1

CMD ["node", "index.js"]
```

- `HEALTHCHECK` → Docker sondeará `/api/hello` cada 30 segundos. Si falla, el contenedor pasa a estado `unhealthy`. Kubernetes también puede leer este estado.
- `CMD` en forma de array (exec form) → evita envoltura con `sh -c`, las señales del SO (SIGTERM) llegan directamente al proceso Node.

---

## Manos a la obra

### 1. Construir la imagen

```bash
cd lab1-fullstack/api
docker build -t lab1-api:v1 .
```

Observa en el output cómo Docker ejecuta los dos stages por separado.

### 2. Verificar tamaño de la imagen

```bash
docker images lab1-api
```

Compara con la imagen base `node:20` (sin alpine) para ver el impacto del multi-stage.

### 3. Ejecutar el contenedor

```bash
docker run -d \
  --name lab1-api \
  -p 3000:3000 \
  -e NODE_ENV=production \
  lab1-api:v1
```

| Flag | Qué hace |
|------|----------|
| `-d` | Corre en segundo plano (detached) |
| `--name` | Nombre legible para el contenedor |
| `-p 3000:3000` | Mapea puerto del host → contenedor |
| `-e NODE_ENV=production` | Inyecta variable de entorno |

### 4. Probar los endpoints

```bash
# Health check
curl http://localhost:3000/api/hello

# Listar productos
curl http://localhost:3000/api/products

# Crear un producto
curl -s -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Webcam HD","price":75.00,"stock":10}' | jq

# Actualizar
curl -s -X PUT http://localhost:3000/api/products/1 \
  -H "Content-Type: application/json" \
  -d '{"price":79.99}' | jq

# Eliminar
curl -s -X DELETE http://localhost:3000/api/products/2 | jq
```

### 5. Inspeccionar el contenedor

```bash
# Ver logs en tiempo real
docker logs -f lab1-api

# Verificar que corre como non-root
docker exec lab1-api whoami

# Revisar el estado del healthcheck
docker inspect --format='{{.State.Health.Status}}' lab1-api

# Ver variables de entorno activas
docker exec lab1-api env
```

### 6. Limpiar

```bash
docker stop lab1-api && docker rm lab1-api
```

---

## Conceptos clave

| Concepto | Por qué importa |
|----------|----------------|
| **Multi-stage build** | Separa el entorno de build del de runtime → imagen más pequeña y sin herramientas innecesarias |
| **Alpine base image** | ~50 MB vs ~900 MB; menos superficie de ataque |
| **Non-root user** | Si el contenedor es comprometido, el atacante no tiene privilegios de root en el host |
| **`npm ci`** | Instalación reproducible basada exactamente en `package-lock.json` |
| **Exec form en CMD** | Las señales Unix (SIGTERM para graceful shutdown) llegan directamente a Node |
| **HEALTHCHECK** | Docker y Kubernetes pueden reiniciar el contenedor automáticamente si la app no responde |

---

## Para profundizar

- `docker history lab1-api:v1` — ver las capas de la imagen y su tamaño
- `docker scout cves lab1-api:v1` — escanear vulnerabilidades conocidas
- Agrega un `docker-compose.yml` para levantar api + frontend juntos (próximo lab)

---

## Próximo lab

En el **Lab 2** desplegaremos esta misma imagen en un cluster Kubernetes local con `kind`, creando un `Deployment` y un `Service` para exponer la API.
