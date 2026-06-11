# Lab 2-6 — Fullstack en Kubernetes: Frontend + API con Services

Despliega la misma app fullstack del Lab 1 de Docker, ahora en Kubernetes.
Aprenderás cómo se comunican dos servicios entre sí usando ClusterIP y NodePort.

## Arquitectura

```
  Tu navegador
       │
       │  http://localhost:30080
       ▼
┌─────────────────────┐
│  frontend-svc       │  NodePort 30080
│  (NodePort)         │  ← único punto de entrada externo
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  frontend-deploy    │  2 réplicas nginx
│  Pod 1 / Pod 2      │  sirve el React build
└────────┬────────────┘
         │  /api/* → proxy_pass http://api-svc:3000
         │  (nginx reenvía internamente)
         ▼
┌─────────────────────┐
│  api-svc            │  ClusterIP (solo interno)
│  (ClusterIP)        │  ← NO accesible desde fuera
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  api-deploy         │  2 réplicas Node.js
│  Pod 1 / Pod 2      │  /api/products, /api/hello
└─────────────────────┘
```

**Clave del lab:**
- `ClusterIP` — solo pods dentro del clúster pueden llegar a `api-svc:3000`
- `NodePort` — el browser accede al frontend en `localhost:30080`
- nginx hace de puente: recibe `/api/*` del browser y lo reenvía al ClusterIP interno

---

## Archivos

```
api/
  Dockerfile          ← imagen Node.js (sin cambios vs Lab 1)
  index.js            ← API Express con /api/products, /api/hello
  package.json

frontend/
  Dockerfile          ← VITE_API_URL='' (same-origin, nginx hace el proxy)
  nginx.conf          ← proxy_pass /api/ → http://api-svc:3000
  src/App.jsx         ← usa ?? en vez de || para respetar VITE_API_URL vacío

k8s/
  api-deployment.yaml       ← Deployment 2 réplicas + Service ClusterIP
  frontend-deployment.yaml  ← Deployment 2 réplicas + Service NodePort 30080
```

---

## Pre-requisito

```bash
kubectl get nodes
# NAME             STATUS   ROLES           AGE
# docker-desktop   Ready    control-plane   ...
```

---

## Step 1 — Construir las imágenes Docker locales

Las imágenes se construyen localmente. Docker Desktop comparte las imágenes con K8s,
por eso los manifiestos usan `imagePullPolicy: Never`.

```bash
# Desde la raíz del lab
cd section02-kubernetes-intro/lab-2-6-fullstack

# Imagen de la API
docker build -t lab2-6-api:1.0 ./api
# Successfully tagged lab2-6-api:1.0

# Imagen del frontend (incluye el build de React + nginx con proxy)
docker build -t lab2-6-frontend:1.0 ./frontend
# Successfully tagged lab2-6-frontend:1.0

# Verificar que existen
docker images | grep lab2-6
# lab2-6-frontend   1.0   ...
# lab2-6-api        1.0   ...
```

---

## Step 2 — Desplegar en Kubernetes

```bash
# API primero (el frontend lo necesita para resolver el DNS)
kubectl apply -f k8s/api-deployment.yaml
# deployment.apps/api-deploy created
# service/api-svc created

# Luego el frontend
kubectl apply -f k8s/frontend-deployment.yaml
# deployment.apps/frontend-deploy created
# service/frontend-svc created
```

---

## Step 3 — Verificar los Pods y Services

```bash
# Ver los 4 Pods (2 de API + 2 de frontend)
kubectl get pods
# NAME                               READY   STATUS    RESTARTS   AGE
# api-deploy-xxxx-aaaaa              1/1     Running   0          15s
# api-deploy-xxxx-bbbbb              1/1     Running   0          15s
# frontend-deploy-xxxx-ccccc         1/1     Running   0          12s
# frontend-deploy-xxxx-ddddd         1/1     Running   0          12s

# Ver los Services
kubectl get services
# NAME           TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)          AGE
# api-svc        ClusterIP   10.96.x.x       <none>        3000/TCP         20s
# frontend-svc   NodePort    10.97.x.x       <none>        80:30080/TCP     17s

# CLUSTER-IP de api-svc: solo accesible desde dentro del clúster
# PORT(S) de frontend-svc: 80:30080 → puerto 30080 en tu máquina
```

---

## Step 4 — Abrir la app en el navegador

**Docker Desktop:** http://localhost:30080

**minikube:**
```bash
minikube service frontend-svc --url
```

Verás la app de productos. El banner azul muestra el **hostname del Pod de la API**
que respondió — si recargas varias veces verás que cambia entre los 2 pods.

---

## Step 5 — Comprobar la comunicación interna

El browser NUNCA habla directo con la API. El flujo es:

```
browser → localhost:30080 → frontend Pod (nginx)
                                   │
                          nginx proxy_pass
                                   │
                                   ▼
                            api-svc:3000 (ClusterIP)
                                   │
                          K8s DNS resuelve
                                   │
                                   ▼
                            api-deploy Pod 1 o Pod 2
```

Puedes comprobarlo intentando acceder directo a la API desde fuera — no hay NodePort:

```bash
# La API no tiene NodePort, no es accesible desde el browser
kubectl get service api-svc
# TYPE: ClusterIP  ← sin puerto externo

# Pero sí funciona desde dentro del clúster
kubectl run test-curl --image=curlimages/curl --restart=Never --rm -it \
  -- curl http://api-svc:3000/api/hello
# {"msg":"¡Hola desde Kubernetes Ninja Lab!","hostname":"api-deploy-xxxx-aaaaa"}
```

---

## Step 6 — Ver los logs de cada servicio

```bash
# Logs de los pods de la API
kubectl logs -l app=api --tail=20

# Logs del frontend (nginx access log — verás las peticiones /api/*)
kubectl logs -l app=frontend --tail=20
# 10.x.x.x - - "GET /api/hello HTTP/1.0" 200
# 10.x.x.x - - "GET /api/products HTTP/1.0" 200
```

---

## Step 7 — Limpiar

```bash
kubectl delete -f k8s/frontend-deployment.yaml
kubectl delete -f k8s/api-deployment.yaml

kubectl get pods    # sin pods
kubectl get svc     # solo kubernetes
```

---

## Tabla de conceptos

| Concepto | En este lab |
|----------|-------------|
| `ClusterIP` | `api-svc` — solo accesible desde pods del clúster |
| `NodePort` | `frontend-svc` — expone el frontend en `localhost:30080` |
| `proxy_pass` | nginx reenvía `/api/*` al `api-svc:3000` interno |
| DNS interno | K8s resuelve `api-svc` al ClusterIP automáticamente |
| `imagePullPolicy: Never` | K8s usa la imagen local en vez de buscarla en Docker Hub |
| 2 réplicas cada uno | 4 pods en total, carga balanceada entre ellos |
