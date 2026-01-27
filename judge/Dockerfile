# OTIMIZAÇÃO: Debian Slim é muito menor que Ubuntu, mas mantém compatibilidade glibc (necessária para C/C++)
FROM debian:bookworm-slim

# Evita interatividade durante instalação
ENV DEBIAN_FRONTEND=noninteractive

# 1. Instalação de Compiladores e Runtimes
# OTIMIZAÇÃO: --no-install-recommends economiza muito espaço em disco
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    nodejs \
    npm \
    gcc \
    g++ \
    openjdk-17-jdk-headless \
    wget \
    tar \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 2. Instalação do Go-Judge (Binário)
RUN wget https://github.com/criyle/go-judge/releases/download/v1.8.5/go-judge_1.8.5_linux_amd64.tar.gz \
    && tar -xvf go-judge_1.8.5_linux_amd64.tar.gz \
    && mv go-judge /usr/bin/go-judge \
    && chmod +x /usr/bin/go-judge \
    && rm go-judge_1.8.5_linux_amd64.tar.gz

# Porta do Executor
EXPOSE 5050

CMD ["/usr/bin/go-judge", "-http-addr", ":5050", "-enable-debug"]