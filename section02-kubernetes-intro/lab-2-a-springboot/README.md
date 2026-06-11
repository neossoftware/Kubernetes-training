# Lab 2-A — Spring Boot Products API + PostgreSQL en Kubernetes

Stack completo desplegado en Kubernetes: base de datos PostgreSQL con almacenamiento
persistente, API Spring Boot con rolling updates, health probes y autoscaling (HPA).

## Estructura de archivos

```
lab-2-a-springboot/
├── namespace.yaml              Namespace "labs"
├── secret.yaml                 Credenciales de PostgreSQL
├── configmap.yaml              Variables de configuración para Spring Boot
├── postgres/
│   ├── pvc.yaml                PersistentVolumeClaim (1Gi de almacenamiento)
│   ├── deployment.yaml         Deployment de PostgreSQL con liveness/readiness probes
│   └── service.yaml            Service ClusterIP (solo accesible dentro del cluster)
└── products-api/
    ├── deployment.yaml         Deployment Spring Boot con 2 réplicas y 3 health probes
    ├── service.yaml            Service NodePort para acceso externo
    └── hpa.yaml                HorizontalPodAutoscaler (escala entre 2 y 8 réplicas)
```

---

## Pre-requisitos

- Cluster activo con al menos 2 CPUs y 4GB RAM (minikube o Docker Desktop)
- Imagen de la API publicada en Docker Hub

```bash
# Verificar cluster
kubectl get nodes

# Arrancar minikube con recursos suficientes (si usas minikube)
minikube start --driver=docker --cpus=2 --memory=4096

# Habilitar metrics-server para que funcione el HPA
minikube addons enable metrics-server
# (En Docker Desktop: ya viene habilitado)
```

---

## Step 1 — Construir y publicar la imagen de la API

```bash
# Desde la carpeta de la API Spring Boot
cd ../../section01-docker/lab2-springboot-postgre-compose/products-api

docker build -t TUUSUARIO/products-api:v1 .
docker push TUUSUARIO/products-api:v1
```

> Reemplaza `TUUSUARIO` con tu usuario de Docker Hub en `products-api/deployment.yaml`.

---

## Step 2 — Aplicar los manifiestos en orden

El orden importa: primero el namespace, luego secrets/config, luego la DB, y por último la API.

```bash
# Ir a la carpeta del lab
cd section02-kubernetes-intro/lab-2-a-springboot

# 1. Namespace
kubectl apply -f namespace.yaml

# 2. Credenciales y configuración
kubectl apply -f secret.yaml
kubectl apply -f configmap.yaml

# 3. PostgreSQL (PVC → Deployment → Service)
kubectl apply -f postgres/pvc.yaml
kubectl apply -f postgres/deployment.yaml
kubectl apply -f postgres/service.yaml

# 4. Esperar a que PostgreSQL esté listo antes de arrancar la API
kubectl wait --for=condition=ready pod -l app=postgres -n labs --timeout=120s

# 5. Products API
kubectl apply -f products-api/deployment.yaml
kubectl apply -f products-api/service.yaml
kubectl apply -f products-api/hpa.yaml
```

---

## Step 3 — Verificar el despliegue

```bash
# Ver todos los recursos del namespace
kubectl get all -n labs

# Esperar a que los pods de la API estén Running (Spring Boot tarda ~15s)
kubectl get pods -n labs -w

# Logs de la API (busca "Started ProductsApiApplication")
kubectl logs -n labs -l app=products-api -f
```

---

## Step 4 — Acceder a la API

**Docker Desktop:**
```bash
# Ver qué nodePort asignó K8s al service
kubectl get svc products-api-svc -n labs
# Busca el puerto en la columna PORT(S), ej: 80:31234/TCP

# O usar port-forward
kubectl port-forward -n labs svc/products-api-svc 8080:80
```

**minikube:**
```bash
minikube service products-api-svc -n labs --url
```

**Verificar endpoints:**
```bash
curl http://localhost:8080/actuator/health
curl http://localhost:8080/api/products
```

---

## Step 5 — Probar Rolling Update sin downtime

```bash
# Terminal 1: monitorear pods en tiempo real
watch kubectl get pods -n labs

# Terminal 2: actualizar la imagen a v2
kubectl set image deployment/products-api api=TUUSUARIO/products-api:v2 -n labs

# Ver historial de deployments
kubectl rollout history deployment/products-api -n labs

# Hacer rollback si algo salió mal
kubectl rollout undo deployment/products-api -n labs
```

---

## Step 6 — Probar el autoscaling (HPA)

```bash
# Ver estado actual del HPA
kubectl get hpa -n labs

# Generar carga para disparar el autoscaling
kubectl run load-generator --image=busybox -n labs --rm -it -- \
  sh -c "while true; do wget -q -O- http://products-api-svc/api/products; done"

# En otra terminal: observar cómo escalan los pods
watch kubectl get pods -n labs
```

---

## Step 7 — Limpiar

```bash
kubectl delete namespace labs

# Verificar
kubectl get namespaces
```

---

## Conceptos clave

| Concepto | Descripción |
|----------|-------------|
| `PersistentVolumeClaim` | Solicitud de almacenamiento persistente. Los datos de PostgreSQL sobreviven reinicios del Pod. |
| `secretRef` | Inyecta todas las claves de un Secret como variables de entorno |
| `configMapRef` | Inyecta todas las claves de un ConfigMap como variables de entorno |
| `RollingUpdate` | Actualiza los Pods de a uno sin downtime. `maxUnavailable: 0` garantiza cero caídas. |
| `startupProbe` | Da tiempo a Spring Boot para arrancar antes de que liveness/readiness entren en acción |
| `livenessProbe` | Reinicia el Pod si la app entra en estado irrecuperable |
| `readinessProbe` | Quita el Pod del LoadBalancer si no está listo para recibir tráfico |
| `HorizontalPodAutoscaler` | Escala automáticamente entre 2 y 8 réplicas según CPU/memoria |
| `ClusterIP` | PostgreSQL solo es accesible desde dentro del cluster (ningún puerto expuesto al exterior) |
