// web/src/pages/Login.tsx
import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const navigate = useNavigate();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault(); // Impede o recarregamento da página
    setError("");

    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const payload = { email, password };

      const res = await axios.post(`${API_URL}${endpoint}`, payload);

      if (!isRegister) {
        // Login: Salva token e redireciona
        localStorage.setItem("token", res.data.access_token);
        // localStorage.setItem("role", res.data.role); // Descomente se o backend retornar a role
        navigate("/dashboard"); // Redireciona para o Dashboard
      } else {
        // Registro: Alterna para a tela de login
        setIsRegister(false);
        alert("Conta criada com sucesso! Faça login.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Erro na autenticação");
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#1e1e1e",
        color: "white",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          padding: "40px",
          backgroundColor: "#252526",
          borderRadius: "8px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
        }}
      >
        <h2 style={{ textAlign: "center", marginBottom: "20px" }}>
          {isRegister ? "Criar Conta" : "Login"}
        </h2>

        {error && (
          <div
            style={{
              backgroundColor: "#f44336",
              color: "white",
              padding: "10px",
              borderRadius: "4px",
              marginBottom: "15px",
              fontSize: "0.9rem",
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

        {/* AQUI ESTÁ A CORREÇÃO PRINCIPAL: A TAG FORM */}
        <form
          onSubmit={handleAuth}
          style={{ display: "flex", flexDirection: "column", gap: "15px" }}
        >
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              padding: "12px",
              backgroundColor: "#3c3c3c",
              border: "1px solid #555",
              color: "white",
              borderRadius: "4px",
              fontSize: "1rem",
            }}
          />

          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              padding: "12px",
              backgroundColor: "#3c3c3c",
              border: "1px solid #555",
              color: "white",
              borderRadius: "4px",
              fontSize: "1rem",
            }}
          />

          <button
            type="submit"
            style={{
              padding: "12px",
              backgroundColor: "#0e639c",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "1rem",
              marginTop: "10px",
              transition: "background 0.2s",
            }}
          >
            {isRegister ? "Cadastrar" : "Entrar"}
          </button>
        </form>

        <p
          onClick={() => {
            setIsRegister(!isRegister);
            setError("");
          }}
          style={{
            textAlign: "center",
            marginTop: "20px",
            fontSize: "0.9rem",
            color: "#aaa",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          {isRegister
            ? "Já tem uma conta? Faça login"
            : "Não tem conta? Crie uma agora"}
        </p>
      </div>
    </div>
  );
}
