# Lab 2-8 — Angular + Spring Boot: API interna y Frontend público

Aprende a desplegar un sistema fullstack en Kubernetes donde el **API es solo accesible internamente** (ClusterIP) y el **frontend es accesible desde el browser** (NodePort). El frontend Angular actúa como proxy — el browser nunca llega al API directamente.

## Arquitectura

```
Browser
  │  http://localhost:30093
  ▼
frontend-svc (NodePort :30093)
  │
  ▼
frontend Pod ×2 (nginx)
  │  /api/* → proxy_pass http://api-svc:8080  (interno)
  ▼
api-svc (ClusterIP — NO accesible desde fuera)
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

# Limpiar lab anterior si está corriendo
kubectl delete deployment products-api --ignore-not-found
kubectl delete service api-svc products-api-svc --ignore-not-found
kubectl delete secret db-secret --ignore-not-found
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

## Step 4 — Desplegar Secret y API (ClusterIP)

```bash
# Secret con credenciales de BD
kubectl apply -f k8s/secret.yaml
# secret/db-secret created

# API — 3 réplicas, Service ClusterIP (sin acceso externo)
kubectl apply -f k8s/api-deployment.yaml
# deployment.apps/products-api created
# service/api-svc created

kubectl get pods -l app=products-api
# NAME                           READY   STATUS    RESTARTS   AGE
# products-api-xxxx-aaaaa        1/1     Running   0          25s
# products-api-xxxx-bbbbb        1/1     Running   0          25s
# products-api-xxxx-ccccc        1/1     Running   0          25s

kubectl get service api-svc
# NAME      TYPE        CLUSTER-IP    EXTERNAL-IP   PORT(S)    AGE
# api-svc   ClusterIP   10.96.x.x     <none>        8080/TCP   30s
#                                     ^^^^^^
#                                     Sin puerto externo — inaccesible desde fuera
```

---

## Step 5 — Demostrar que el API NO es accesible desde fuera

```bash
# Intentar acceder desde tu máquina — debe fallar
curl http://localhost:8080/api/products
# curl: (7) Failed to connect to localhost port 8080: Connection refused

# Confirmar que es ClusterIP
kubectl get service api-svc -o jsonpath='{.spec.type}'
# ClusterIP
```

Este es el comportamiento esperado. El API es invisible desde fuera del clúster.

---

## Step 6 — Troubleshooting desde dentro del clúster

Cuando el API es ClusterIP, se prueba con un Pod temporal:

```bash
# Pod temporal con curl — se elimina solo al salir
kubectl run tmp-curl --image=curlimages/curl --restart=Never --rm -it \
  -- curl http://api-svc:8080/api/products/health
# {"status":"UP","products":"5"}
# pod "tmp-curl" deleted

# Entrar a un Pod existente
kubectl exec -it deployment/products-api -- sh
# / # wget -qO- http://localhost:8080/api/products/health
# {"status":"UP","products":"5"}
# / # exit

# Probar comunicación entre servicios (como lo hará nginx)
kubectl run tmp-curl --image=curlimages/curl --restart=Never --rm -it \
  -- curl http://api-svc:8080/api/products
# {"data":[...],"total":5}
```

> K8s resuelve `api-svc` automáticamente al ClusterIP del Service. El nombre completo es `api-svc.default.svc.cluster.local`, pero dentro del mismo namespace basta con `api-svc`.

---

## Step 7 — Desplegar el Frontend Angular (NodePort)

```bash
kubectl apply -f k8s/frontend-deployment.yaml
# deployment.apps/frontend created
# service/frontend-svc created

kubectl get pods -l app=frontend
# NAME                        READY   STATUS    RESTARTS   AGE
# frontend-xxxx-aaaaa         1/1     Running   0          15s
# frontend-xxxx-bbbbb         1/1     Running   0          15s

kubectl get services
# NAME           TYPE        CLUSTER-IP    EXTERNAL-IP   PORT(S)        AGE
# api-svc        ClusterIP   10.96.x.x     <none>        8080/TCP       3m
# frontend-svc   NodePort    10.97.x.x     <none>        80:30093/TCP   15s
```

---

## Step 8 — Abrir la app en el browser

Abre **http://localhost:30093** en tu navegador.

Crea, edita y elimina productos. Cada acción llama a `/api/*`, nginx lo reenvía a `api-svc:8080`, Spring Boot responde — todo sin que el browser sepa que el API existe directamente.

```bash
# Ver los logs del API en tiempo real
kubectl logs -l app=products-api -f --prefix
```

---

## Step 9 — Verificar el flujo nginx → API en los logs

```bash
# Logs del frontend (nginx access log)
kubectl logs -l app=frontend --tail=20
# 10.x.x.x - "GET /api/products HTTP/1.0" 200
# 10.x.x.x - "POST /api/products HTTP/1.0" 201

# Logs del API (Spring Boot) — mismas peticiones desde el otro lado
kubectl logs -l app=products-api --tail=20
# INFO [GET]  /api/products - 5 productos encontrados
# INFO [POST] /api/products - creando: name=Teclado, price=89.99
```

La IP en los logs de nginx es la IP interna del Pod — tráfico Pod-a-Pod, nunca desde el exterior.

---

## Step 10 — Limpiar

```bash
kubectl delete -f k8s/frontend-deployment.yaml
kubectl delete -f k8s/api-deployment.yaml
kubectl delete -f k8s/secret.yaml

kubectl get pods     # sin pods
kubectl get services # solo "kubernetes"
```

---

## Tabla de conceptos

| Concepto | Descripción |
|----------|-------------|
| `ClusterIP` | Service accesible solo dentro del clúster — sin puerto externo |
| `NodePort` | Service accesible desde fuera — abre un puerto en el nodo |
| `proxy_pass` | nginx reenvía `/api/*` al Service interno `api-svc:8080` |
| `env.js` | Configuración runtime de Angular — `API_URL: ''` para K8s |
| `kubectl run tmp-curl` | Pod temporal para troubleshooting interno |
| `kubectl exec -it` | Entrar a un Pod existente para diagnóstico |
| Service Discovery | K8s resuelve `api-svc` al ClusterIP automáticamente via DNS |
