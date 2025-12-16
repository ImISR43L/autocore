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
    e.preventDefault();
    setError("");

    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const payload = isRegister ? { email, password } : { email, password };

      const res = await axios.post(`${API_URL}${endpoint}`, payload);

      if (!isRegister) {
        // Salva token e redireciona
        localStorage.setItem("token", res.data.access_token);
        localStorage.setItem("role", res.data.role);
        navigate("/");
      } else {
        setIsRegister(false); // Volta pro login após registrar
        alert("Conta criada! Faça login.");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Erro na autenticação");
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#1e1e1e",
        color: "#fff",
        fontFamily: "sans-serif",
      }}
    >
      <form
        onSubmit={handleAuth}
        style={{
          backgroundColor: "#252526",
          padding: "40px",
          borderRadius: "8px",
          width: "300px",
          display: "flex",
          flexDirection: "column",
          gap: "15px",
        }}
      >
        <h2 style={{ textAlign: "center", margin: 0 }}>
          Autocore {isRegister ? "Registro" : "Login"}
        </h2>

        {error && (
          <div
            style={{
              color: "#f44336",
              fontSize: "0.9rem",
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            padding: "10px",
            backgroundColor: "#3c3c3c",
            border: "none",
            color: "white",
            borderRadius: "4px",
          }}
        />

        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            padding: "10px",
            backgroundColor: "#3c3c3c",
            border: "none",
            color: "white",
            borderRadius: "4px",
          }}
        />

        <button
          type="submit"
          style={{
            padding: "10px",
            backgroundColor: "#0e639c",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          {isRegister ? "Criar Conta" : "Entrar"}
        </button>

        <p
          onClick={() => setIsRegister(!isRegister)}
          style={{
            textAlign: "center",
            fontSize: "0.8rem",
            color: "#aaa",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          {isRegister ? "Já tem conta? Login" : "Não tem conta? Registrar"}
        </p>
      </form>
    </div>
  );
}
