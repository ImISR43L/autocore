# Etapa 1: Build do React
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
# OTIMIZAÇÃO: Build limpo e rápido
RUN npm ci
COPY . .
RUN npm run build

# Etapa 2: Servidor Nginx
FROM nginx:alpine
# Copia os arquivos estáticos gerados
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuração inline do Nginx para SPA (Single Page Application)
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]