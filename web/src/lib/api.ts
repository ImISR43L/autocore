import axios from "axios";

// Instância centralizada do Axios
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
});

// Interceptor que injeta o Token automaticamente
api.interceptors.request.use((config) => {
  // CORREÇÃO: Mudamos de 'auth_token' para 'token' (conforme seu Login.tsx)
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
