# Lab 3-2 — Microservicios en Kubernetes: React + Spring Boot × 2 + PostgreSQL externo

Despliega una arquitectura real de tres capas con Ingress como punto único de entrada: frontend React, dos microservicios Spring Boot independientes y PostgreSQL corriendo en Docker fuera del cluster (simulando una BD corporativa existente).

> **Namespace:** `lab3-2` · **URL:** `http://localhost`

## Arquitectura

```
Browser → http://localhost
                │
    ┌───────────┼────────────────────────────┐
    │      ingress-nginx Controller           │
    │                                         │
    │  /api/customers  → customers-svc:8080   │
    │  /api/products   → products-svc:8080    │
    │  /               → frontend-svc:80      │
    └───────────────────────────────────────  ┘
         │                │              │
    customers-svc     products-svc   frontend-svc
    (ClusterIP)       (ClusterIP)    (ClusterIP)
         │                │              │
   customers Pod×2   products Pod×2  frontend Pod×2
   (Spring Boot 3)   (Spring Boot 3) (React+nginx)
         │                │
         └────────┬────────┘
                  │ host.docker.internal:5432
                  ▼
         PostgreSQL (Docker — fuera de K8s)
         ├── customersdb
         └── productsdb
```

## Archivos

```
customers-api/          ← Spring Boot 3, context-path=/api, puerto 8080
products-api/           ← Spring Boot 3, context-path=/api, puerto 8080
frontend/               ← React + Vite + nginx
k8s/
  namespace.yaml        ← lab3-2
  secret.yaml           ← credenciales PostgreSQL
  customers-deployment.yaml
  products-deployment.yaml
  frontend-deployment.yaml
  ingress.yaml          ← Prefix routing sin rewrite
```

---

## Pre-requisitos

```bash
# Kubernetes corriendo en Docker Desktop
kubectl cluster-info

# ingress-nginx instalado (del lab 3-1)
kubectl get svc -n ingress-nginx
# ingress-nginx-controller   LoadBalancer   localhost   80:...
```

---

## Step 1 — Levantar PostgreSQL en Docker (fuera de K8s)

```bash
# Iniciar PostgreSQL en Docker (simula BD corporativa externa)
docker run -d \
  --name lab3-postgres \
  -e POSTGRES_USER=admin \
  -e POSTGRES_PASSWORD=ninja123 \
  -p 5432:5432 \
  postgres:16-alpine

# Crear las dos bases de datos
docker exec lab3-postgres psql -U admin -c "CREATE DATABASE customersdb;"
docker exec lab3-postgres psql -U admin -c "CREATE DATABASE productsdb;"

# Verificar
docker exec lab3-postgres psql -U admin -l
#  customersdb  | admin
#  productsdb   | admin
```

> `host.docker.internal` es el hostname que Docker Desktop expone para que los Pods de K8s puedan alcanzar servicios del host Mac (incluyendo este contenedor PostgreSQL).

---

## Step 2 — Construir imagen de Customers API

```bash
cd section03-network-ingress-helm/lab-3-2-microservices

docker build -t lab3-2-customers:1.0 ./customers-api
# Primera vez descarga Maven + dependencias (≈3–5min)

docker images | grep lab3-2-customers
# lab3-2-customers   1.0   ...
```

---

## Step 3 — Construir imagen de Products API

```bash
docker build -t lab3-2-products:1.0 ./products-api

docker images | grep lab3-2-products
# lab3-2-products   1.0   ...
```

---

## Step 4 — Construir imagen del Frontend React

```bash
docker build -t lab3-2-frontend:1.0 ./frontend

docker images | grep lab3-2-frontend
# lab3-2-frontend   1.0   ...
```

---

## Step 5 — Crear namespace y Secret

```bash
kubectl apply -f k8s/namespace.yaml
# namespace/lab3-2 created

kubectl apply -f k8s/secret.yaml
# secret/postgres-secret created
```

---

## Step 6 — Desplegar microservicios y frontend

```bash
kubectl apply -f k8s/customers-deployment.yaml
kubectl apply -f k8s/products-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml

# Verificar que los Pods arrancan (Spring Boot tarda ~30s)
kubectl get pods -n lab3-2 -w
# NAME                         READY   STATUS    RESTARTS   AGE
# customers-xxxx-aaaa          1/1     Running   0          35s
# customers-xxxx-bbbb          1/1     Running   0          35s
# frontend-xxxx-aaaa           1/1     Running   0          20s
# frontend-xxxx-bbbb           1/1     Running   0          20s
# products-xxxx-aaaa           1/1     Running   0          30s
# products-xxxx-bbbb           1/1     Running   0          30s
```

---

## Step 7 — Crear el Ingress

```bash
kubectl apply -f k8s/ingress.yaml
# ingress.networking.k8s.io/lab3-2-ingress created

kubectl get ingress -n lab3-2
# NAME             CLASS   HOSTS   ADDRESS     PORTS   AGE
# lab3-2-ingress   nginx   *       localhost   80      10s
```

---

## Step 8 — Probar

```bash
# Customers API
curl -s http://localhost/api/customers | python3 -m json.tool
# [{"id":1,"name":"Ana García","email":"ana@empresa.com",...}]

# Products API
curl -s http://localhost/api/products | python3 -m json.tool
# [{"id":1,"name":"Laptop Pro 15","price":1299.99,...}]

# Frontend React
open http://localhost        # macOS
```

Abre `http://localhost` en el browser — verás la UI con dos tabs: Clientes y Productos.

---

## Step 9 — Agregar registros y verificar persistencia

```bash
# Crear un cliente
curl -s -X POST http://localhost/api/customers \
  -H "Content-Type: application/json" \
  -d '{"name":"Pedro Martínez","email":"pedro@empresa.com","phone":"+52 55 9999 0000"}'

# Crear un producto
curl -s -X POST http://localhost/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Webcam 4K","price":79.99,"stock":30,"description":"USB-C, 4K 30fps"}'

# Borrar los Pods de customers — K8s los recrea
kubectl delete pod -l app=customers -n lab3-2

# Los datos siguen ahí (viven en PostgreSQL externo, no en los Pods)
curl -s http://localhost/api/customers | python3 -c "import sys,json; [print(c['name']) for c in json.load(sys.stdin)]"
```

---

## Step 10 — Limpiar

```bash
# Elimina todos los recursos de K8s del lab
kubectl delete namespace lab3-2

# Detener PostgreSQL Docker (opcional)
docker stop lab3-postgres && docker rm lab3-postgres
```

---

## Tabla de conceptos

| Concepto | Descripción |
|----------|-------------|
| `server.servlet.context-path=/api` | Spring Boot acepta rutas `/api/**` — Ingress no necesita rewrite |
| `pathType: Prefix` | Ruta más larga gana: `/api/customers` > `/api/products` > `/` |
| `host.docker.internal` | Hostname que Docker Desktop expone para alcanzar el host Mac desde los Pods |
| PostgreSQL externo | BD fuera de K8s — simula migración gradual donde la BD ya existe |
| `imagePullPolicy: Never` | Usa imágenes locales de Docker Desktop sin registry |
| Seeds en `CommandLineRunner` | Datos de ejemplo insertados al arrancar si la tabla está vacía |
| Microservicio independiente | Cada API tiene su propia BD, Deployment, Service e imagen |
