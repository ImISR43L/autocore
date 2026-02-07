# 1. Base (Comum para Dev e Prod)
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci

# 2. Estágio de Desenvolvimento (Para o Docker Watch)
# Aqui paramos com o Node.js instalado para rodar o Vite
FROM base AS development
COPY . .
EXPOSE 5173
# O --host é essencial para acessar fora do container
CMD ["npm", "run", "dev", "--", "--host"]

# 3. Estágio de Build (Apenas para gerar o estático)
FROM base AS builder
COPY . .
RUN npm run build

# 4. Estágio de Produção (Nginx serve os arquivos)
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html

# Mantive sua configuração original do Nginx
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