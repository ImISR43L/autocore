import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  GraduationCap,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
  Check,
  X,
  AlertCircle,
} from "lucide-react";
import "../App.css";

// Interface para os requisitos de senha
interface PasswordRequirement {
  id: number;
  label: string;
  regex: RegExp;
  met: boolean;
}

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);

  // MELHORIA 1: Estado para evitar o "Flash" da tela de login se já tiver token
  const [isCheckingSession, setIsCheckingSession] = useState(
    !!localStorage.getItem("token"),
  );

  const [showPassword, setShowPassword] = useState(false);

  // Estados dos campos
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");

  // MELHORIA 2: Refs para gestão de foco automático
  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

  // --- VERIFICAÇÃO DE SESSÃO (ANTI-FLASH) ---
  useEffect(() => {
    const verifySession = async () => {
      const token = localStorage.getItem("token");

      // Se não tem token, libera o formulário imediatamente
      if (!token) {
        setIsCheckingSession(false);
        return;
      }

      try {
        await axios.get(`${API_URL}/classrooms`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        // Token válido -> Redireciona
        navigate("/dashboard");
      } catch (error) {
        // Token inválido -> Limpa e libera o formulário
        console.warn("Sessão expirada.");
        localStorage.removeItem("token");
        localStorage.removeItem("userName");
        setIsCheckingSession(false);
      }
    };

    verifySession();
  }, [navigate, API_URL]);

  // --- GESTÃO DE FOCO AUTOMÁTICO ---
  useEffect(() => {
    // Só foca se o formulário estiver visível (não estiver checando sessão)
    if (!isCheckingSession) {
      if (isRegister) {
        // Pequeno timeout para garantir que o DOM atualizou
        setTimeout(() => nameInputRef.current?.focus(), 50);
      } else {
        setTimeout(() => emailInputRef.current?.focus(), 50);
      }
    }
  }, [isRegister, isCheckingSession]);

  // Requisitos da senha
  const passwordRequirements: PasswordRequirement[] = [
    { id: 1, label: "Mínimo 6 caracteres", regex: /.{6,}/, met: false },
    { id: 2, label: "Letra maiúscula", regex: /[A-Z]/, met: false },
    { id: 3, label: "Letra minúscula", regex: /[a-z]/, met: false },
    { id: 4, label: "Número", regex: /[0-9]/, met: false },
  ];

  const getPasswordStatus = () => {
    return passwordRequirements.map((req) => ({
      ...req,
      met: req.regex.test(password),
    }));
  };

  const statusList = getPasswordStatus();
  const isPasswordValid = statusList.every((req) => req.met);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    // CORREÇÃO: Pegar valores diretamente do elemento DOM garante que
    // o autocomplete do navegador seja capturado, mesmo se o state do React falhar.
    const form = e.currentTarget;
    const emailInput = form.elements.namedItem("email") as HTMLInputElement;
    const passwordInput = form.elements.namedItem(
      "password",
    ) as HTMLInputElement;

    const emailValue = emailInput.value;
    const passwordValue = passwordInput.value;

    try {
      const { data } = await axios.post(`${API_URL}/auth/login`, {
        email: emailValue.trim(), // Usa o valor direto do input
        password: passwordValue, // Usa o valor direto do input
      });

      localStorage.setItem("token", data.access_token);
      // Nota: Verifique se o backend retorna 'user.name' dentro de 'data.user' conforme seu AuthService
      localStorage.setItem("userName", data.user?.name || "Usuário");

      toast.success(`Bem-vindo de volta!`);
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Email ou senha incorretos.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) return toast.warning("Por favor, informe seu nome.");

    if (!isPasswordValid) {
      return toast.warning("A senha não atende aos requisitos de segurança.");
    }

    if (password !== confirmPassword) {
      return toast.warning("As senhas não coincidem.");
    }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/auth/register`, {
        name,
        email: email.trim(),
        password,
      });
      toast.success("Conta criada com sucesso! Faça login.");

      // UX: Troca para login e mantém o email preenchido para facilitar
      setIsRegister(false);
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
    } catch (err: any) {
      const msg = err.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : msg || "Erro ao cadastrar.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    toast.info(
      "Contate a secretaria ou seu professor para redefinir a senha.",
      {
        icon: <AlertCircle size={18} className="text-blue-400" />,
      },
    );
  };

  // RENDERIZAÇÃO: Tela de Loading Fullscreen enquanto verifica sessão
  if (isCheckingSession) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <Loader2 className="animate-spin text-green-500" size={48} />
        <span style={{ color: "#666", fontSize: "0.9rem" }}>
          Verificando credenciais...
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
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
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "50px",
              height: "50px",
              background: "linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)",
              borderRadius: "12px",
              marginBottom: "15px",
              boxShadow: "0 8px 16px rgba(46, 125, 50, 0.2)",
            }}
          >
            <GraduationCap size={28} color="#fff" />
          </div>
          <h1
            style={{
              color: "#fff",
              fontSize: "1.5rem",
              fontWeight: "700",
              margin: "0 0 5px 0",
              letterSpacing: "-0.5px",
            }}
          >
            AutoCore
          </h1>
          <p style={{ color: "#888", fontSize: "0.9rem", margin: 0 }}>
            {isRegister
              ? "Crie sua conta acadêmica"
              : "Entre para continuar estudando"}
          </p>
        </div>

        {/* FORMULÁRIO */}
        <form
          onSubmit={isRegister ? handleRegister : handleLogin}
          style={{ display: "flex", flexDirection: "column", gap: "15px" }}
        >
          {isRegister && (
            <div className="form-group">
              <label htmlFor="name" className="input-label">
                Nome Completo
              </label>
              <input
                ref={nameInputRef} // Ref para foco
                id="name"
                name="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: João Silva"
                className="modern-input"
                disabled={loading}
                autoComplete="name"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email" className="input-label">
              Email
            </label>
            <input
              ref={!isRegister ? emailInputRef : undefined} // Ref para foco no Login
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="aluno@exemplo.com"
              className="modern-input"
              disabled={loading}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "6px",
              }}
            >
              <label htmlFor="password" className="input-label">
                Senha
              </label>
              {!isRegister && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#4caf50",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Esqueceu?
                </button>
              )}
            </div>

            <div style={{ position: "relative" }}>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="modern-input"
                style={{ paddingRight: "40px" }}
                disabled={loading}
                autoComplete={isRegister ? "new-password" : "current-password"}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "#666",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
                tabIndex={-1}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* CAMPO CONFIRMAR SENHA */}
            {isRegister && (
              <div style={{ marginTop: "15px" }}>
                <label htmlFor="confirmPassword" className="input-label">
                  Confirmar Senha
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  className="modern-input"
                  disabled={loading}
                  autoComplete="new-password"
                  required
                  style={{
                    borderColor:
                      confirmPassword && password !== confirmPassword
                        ? "#f44336"
                        : undefined,
                  }}
                />
              </div>
            )}

            {/* CHECKLIST DE SENHA */}
            {isRegister && (
              <div
                style={{
                  marginTop: "10px",
                  background: "#222",
                  padding: "10px",
                  borderRadius: "6px",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                }}
              >
                {statusList.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    {req.met ? (
                      <Check size={12} className="text-green-500" />
                    ) : (
                      <X size={12} className="text-red-500" />
                    )}
                    <span
                      style={{
                        fontSize: "0.7rem",
                        color: req.met ? "#ccc" : "#666",
                      }}
                    >
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="modern-button"
            style={{
              marginTop: "10px",
              background: "#4caf50",
              color: "white",
              padding: "12px",
              borderRadius: "8px",
              border: "none",
              fontSize: "0.95rem",
              fontWeight: "600",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "background 0.2s",
              opacity: loading ? 0.7 : 1,
            }}
            onMouseEnter={(e) =>
              !loading && (e.currentTarget.style.background = "#43a047")
            }
            onMouseLeave={(e) =>
              !loading && (e.currentTarget.style.background = "#4caf50")
            }
          >
            {loading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <>
                {isRegister ? "Criar Conta" : "Entrar"}
                {!loading && <ArrowRight size={16} />}
              </>
            )}
          </button>
        </form>

        {/* FOOTER / TOGGLE */}
        <div
          style={{
            marginTop: "25px",
            textAlign: "center",
            paddingTop: "20px",
            borderTop: "1px solid #222",
          }}
        >
          <p style={{ color: "#666", fontSize: "0.85rem", margin: 0 }}>
            {isRegister ? "Já tem acesso?" : "Primeiro acesso?"}{" "}
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setPassword("");
                setConfirmPassword("");
                setName("");
                setShowPassword(false);
              }}
              style={{
                background: "none",
                border: "none",
                color: "#4caf50",
                fontWeight: "600",
                cursor: "pointer",
                padding: "0 5px",
                fontSize: "0.85rem",
              }}
            >
              {isRegister ? "Fazer Login" : "Cadastre-se"}
            </button>
          </p>
        </div>
      </div>

      <style>{`
        .modern-input {
          width: 100%;
          padding: 10px 14px;
          background: #0a0a0a;
          border: 1px solid #333;
          border-radius: 6px;
          color: white;
          font-size: 0.9rem;
          outline: none;
          transition: all 0.2s ease;
        }
        .modern-input:focus {
          border-color: #4caf50;
          box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.1);
          background: #111;
        }
        .modern-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .modern-input::placeholder {
          color: #444;
        }
        .input-label {
          display: block;
          color: #ccc;
          font-size: 0.8rem;
          margin-bottom: 6px;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
