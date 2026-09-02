# Teste de carga — 30 usuários, 3 matérias simultâneas

## As 3 coisas que eu não tinha como confirmar sem ver mais arquivos

Marcadas no código também, mas resumindo aqui pra você saber onde olhar primeiro se algo falhar:

1. **Sincronização entre `auth.users` (Supabase) e a tabela `users` da aplicação.**
   Criar um usuário via Admin API do Supabase não necessariamente cria a
   linha correspondente na tabela `users` do seu backend — se isso
   acontece hoje, pode ser via trigger no Postgres, ou só na primeira
   requisição autenticada real (`JwtStrategy.validate()`, que eu não
   tenho). Se `create-users.ts` falhar em `joinClassroom` pra todo
   mundo, é praticamente certo que é isso. Solução mais provável: uma
   chamada extra logo após o login, pra qualquer endpoint autenticado
   simples, antes do `join`.

2. **Formato de autenticação do socket.** `submissions.gateway.ts` usa
   `WsJwtGuard`, que eu não tenho. Tentei `auth: { token }` (padrão mais
   comum em Nest+socket.io), mas se estiver errado, o script não quebra
   — ele tem fallback de polling (`GET /submissions/:id` a cada 1s) e
   avisa no final quantos vereditos vieram por socket vs. polling.

3. **Comportamento do `WrapperGenerator` com `parameters: []`.** O
   problema de Programming do seed assume que, sem parâmetros, o
   arquivo roda como está (lê stdin, escreve stdout) em vez de embrulhar
   numa função `solve()`. Se estiver errado, a resposta "correta" pode
   voltar como erro — mas isso não invalida a medição de tempo/
   concorrência, só o "% de acerto" do relatório.

## Setup

```bash
cd load-test
npm install
cp .env.example .env
SELECT id, email FROM "user" WHERE email = 'seu-email-de-professor@exemplo.com';
```

1. Preencha `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   no `.env` (mesmos valores que a API/frontend já usam).

2. Rode o seed (cria a turma + os 3 problemas):

   ```bash
   sudo docker compose exec api npx ts-node -r tsconfig-paths/register \
     src/submissions/seeds/run-seed-load-test.ts SEU-TEACHER-ID
   ```

   Cole o bloco impresso (`CLASSROOM_ID`, `CLASSROOM_CODE`, os 3
   `*_PROBLEM_ID`) no `.env` do `load-test/`.

3. Crie e matricule os usuários de teste:

   ```bash
   npm run create-users
   ```

   Gera `users.json` (gitignore isso — tem tokens de acesso válidos).

4. Rode o teste:
   ```bash
   npm run run
   ```

## O que o relatório mostra

Por matéria (HTML / Programming / SQL), separado em duas medidas
diferentes de propósito:

- **Enfileirar**: tempo entre o `POST /submissions` sair e a resposta
  chegar. Mede a API em si, não a correção.
- **Até o veredito final**: tempo entre o envio e o status parar de ser
  `Pending`. Essa é a métrica que interessa de verdade — inclui fila +
  motor de correção (Go-judge / SqlExecutorService / jsdom).

Mais a distribuição de status finais (`Accepted`, `Wrong Answer`,
`Internal Error`, etc.) e quantos vereditos vieram via socket vs.
polling.

## O que eu esperaria ver, dado o que já sabemos do código

- **HTML e SQL/Programming devem se comportar de forma visivelmente
  diferente**, e essa diferença é o dado mais importante do teste:
  HTML roda `jsdom` dentro do processo da própria API (`mode: sync`),
  então 30 simultâneas competem CPU direto com o resto da aplicação.
  Programming e SQL passam por fila (Bull) e um motor externo
  (Go-judge / Postgres de sandbox).
- **Dentro de Programming e SQL, o tempo até o veredito deve crescer
  de forma aproximadamente linear com o número de submissões**, não
  ficar constante — porque `@Process('grade')` e
  `@Process('grade-sql')` não têm `concurrency` configurada, e o
  padrão do Bull pra isso é processar um job por vez. Se o p95 de 30
  submissões for ~30x o tempo de uma submissão isolada, é essa a causa
  raiz mais provável, não um limite de recursos do Go-judge/Postgres.
- Não deveria aparecer nenhum `Internal Error` de conexão recusada do
  Postgres de sandbox neste teste — 30 é bem abaixo do
  `CONNECTION LIMIT 20` da role `sql_sandbox` MULTIPLICADO pela
  serialização acima (se as submissões de SQL processam uma por vez,
  nunca existem 30 conexões simultâneas de verdade, só uma). Se
  aparecer mesmo assim, é sinal de que a serialização não está
  acontecendo como eu esperava — dado igualmente interessante.
