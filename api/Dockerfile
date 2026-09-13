# Etapa 1: Build
FROM node:22-alpine AS builder
WORKDIR /app

# Chromium do próprio Alpine (musl-compatible) + libs de runtime que ele
# precisa. O binário que o `npx playwright install chromium` baixaria é
# compilado pra glibc (Debian/Ubuntu) — não roda em Alpine (musl libc),
# então nem vale tentar resolver isso só como "timeout de rede": mesmo
# com o download concluído, o binário não executaria aqui dentro.
#
# PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 evita que o `npm ci`/`npm install`
# tente baixar o Chromium próprio do Playwright (é isso que gerava o
# timeout do CDN). PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH aponta pro binário
# do apk em vez disso — é o mesmo valor usado no
# `chromium.launch({ executablePath: ... })` do HtmlExecutorService, ou
# pode ficar só na env var se o launch() não passar executablePath
# explícito (Playwright lê essa env var sozinho).
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

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

# Mesmo motivo da etapa builder: a imagem final também PRECISA do
# Chromium do sistema, porque é ela que roda em runtime de verdade
# (o HtmlExecutorService sobe o browser dentro deste container).
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

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