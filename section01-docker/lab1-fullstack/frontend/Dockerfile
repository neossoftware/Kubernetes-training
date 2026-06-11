# Stage 1: Build de React
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# La API_URL será inyectada en build time o via nginx
# VITE_API_URL vacío = same-origin: el browser llama a /api/... sin host
# nginx hace proxy_pass a "api:3000" (Docker Compose) o "api-svc:3000" (K8s)
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Stage 2: Servir con nginx
FROM nginx:1.25-alpine
# Copiar build
COPY --from=build /app/dist /usr/share/nginx/html
# Configuración nginx para SPA (React Router)
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
