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

El contenedor `postgres-lab` del Lab 0.1 debe estar activo:

```bash
docker ps | grep postgres-lab
# Si no está corriendo, levántalo:
docker run -d \
  --name postgres-lab \
  -e POSTGRES_DB=labdb \
  -e POSTGRES_USER=admin \
  -e POSTGRES_PASSWORD=ninja123 \
  -e PGDATA=/var/lib/postgresql/data/pgdata \
  -v postgres-data:/var/lib/postgresql/data \
  -p 5432:5432 \
  postgres:16-alpine
```

La clave es `-p 5432:5432` — expone la BD al host para que los Pods de K8s puedan alcanzarla.

---

## Step 1 — Construir la imagen de la API

```bash
cd section01-docker/lab2-springboot-postgre-compose/products-api
docker build -t lab2-6-products-api:1.0 .
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
