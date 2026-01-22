import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import "../App.css";

export default function Login() {
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const navigate = useNavigate();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    // Feedback visual imediato
    const toastId = toast.loading(
      isRegister ? "Criando conta..." : "Autenticando...",
    );

    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const payload = { email, password };
      const res = await axios.post(`${API_URL}${endpoint}`, payload);

      if (!isRegister) {
        localStorage.setItem("token", res.data.access_token);
        toast.success("Login realizado com sucesso!", { id: toastId });
        navigate("/dashboard");
      } else {
        setIsRegister(false);
        toast.success("Conta criada! Faça login para continuar.", {
          id: toastId,
        });
      }
    } catch (err: unknown) {
      console.error(err);
      let msg = "Erro na autenticação";

      // Verificação de tipo segura para substituir o 'any'
      if (axios.isAxiosError(err) && err.response) {
        msg = err.response.data?.message || msg;
      } else if (err instanceof Error) {
        msg = err.message;
      }

      // Exibe o erro no Toast
      toast.error(Array.isArray(msg) ? msg[0] : msg, { id: toastId });
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h2 className="auth-title">
          {isRegister ? "Criar Conta" : "Bem-vindo"}
        </h2>

        <form onSubmit={handleAuth}>
          <div className="form-group">
            <label className="form-label">E-mail Institucional</label>
            <input
              className="form-input"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Senha</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%" }}
          >
            {isRegister ? "Cadastrar" : "Entrar"}
          </button>
        </form>

        <p className="auth-toggle" onClick={() => setIsRegister(!isRegister)}>
          {isRegister
            ? "Já possui conta? Faça Login"
            : "Novo por aqui? Crie uma conta"}
        </p>
      </div>
    </div>
  );
}
