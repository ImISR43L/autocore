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

// Admin API do Supabase — autenticada com a service_role key, NÃO sofre
// o rate limit por IP dos endpoints públicos de auth (a tabela oficial
// de rate limits só cobre /auth/v1/signup, /otp, /token, /verify,
// /factors — não /auth/v1/admin/*). email_confirm:true pula a etapa de
// confirmação por e-mail, necessário porque isso é um script sem
// interação humana.
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

async function main() {
  console.log(`Criando ${NUM_USERS} usuários de teste...`);
  const users = [];
  const errors = [];

  for (let i = 0; i < NUM_USERS; i++) {
    const email = `loadtest-user-${i}-${Date.now()}@${USER_EMAIL_DOMAIN}`;
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

  console.log(`\n\n${users.length} usuários prontos, ${errors.length} erros.`);

  if (errors.length > 0) {
    console.log("\nErros encontrados:");
    errors.slice(0, 5).forEach((e) =>
      console.log(`  [${e.step}] ${e.email}: ${e.message}`),
    );
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

  const outPath = path.join(__dirname, "users.json");
  fs.writeFileSync(outPath, JSON.stringify(users, null, 2));
  console.log(`\nSalvo em ${outPath}`);
}

main().catch((err) => {
  console.error("Erro fatal não tratado:", err);
  process.exit(1);
});
