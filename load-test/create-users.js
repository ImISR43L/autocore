require("dotenv/config");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_ANON_KEY = requireEnv("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const API_URL = requireEnv("API_URL");
const CLASSROOM_CODE = requireEnv("CLASSROOM_CODE");
const NUM_USERS = parseInt(process.env.NUM_USERS || "30", 10);
const USER_EMAIL_DOMAIN = process.env.USER_EMAIL_DOMAIN || "loadtest.local";
const USER_PASSWORD = process.env.USER_PASSWORD || "LoadTest123!@#";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Variável de ambiente ausente: ${name} (ver .env.example)`);
    process.exit(1);
  }
  return value;
}

// Admin API do Supabase — autenticada com a service_role key. A tabela
// oficial de rate limits só documenta /auth/v1/signup, /otp, /token,
// /verify, /factors (não /auth/v1/admin/*), MAS na prática esse endpoint
// também é barrado por um limitador genérico e não documentado do
// GoTrue (error_code "over_request_rate_limit"), que dispara depois de
// ~30-50 requisições por IP — é por isso que o script agora acumula
// progresso em vez de recomeçar do zero a cada execução (ver abaixo).
// email_confirm:true pula a etapa de confirmação por e-mail, necessário
// porque isso é um script sem interação humana.
async function createSupabaseUser(email) {
  const res = await axios.post(
    `${SUPABASE_URL}/auth/v1/admin/users`,
    { email, password: USER_PASSWORD, email_confirm: true },
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
    },
  );
  return res.data.id;
}

// Este SIM é o endpoint com rate limit por IP (/auth/v1/token, 1800/h
// com rajada de até 30) — por isso logamos todo mundo aqui, uma vez,
// ANTES do teste de carga em si, e reutilizamos o token depois.
async function signIn(email) {
  const res = await axios.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    { email, password: USER_PASSWORD },
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
    },
  );
  return res.data.access_token;
}

async function joinClassroom(accessToken) {
  await axios.post(
    `${API_URL}/classrooms/join`,
    { code: CLASSROOM_CODE },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
}

// Lê o "exp" (timestamp de expiração, em segundos) de um JWT sem verificar
// assinatura — aqui só precisamos saber SE vale a pena renovar, não validar
// o token de verdade (quem faz a validação real é o backend).
function getTokenExpirySeconds(accessToken) {
  try {
    const payloadB64 = accessToken.split(".")[1];
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64").toString("utf8"),
    );
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

const REFRESH_BUFFER_SECONDS = 5 * 60; // renova se faltar menos que isso pra expirar

// /auth/v1/token tem um bucket de rajada de ~30 requisições (documentado:
// 1800/h, burst 30) — se estourar, espera o tempo do header Retry-After
// (ou um backoff crescente, se o header não vier) e tenta de novo, em vez
// de desistir do usuário na primeira negativa.
async function signInWithRetry(email, maxRetries = 6) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await signIn(email);
    } catch (err) {
      const status = err.response?.status;
      if (status === 429 && attempt < maxRetries) {
        const retryAfterHeader = err.response?.headers?.["retry-after"];
        const waitMs = retryAfterHeader
          ? parseInt(retryAfterHeader, 10) * 1000
          : 2000 * (attempt + 1);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
}

async function main() {
  const outPath = path.join(__dirname, "users.json");

  // Carrega o que já existe de rodadas anteriores em vez de sobrescrever
  // do zero — NUM_USERS agora é a META TOTAL de usuários prontos (soma de
  // todas as execuções), não a quantidade a criar nesta execução.
  let users = [];
  if (fs.existsSync(outPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(outPath, "utf8"));
      if (Array.isArray(existing)) users = existing;
      console.log(
        `users.json existente: ${users.length} usuário(s) já prontos, mantendo-os.`,
      );
    } catch (e) {
      console.error(
        `Aviso: não consegui ler o users.json existente (${e.message}). Começando do zero para não travar o script — se isso não era o esperado, verifique o arquivo manualmente antes de rodar de novo.`,
      );
      users = [];
    }
  }

  const alreadyHave = users.length;
  const toCreate = Math.max(0, NUM_USERS - alreadyHave);

  const errors = [];

  if (toCreate === 0) {
    console.log(
      `Já há ${alreadyHave} usuários em users.json, que é >= NUM_USERS (${NUM_USERS}). Nada a criar — só renovando tokens abaixo.`,
    );
  } else {
    console.log(
      `${alreadyHave} usuário(s) já prontos. Criando mais ${toCreate} para atingir a meta de ${NUM_USERS}...`,
    );

    for (let i = 0; i < toCreate; i++) {
      const email = `loadtest-user-${alreadyHave + i}-${Date.now()}@${USER_EMAIL_DOMAIN}`;
      try {
        const supabaseUserId = await createSupabaseUser(email);
        const accessToken = await signIn(email);

        try {
          await joinClassroom(accessToken);
        } catch (joinErr) {
          // Não aborta o usuário inteiro por causa disso — ver nota no
          // README sobre a possibilidade de o app precisar de um passo de
          // sincronização entre auth.users (Supabase) e a tabela `users`
          // da aplicação antes de qualquer ação autenticada funcionar.
          errors.push({
            email,
            step: "joinClassroom",
            message: joinErr.response?.data?.message || joinErr.message,
          });
        }

        users.push({ email, supabaseUserId, accessToken });
        process.stdout.write(`\r  ${users.length}/${NUM_USERS} prontos`);
        // Salva a cada usuário: se a rodada morrer no meio (ex: rate limit
        // vira erro fatal em vez de cair no catch por usuário), o progresso
        // desta execução não se perde igual acontecia antes.
        fs.writeFileSync(outPath, JSON.stringify(users, null, 2));
      } catch (err) {
        errors.push({
          email,
          step: "createOrSignIn",
          message: err.response?.data?.message || err.message,
        });
      }

      // Pequeno espaçamento na CRIAÇÃO (não no login em massa — aqui não
      // tem problema, é sequencial de propósito) só por boa prática ao
      // martelar a Admin API do free tier repetidamente.
      await new Promise((r) => setTimeout(r, 50));
    }

    console.log(
      `\n\n${users.length} usuários prontos, ${errors.length} erros nesta rodada de criação.`,
    );

    if (errors.length > 0) {
      console.log("\nErros encontrados:");
      errors
        .slice(0, 5)
        .forEach((e) => console.log(`  [${e.step}] ${e.email}: ${e.message}`));
      if (errors.length > 5) console.log(`  ...e mais ${errors.length - 5}.`);

      if (errors.some((e) => e.step === "joinClassroom")) {
        console.log(
          "\n⚠ Falhas em joinClassroom geralmente significam que o usuário\n" +
            "  recém-criado no Supabase Auth ainda não tem uma linha\n" +
            "  correspondente na tabela `users` da aplicação (se o app\n" +
            "  sincroniza isso em algum outro momento, ex: primeiro login\n" +
            "  pela própria UI). Ver README.md.",
        );
      }
    }
  }

  console.log(`\nTotal acumulado em users.json: ${users.length}/${NUM_USERS}.`);

  // Reautentica TODOS os usuários (os que já existiam + os criados agora)
  // para garantir accessTokens frescos. Sem isso, um users.json reutilizado
  // em dias diferentes acumula tokens expirados (padrão do Supabase: ~1h),
  // e run-load-test.js começa a tomar 401 do seu próprio backend em vez de
  // testar o que deveria. signIn (/auth/v1/token) tem limite bem mais
  // folgado (1800/h) que o admin/users, então refazer login em todos a
  // cada execução é seguro mesmo com uma lista grande.
  const nowSec = Math.floor(Date.now() / 1000);
  const toRefreshIdx = [];
  for (let i = 0; i < users.length; i++) {
    const exp = users[i].accessToken
      ? getTokenExpirySeconds(users[i].accessToken)
      : null;
    if (exp === null || exp - nowSec < REFRESH_BUFFER_SECONDS)
      toRefreshIdx.push(i);
  }

  console.log(
    `${toRefreshIdx.length} de ${users.length} usuário(s) com token ausente/expirado/perto de expirar — só esses serão renovados (os demais já estão válidos).`,
  );
  const refreshErrors = [];
  for (let n = 0; n < toRefreshIdx.length; n++) {
    const idx = toRefreshIdx[n];
    try {
      users[idx].accessToken = await signInWithRetry(users[idx].email);
      process.stdout.write(`\r  ${n + 1}/${toRefreshIdx.length} renovados`);
    } catch (err) {
      refreshErrors.push({
        email: users[idx].email,
        message: err.response?.data?.message || err.message,
      });
    }
    // pequeno espaçamento entre chamadas ao endpoint de login, mesmo com o
    // retry acima cobrindo os casos de rajada
    await new Promise((r) => setTimeout(r, 60));
  }
  fs.writeFileSync(outPath, JSON.stringify(users, null, 2));
  console.log(
    `\n\nTokens renovados. ${refreshErrors.length} falha(s) ao renovar.`,
  );
  if (refreshErrors.length > 0) {
    refreshErrors
      .slice(0, 5)
      .forEach((e) =>
        console.log(`  [renovar login] ${e.email}: ${e.message}`),
      );
  }
  console.log(`Salvo em ${outPath}`);
}

main().catch((err) => {
  console.error("Erro fatal não tratado:", err);
  process.exit(1);
});
