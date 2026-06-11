# Lab 2-6 — Secrets: Spring Boot API conectada a PostgreSQL externo

Despliega la Spring Boot Products API en Kubernetes conectándola a la base de datos
PostgreSQL del Lab 0.1 — que corre en Docker en tu máquina, fuera del clúster.

Aprenderás a usar **Kubernetes Secrets** para manejar credenciales de forma segura.

## Arquitectura

```
Tu máquina (host)
│
├── Docker: postgres-lab (puerto 5432)   ← BD externa, NO es un Pod de K8s
│     database: labdb / user: admin
│
└── Kubernetes (Docker Desktop)
      │
      ├── Secret: db-secret
      │     DB_USER / DB_PASSWORD / DB_NAME
      │
      ├── products-api Deployment (3 réplicas)
      │     cada Pod lee las credenciales del Secret
      │     conecta a host.docker.internal:5432
      │
      └── products-api-svc (NodePort 30092)
            accesible desde tu máquina en localhost:30092
```

**¿Por qué `host.docker.internal`?**
Los Pods de K8s (en Docker Desktop) corren dentro de una VM. Para llegar a un
proceso en tu Mac usan el nombre DNS especial `host.docker.internal`, que Docker
Desktop resuelve automáticamente a la IP del host.

---

## Archivos

```
k8s/
  secret.yaml          ← Secret con DB_USER, DB_PASSWORD, DB_NAME (base64)
  api-deployment.yaml  ← Deployment 3 réplicas + NodePort Service 30092
```

El código fuente de la API está en:
`section01-docker/lab2-springboot-postgre-compose/products-api/`

---

## Pre-requisito — PostgreSQL corriendo en Docker

Verifica el estado del contenedor `postgres-lab` del Lab 0.1:

```bash
docker ps -a | grep postgres-lab
```

**Caso 1 — Está corriendo** (STATUS "Up"): no hay que hacer nada, continúa al Step 1.

**Caso 2 — Existe pero está detenido** (STATUS "Exited"): si intentas `docker run`
verás este error:

```
Error: Conflict. The container name "/postgres-lab" is already in use...
You have to remove (or rename) that container to be able to reuse that name.
```

Solución — no uses `docker run`, solo arráncalo:

```bash
docker start postgres-lab
docker exec postgres-lab pg_isready -U admin -d labdb
# localhost:5432 - accepting connections
```

**Caso 2b — Puerto 5432 ya ocupado**: si `docker start` falla con:

```
Bind for 0.0.0.0:5432 failed: port is already allocated
```

Otro contenedor del curso tiene el puerto. Búscalo y páralo primero:

```bash
docker ps | grep 5432
# lab2-postgres   postgres:16-alpine   0.0.0.0:5432->5432/tcp

docker stop lab2-postgres
docker start postgres-lab
docker exec postgres-lab pg_isready -U admin -d labdb
# localhost:5432 - accepting connections
```

**Caso 3 — No existe**: créalo desde cero. Incluye **todos** los flags — si faltan
las variables de entorno PostgreSQL no puede inicializarse:

```bash
docker run -d \
  --name postgres-lab \
  -e POSTGRES_DB=labdb \
  -e POSTGRES_USER=admin \
  -e POSTGRES_PASSWORD=ninja123 \
  -e PGDATA=/var/lib/postgresql/data/pgdata \
  -v postgres-data:/var/lib/postgresql/data \
  -p 5432:5432 \
  postgres:16-alpine

# Esperar ~5s y verificar
docker exec postgres-lab pg_isready -U admin -d labdb
# localhost:5432 - accepting connections
```

La clave es `-p 5432:5432` — expone la BD al host para que los Pods de K8s puedan alcanzarla.

---

## Step 1 — Construir la imagen de la API

El código está en `api/` dentro de este lab. El `application.properties` fue
actualizado para leer variables de entorno **sin defaults** — si el Secret no
está montado, la app falla al arrancar (CrashLoopBackOff), señal clara de que
falta configuración.

```bash
cd section02-kubernetes-intro/lab-2-6-secrets-springboot
docker build -t lab2-6-products-api:1.0 ./api
# (tarda ~2 min la primera vez — descarga dependencias Maven)

docker images | grep lab2-6-products-api
# lab2-6-products-api   1.0   ...
```

---

## Step 2 — Crear el Secret

```bash
kubectl apply -f k8s/secret.yaml
# secret/db-secret created

# Ver que existe (los valores aparecen como [concealed])
kubectl get secret db-secret
# NAME        TYPE     DATA   AGE
# db-secret   Opaque   3      5s

# Inspeccionar (muestra base64, NO texto plano)
kubectl describe secret db-secret
# DB_NAME:     6 bytes
# DB_PASSWORD: 8 bytes
# DB_USER:     5 bytes

# Para decodificar un valor:
kubectl get secret db-secret -o jsonpath='{.data.DB_USER}' | base64 -d
# admin
```

---

## Step 3 — Desplegar la API

```bash
kubectl apply -f k8s/api-deployment.yaml
# deployment.apps/products-api created
# service/products-api-svc created

# Ver los 3 pods (pueden tardar ~30s en Ready — Spring Boot arranca)
kubectl get pods -l app=products-api
# NAME                            READY   STATUS    RESTARTS   AGE
# products-api-xxxx-aaaaa         1/1     Running   0          35s
# products-api-xxxx-bbbbb         1/1     Running   0          35s
# products-api-xxxx-ccccc         1/1     Running   0          35s
```

---

## Troubleshooting — CrashLoopBackOff

Si los pods arrancaron antes de que la BD estuviera lista, Spring Boot no puede
conectar y K8s los deja en `CrashLoopBackOff`:

```bash
kubectl get pods -l app=products-api
# products-api-xxxx-aaaaa   0/1   CrashLoopBackOff   5 (2m ago)   6m
```

Primero confirma que la BD acepta conexiones, luego reinicia el Deployment:

```bash
docker exec postgres-lab pg_isready -U admin -d labdb
# localhost:5432 - accepting connections

kubectl rollout restart deployment/products-api
kubectl get pods -l app=products-api -w
# products-api-yyyy-aaaaa   1/1   Running   0   15s  ← pods nuevos, sin errores
```

> **La lección:** `CrashLoopBackOff` no significa que K8s está roto — es K8s
> diciéndote que la app no puede arrancar. Los logs dan el motivo exacto:
> `kubectl logs <nombre-del-pod>`

---

## Step 4 — Verificar logs de conexión a la BD

```bash
# Ver logs de uno de los pods
kubectl logs -l app=products-api --tail=30

# Buscar la línea de conexión exitosa:
# HikariPool-1 - Start completed.
# Tomcat started on port 8080
```

---

## Step 5 — Probar los endpoints con curl

```bash
# Health check
curl http://localhost:30092/api/products/health
# {"status":"UP","products":"3"}

# Listar productos
curl http://localhost:30092/api/products
# {"data":[{"id":1,"name":"Teclado Mecánico Cherry MX",...}],"total":3}

# Crear un producto
curl -X POST http://localhost:30092/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Webcam 4K","price":129.99,"stock":10,"description":"USB-C, 4K 30fps"}'
# {"id":4,"name":"Webcam 4K",...}

# Verificar que se guardó en la BD
curl http://localhost:30092/api/products
# ahora total: 4

# Las 3 réplicas comparten la misma BD — crear desde un pod, leer desde otro
# K8s balancea las peticiones entre los 3 pods automáticamente
```

---

## Step 6 — Verificar que los 3 pods usan el mismo Secret

```bash
# Ver las variables de entorno de un Pod (las del Secret aparecen resueltas)
kubectl exec -it $(kubectl get pod -l app=products-api -o name | head -1) \
  -- env | grep DB_
# DB_HOST=host.docker.internal
# DB_PORT=5432
# DB_USER=admin         ← resuelto desde el Secret
# DB_PASSWORD=ninja123  ← resuelto desde el Secret
# DB_NAME=labdb         ← resuelto desde el Secret
```

---

## Step 7 — Limpiar

```bash
kubectl delete -f k8s/api-deployment.yaml
kubectl delete -f k8s/secret.yaml

kubectl get pods    # sin pods de products-api
kubectl get secrets # db-secret eliminado
```

---

## Tabla de conceptos

| Concepto | Descripción |
|----------|-------------|
| `Secret` | Objeto K8s para datos sensibles (base64, no cifrado por defecto) |
| `secretKeyRef` | Inyecta el valor de un Secret como variable de entorno en el Pod |
| `host.docker.internal` | DNS especial para alcanzar el host desde dentro de K8s (Docker Desktop) |
| `imagePullPolicy: Never` | Usa la imagen Docker local sin buscar en Docker Hub |
| BD externa al clúster | Simula una BD en VM de producción — el clúster K8s no la gestiona |
