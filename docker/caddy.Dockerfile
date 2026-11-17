FROM node:22-alpine AS dashboard-builder

WORKDIR /app/frontend
COPY frontend/frontend/package*.json ./
RUN npm ci

COPY frontend/frontend/ ./
RUN npm run build

FROM caddy:2-alpine

COPY --from=dashboard-builder /app/frontend/dist /srv/dashboard
COPY docker/Caddyfile /etc/caddy/Caddyfile
