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

# Altera a propriedade do diretório de trabalho para o utilizador restrito ANTES da transição
RUN chown -R node:node /app

# Transição para utilizador não privilegiado para as restantes operações
USER node

# Copia dependências assumindo a propriedade explícita para o utilizador node
COPY --chown=node:node package*.json ./

# Instala as dependências estritamente operando como o utilizador node
RUN npm ci --omit=dev && npm cache clean --force

# Copia o build da etapa anterior com as permissões corretas
COPY --from=builder --chown=node:node /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main"]