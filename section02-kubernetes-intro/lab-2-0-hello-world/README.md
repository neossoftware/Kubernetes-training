# Lab 2-0 — Hello World en Kubernetes: tu primer Pod con YAML

Crearás un Pod de nginx con una **página HTML personalizada** inyectada via ConfigMap
y lo expondrás con un Service NodePort en un namespace dedicado.

## Archivos

```
hello-configmap.yaml   ← ConfigMap con la página HTML
hello-app.yaml         ← Pod (monta el ConfigMap) + Service NodePort
```

## Pre-requisito

Cluster activo (minikube o Docker Desktop con Kubernetes habilitado).

```bash
kubectl get nodes
```

---

## Step 1 — Crear el namespace

```bash
kubectl create namespace hello

# Verificar
kubectl get namespaces
```

---

## Step 2 — Aplicar el ConfigMap

El ConfigMap contiene el HTML de la página. El Pod lo montará como volumen.

```bash
kubectl apply -f hello-configmap.yaml
# configmap/hello-html created
```

---

## Step 3 — Aplicar el Pod y el Service

```bash
kubectl apply -f hello-app.yaml
# pod/hello-pod created
# service/hello-svc created
```

---

## Step 4 — Verificar

```bash
# Pod corriendo
kubectl get pods -n hello
# NAME        READY   STATUS    RESTARTS   AGE
# hello-pod   1/1     Running   0          15s

# Service con NodePort 30080
kubectl get svc -n hello
# NAME        TYPE       CLUSTER-IP      EXTERNAL-IP   PORT(S)        AGE
# hello-svc   NodePort   10.96.144.201   <none>        80:30080/TCP   15s
```

---

## Step 5 — Acceder desde el navegador

**Docker Desktop:**
```
http://localhost:30080
```

**minikube:**
```bash
minikube service hello-svc -n hello --url
# Abrir la URL que devuelve el comando
```

Deberías ver: **☸ Hello from Kubernetes!** con fondo degradado azul-morado.

---

## Step 6 — Comandos de diagnóstico

```bash
# Descripción completa del Pod (eventos, volúmenes, estado)
kubectl describe pod hello-pod -n hello

# Logs del container nginx
kubectl logs hello-pod -n hello

# Entrar al container (como docker exec)
kubectl exec -it hello-pod -n hello -- sh

# Ver todos los recursos del namespace de un vistazo
kubectl get all -n hello
```

---

## Step 7 — Limpiar

```bash
# Elimina todos los recursos del namespace de una vez
kubectl delete namespace hello

# Verificar
kubectl get namespaces
```

---

## Conceptos clave

| Concepto | Explicación |
|----------|-------------|
| `ConfigMap` | Almacena configuración (archivos, variables). El Pod lo monta como volumen. |
| `volumeMounts.mountPath` | Ruta dentro del container donde se monta el ConfigMap |
| `namespace` | Espacio aislado dentro del cluster. `kubectl delete namespace` borra todo lo que contiene. |
| `kubectl apply -f` | Crea o actualiza recursos declarados en el YAML |
| `kubectl delete namespace` | La forma más limpia de limpiar un lab completo |
