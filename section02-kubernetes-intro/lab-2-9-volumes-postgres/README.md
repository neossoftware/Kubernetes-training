# Lab 2-9 — Volúmenes y Almacenamiento Persistente con PostgreSQL

Demuestra de forma práctica por qué los datos de una base de datos **no pueden vivir dentro de un Pod**: primero lo pierdes, luego lo salvas con un `PersistentVolumeClaim`.

> **Namespace:** `lab2-9`

## Arquitectura

```
PARTE 1 — Sin volumen (datos efímeros)

  postgres Pod
  ┌─────────────────────────────┐
  │  /var/lib/postgresql/data   │  ← almacenamiento dentro del contenedor
  │  (desaparece al morir el Pod)│
  └─────────────────────────────┘
         ↓ kubectl delete pod
  DATOS PERDIDOS ✗

─────────────────────────────────────────────

PARTE 2 — Con PVC (datos persistentes)

  postgres Pod
  ┌─────────────────────────────┐
  │  /var/lib/postgresql/data   │
  │     ↕ volumeMount           │
  └─────────────────────────────┘
             │
  ┌──────────▼──────────┐
  │  PersistentVolumeClaim│  ← postgres-pvc (1Gi)
  └──────────┬───────────┘
             │
  ┌──────────▼──────────┐
  │  PersistentVolume   │  ← provisionado por StorageClass (hostpath en Docker Desktop)
  │  (disco del nodo)   │
  └─────────────────────┘
         ↓ kubectl delete pod
  K8s crea nuevo Pod → monta el mismo PVC
  DATOS SOBREVIVEN ✓
```

## Conceptos clave

| Concepto | Descripción |
|----------|-------------|
| `emptyDir` | Volumen temporal compartido entre contenedores del mismo Pod — muere con el Pod |
| `PersistentVolume (PV)` | Disco físico disponible en el clúster — creado por el admin o por StorageClass |
| `PersistentVolumeClaim (PVC)` | Solicitud de almacenamiento de un Pod — K8s lo liga a un PV disponible |
| `StorageClass` | Define cómo se aprovisiona el almacenamiento (hostpath local, EBS en AWS, etc.) |
| `ReadWriteOnce` | Un solo nodo puede leer y escribir a la vez — correcto para una BD con 1 réplica |
| `volumeMounts` | Ruta dentro del contenedor donde se monta el volumen |
| `PGDATA` | Variable de PostgreSQL que define el subdirectorio de datos dentro del mountPath |

## Archivos

```
k8s/
  namespace.yaml                ← namespace lab2-9
  secret.yaml                   ← credenciales PostgreSQL
  part1-postgres-no-volume.yaml ← Deployment SIN PVC (datos efímeros)
  part2-postgres-pvc.yaml       ← PVC + Deployment CON volumen persistente
```

---

## Pre-requisito

```bash
# Verificar que el clúster está activo
kubectl cluster-info

# Verificar StorageClass disponible
kubectl get storageclass
# NAME                 PROVISIONER          ...
# hostpath (default)   docker.io/hostpath   ...
```

---

## PARTE 1 — El problema: datos que desaparecen

### Step 1 — Crear namespace y desplegar PostgreSQL sin volumen

```bash
cd section02-kubernetes-intro/lab-2-9-volumes-postgres

kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/part1-postgres-no-volume.yaml

kubectl get pods -n lab2-9 -w
# NAME                        READY   STATUS    RESTARTS   AGE
# postgres-xxxx-aaaaa         1/1     Running   0          15s
```

### Step 2 — Insertar datos

```bash
# Conectar a PostgreSQL dentro del Pod
kubectl exec -it deployment/postgres -n lab2-9 -- psql -U admin -d labdb

# Dentro de psql:
CREATE TABLE productos (
  id     SERIAL PRIMARY KEY,
  nombre VARCHAR(100),
  precio DECIMAL(10,2)
);

INSERT INTO productos (nombre, precio) VALUES ('Teclado Mecánico', 89.99);
INSERT INTO productos (nombre, precio) VALUES ('Mouse Logitech',   45.00);
INSERT INTO productos (nombre, precio) VALUES ('Monitor 4K',      349.00);

SELECT * FROM productos;
--  id |     nombre       | precio
-- ----+------------------+--------
--   1 | Teclado Mecánico |  89.99
--   2 | Mouse Logitech   |  45.00
--   3 | Monitor 4K       | 349.00

\q
```

### Step 3 — Eliminar el Pod y observar

```bash
# Guardar el nombre del Pod actual
kubectl get pods -n lab2-9

# Eliminar el Pod (el Deployment crea uno nuevo automáticamente)
kubectl delete pod -l app=postgres -n lab2-9

# Observar cómo K8s levanta uno nuevo
kubectl get pods -n lab2-9 -w
# NAME                        READY   STATUS              RESTARTS   AGE
# postgres-xxxx-aaaaa         Terminating                            45s
# postgres-xxxx-bbbbb         ContainerCreating                      2s
# postgres-xxxx-bbbbb         1/1     Running             0          8s
```

### Step 4 — Verificar que los datos desaparecieron

```bash
kubectl exec -it deployment/postgres -n lab2-9 -- psql -U admin -d labdb

SELECT * FROM productos;
# ERROR:  relation "productos" does not exist

\q
```

> **La tabla no existe.** El nuevo Pod arrancó con un sistema de archivos vacío — los datos que insertamos están perdidos para siempre.

---

## PARTE 2 — La solución: PersistentVolumeClaim

### Step 5 — Limpiar la Parte 1 y desplegar con PVC

```bash
# Eliminar el Deployment de la Parte 1 (el Secret y namespace se reusan)
kubectl delete -f k8s/part1-postgres-no-volume.yaml

# Desplegar PVC + Deployment con volumen
kubectl apply -f k8s/part2-postgres-pvc.yaml

# Verificar que el PVC fue provisionado y está Bound
kubectl get pvc -n lab2-9
# NAME           STATUS   VOLUME       CAPACITY   ACCESS MODES   STORAGECLASS   AGE
# postgres-pvc   Bound    pvc-xxx...   1Gi        RWO            hostpath       10s
#                ^^^^^^
#                Bound = K8s encontró un PV y lo asignó

kubectl get pods -n lab2-9
# NAME                        READY   STATUS    RESTARTS   AGE
# postgres-xxxx-ccccc         1/1     Running   0          20s
```

### Step 6 — Insertar datos (de nuevo)

```bash
kubectl exec -it deployment/postgres -n lab2-9 -- psql -U admin -d labdb

CREATE TABLE productos (
  id     SERIAL PRIMARY KEY,
  nombre VARCHAR(100),
  precio DECIMAL(10,2)
);

INSERT INTO productos (nombre, precio) VALUES ('Teclado Mecánico', 89.99);
INSERT INTO productos (nombre, precio) VALUES ('Mouse Logitech',   45.00);
INSERT INTO productos (nombre, precio) VALUES ('Monitor 4K',      349.00);

SELECT * FROM productos;
--  id |     nombre       | precio
-- ----+------------------+--------
--   1 | Teclado Mecánico |  89.99
--   2 | Mouse Logitech   |  45.00
--   3 | Monitor 4K       | 349.00

\q
```

### Step 7 — Eliminar el Pod y verificar que los datos sobreviven

```bash
# Eliminar el Pod
kubectl delete pod -l app=postgres -n lab2-9

# Esperar a que K8s cree el nuevo Pod
kubectl get pods -n lab2-9 -w
# postgres-xxxx-dddd   1/1   Running   0   12s

# Conectar al NUEVO Pod
kubectl exec -it deployment/postgres -n lab2-9 -- psql -U admin -d labdb

SELECT * FROM productos;
--  id |     nombre       | precio
-- ----+------------------+--------
--   1 | Teclado Mecánico |  89.99
--   2 | Mouse Logitech   |  45.00
--   3 | Monitor 4K       | 349.00

\q
```

> **Los datos sobrevivieron.** El nuevo Pod montó el mismo PVC — los datos estaban en el disco del nodo, no en el contenedor.

### Step 8 — Inspeccionar el PVC y el PV

```bash
# Ver el PVC y el PV que K8s provisionó automáticamente
kubectl get pvc,pv -n lab2-9

# Descripción detallada del PVC
kubectl describe pvc postgres-pvc -n lab2-9
# Name:          postgres-pvc
# Namespace:     lab2-9
# StorageClass:  hostpath
# Status:        Bound
# Volume:        pvc-abc123...
# Capacity:      1Gi
# Access Modes:  RWO
```

---

## Step 9 — Limpiar

```bash
# Eliminar namespace (borra pods, services y secret)
kubectl delete namespace lab2-9

# El PVC y PV se eliminan junto con el namespace
kubectl get pv   # sin PVs del lab
```

---

## Comparación final

| | Sin volumen (Parte 1) | Con PVC (Parte 2) |
|---|---|---|
| **Datos tras reiniciar Pod** | Perdidos ✗ | Sobreviven ✓ |
| **Dónde viven los datos** | Capa efímera del contenedor | Disco del nodo (PV) |
| **Al hacer rollout update** | Datos perdidos | PVC se reasigna al nuevo Pod |
| **Uso en producción** | Nunca para BD | Siempre para BD |
