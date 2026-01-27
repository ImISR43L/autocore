# Etapa 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
# Copia apenas os arquivos de dependência primeiro (melhora cache)
COPY package*.json ./
# OTIMIZAÇÃO: 'npm ci' é mais rápido e confiável que 'npm install' para CI/CD
RUN npm ci
COPY . .
RUN npm run build

# Etapa 2: Produção
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV production

# Copia dependências e instala apenas as de produção
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# OTIMIZAÇÃO: Segurança (roda como usuário restrito, não root)
USER node

# Copia o build da etapa anterior com as permissões corretas
COPY --from=builder --chown=node:node /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main"]