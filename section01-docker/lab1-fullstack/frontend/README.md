# Lab 1 — Frontend

> **Módulo:** Introducción a Docker — lado cliente  
> **Objetivo:** Entender cómo un frontend React se comunica con una API containerizada, y qué rol juegan las herramientas del stack (Vite, Axios, React).

---

## Qué hace este frontend

Interfaz web que consume la API del Lab 1 (`api/`) y permite:

- Ver el listado de productos en tiempo real
- Crear un producto nuevo mediante un formulario
- Eliminar un producto con un clic
- Mostrar información del servidor (hostname, entorno) — útil en Kubernetes para ver en qué pod estás hablando

---

## Estructura

```
frontend/
├── src/
│   ├── main.jsx      ← punto de entrada, monta React en el DOM
│   └── App.jsx       ← toda la lógica: estado, llamadas a la API, UI
├── Dockerfile        ← imagen de producción (multi-stage: build + nginx)
├── nginx.conf        ← configuración del servidor web para SPA
├── package.json
└── vite.config.js
```

---

## Stack y dependencias

### Vite — el servidor de desarrollo

Vite reemplaza a Webpack/Create React App. Tiene dos modos:

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor local en `http://localhost:5173` con hot-reload instantáneo |
| `npm run build` | Genera `dist/` optimizado y minificado para producción |
| `npm run preview` | Sirve el `dist/` localmente para verificar antes de deployar |

### React + React DOM

React es la librería de UI. `react-dom` es el puente entre React y el navegador. En `main.jsx` se ve el punto de montaje:

```jsx
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

`StrictMode` no afecta la UI — activa advertencias extra durante el desarrollo para detectar problemas antes de que lleguen a producción.

### Axios — cliente HTTP

Axios es la librería que hace las peticiones HTTP desde el frontend hacia la API.

**¿Por qué Axios y no el `fetch` nativo del navegador?**

| | `fetch` (nativo) | `axios` |
|---|---|---|
| Manejo de errores | No lanza error en 4xx/5xx — hay que verificar `response.ok` manualmente | Lanza error automáticamente si el servidor responde 4xx/5xx |
| Parseo de JSON | Requiere `await response.json()` en un segundo paso | Entrega el JSON directo en `response.data` |
| Timeouts | No tiene soporte nativo | Configurable con `timeout: 5000` |
| Interceptors | No tiene | Permite agregar headers de auth, logging, reintentos — útil en apps reales |

En este lab se usa así:

```jsx
// GET — obtener productos
axios.get(`${API_URL}/api/products`)
  .then(r => setProducts(r.data.data))   // r.data ya es el JSON parseado
  .catch(e => setError(e.message));

// POST — crear producto
await axios.post(`${API_URL}/api/products`, {
  name: 'Webcam HD',
  price: 75.00,
  stock: 10,
});

// DELETE — eliminar por ID
await axios.delete(`${API_URL}/api/products/${id}`);
```

---

## Variable de entorno: `VITE_API_URL`

```jsx
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
```

Esta línea es clave para el curso. Define la dirección de la API de dos formas:

- **Desarrollo local:** si no hay variable definida, usa `http://localhost:3000` (donde corre la API en tu máquina)
- **En Docker / Kubernetes:** se inyecta `VITE_API_URL` al hacer el `build`, apuntando al servicio real del cluster

> **¿Por qué el prefijo `VITE_`?**  
> Vite solo expone al navegador las variables que empiezan con `VITE_`. Las demás quedan privadas para evitar filtrar secretos accidentalmente.

Para desarrollo, crea un archivo `.env.local` en esta carpeta:

```bash
VITE_API_URL=http://localhost:3000
```

---

## Flujo de datos

```
Usuario
  │
  │ interactúa con el formulario / botones
  ▼
App.jsx (React)
  │
  │ axios.get / .post / .delete
  ▼
API REST (api/ — puerto 3000)
  │
  │ JSON response
  ▼
App.jsx actualiza el estado → React re-renderiza la UI
```

Los dos hooks de React que manejan este flujo:

```jsx
const [products, setProducts] = useState([]);  // estado: lista de productos

useEffect(() => {
  fetchProducts();   // se ejecuta una vez al montar el componente
}, []);
```

- `useState` — guarda los datos en memoria mientras la página está abierta
- `useEffect` con `[]` — equivale a "ejecuta esto al cargar la página"

---

## El Dockerfile — análisis línea a línea

Este Dockerfile también usa **multi-stage build**, pero con una diferencia importante respecto al de la API: aquí Node.js **no llega a la imagen final**. Solo se usa para compilar.

```dockerfile
# ── Stage 1: compilar React ──────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
```

Igual que en la API: primero se copian solo los archivos de dependencias para aprovechar la caché de capas, luego se instala (`npm ci`) y por último se copia el resto del código fuente.

> **¿Por qué aquí es `npm ci` sin `--only=production`?**  
> Porque en este stage se necesita Vite, ESLint y otras devDependencies para poder hacer el `build`. Son herramientas de compilación, no van al contenedor final — pero aquí sí se necesitan.

```dockerfile
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build
```

- `ARG` — declara un argumento que se puede pasar en tiempo de `docker build` con `--build-arg`
- `ENV` — lo convierte en variable de entorno disponible para el proceso de build
- `npm run build` — Vite lee `VITE_API_URL` y lo **incrusta dentro del JavaScript compilado** que va a `dist/`

> **Importante:** `VITE_API_URL` se graba en el bundle estático en el momento del build, no en ejecución. Si necesitas cambiarla después, hay que reconstruir la imagen.

```dockerfile
# ── Stage 2: servir con Nginx ────────────────────────────────────────────
FROM nginx:1.25-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

El Stage 2 parte de `nginx:1.25-alpine` (~10 MB). Node.js, npm, Vite, y todo el código fuente **no existen en esta imagen**. Solo llegan los archivos HTML/CSS/JS ya compilados del `dist/`.

- `COPY --from=build /app/dist` → trae los estáticos del stage anterior
- `COPY nginx.conf` → reemplaza la config por defecto de Nginx con la nuestra
- `daemon off` → hace que Nginx corra en primer plano (necesario para que Docker sepa que el proceso sigue vivo)

### nginx.conf — por qué es necesario para una SPA

```nginx
location / {
    try_files $uri $uri/ /index.html;   ← la línea clave
}
```

Sin esta línea, si el usuario navega directamente a una ruta como `/products/5`, Nginx buscaría un archivo `products/5` en disco, no lo encontraría y devolvería **404**. Con `try_files ... /index.html`, cualquier ruta que no sea un archivo real se redirige a `index.html` y React Router toma el control desde ahí.

```nginx
location ~* \.(js|css|png|jpg|svg|ico)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

Los assets compilados por Vite tienen hash en el nombre (`main.a3f9c2.js`), así que nunca cambian. Esta regla los cachea por 1 año en el navegador — carga instantánea en visitas repetidas.

---

## Arrancar el frontend

### Opción A — desarrollo local (sin Docker)

```bash
cd lab1-fullstack/frontend
npm install        # solo la primera vez
npm run dev        # → http://localhost:5173
```

La API debe estar corriendo en paralelo:

```bash
# En otra terminal
cd lab1-fullstack/api
docker run -d --name lab1-api -p 3000:3000 lab1-api:v1
```

### Opción B — contenedor Docker (producción)

```bash
cd lab1-fullstack/frontend

# Construir pasando la URL de la API
docker build \
  --build-arg VITE_API_URL=http://localhost:3000 \
  -t lab1-frontend:v1 .

# Correr en el puerto 8080
docker run -d --name lab1-frontend -p 8080:80 lab1-frontend:v1
```

Abre `http://localhost:8080` — verás el frontend servido por Nginx.

### Verificar que ambos contenedores están activos

```bash
docker ps
# NAMES             STATUS          PORTS
# lab1-frontend     Up X seconds    0.0.0.0:8080->80/tcp
# lab1-api          Up X seconds    0.0.0.0:3000->3000/tcp
```

### Limpiar

```bash
docker stop lab1-frontend lab1-api
docker rm   lab1-frontend lab1-api
```

---

## Comparación de imágenes finales

| Imagen | Base | Contiene | Tamaño aprox. |
|---|---|---|---|
| `lab1-api:v1` | node:20-alpine | Node.js + código + node_modules | ~80 MB |
| `lab1-frontend:v1` | nginx:1.25-alpine | Solo HTML/CSS/JS compilados | ~15 MB |

El frontend es más pequeño porque Node.js **no está** — fue solo una herramienta de compilación que quedó en el Stage 1 descartado.

---

## Próximo lab

En el **Lab 2** crearemos un `docker-compose.yml` que levante API + Frontend juntos con un solo `docker compose up`, y veremos cómo los contenedores se comunican entre sí mediante una red interna de Docker.
