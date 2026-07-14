#!/bin/bash
# Executado automaticamente pela imagem oficial do Postgres na PRIMEIRA
# subida do container (mecanismo padrão de /docker-entrypoint-initdb.d/,
# só roda quando o data dir está vazio). Como este serviço não tem volume
# persistente por design (o conteúdo é inteiramente efêmero), isso na
# prática roda toda vez que o container é recriado — comportamento
# desejado.
#
# Cria a role de baixo privilégio que o SqlExecutorService usa para se
# conectar. Ela NUNCA deve ter acesso a nada fora deste banco.
set -e

ROLE_PASSWORD_FILE="/run/secrets/sql_sandbox_role_password"

if [ ! -f "$ROLE_PASSWORD_FILE" ]; then
  echo "ERRO: secret sql_sandbox_role_password não montado. Abortando init da role de sandbox." >&2
  exit 1
fi

ROLE_PASSWORD="$(cat "$ROLE_PASSWORD_FILE")"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE ROLE sql_sandbox WITH LOGIN PASSWORD '$ROLE_PASSWORD';

  -- Só pode conectar e criar schemas DENTRO deste banco. Nada de acesso
  -- a outros bancos (nem existe outro banco aqui além de $POSTGRES_DB).
  GRANT CONNECT, CREATE ON DATABASE $POSTGRES_DB TO sql_sandbox;

  -- Teto de conexões simultâneas: uma avalanche de submissões não deve
  -- conseguir esgotar o pool do Postgres inteiro.
  ALTER ROLE sql_sandbox CONNECTION LIMIT 20;

  -- Timeout como default da ROLE, não só da sessão via código. Camada
  -- extra: mesmo que o SqlExecutorService algum dia deixe de setar
  -- statement_timeout por sessão, essa role nunca segura uma query por
  -- mais de 5s.
  ALTER ROLE sql_sandbox SET statement_timeout = '5s';

  -- Revoga explicitamente o que o Postgres concede por padrão ao PUBLIC
  -- em bancos novos (CREATE no schema public), para não deixar nenhuma
  -- porta aberta por convenção da imagem em vez de por decisão nossa.
  REVOKE ALL ON SCHEMA public FROM PUBLIC;
EOSQL

echo "Role sql_sandbox criada com sucesso."