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
