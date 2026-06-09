# Lab 0.1 — Volúmenes y PostgreSQL en Docker

> **Objetivo:** Crear un volumen nombrado, arrancar PostgreSQL con datos persistentes y verificar que el contenedor está listo para recibir conexiones.

---

## 1. Crear la red

```bash
docker network create mi-red
```

Crea una red bridge llamada `mi-red`. Los contenedores conectados a ella se comunican por nombre de servicio.

---

## 2. Gestionar el volumen

```bash
# Crear el volumen con nombre explícito
docker volume create postgres-data

# Listar todos los volúmenes
docker volume ls

# Inspeccionar el volumen (muestra la ruta donde Docker almacena los datos)
docker volume inspect postgres-data
```

Un **named volume** persiste los datos aunque el contenedor se elimine. Si vuelves a crear el contenedor apuntando al mismo volumen, los datos siguen ahí.

### ¿Dónde están físicamente los datos en tu máquina?

`docker volume inspect` muestra una ruta como esta:

```json
"Mountpoint": "/var/lib/docker/volumes/postgres-data/_data"
```

**En Linux** esa ruta existe directamente en el sistema de archivos del host.

**En Mac** esa ruta NO existe en tu Mac — Docker Desktop corre dentro de una VM Linux oculta, y los datos viven dentro de esa VM:

```
Tu Mac (macOS)
└── VM Linux oculta (Docker Desktop)
    └── /var/lib/docker/volumes/postgres-data/_data/   ← datos reales aquí
        └── contenedor postgres-lab
            └── /var/lib/postgresql/data/pgdata/       ← lo que ve Postgres
```

Si necesitas acceder a esa ruta en Mac, puedes entrar a la VM así:

```bash
docker run -it --rm --privileged --pid=host alpine nsenter -t 1 -m -u -n -i sh
# Ahora sí puedes navegar a /var/lib/docker/volumes/postgres-data/_data/
```

### Named volume vs Bind mount

Hay dos formas de montar datos en Docker:

| | Named volume (`-v postgres-data:/ruta`) | Bind mount (`-v /mi/carpeta:/ruta`) |
|---|---|---|
| Dónde vive | Dentro de la VM de Docker | Carpeta real de tu Mac |
| Rendimiento en Mac | Mejor | Más lento (sincronización VM↔Mac) |
| Fácil de explorar | No (dentro de VM) | Sí (`ls /mi/carpeta`) |
| Uso recomendado | Bases de datos, producción | Código fuente en desarrollo |

Para bases de datos siempre se recomienda **named volume** — mejor rendimiento y Docker gestiona el ciclo de vida completo.

---

## 3. Arrancar PostgreSQL

```bash
docker run -d \
  --name postgres-lab \
  --network mi-red \
  -e POSTGRES_DB=labdb \
  -e POSTGRES_USER=admin \
  -e POSTGRES_PASSWORD=ninja123 \
  -e PGDATA=/var/lib/postgresql/data/pgdata \
  -v postgres-data:/var/lib/postgresql/data \
  -p 5432:5432 \
  postgres:16-alpine
```

| Flag | Qué hace |
|---|---|
| `-d` | Corre en segundo plano (detached) |
| `--name postgres-lab` | Nombre fijo del contenedor |
| `--network mi-red` | Lo conecta a la red interna del lab |
| `-e POSTGRES_DB` | Crea esta base de datos al iniciar |
| `-e POSTGRES_USER/PASSWORD` | Credenciales del superusuario |
| `-e PGDATA` | Subdirectorio dentro del volumen donde Postgres escribe los datos |
| `-v postgres-data:/var/lib/postgresql/data` | Monta el named volume |
| `-p 5432:5432` | Expone el puerto al host para conectarte con un cliente externo |

> **¿Por qué `PGDATA` apunta a un subdirectorio?**  
> PostgreSQL requiere que la carpeta de datos esté vacía al inicializar. Al montar un volumen en `/var/lib/postgresql/data`, Docker puede dejar archivos ocultos ahí (como `lost+found`). Usar un subdirectorio `/pgdata` evita ese conflicto.

---

## 4. Verificar que PostgreSQL está listo

```bash
# Ver los logs del contenedor
docker logs postgres-lab

# Verificar que el servidor acepta conexiones
docker exec postgres-lab pg_isready -U admin -d labdb
```

`pg_isready` devuelve:
- `accepting connections` — todo bien, puedes conectarte
- `rejecting connections` — está iniciando, espera unos segundos y reintenta
- `no response` — el proceso no levantó, revisa `docker logs`

---

## 5. Conectarte a la base de datos

```bash
docker exec -it postgres-lab psql -U admin -d labdb
```

Desde el prompt de `psql` puedes probar:

```sql
-- Ver las bases de datos
\l

-- Crear una tabla de prueba
CREATE TABLE productos (id SERIAL PRIMARY KEY, nombre TEXT);

-- Insertar un registro
INSERT INTO productos (nombre) VALUES ('Teclado');

-- Consultar
SELECT * FROM productos;

-- Salir
\q
```

---

## 6. Probar la persistencia

```bash
# Eliminar el contenedor (NO el volumen)
docker rm -f postgres-lab

# Volver a crearlo con el mismo volumen
docker run -d \
  --name postgres-lab \
  --network mi-red \
  -e POSTGRES_DB=labdb \
  -e POSTGRES_USER=admin \
  -e POSTGRES_PASSWORD=ninja123 \
  -e PGDATA=/var/lib/postgresql/data/pgdata \
  -v postgres-data:/var/lib/postgresql/data \
  -p 5432:5432 \
  postgres:16-alpine

# Conectarse y verificar que los datos siguen ahí
docker exec -it postgres-lab psql -U admin -d labdb -c "SELECT * FROM productos;"
```

La tabla y los registros sobreviven porque están en el volumen, no en el contenedor.

---

## 7. Limpiar

```bash
# Detener y eliminar el contenedor
docker rm -f postgres-lab

# Eliminar el volumen (esto SÍ borra los datos)
docker volume rm postgres-data

# Eliminar la red
docker network rm mi-red
```
