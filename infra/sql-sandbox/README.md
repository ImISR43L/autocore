# Setup do sandbox de SQL (Fase 1)

## 1. Docker Compose

Copie o conteúdo de `docker-compose.snippet.yml` para o `docker-compose.yml`
raiz do projeto:
- adicione o serviço `sql-sandbox-db` junto dos demais;
- adicione `sql-sandbox-db` ao `depends_on` do serviço da aplicação.

## 2. Script de init

`init-sql-sandbox.sh` já está pronto e executável. Mova a pasta
`infra/sql-sandbox/` inteira para a raiz do projeto (ou ajuste o path do
volume no compose se preferir outro lugar).

## 3. Variáveis de ambiente

Copie as variáveis de `.env.sql-sandbox.example` para o seu `.env` (ou
para o secret manager, se for produção — ver observação abaixo). Troque
as senhas de exemplo por valores fortes e únicos. Lembre-se: a mesma
senha aparece em `SQL_SANDBOX_ROLE_PASSWORD` e dentro da URL de
`SQL_SANDBOX_DATABASE_URL` — não são independentes.

## 4. Subir e verificar

```bash
docker compose up -d sql-sandbox-db

# confirmar que a role foi criada:
docker compose exec sql-sandbox-db psql -U postgres -d grading_sandbox \
  -c "\du sql_sandbox"

# confirmar que a role NÃO consegue criar role/database (checagem de
# que o privilégio está mesmo restrito, não só documentado):
docker compose exec sql-sandbox-db psql \
  "postgresql://sql_sandbox:SUA_SENHA@localhost:5432/grading_sandbox" \
  -c "CREATE DATABASE tentativa_indevida;"
# esperado: ERROR:  permission denied to create database
```

## 5. Pendência conhecida: `getSecret`

Ajustei `sql-executor.service.ts` para ler a connection string via
`getSecret('SQL_SANDBOX_DATABASE_URL', 'sql_sandbox_database_url')`,
espelhando o uso de `REDIS_PASSWORD` em `submissions.module.ts`. Não
tenho o conteúdo de `secrets.util.ts`, então essa chamada assume a
mesma assinatura `(envVarName, secretManagerKey)` já usada ali — se a
assinatura real for diferente, é só ajustar essa chamada, o resto do
serviço não muda.

## 6. Rodando o seed de exemplo

Com o exercício `seed-sql-example.ts` já criado (Fase 1 anterior), rode
via um script de bootstrap do TypeORM que tenha acesso ao `DataSource`
principal da aplicação (não ao de sandbox — o seed grava o `Problem` e
o `TestCase` no banco principal; é o `SqlExecutorService`, em tempo de
correção, que usa o banco de sandbox). Ajuste `classroomId` para uma
turma real antes de rodar.
