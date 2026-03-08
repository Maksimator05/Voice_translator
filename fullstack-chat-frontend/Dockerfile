# ====================================================
# Frontend Dockerfile (multi-stage)
# Stage 1: сборка React/Vite
# Stage 2: раздача через nginx
# ====================================================

# --- Stage 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# Устанавливаем зависимости (используем package-lock.json если есть)
COPY package.json package-lock.json* ./
RUN npm config set registry https://registry.npmjs.org/ \
    && npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm ci

COPY . .

# VITE_API_URL=/api — запросы идут через nginx-прокси на бэкенд
ARG VITE_API_URL=/api
ARG VITE_WS_URL=

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

RUN npm run build

# --- Stage 2: Serve ---
FROM nginx:stable-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
