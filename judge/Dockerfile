# Usamos Ubuntu para ter compatibilidade fácil com todos os compiladores
FROM ubuntu:22.04

# Evita perguntas durante a instalação
ENV DEBIAN_FRONTEND=noninteractive

# 1. Instala Python, Node.js, GCC, G++ e ferramentas básicas
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    nodejs \
    npm \
    gcc \
    g++ \
    openjdk-17-jdk-headless \
    wget \
    tar \
    && rm -rf /var/lib/apt/lists/*

# 2. Baixa e instala o Go-Judge
RUN wget https://github.com/criyle/go-judge/releases/download/v1.8.5/go-judge_1.8.5_linux_amd64.tar.gz \
    && tar -xvf go-judge_1.8.5_linux_amd64.tar.gz \
    && mv go-judge /usr/bin/go-judge \
    && chmod +x /usr/bin/go-judge \
    && rm go-judge_1.8.5_linux_amd64.tar.gz

# 3. Configura a porta e o comando de entrada
EXPOSE 5050

CMD ["/usr/bin/go-judge", "-http-addr", ":5050", "-enable-debug"]