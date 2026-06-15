# Stage 1: Build de React
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# VITE_API_URL vacío = same-origin: el browser llama a /api/... sin host
# nginx hace el proxy interno hacia api-svc:3000 (ClusterIP de K8s)
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Stage 2: Servir con nginx
FROM nginx:1.25-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# nginx.conf incluye el proxy /api/ → api-svc:3000
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
