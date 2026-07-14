import axios from "axios";
import { supabase } from "./supabase";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost",
});

api.interceptors.request.use(async (config) => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    config.headers.set("Authorization", `Bearer ${session.access_token}`);
  } else {
    console.warn(
      "Nenhum token JWT disponível na sessão atual do Supabase.",
      error,
    );
  }

  return config;
});

export const dryRunProblem = async (payload: {
  starterCode: { name: string; content: string }[];
  testCases: { input: string; expectedOutput: string }[];
  parameters: { name: string; type: string }[];
  returnType?: string;
  language?: string;
}) => {
  const { data } = await api.post("/problems/dry-run", {
    ...payload,
    language: payload.language || "python",
  });
  return data;
};

// Adicionar em web/src/lib/api.ts, próximo de onde `dryRunProblem` (usado
// por ValidationConfig.tsx, o dry-run de Programming) já está definido —
// não tenho esse arquivo então não posso editá-lo diretamente, mas o
// formato deve seguir o mesmo padrão que ele já usa para chamar `api`.

export interface DryRunSqlParams {
  sqlSchema: string;
  seedDml?: string;
  referenceQuery: string;
}

export interface DryRunSqlResult {
  success: boolean;
  rows?: Record<string, any>[];
  status?: string;
  error?: string;
}

export async function dryRunSqlTestCase(
  params: DryRunSqlParams,
): Promise<DryRunSqlResult> {
  const res = await api.post("/problems/dry-run-sql", params);
  return res.data;
}
