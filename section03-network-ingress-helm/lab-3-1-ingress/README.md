# Lab 3-1 — Ingress: un solo punto de entrada para múltiples apps

Despliega tres apps con ClusterIP Services (sin acceso externo) y expónalas todas a través de un único **Ingress Controller** con path-based routing. El browser solo conoce `http://localhost` — Ingress decide a quién enrutar.

> **Namespace:** `lab3-1` · **Ingress Controller:** ingress-nginx · **Entorno:** Docker Desktop

## Arquitectura

```
Browser → http://localhost
                │
     ┌──────────┼──────────┐
     │          │          │
  /blue/     /green/     /api/
     │          │          │
  blue-svc  green-svc  api-svc
 (ClusterIP)(ClusterIP)(ClusterIP)
     │          │          │
  blue Pod   green Pod   api Pod ×2
  (nginx)    (nginx)     (node:20)
     │          │          │
 ConfigMap  ConfigMap  inline JS
```

## Archivos

```
k8s/
  namespace.yaml   ← lab3-1
  blue-app.yaml    ← ConfigMap HTML + Deployment nginx + ClusterIP blue-svc
  green-app.yaml   ← ConfigMap HTML + Deployment nginx + ClusterIP green-svc
  api.yaml         ← Deployment node:20-alpine (sin imagen custom) + ClusterIP api-svc
  ingress.yaml     ← reglas path-based routing con rewrite-target
```

---

## Pre-requisitos

```bash
# Docker Desktop con Kubernetes habilitado
kubectl cluster-info
# Kubernetes control plane is running at https://127.0.0.1:6443
```

---

## Step 1 — Instalar ingress-nginx

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.15.1/deploy/static/provider/cloud/deploy.yaml
```

Docker Desktop crea automáticamente un Service `LoadBalancer` para el controller que se mapea a `localhost:80`.

```bash
# Esperar a que el controller esté listo (≈60s)
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s
# pod/ingress-nginx-controller-xxxx condition met

# Verificar que el LoadBalancer tiene EXTERNAL-IP = localhost
kubectl get svc -n ingress-nginx
# NAME                   TYPE           CLUSTER-IP     EXTERNAL-IP   PORT(S)
# ingress-nginx-controller   LoadBalancer   10.x.x.x   localhost     80:3xxxx/TCP,443:3xxxx/TCP
```

---

## Step 2 — Crear namespace

```bash
kubectl apply -f k8s/namespace.yaml
# namespace/lab3-1 created
```

---

## Step 3 — Desplegar App Azul

```bash
kubectl apply -f k8s/blue-app.yaml
# configmap/blue-html created
# deployment.apps/blue-app created
# service/blue-svc created

kubectl get pods -l app=blue-app -n lab3-1
# NAME                        READY   STATUS    RESTARTS   AGE
# blue-app-xxxx-aaaa          1/1     Running   0          10s
# blue-app-xxxx-bbbb          1/1     Running   0          10s
```

---

## Step 4 — Desplegar App Verde

```bash
kubectl apply -f k8s/green-app.yaml
# configmap/green-html created
# deployment.apps/green-app created
# service/green-svc created
```

---

## Step 5 — Desplegar la API Node.js

```bash
kubectl apply -f k8s/api.yaml
# deployment.apps/api created
# service/api-svc created

# Esta API no necesita imagen custom — node:20-alpine ejecuta el servidor inline
kubectl logs -l app=api -n lab3-1 --tail=2
# API running on :3000
```

---

## Step 6 — Crear el Ingress

```bash
kubectl apply -f k8s/ingress.yaml
# ingress.networking.k8s.io/lab3-1-ingress created

kubectl get ingress -n lab3-1
# NAME             CLASS   HOSTS   ADDRESS     PORTS   AGE
# lab3-1-ingress   nginx   *       localhost   80      10s
```

El campo `HOSTS=*` indica que aplica a cualquier hostname — perfecto para localhost.

---

## Step 7 — Verificar todos los recursos

```bash
kubectl get all,ingress,configmap -n lab3-1
# NAME                             READY   STATUS    RESTARTS   AGE
# pod/api-xxxx-aaaa                1/1     Running   0          1m
# pod/api-xxxx-bbbb                1/1     Running   0          1m
# pod/blue-app-xxxx-aaaa           1/1     Running   0          2m
# pod/blue-app-xxxx-bbbb           1/1     Running   0          2m
# pod/green-app-xxxx-aaaa          1/1     Running   0          2m
# pod/green-app-xxxx-bbbb          1/1     Running   0          2m
#
# NAME                TYPE        CLUSTER-IP      PORT(S)
# service/api-svc     ClusterIP   10.96.x.x       3000/TCP
# service/blue-svc    ClusterIP   10.97.x.x       80/TCP
# service/green-svc   ClusterIP   10.98.x.x       80/TCP
#
# NAME                             CLASS   HOSTS   ADDRESS     PORTS
# ingress.../lab3-1-ingress        nginx   *       localhost   80
```

---

## Step 8 — Probar el routing

```bash
# App Azul
curl http://localhost/blue/
# Retorna el HTML de la app azul

# App Verde
curl http://localhost/green/
# Retorna el HTML de la app verde

# API
curl http://localhost/api/
# {
#   "message": "API Lab 3-1 - Ingress routing demo",
#   "hostname": "api-xxxx-aaaa",
#   "path": "/",
#   "timestamp": "2026-06-17T..."
# }
```

También puedes abrir en el browser:
- **http://localhost/blue/** → pantalla azul
- **http://localhost/green/** → pantalla verde
- **http://localhost/api/** → JSON de la API

---

## Step 9 — Demostrar load balancing en la API

```bash
# El hostname cambia entre las 2 réplicas de la API
for i in $(seq 1 6); do
  curl -s http://localhost/api/ | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['hostname'])"
done
# api-xxxx-aaaa
# api-xxxx-bbbb
# api-xxxx-aaaa
# api-xxxx-bbbb
```

---

## Step 10 — Limpiar

```bash
kubectl delete namespace lab3-1
# namespace "lab3-1" deleted
# (Pods, Services, ConfigMaps e Ingress eliminados automáticamente)

# El ingress-nginx controller se puede dejar instalado para labs siguientes
# o desinstalarlo con:
kubectl delete -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.15.1/deploy/static/provider/cloud/deploy.yaml
```

---

## Tabla de conceptos

| Concepto | Descripción |
|----------|-------------|
| `Ingress Resource` | Objeto K8s que define las reglas de routing (YAML) |
| `Ingress Controller` | Pod que lee las reglas y configura nginx/traefik en tiempo real |
| `ingressClassName: nginx` | Indica qué controller debe procesar este Ingress |
| `rewrite-target: /$2` | Elimina el prefijo del path antes de enviarlo al backend |
| `use-regex: "true"` | Habilita expresiones regulares en los paths |
| `HOSTS: *` | El Ingress aplica a cualquier hostname (incluido localhost) |
| Sin `host:` en rules | Equivalente a `*` — acepta tráfico de cualquier dominio |
| ConfigMap como HTML | Sirve contenido estático sin necesidad de imagen custom |
