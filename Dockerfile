# Frontend SecureLeaf: compila la app con Vite y la sirve con Caddy (HTTPS automático),
# que además reenvía /api (REST y WebSocket) al backend.

# ---- 1. Compilación ----
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Las variables VITE_* del .env se incrustan en el JavaScript al compilar
RUN test -f .env || (echo "ERROR: falta SeguridadFrontend/.env (copia .env.example y completa los valores)" && exit 1)
RUN npm run build

# ---- 2. Servidor web ----
FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
