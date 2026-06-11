# Lab 2-2 — Services: exponer tu Pod con NodePort

Aprenderás a crear un Service de tipo NodePort que conecta con un Pod usando labels,
y accederás a nginx desde el navegador sin necesidad de port-forward.

## Archivos

```
nginx-service.yaml   ← Pod + Service NodePort en un solo archivo
```

## Pre-requisito

Cluster activo (minikube o Docker Desktop con Kubernetes habilitado).

```bash
kubectl get nodes
# NAME             STATUS   ROLES           AGE
# docker-desktop   Ready    control-plane   1d
```

---

## Step 1 — Aplicar el manifiesto

```bash
kubectl apply -f nginx-service.yaml
```

Salida esperada:
```
pod/mi-nginx created
service/mi-nginx-svc created
```

---

## Step 2 — Verificar Pod y Service

```bash
# Pod corriendo
kubectl get pods
# NAME       READY   STATUS    RESTARTS   AGE
# mi-nginx   1/1     Running   0          8s

# Service creado con NodePort 30090
kubectl get svc
# NAME           TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)        AGE
# mi-nginx-svc   NodePort    10.96.58.12     <none>        80:30090/TCP   8s

# Verificar que el Service apunta al Pod (K8s v1.33+)
kubectl get endpointslices -l kubernetes.io/service-name=mi-nginx-svc
# NAME                 ADDRESSTYPE   PORTS   ENDPOINTS      AGE
# mi-nginx-svc-xxxxx   IPv4          80      10.1.0.45      8s
```

### ¿Qué significan esas IPs y columnas?

| Columna | Valor | Qué es |
|---------|-------|--------|
| `CLUSTER-IP` | `10.96.58.12` | IP virtual **interna** del cluster. Solo otros Pods pueden usarla. Tú no puedes accederla desde tu máquina. |
| `EXTERNAL-IP` | `<none>` | En NodePort siempre dice `<none>`. Solo aparece una IP aquí con tipo `LoadBalancer` en un cloud real (GCP/AWS). |
| `PORT(S)` | `80:30090/TCP` | `80` = puerto interno del cluster · `30090` = puerto abierto en el nodo, accesible desde tu máquina. |

### ¿Cómo llega el tráfico desde el navegador hasta nginx?

```
Tu navegador  →  http://localhost:30090
                          ↓  nodePort (puerto abierto en el nodo / tu máquina)
         Service mi-nginx-svc  (ClusterIP 10.96.58.12:80)
                          ↓  selector app=mi-nginx → encuentra el Pod
                 Pod mi-nginx  (10.1.0.45:80)  ← targetPort, el container nginx
```

> **Docker Desktop** mapea automáticamente los `nodePort` a `localhost`, por eso
> funciona directo en el navegador sin configuración extra.
> **minikube** corre en una VM separada — necesitas `minikube service mi-nginx-svc --url`
> para obtener la URL correcta.

---

## Step 3 — Acceder desde el navegador

**Docker Desktop:**
```
http://localhost:30090
```

**minikube:**
```bash
minikube service mi-nginx-svc --url
# Abrir la URL que devuelve el comando
```

Deberías ver: **Welcome to nginx!**

---

## Step 4 — Limpiar

```bash
# Elimina tanto el Pod como el Service de una vez
kubectl delete -f nginx-service.yaml

# Verificar que no queda nada (solo el Service "kubernetes" del sistema es normal)
kubectl get pods
kubectl get svc
```

---

## Conceptos clave

| Término | Descripción |
|---------|-------------|
| `selector: app: mi-nginx` | El Service busca Pods con este label |
| `port: 80` | Puerto del Service dentro del cluster |
| `targetPort: 80` | Puerto del container nginx |
| `nodePort: 30090` | Puerto accesible desde tu máquina (30000–32767) |
| `ClusterIP` | Solo interno al cluster (comunicación entre microservicios) |
| `NodePort` | Accesible desde fuera del cluster, ideal para desarrollo local |
| `LoadBalancer` | IP pública via cloud (GCP/AWS/Azure), para producción |
