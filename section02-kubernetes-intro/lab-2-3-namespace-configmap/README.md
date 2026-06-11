# Lab 2-3 — Comprende Namespace y ConfigMap

Aprenderás a organizar recursos en un **Namespace** dedicado y a inyectar
configuración en un Pod mediante un **ConfigMap** montado como volumen.

## Archivos

```
hello-configmap.yaml   ← ConfigMap con la página HTML (namespace: hello)
hello-app.yaml         ← Pod (monta el ConfigMap) + Service NodePort
```

---

## Conceptos clave antes de empezar

### ¿Qué es un Namespace?
Partición lógica dentro del cluster. Todos los recursos de este lab viven
en el namespace `hello` — al borrarlo, se borran todos de una vez.

```
Cluster
├── ns: default      ← donde van tus recursos si no especificas namespace
├── ns: kube-system  ← componentes internos de K8s. No tocar.
└── ns: hello        ← el que crearemos en este lab
```

### ¿Qué es un ConfigMap?
Almacena configuración (archivos, variables) separada del container.
K8s lo monta dentro del Pod como si fuera un archivo en disco.

```
ConfigMap: hello-html              Pod: hello-pod
  data:                              volumeMounts:
    index.html: |         →→→          mountPath: /usr/share/nginx/html
      <h1>Hello K8s!</h1>              (nginx sirve desde aquí)
```

---

## Pre-requisito

```bash
kubectl get nodes
```

---

## Step 1 — Crear el Namespace

```bash
kubectl create namespace hello

kubectl get namespaces
# NAME          STATUS   AGE
# default       Active   2d
# hello         Active   3s
# kube-system   Active   2d
```

---

## Step 2 — Aplicar el ConfigMap

El ConfigMap debe existir **antes** del Pod, porque el Pod lo necesita al arrancar.

```bash
kubectl apply -f hello-configmap.yaml
# configmap/hello-html created

# Ver su contenido
kubectl describe configmap hello-html -n hello
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
kubectl get pods -n hello
# NAME        READY   STATUS    RESTARTS   AGE
# hello-pod   1/1     Running   0          10s

kubectl get svc -n hello
# NAME        TYPE       CLUSTER-IP      EXTERNAL-IP   PORT(S)        AGE
# hello-svc   NodePort   10.96.144.201   <none>        80:30080/TCP   10s
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
```

Deberías ver: **☸ Hello from Kubernetes!** con fondo degradado azul-morado.

---

## Step 6 — Diagnóstico

```bash
# Ver descripción completa del Pod (eventos, volúmenes montados)
kubectl describe pod hello-pod -n hello

# Verificar que el ConfigMap está montado correctamente dentro del container
kubectl exec -it hello-pod -n hello -- cat /usr/share/nginx/html/index.html

# Ver todos los recursos del namespace de un vistazo
kubectl get all -n hello
```

---

## Step 7 — Limpiar

```bash
# Borra el namespace y TODO lo que contiene de una sola vez
kubectl delete namespace hello

kubectl get namespaces
```

---

## Tabla de conceptos

| Concepto | Descripción |
|----------|-------------|
| `Namespace` | Partición lógica del cluster. Aísla recursos entre equipos/entornos. |
| `kubectl create namespace` | Crea un namespace vacío |
| `kubectl delete namespace` | Borra el namespace y **todos** sus recursos |
| `ConfigMap` | Almacena config (archivos/vars) fuera de la imagen Docker |
| `volumeMounts.mountPath` | Ruta dentro del container donde se monta el ConfigMap |
| `-n hello` | Flag para apuntar a un namespace en cualquier comando kubectl |
| `kubectl describe` | Muestra el estado detallado de un recurso, incluyendo eventos |
