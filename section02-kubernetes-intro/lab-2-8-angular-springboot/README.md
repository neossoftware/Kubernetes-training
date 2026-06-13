# Lab 2-8 — Angular + Spring Boot: API interna y Frontend público

Aprende a desplegar un sistema fullstack en Kubernetes donde el **API es solo accesible internamente** (ClusterIP) y el **frontend es accesible desde el browser** (NodePort). El frontend Angular actúa como proxy — el browser nunca llega al API directamente.

> **Namespace:** todo este lab corre en el namespace `lab2-8` para evitar conflictos de nombres con otros labs.

## Arquitectura

```
Browser
  │  http://localhost:30093
  ▼
frontend-svc (NodePort :30093)  [namespace: lab2-8]
  │
  ▼
frontend Pod ×2 (nginx)
  │  /api/* → proxy_pass http://api-svc:8080  (interno)
  ▼
api-svc (ClusterIP — NO accesible desde fuera)  [namespace: lab2-8]
  │
  ▼
products-api Pod ×3 (Spring Boot + logs)
  │  host.docker.internal:5432
  ▼
PostgreSQL (Docker — fuera del clúster)
```

## ¿Por qué ClusterIP para el API?

| NodePort (❌ no usar en prod) | ClusterIP (✅ correcto) |
|-------------------------------|------------------------|
| El API queda expuesto en internet | El API es invisible desde fuera |
| Cualquiera puede llamar a `DELETE /api/products/1` | Solo el Pod de nginx puede hablarle |
| Requiere autenticación en cada endpoint | La red es la primera línea de defensa |

## Archivos

```
api/                          ← Spring Boot con logs (mismo código que Lab 2-7)
frontend/
  src/                        ← Angular 21 + Bootstrap
  public/env.js               ← API_URL: '' (llamadas relativas → nginx proxy)
  nginx.conf                  ← proxy_pass /api/ → api-svc:8080
  Dockerfile
k8s/
  namespace.yaml              ← namespace lab2-8
  secret.yaml                 ← credenciales BD (base64)
  api-deployment.yaml         ← 3 réplicas, Service ClusterIP
  frontend-deployment.yaml    ← 2 réplicas, Service NodePort :30093
```

---

## Pre-requisito

PostgreSQL corriendo y labs anteriores limpios:

```bash
docker exec postgres-lab pg_isready -U admin -d labdb
# localhost:5432 - accepting connections

# Si tienes recursos del lab en el namespace default, límpialos
kubectl delete deployment products-api frontend --ignore-not-found -n default
kubectl delete service api-svc frontend-svc --ignore-not-found -n default
```

---

## Step 1 — Entrar a la carpeta del lab

```bash
cd section02-kubernetes-intro/lab-2-8-angular-springboot
```

---

## Step 2 — Verificar imagen del API (reutilizamos lab-2-7)

El API es el mismo Spring Boot con logs del Lab 2-7. No hace falta reconstruirlo:

```bash
docker images | grep lab2-7-products-api
# lab2-7-products-api   v2   ...  ← ya construida en Lab 2-7

# Si no existe, constrúyela:
# docker build -t lab2-7-products-api:v2 ../lab-2-7-rollout-undo/api
```

---

## Step 3 — Construir imagen del Frontend Angular

```bash
docker build -t lab2-8-frontend:1.0 ./frontend

docker images | grep lab2-8-frontend
# lab2-8-frontend   1.0   ...
```

El `env.js` tiene `API_URL: ''` — Angular hace llamadas relativas (`/api/*`) que nginx enruta internamente a `api-svc:8080`. El browser nunca sabe la dirección del API.

---

## Step 4 — Crear el namespace y desplegar todo

```bash
# Crear el namespace lab2-8
kubectl apply -f k8s/namespace.yaml
# namespace/lab2-8 created

# Secret con credenciales de BD
kubectl apply -f k8s/secret.yaml
# secret/db-secret created

# API — 3 réplicas, Service ClusterIP (sin acceso externo)
kubectl apply -f k8s/api-deployment.yaml
# deployment.apps/products-api created
# service/api-svc created

# Frontend — 2 réplicas, Service NodePort :30093
kubectl apply -f k8s/frontend-deployment.yaml
# deployment.apps/frontend created
# service/frontend-svc created

# Ver todo en el namespace
kubectl get pods,services -n lab2-8
# NAME                                READY   STATUS    RESTARTS   AGE
# pod/frontend-xxxx-aaaaa             1/1     Running   0          20s
# pod/frontend-xxxx-bbbbb             1/1     Running   0          20s
# pod/products-api-xxxx-aaaaa         1/1     Running   0          25s
# pod/products-api-xxxx-bbbbb         1/1     Running   0          25s
# pod/products-api-xxxx-ccccc         1/1     Running   0          25s
#
# NAME                   TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)        AGE
# service/api-svc        ClusterIP   10.96.x.x       <none>        8080/TCP       25s
# service/frontend-svc   NodePort    10.97.x.x       <none>        80:30093/TCP   20s
```

---

## Step 5 — Demostrar que el API NO es accesible desde fuera

```bash
# Intentar acceder desde tu máquina — debe fallar
curl http://localhost:8080/api/products
# curl: (7) Failed to connect to localhost port 8080: Connection refused

# Confirmar que es ClusterIP (sin EXTERNAL-IP ni nodePort)
kubectl get service api-svc -n lab2-8 -o jsonpath='{.spec.type}'
# ClusterIP
```

Este es el comportamiento esperado. El API es invisible desde fuera del clúster.

---

## Step 6 — Troubleshooting desde dentro del clúster

Cuando el API es ClusterIP, se prueba con un Pod temporal **en el mismo namespace**:

```bash
# Pod temporal con curl — se elimina solo al salir
kubectl run tmp-curl -n lab2-8 --image=curlimages/curl --restart=Never --rm -it \
  -- curl http://api-svc:8080/api/products/health
# {"status":"UP","products":"5"}
# pod "tmp-curl" deleted

# Entrar a un Pod existente
kubectl exec -it deployment/products-api -n lab2-8 -- sh
# / # wget -qO- http://localhost:8080/api/products/health
# {"status":"UP","products":"5"}
# / # exit

# Probar comunicación entre servicios (como lo hará nginx)
kubectl run tmp-curl -n lab2-8 --image=curlimages/curl --restart=Never --rm -it \
  -- curl http://api-svc:8080/api/products
# {"data":[...],"total":5}
```

> K8s resuelve `api-svc` automáticamente al ClusterIP del Service dentro del mismo namespace. El nombre completo es `api-svc.lab2-8.svc.cluster.local`, pero dentro del mismo namespace basta con `api-svc`.

---

## Step 7 — Abrir la app en el browser

Abre **http://localhost:30093** en tu navegador.

Crea, edita y elimina productos. Cada acción llama a `/api/*`, nginx lo reenvía a `api-svc:8080`, Spring Boot responde — todo sin que el browser sepa que el API existe directamente.

```bash
# Ver los logs del API en tiempo real
kubectl logs -l app=products-api -n lab2-8 -f --prefix
```

---

## Step 8 — Verificar el flujo nginx → API en los logs

```bash
# Logs del frontend (nginx access log)
kubectl logs -l app=frontend -n lab2-8 --tail=20
# 10.x.x.x - "GET /api/products HTTP/1.0" 200
# 10.x.x.x - "POST /api/products HTTP/1.0" 201

# Logs del API (Spring Boot) — mismas peticiones desde el otro lado
kubectl logs -l app=products-api -n lab2-8 --tail=20
# INFO [GET]  /api/products - 5 productos encontrados
# INFO [POST] /api/products - creando: name=Teclado, price=89.99
```

La IP en los logs de nginx es la IP interna del Pod — tráfico Pod-a-Pod, nunca desde el exterior.

---

## Step 9 — Limpiar

```bash
# Eliminar todo borrando el namespace completo
kubectl delete namespace lab2-8

kubectl get namespaces | grep lab2-8   # ya no aparece
```

> Borrar el namespace elimina **todos** sus recursos (pods, services, secrets) de una sola vez — no hay que borrarlos uno a uno.

---

## Tabla de conceptos

| Concepto | Descripción |
|----------|-------------|
| `namespace` | Ámbito de aislamiento — recursos de distintos labs no colisionan |
| `ClusterIP` | Service accesible solo dentro del clúster — sin puerto externo |
| `NodePort` | Service accesible desde fuera — abre un puerto en el nodo |
| `proxy_pass` | nginx reenvía `/api/*` al Service interno `api-svc:8080` |
| `env.js` | Configuración runtime de Angular — `API_URL: ''` para K8s |
| `kubectl -n lab2-8` | Flag para operar en un namespace específico |
| `kubectl run tmp-curl -n lab2-8` | Pod temporal en el namespace correcto para troubleshooting |
| Service Discovery | K8s resuelve `api-svc` al ClusterIP via DNS dentro del mismo namespace |
