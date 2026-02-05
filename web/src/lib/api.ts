import axios from "axios";

// ... (configuração da instância api existente)

export const api = axios.create({
  baseURL: "http://localhost:3000", // Ajuste conforme seu env
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// --- ATUALIZAÇÃO DA FUNÇÃO DRY RUN ---
export const dryRunProblem = async (payload: {
  starterCode: { name: string; content: string }[];
  testCases: { input: string; expectedOutput: string }[];
  // Novos campos obrigatórios para o Wrapper funcionar
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
