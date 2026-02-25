import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
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

  // ALTERAÇÃO 1: Adicionamos um estado de carregamento inicial para a verificação da sessão
  const [checkingSession, setCheckingSession] = useState(true);

  const [showPassword, setShowPassword] = useState(false);

  // Estados dos campos
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");

  // Refs para gestão de foco automático
  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();

  // Novos Requisitos de segurança de senha
  const [passwordRequirements, setPasswordRequirements] = useState<
    PasswordRequirement[]
  >([
    { id: 1, label: "Mínimo de 6 caracteres", regex: /.{6,}/, met: false },
    {
      id: 2,
      label: "Pelo menos uma letra maiúscula",
      regex: /[A-Z]/,
      met: false,
    },
    {
      id: 3,
      label: "Pelo menos uma letra minúscula",
      regex: /[a-z]/,
      met: false,
    },
    { id: 4, label: "Pelo menos um número", regex: /[0-9]/, met: false },
  ]);

  // Atualiza os requisitos em tempo real enquanto digita
  useEffect(() => {
    if (isRegister) {
      setPasswordRequirements((reqs) =>
        reqs.map((req) => ({ ...req, met: req.regex.test(password) })),
      );
    }
  }, [password, isRegister]);

  // Foco automático ao alternar entre Login e Cadastro
  useEffect(() => {
    if (isRegister && nameInputRef.current) {
      nameInputRef.current.focus();
    } else if (!isRegister && emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, [isRegister]);

  // ALTERAÇÃO 2: Verificação robusta de sessão com Supabase ao invés de apenas ler localStorage
  useEffect(() => {
    const checkSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          // Se existe uma sessão válida no Supabase, redireciona
          navigate("/dashboard", { replace: true });
        }
      } catch (error) {
        console.error("Erro ao verificar sessão:", error);
      } finally {
        // Finaliza o loading independentemente do resultado
        setCheckingSession(false);
      }
    };

    checkSession();
  }, [navigate]);

  // Lógica de Autenticação (Login)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data?.session) {
        toast.success("Login efetuado com sucesso!");
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao efetuar login.");
    } finally {
      setLoading(false);
    }
  };

  // Lógica de Autenticação (Cadastro)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      return toast.error("As senhas não coincidem.");
    }

    const allReqsMet = passwordRequirements.every((req) => req.met);
    if (!allReqsMet) {
      return toast.error("A senha não atende a todos os requisitos.");
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
        },
      });

      if (error) throw error;

      if (data?.session) {
        toast.success("Conta criada com sucesso!");
        navigate("/dashboard");
      } else {
        toast.success("Verifique seu email para confirmar o cadastro.");
        setIsRegister(false);
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar conta.");
    } finally {
      setLoading(false);
    }
  };

  // ALTERAÇÃO 3: Retorna nulo enquanto verifica a sessão para evitar piscada
  if (checkingSession) {
    return null;
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background font-sans text-foreground p-4 relative overflow-hidden">
      {/* ... O restante do seu JSX permanece idêntico ... */}
      {/* Decoração de fundo opcional (brilho suave) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* Formulário Centralizado */}
      <div className="w-full max-w-md bg-surface p-8 sm:p-10 rounded-2xl border border-border shadow-2xl relative z-10">
        {/* Cabeçalho do Formulário */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-4 border border-primary/20 shadow-sm">
            <GraduationCap size={32} className="text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 tracking-tight">
            {isRegister ? "Criar Conta" : "Plataforma Autocore"}
          </h1>
          <p className="text-muted text-sm">
            {isRegister
              ? "Preencha os dados abaixo para começar."
              : "Faça login para continuar seus estudos."}
          </p>
        </div>

        <form
          onSubmit={isRegister ? handleRegister : handleLogin}
          className="space-y-5"
        >
          {/* Nome (Apenas Cadastro) */}
          {isRegister && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="input-label">Nome Completo</label>
              <input
                ref={nameInputRef}
                type="text"
                required
                className="modern-input"
                placeholder="João da Silva"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          {/* Email */}
          <div>
            <label className="input-label">E-mail</label>
            <input
              ref={emailInputRef}
              type="email"
              required
              className="modern-input"
              placeholder="aluno@instituicao.edu.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Senha */}
          <div>
            <label className="input-label">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                className="modern-input pr-10"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Requisitos de Senha (Apenas Cadastro) */}
          {isRegister && password.length > 0 && (
            <div className="bg-background border border-border rounded-lg p-3 space-y-1.5 animate-in fade-in">
              <p className="text-xs font-semibold text-foreground mb-2">
                Requisitos da senha:
              </p>
              {passwordRequirements.map((req) => (
                <div key={req.id} className="flex items-center gap-2 text-xs">
                  {req.met ? (
                    <Check size={14} className="text-primary" />
                  ) : (
                    <X size={14} className="text-muted" />
                  )}
                  <span className={req.met ? "text-primary" : "text-muted"}>
                    {req.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Confirmar Senha (Apenas Cadastro) */}
          {isRegister && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="input-label">Confirmar Senha</label>
              <input
                type={showPassword ? "text" : "password"}
                required
                className="modern-input"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-destructive text-xs mt-1.5 flex items-center gap-1">
                  <AlertCircle size={12} /> As senhas não coincidem
                </p>
              )}
            </div>
          )}

          {/* Botão Principal */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-primary hover:bg-primary-dark text-primary-foreground font-semibold rounded-md transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-70 disabled:cursor-not-allowed shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                {isRegister ? "Criar Conta" : "Entrar"} <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Alternar entre Login / Cadastro */}
        <p className="text-center text-muted text-sm mt-8">
          {isRegister ? "Já possui uma conta?" : "Ainda não tem acesso?"}
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setPassword("");
              setConfirmPassword("");
              setName("");
              setShowPassword(false);
            }}
            className="ml-2 text-primary font-semibold hover:underline focus:outline-none bg-transparent border-none cursor-pointer"
          >
            {isRegister ? "Fazer Login" : "Cadastre-se"}
          </button>
        </p>
      </div>
    </div>
  );
}
