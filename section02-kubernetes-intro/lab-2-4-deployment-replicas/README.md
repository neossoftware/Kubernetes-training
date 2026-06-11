# Lab 2-4 — Tu primer Deployment: 3 réplicas de nginx

Aprenderás a crear un Deployment, entender la jerarquía
Deployment → ReplicaSet → Pods, y comprobar la autocuración de K8s.

## Archivos

```
nginx-deployment.yaml   ← Deployment (3 réplicas) + Service NodePort
```

---

## Conceptos clave

### Jerarquía de objetos

```
Deployment           ← describes el estado deseado ("quiero 3 pods")
    └── ReplicaSet   ← mantiene el número de réplicas
            ├── Pod 1
            ├── Pod 2
            └── Pod 3
```

### ¿Por qué usar Deployment en lugar de Pod directo?

| Pod directo | Deployment |
|-------------|------------|
| Si muere → app caída | Si un Pod muere → K8s crea uno nuevo |
| No escala | `kubectl scale --replicas=N` |
| Sin rolling updates | Actualización sin downtime |

---

## Pre-requisito

```bash
kubectl get nodes
```

---

## Step 1 — Aplicar el manifiesto

```bash
kubectl apply -f nginx-deployment.yaml
# deployment.apps/nginx-deploy created
# service/nginx-deploy-svc created
```

---

## Step 2 — Verificar los 3 Pods y el ReplicaSet

```bash
# Ver el Deployment (READY 3/3 = 3 pods listos de 3 deseados)
kubectl get deployments
# NAME           READY   UP-TO-DATE   AVAILABLE   AGE
# nginx-deploy   3/3     3            3           10s

# Ver los 3 Pods creados automáticamente
kubectl get pods
# NAME                            READY   STATUS    RESTARTS   AGE
# nginx-deploy-7d6b8c9f4-abcde    1/1     Running   0          12s
# nginx-deploy-7d6b8c9f4-fghij    1/1     Running   0          12s
# nginx-deploy-7d6b8c9f4-klmno    1/1     Running   0          12s

# Ver el ReplicaSet que gestiona los Pods
kubectl get replicasets
# NAME                       DESIRED   CURRENT   READY
# nginx-deploy-7d6b8c9f4     3         3         3
```

---

## Step 3 — Probar la autocuración

Elimina un Pod a propósito y observa cómo K8s lo recrea:

```bash
# Copia el nombre de uno de tus pods
kubectl delete pod nginx-deploy-7d6b8c9f4-abcde

# Mira cómo inmediatamente aparece uno nuevo
kubectl get pods
# nginx-deploy-7d6b8c9f4-fghij    1/1     Running             45s
# nginx-deploy-7d6b8c9f4-klmno    1/1     Running             45s
# nginx-deploy-7d6b8c9f4-xyzab    0/1     ContainerCreating   2s  ← nuevo

# El Deployment sigue en 3/3
kubectl get deployments
```

---

## Step 4 — Escalar

```bash
# Subir a 5 réplicas
kubectl scale deployment nginx-deploy --replicas=5
kubectl get pods   # verás 5 pods

# Bajar a 2 réplicas
kubectl scale deployment nginx-deploy --replicas=2
kubectl get pods   # K8s termina 3 pods y deja 2
```

---

## Step 5 — Acceder desde el navegador

**Docker Desktop:** `http://localhost:30091`

**minikube:**
```bash
minikube service nginx-deploy-svc --url
```

---

## Step 6 — Limpiar

```bash
kubectl delete -f nginx-deployment.yaml

kubectl get pods
kubectl get deployments
```

---

## Tabla de conceptos

| Concepto | Descripción |
|----------|-------------|
| `replicas: 3` | K8s mantiene exactamente 3 Pods corriendo siempre |
| `ReplicaSet` | Objeto que K8s crea automáticamente para vigilar las réplicas |
| `matchLabels` | El Deployment identifica sus Pods por este label |
| `template` | Plantilla usada para crear cada Pod del Deployment |
| `kubectl scale` | Cambia el número de réplicas sin editar el YAML |
| Autocuración | Si un Pod muere, el ReplicaSet crea uno nuevo automáticamente |
