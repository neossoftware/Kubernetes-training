# Lab 2-7 — Rollout y Undo: actualiza la imagen sin downtime

Aprende a hacer un **rolling update real** cambiando la imagen del contenedor,
y a revertir con `kubectl rollout undo` — esta vez sí funciona porque el cambio
está en el Deployment, no en un ConfigMap externo.

## ¿Por qué ahora sí funciona el rollout undo?

| Lab 2-5 (ConfigMap) | Lab 2-7 (imagen) |
|---------------------|-----------------|
| El cambio estaba en el ConfigMap — objeto externo al Deployment | El cambio está en la imagen del contenedor — parte del Deployment spec |
| `rollout undo` revierte el Deployment pero el ConfigMap no cambia | `rollout undo` revierte el Deployment spec completo, incluyendo la imagen |
| Los Pods siguen leyendo el ConfigMap nuevo | Los Pods vuelven a usar la imagen anterior |

## Versiones del lab

| Versión | Imagen | Qué hace |
|---------|--------|----------|
| v1 | `lab2-6-products-api:1.0` | API sin logs (imagen del Lab 2-6) |
| v2 | `lab2-7-products-api:v2`  | API con `log.info` en todos los endpoints |

## Archivos

```
api/                              ← v2: ProductController con @Slf4j + logs
k8s/
  secret.yaml                     ← mismo Secret del Lab 2-6
  api-deployment.yaml             ← empieza con imagen v1
```

---

## Pre-requisito

PostgreSQL corriendo y Lab 2-6 limpio:

```bash
docker exec postgres-lab pg_isready -U admin -d labdb
# localhost:5432 - accepting connections

# Si lab 2-6 aún está desplegado, límpialo primero
kubectl delete deployment products-api --ignore-not-found
kubectl delete service products-api-svc --ignore-not-found
kubectl delete secret db-secret --ignore-not-found
```

---

## Step 1 — Aplicar el Secret y desplegar v1

```bash
cd section02-kubernetes-intro/lab-2-7-rollout-undo

kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/api-deployment.yaml
# deployment.apps/products-api created   ← imagen v1 (sin logs)
# service/products-api-svc created

kubectl get pods -l app=products-api
# NAME                            READY   STATUS    RESTARTS   AGE
# products-api-xxxx-aaaaa         1/1     Running   0          30s
# products-api-xxxx-bbbbb         1/1     Running   0          30s
# products-api-xxxx-ccccc         1/1     Running   0          30s
```

---

## Step 2 — Construir la imagen v2 (con logs)

```bash
docker build -t lab2-7-products-api:v2 ./api

docker images | grep lab2-7
# lab2-7-products-api   v2   ...
```

---

## Step 3 — Probar v1: sin logs

Abre una terminal y sigue los logs:

```bash
kubectl logs -l app=products-api -f
```

En otra terminal llama al endpoint:

```bash
curl http://localhost:30092/api/products
```

En los logs NO aparece nada — v1 no tiene logging. Confirma que estás en v1.

---

## Step 4 — Rolling update a v2

```bash
# Actualizar la imagen — K8s reemplaza los 3 pods de uno en uno
kubectl set image deployment/products-api api=lab2-7-products-api:v2

# Seguir el rolling update en tiempo real
kubectl rollout status deployment/products-api
# Waiting for deployment "products-api" rollout to finish: 1 out of 3 new replicas...
# Waiting for deployment "products-api" rollout to finish: 2 out of 3 new replicas...
# deployment "products-api" successfully rolled out

# Ver el historial — ahora hay 2 revisiones
kubectl rollout history deployment/products-api
# REVISION  CHANGE-CAUSE
# 1         <none>   ← v1 sin logs
# 2         <none>   ← v2 con logs
```

---

## Step 5 — Verificar los logs en v2

Sigue los logs en una terminal:

```bash
kubectl logs -l app=products-api -f --prefix
```

En otra terminal ejecuta requests:

```bash
curl http://localhost:30092/api/products
curl http://localhost:30092/api/products/1
curl -X POST http://localhost:30092/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Auriculares","price":59.99,"stock":5,"description":"Bluetooth 5.0"}'
```

Verás los logs aparecer en tiempo real:

```
[products-api-yyyy-aaaaa] INFO  [GET]  /api/products - search=null
[products-api-yyyy-aaaaa] INFO  [GET]  /api/products - 3 productos encontrados
[products-api-yyyy-bbbbb] INFO  [GET]  /api/products/1 - encontrado: Teclado Mecánico
[products-api-yyyy-ccccc] INFO  [POST] /api/products - creando: name=Auriculares, price=59.99
```

Fíjate en el prefix — K8s balancea entre los 3 pods.

---

## Step 6 — Rollout undo (esta vez sí funciona)

```bash
# Revertir a la revisión anterior (v1 sin logs)
kubectl rollout undo deployment/products-api

kubectl rollout status deployment/products-api
# deployment "products-api" successfully rolled out

# Ver el historial — revisión 3 es el undo de v1
kubectl rollout history deployment/products-api
# REVISION  CHANGE-CAUSE
# 2         <none>
# 3         <none>   ← undo aplicado (volvió a la imagen v1)
```

Repite el curl y mira los logs — **ya no aparece nada**. Los pods volvieron a la
imagen v1 sin logging. `rollout undo` funcionó porque el cambio estaba en la
imagen del Deployment, no en un objeto externo.

---

## Step 7 — Limpiar

```bash
kubectl delete -f k8s/api-deployment.yaml
kubectl delete -f k8s/secret.yaml
```

---

## Tabla de conceptos

| Concepto | Descripción |
|----------|-------------|
| `kubectl set image` | Cambia la imagen de un contenedor sin editar el YAML |
| `kubectl rollout status` | Muestra el progreso del rolling update en tiempo real |
| `kubectl rollout history` | Lista las revisiones del Deployment |
| `kubectl rollout undo` | Revierte al Deployment spec anterior (imagen incluida) |
| `--prefix` | Muestra el nombre del Pod en cada línea de log |
| Rolling update | K8s reemplaza los Pods de uno en uno sin downtime |
