import axios from "axios";
import { supabase } from "./supabase";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
});

api.interceptors.request.use(async (config) => {
  // Apanha o token diretamente da sessão armazenada na storage local do Supabase
  // Isso previne chamadas lentas à API de auth durante requests paralelos
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    // IMPORTANTE: Utilize atribuição direta no Axios mais recente se o set() falhar
    config.headers.Authorization = `Bearer ${session.access_token}`;
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
