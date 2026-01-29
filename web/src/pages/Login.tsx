import React, { useState } from "react"; // Alterado para importar React e useState
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { GraduationCap, ArrowRight, Loader2 } from "lucide-react";
import "../App.css";

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);

  // Estados
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/auth/login`, {
        email,
        password,
      });
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("userName", data.user.name);
      toast.success(`Bem-vindo de volta, ${data.user.name}!`);
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Email ou senha incorretos.");
    } finally {
      setLoading(false);
    }
  };

  // CORREÇÃO: Uso de React.FormEvent (Namespace)
  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) return toast.warning("Por favor, informe seu nome.");

    setLoading(true);
    try {
      await axios.post(`${API_URL}/auth/register`, {
        name,
        email,
        password,
      });
      toast.success("Conta criada com sucesso!");
      setIsRegister(false);
      setPassword("");
    } catch (err: any) {
      const msg = err.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : msg || "Erro ao cadastrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a", // Fundo ultra-dark
        padding: "20px",
      }}
    >
      <div
        className="login-card-redesigned"
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#161616",
          border: "1px solid #333",
          borderRadius: "12px",
          padding: "40px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
        }}
      >
        {/* CABEÇALHO */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "60px",
              height: "60px",
              background: "linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)",
              borderRadius: "16px",
              marginBottom: "20px",
              boxShadow: "0 10px 20px rgba(46, 125, 50, 0.3)",
            }}
          >
            <GraduationCap size={32} color="#fff" />
          </div>
          <h1
            style={{
              color: "#fff",
              fontSize: "1.8rem",
              fontWeight: "700",
              margin: "0 0 10px 0",
              letterSpacing: "-0.5px",
            }}
          >
            AutoCore
          </h1>
          <p style={{ color: "#888", fontSize: "0.95rem", margin: 0 }}>
            {isRegister
              ? "Crie sua conta acadêmica"
              : "Acesse sua área de aprendizado"}
          </p>
        </div>

        {/* FORMULÁRIO */}
        <form
          onSubmit={isRegister ? handleRegister : handleLogin}
          style={{ display: "flex", flexDirection: "column", gap: "20px" }}
        >
          {isRegister && (
            <div className="form-group">
              <label
                style={{
                  display: "block",
                  color: "#ccc",
                  fontSize: "0.85rem",
                  marginBottom: "8px",
                  fontWeight: "500",
                }}
              >
                Nome Completo
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: João Silva"
                className="modern-input"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label
              style={{
                display: "block",
                color: "#ccc",
                fontSize: "0.85rem",
                marginBottom: "8px",
                fontWeight: "500",
              }}
            >
              Email Institucional ou Pessoal
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="modern-input"
              required
            />
          </div>

          <div className="form-group">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <label
                style={{
                  color: "#ccc",
                  fontSize: "0.85rem",
                  fontWeight: "500",
                }}
              >
                Senha
              </label>
              {!isRegister && (
                <a
                  href="#"
                  style={{
                    color: "#4caf50",
                    fontSize: "0.8rem",
                    textDecoration: "none",
                  }}
                >
                  Esqueceu?
                </a>
              )}
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="modern-input"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="modern-button"
            style={{
              marginTop: "10px",
              background: "#4caf50",
              color: "white",
              padding: "14px",
              borderRadius: "8px",
              border: "none",
              fontSize: "1rem",
              fontWeight: "600",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#43a047")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#4caf50")}
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                {isRegister ? "Criar Conta" : "Entrar"}
                {!loading && <ArrowRight size={18} />}
              </>
            )}
          </button>
        </form>

        {/* FOOTER / TOGGLE */}
        <div
          style={{
            marginTop: "30px",
            textAlign: "center",
            paddingTop: "20px",
            borderTop: "1px solid #222",
          }}
        >
          <p style={{ color: "#666", fontSize: "0.9rem" }}>
            {isRegister ? "Já possui cadastro?" : "Novo por aqui?"}{" "}
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setPassword("");
                setName("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#4caf50",
                fontWeight: "600",
                cursor: "pointer",
                padding: "0 5px",
              }}
            >
              {isRegister ? "Fazer Login" : "Criar conta gratuita"}
            </button>
          </p>
        </div>
      </div>

      {/* STYLE TAG PARA ESTILOS ESPECÍFICOS DE INPUT */}
      <style>{`
        .modern-input {
          width: 100%;
          padding: 12px 16px;
          background: #0a0a0a;
          border: 1px solid #333;
          border-radius: 8px;
          color: white;
          font-size: 0.95rem;
          outline: none;
          transition: all 0.2s ease;
        }
        .modern-input:focus {
          border-color: #4caf50;
          box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
          background: #111;
        }
        .modern-input::placeholder {
          color: #444;
        }
      `}</style>
    </div>
  );
}
