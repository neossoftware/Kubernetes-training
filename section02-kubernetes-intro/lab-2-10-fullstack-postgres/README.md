# Lab 2-10 — Fullstack en Kubernetes: React + Node.js + PostgreSQL con PVC

Despliega una aplicación de tres capas **completamente dentro de Kubernetes**: frontend React, API Node.js y base de datos PostgreSQL con almacenamiento persistente. Los datos sobreviven a reinicios de Pods gracias al `PersistentVolumeClaim` del Lab 2-9.

> **Namespace:** `lab2-10` · **Frontend:** `http://localhost:30094`

## Arquitectura

```
Browser (http://localhost:30094)
  │
  ▼
frontend-svc (NodePort :30094)
  │
  ▼
frontend Pod ×2  — React + nginx
  │  location /api/ → proxy_pass http://api-svc:3000
  ▼
api-svc (ClusterIP — solo interna)
  │
  ▼
api Pod ×2  — Node.js + Express + pg
  │  DB_HOST=postgres-svc (K8s DNS)
  ▼
postgres-svc (ClusterIP — solo interna)
  │
  ▼
postgres Pod ×1  — PostgreSQL 16-alpine
  │  mountPath: /var/lib/postgresql/data
  ▼
PersistentVolumeClaim  postgres-pvc (1Gi)
  │
  ▼
PersistentVolume  (hostpath en Docker Desktop / EBS en AWS)
```

## ¿Qué cambia respecto a labs anteriores?

| Lab | Base de datos | Dónde vive |
|-----|--------------|------------|
| 2-6, 2-7, 2-8 | PostgreSQL | Docker externo al clúster |
| 2-9 | PostgreSQL | K8s — pero sin conexión desde la app |
| **2-10** | **PostgreSQL** | **K8s — con PVC + API Node.js conectada** |

## Archivos

```
api/
  index.js          ← Express + pg Pool — lee credenciales del Secret
  package.json      ← dependencias: express, cors, pg
  Dockerfile        ← multi-stage, node:20-alpine
frontend/
  src/App.jsx       ← React + axios, sin cambios de lógica
  nginx.conf        ← proxy /api/ → api-svc:3000
  Dockerfile        ← Vite build + nginx:1.25-alpine
k8s/
  namespace.yaml           ← lab2-10
  secret.yaml              ← credenciales PostgreSQL (base64)
  postgres-deployment.yaml ← PVC + Deployment + Service ClusterIP
  api-deployment.yaml      ← 2 réplicas + env vars desde Secret
  frontend-deployment.yaml ← 2 réplicas + NodePort 30094
```

---

## Pre-requisitos

```bash
# Clúster activo
kubectl cluster-info

# Verificar StorageClass
kubectl get storageclass
# NAME                 PROVISIONER          RECLAIMPOLICY
# hostpath (default)   docker.io/hostpath   Delete
```

---

## Step 1 — Entrar a la carpeta del lab

```bash
cd section02-kubernetes-intro/lab-2-10-fullstack-postgres
```

---

## Step 2 — Construir imagen de la API

```bash
docker build -t lab2-10-api:1.0 ./api

docker images | grep lab2-10-api
# lab2-10-api   1.0   ...
```

La imagen incluye `pg` — el driver oficial de PostgreSQL para Node.js. La conexión usa variables de entorno inyectadas desde el Secret de K8s.

---

## Step 3 — Construir imagen del Frontend

```bash
docker build -t lab2-10-frontend:1.0 ./frontend

docker images | grep lab2-10-frontend
# lab2-10-frontend   1.0   ...
```

El `VITE_API_URL` queda vacío en la build — las llamadas son relativas (`/api/*`) y nginx las proxea a `api-svc:3000` internamente.

---

## Step 4 — Crear namespace y Secret

```bash
kubectl apply -f k8s/namespace.yaml
# namespace/lab2-10 created

kubectl apply -f k8s/secret.yaml
# secret/postgres-secret created
```

---

## Step 5 — Desplegar PostgreSQL con PVC

```bash
kubectl apply -f k8s/postgres-deployment.yaml
# persistentvolumeclaim/postgres-pvc created
# deployment.apps/postgres created
# service/postgres-svc created

# Esperar a que PostgreSQL esté listo antes de levantar la API
kubectl wait --for=condition=ready pod -l app=postgres -n lab2-10 --timeout=60s
# pod/postgres-xxxx-aaaa condition met

kubectl get pvc -n lab2-10
# NAME           STATUS   VOLUME         CAPACITY   ACCESS MODES   STORAGECLASS
# postgres-pvc   Bound    pvc-xxx...     1Gi        RWO            hostpath
```

---

## Step 6 — Desplegar la API Node.js

```bash
kubectl apply -f k8s/api-deployment.yaml
# deployment.apps/api created
# service/api-svc created

kubectl get pods -l app=api -n lab2-10
# NAME                   READY   STATUS    RESTARTS   AGE
# api-xxxx-aaaa          1/1     Running   0          20s
# api-xxxx-bbbb          1/1     Running   0          20s
```

Al arrancar, la API ejecuta `initDB()`: crea la tabla `products` si no existe e inserta 4 productos de ejemplo.

```bash
# Ver los logs del initDB
kubectl logs -l app=api -n lab2-10 --tail=5
# Base de datos lista
# API corriendo en puerto 3000
```

---

## Step 7 — Desplegar el Frontend React

```bash
kubectl apply -f k8s/frontend-deployment.yaml
# deployment.apps/frontend created
# service/frontend-svc created

kubectl get pods,services -n lab2-10
# NAME                             READY   STATUS    RESTARTS   AGE
# pod/api-xxxx-aaaa                1/1     Running   0          1m
# pod/api-xxxx-bbbb                1/1     Running   0          1m
# pod/frontend-xxxx-aaaa           1/1     Running   0          15s
# pod/frontend-xxxx-bbbb           1/1     Running   0          15s
# pod/postgres-xxxx-aaaa           1/1     Running   0          2m
#
# NAME                   TYPE        CLUSTER-IP      PORT(S)        AGE
# service/api-svc        ClusterIP   10.96.x.x       3000/TCP       1m
# service/frontend-svc   NodePort    10.97.x.x       80:30094/TCP   15s
# service/postgres-svc   ClusterIP   10.98.x.x       5432/TCP       2m
```

---

## Step 8 — Abrir la app

Abre **http://localhost:30094** en el browser.

Verás los 4 productos iniciales cargados desde PostgreSQL. Crea, elimina productos — cada cambio se persiste en el PVC.

```bash
# Probar el API directamente (nginx hace el proxy)
curl http://localhost:30094/api/products
# {"data":[...],"total":4}

curl -X POST http://localhost:30094/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Auriculares Sony","price":129.99,"stock":12}'
# {"id":5,"name":"Auriculares Sony","price":"129.99","stock":12,"description":""}
```

---

## Step 9 — Demostrar persistencia

```bash
# Agregar un producto desde la UI o con curl (id=5 en el ejemplo)
# Luego borrar TODOS los Pods de la API — K8s los recrea
kubectl delete pod -l app=api -n lab2-10

# Esperar recuperación
kubectl get pods -l app=api -n lab2-10 -w

# Los nuevos Pods se reconectan al mismo PostgreSQL
curl http://localhost:30094/api/products
# El producto agregado sigue ahí — datos en el PVC, no en el Pod
```

---

## Step 10 — Verificar el balanceo entre Pods de la API

```bash
# El hostname en la respuesta cambia — K8s balancea entre los 2 Pods
for i in $(seq 1 6); do
  curl -s http://localhost:30094/api/hello | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['hostname'])"
done
# api-xxxx-aaaa
# api-xxxx-bbbb
# api-xxxx-aaaa
# api-xxxx-bbbb
# ...
```

---

## Step 11 — Limpiar

```bash
kubectl delete namespace lab2-10

kubectl get namespaces | grep lab2-10  # ya no aparece
```

> Borrar el namespace elimina todos los recursos: Pods, Services, Secret, PVC y PV.

---

## Tabla de conceptos

| Concepto | Descripción |
|----------|-------------|
| 3-tier en K8s | Frontend, API y BD cada uno en su propio Deployment |
| `pg Pool` | Pool de conexiones Node.js → PostgreSQL; reutiliza conexiones bajo carga |
| `initDB()` | Patrón: la app crea su tabla al arrancar si no existe |
| `DB_HOST=postgres-svc` | K8s DNS resuelve el nombre del Service al ClusterIP automáticamente |
| `kubectl wait` | Espera a que un Pod esté Ready antes de continuar — útil en scripts de deploy |
| PVC en la capa de datos | Solo PostgreSQL tiene PVC; API y frontend son stateless y escalan libremente |
| `imagePullPolicy: Never` | Usa la imagen local de Docker Desktop — no intenta bajarla de un registry |
