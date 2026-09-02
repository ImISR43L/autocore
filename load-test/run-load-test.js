require("dotenv/config");
const axios = require("axios");
const { io } = require("socket.io-client");
const fs = require("fs");
const path = require("path");

const API_URL = requireEnv("API_URL");
const SOCKET_URL = requireEnv("SOCKET_URL");
const HTML_PROBLEM_ID = requireEnv("HTML_PROBLEM_ID");
const PROGRAMMING_PROBLEM_ID = requireEnv("PROGRAMMING_PROBLEM_ID");
const SQL_PROBLEM_ID = requireEnv("SQL_PROBLEM_ID");

// Vereditos considerados finais — parar de esperar quando qualquer um
// destes chegar. 'Pending' nunca é final por definição.
const TERMINAL_STATUSES = new Set([
  "Accepted",
  "Wrong Answer",
  "Compilation Error",
  "Runtime Error",
  "Time Limit Exceeded",
  "Memory Limit Exceeded",
  "Internal Error",
]);

const VERDICT_TIMEOUT_MS = 120_000; // 2min — generoso de propósito; queremos ver se estoura, não esconder isso
const POLL_INTERVAL_MS = 1000;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Variável de ambiente ausente: ${name} (ver .env.example)`);
    process.exit(1);
  }
  return value;
}

// Confirmado contra ws-jwt.guard.ts real: client.handshake.auth.token é
// lido em primeiro lugar (com fallback pra headers.authorization) — este
// formato está correto, não é mais uma assunção.
function connectUserSocket(accessToken) {
  const socket = io(SOCKET_URL, {
    auth: { token: accessToken },
    transports: ["websocket"],
    reconnection: false,
  });
  socket.on("connect", () => {
    socket.emit("join-user-room");
  });
  return socket;
}

function buildPayload(subject) {
  switch (subject) {
    case "HTML":
      return {
        problem_id: HTML_PROBLEM_ID,
        files: [
          {
            name: "index.html",
            content: "<html><body><h1>Ola</h1></body></html>",
          },
        ],
      };
    case "PROGRAMMING":
      return {
        problem_id: PROGRAMMING_PROBLEM_ID,
        language_id: 71, // python — mesma convenção usada no resto do projeto
        files: [
          {
            name: "main.py",
            content: "a, b = map(int, input().split())\nprint(a + b)",
          },
        ],
      };
    case "SQL":
      return {
        problem_id: SQL_PROBLEM_ID,
        files: [
          {
            name: "query.sql",
            content:
              "SELECT DISTINCT c.id, c.nome FROM clientes c JOIN pedidos p ON c.id = p.cliente_id;",
          },
        ],
      };
  }
}

async function waitForVerdictViaPolling(submissionId, accessToken, deadline) {
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    try {
      const res = await axios.get(`${API_URL}/submissions/${submissionId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (TERMINAL_STATUSES.has(res.data.status)) {
        return { status: res.data.status };
      }
    } catch {
      // ignora erro pontual de polling, tenta de novo até o deadline
    }
  }
  return null;
}

async function submitAndWait(subject, user) {
  const result = {
    subject,
    userEmail: user.email,
    tSubmit: Date.now(),
    tEnqueued: null,
    tVerdict: null,
    status: null,
    error: null,
    via: "timeout",
  };

  const socket = connectUserSocket(user.accessToken);

  const socketVerdict = new Promise((resolve) => {
    socket.on("submission-finished", (submission) => {
      if (TERMINAL_STATUSES.has(submission.status)) {
        resolve({ status: submission.status });
      }
    });
    setTimeout(() => resolve(null), VERDICT_TIMEOUT_MS);
  });

  let submissionId;
  try {
    const res = await axios.post(
      `${API_URL}/submissions`,
      buildPayload(subject),
      { headers: { Authorization: `Bearer ${user.accessToken}` } },
    );
    result.tEnqueued = Date.now();
    submissionId = res.data.id;
  } catch (err) {
    result.error = err.response?.data?.message || err.message;
    result.via = "submit-failed";
    socket.disconnect();
    return result;
  }

  const deadline = Date.now() + VERDICT_TIMEOUT_MS;
  const pollingVerdict = waitForVerdictViaPolling(
    submissionId,
    user.accessToken,
    deadline,
  );

  const winner = await Promise.race([
    socketVerdict.then((v) => (v ? { ...v, via: "socket" } : null)),
    pollingVerdict.then((v) => (v ? { ...v, via: "polling" } : null)),
  ]);

  socket.disconnect();

  if (winner) {
    result.tVerdict = Date.now();
    result.status = winner.status;
    result.via = winner.via;
  } else {
    result.via = "timeout";
  }

  return result;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function summarize(subject, results) {
  const subset = results.filter((r) => r.subject === subject);
  const enqueueLatencies = subset
    .filter((r) => r.tEnqueued)
    .map((r) => r.tEnqueued - r.tSubmit)
    .sort((a, b) => a - b);
  const verdictLatencies = subset
    .filter((r) => r.tVerdict)
    .map((r) => r.tVerdict - r.tSubmit)
    .sort((a, b) => a - b);

  const byStatus = {};
  subset.forEach((r) => {
    const key = r.status || r.via; // "timeout" ou "submit-failed" se não teve status
    byStatus[key] = (byStatus[key] || 0) + 1;
  });

  console.log(`\n=== ${subject} (${subset.length} submissões) ===`);
  console.log(
    `  Enfileirar (POST -> resposta):  p50=${percentile(enqueueLatencies, 50)}ms  p95=${percentile(enqueueLatencies, 95)}ms  max=${enqueueLatencies[enqueueLatencies.length - 1] ?? "-"}ms`,
  );
  console.log(
    `  Até o veredito final:           p50=${percentile(verdictLatencies, 50)}ms  p95=${percentile(verdictLatencies, 95)}ms  max=${verdictLatencies[verdictLatencies.length - 1] ?? "-"}ms`,
  );
  console.log(`  Resultados: ${JSON.stringify(byStatus)}`);
}

async function main() {
  const usersPath = path.join(__dirname, "users.json");
  if (!fs.existsSync(usersPath)) {
    console.error(
      "users.json não encontrado — rode `npm run create-users` primeiro.",
    );
    process.exit(1);
  }
  const users = JSON.parse(fs.readFileSync(usersPath, "utf8"));

  console.log(
    `Disparando ${users.length} usuários x 3 matérias = ${users.length * 3} submissões simultâneas...\n` +
      "(SQL_MODELING fica de fora de propósito: a correção lá é síncrona/manual,\n" +
      " não tem fila pra estressar — todo envio vira 'Awaiting Manual Review'\n" +
      " na hora, então medir concorrência não diz nada de útil pra esse subject.)",
  );

  const startedAt = Date.now();

  const allPromises = [];
  for (const user of users) {
    allPromises.push(submitAndWait("HTML", user));
    allPromises.push(submitAndWait("PROGRAMMING", user));
    allPromises.push(submitAndWait("SQL", user));
  }

  const results = await Promise.all(allPromises);
  const totalWallTimeMs = Date.now() - startedAt;

  console.log(`\nTempo total da rodada: ${totalWallTimeMs}ms`);
  summarize("HTML", results);
  summarize("PROGRAMMING", results);
  summarize("SQL", results);

  const socketHits = results.filter((r) => r.via === "socket").length;
  const pollingHits = results.filter((r) => r.via === "polling").length;
  console.log(
    `\nResolvido via socket: ${socketHits}  |  via polling: ${pollingHits}  |  timeout/falha: ${
      results.length - socketHits - pollingHits
    }`,
  );
  if (socketHits === 0 && pollingHits > 0) {
    console.log(
      "⚠ Nenhum veredito chegou via socket, mesmo com o formato de auth\n" +
        "  confirmado contra ws-jwt.guard.ts — vale checar CORS/allowedOrigins\n" +
        "  em submissions.gateway.ts, já que ele restringe a origem por env\n" +
        "  (NODE_ENV) e este script não é o frontend rodando em localhost:8080.",
    );
  }

  const outPath = path.join(__dirname, "results.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify({ totalWallTimeMs, results }, null, 2),
  );
  console.log(`\nResultado completo salvo em ${outPath}`);
}

main().catch((err) => {
  console.error("Erro fatal não tratado:", err);
  process.exit(1);
});
