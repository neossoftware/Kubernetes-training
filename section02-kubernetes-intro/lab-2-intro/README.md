# Lab 2-Intro — Primer contacto con Kubernetes

Lab 100% imperativo: sin archivos YAML. Solo comandos kubectl.

## Comandos

```bash
# 1. Verificar cluster activo
kubectl get nodes

# 2. Crear el Pod
kubectl run mi-nginx --image=nginx:1.27-alpine

# 3. Verificar que está Running
kubectl get pods

# 4. Exponer con port-forward
kubectl port-forward pod/mi-nginx 8080:80
# Abrir en el navegador: http://localhost:8080

# 5. Limpiar (Ctrl+C primero para detener port-forward)
kubectl delete pod mi-nginx
kubectl get pods
```
