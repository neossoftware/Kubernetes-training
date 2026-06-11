# Lab 2-5 — Actualiza tu app sin downtime: Deployment + ConfigMap

Combina el Deployment de 3 réplicas (Lab 2-4) con un ConfigMap (Lab 2-3).
Actualiza la página HTML y aplica el cambio con rolling update — sin downtime.

## Archivos

```
nginx-configmap.yaml        ← ConfigMap con la página HTML (v1 azul-morado)
nginx-deployment-v2.yaml    ← Deployment 3 réplicas + volumeMount + Service
```

---

## Diferencia clave vs Lab 2-3

| Lab 2-3 (Pod directo) | Lab 2-5 (Deployment) |
|-----------------------|----------------------|
| `kubectl delete pod` + `kubectl apply` | `kubectl rollout restart` |
| Hay un momento sin servicio | Rolling update: siempre hay pods activos |
| Sin historial de versiones | `kubectl rollout history` + `rollout undo` |

---

## Pre-requisito

```bash
kubectl get nodes
```

---

## Step 1 — Aplicar ConfigMap y Deployment

```bash
# ConfigMap primero (el Pod lo necesita al arrancar)
kubectl apply -f nginx-configmap.yaml
kubectl apply -f nginx-deployment-v2.yaml

# Verificar
kubectl get pods
# NAME                            READY   STATUS    RESTARTS   AGE
# nginx-deploy-xxxx-aaaaa         1/1     Running   0          8s
# nginx-deploy-xxxx-bbbbb         1/1     Running   0          8s
# nginx-deploy-xxxx-ccccc         1/1     Running   0          8s
```

Abrir en el navegador → **http://localhost:30091** → verás la v1 (fondo azul-morado).

---

## Step 2 — Modificar el ConfigMap (v2)

Edita `nginx-configmap.yaml` y cambia:

```yaml
# Cambiar el gradiente:
background: linear-gradient(135deg, #f59e0b 0%, #dc2626 100%);  # naranja-rojo

# Cambiar texto y badge:
<h1>☸ ¡Actualización sin downtime!</h1>
<div class="badge">v2 · Lab 2-5</div>
```

Aplicar el ConfigMap actualizado:

```bash
kubectl apply -f nginx-configmap.yaml
# configmap/nginx-html configured
```

---

## Step 3 — Rolling Update

```bash
# Reiniciar el Deployment — reemplaza los Pods de uno en uno
kubectl rollout restart deployment/nginx-deploy

# Seguir el progreso en tiempo real
kubectl rollout status deployment/nginx-deploy
# Waiting for deployment "nginx-deploy" rollout to finish: 1 out of 3 new replicas...
# Waiting for deployment "nginx-deploy" rollout to finish: 2 out of 3 new replicas...
# deployment "nginx-deploy" successfully rolled out

# Ver los pods con nuevo hash (indica que son nuevos)
kubectl get pods
```

Recarga **http://localhost:30091** → fondo naranja-rojo, badge "v2 · Lab 2-5".
En ningún momento la app dejó de responder.

---

## Step 4 — Actualiza el ConfigMap para cambiar la apariencia

Puedes actualizar la app las veces que quieras — solo edita el ConfigMap y reinicia el
Deployment. Volvamos a la v1 (fondo azul-morado):

Edita `nginx-configmap.yaml` y restaura el gradiente original:
```yaml
background: linear-gradient(135deg, #6366f1 0%, #7c3aed 100%);
# y el texto:
<h1>☸ Deployment + ConfigMap</h1>
<div class="badge">v1 · Lab 2-5</div>
```

Luego aplica y reinicia:

```bash
kubectl apply -f nginx-configmap.yaml
# configmap/nginx-html configured

kubectl rollout restart deployment/nginx-deploy
kubectl rollout status deployment/nginx-deploy
# deployment "nginx-deploy" successfully rolled out
```

Recarga `http://localhost:30091` — volvió el fondo azul-morado.

Este es el flujo completo: **editar YAML → `kubectl apply` → `kubectl rollout restart`**.

---

## Step 5 — Limpiar

```bash
kubectl delete -f nginx-deployment-v2.yaml
kubectl delete -f nginx-configmap.yaml
```

---

## Tabla de conceptos

| Concepto | Descripción |
|----------|-------------|
| `rollout restart` | Recrea los Pods de uno en uno con el ConfigMap actualizado |
| `rollout status` | Muestra el progreso del rolling update en tiempo real |
| Rolling Update | K8s nunca deja de haber Pods disponibles durante la actualización |
| `kubectl apply -f` | Aplica cualquier cambio en un manifiesto YAML al clúster |
