import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Loader2, GraduationCap, Clock } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

interface TokenPublicInfo {
  problemTitle: string;
  teacherName: string | null;
  expiresAt: string;
}

type ViewState = "loading" | "invalid" | "form" | "redeeming";

export default function ExamAccessLanding() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [viewState, setViewState] = useState<ViewState>("loading");
  const [tokenInfo, setTokenInfo] = useState<TokenPublicInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!token) {
      setErrorMessage("Link inválido.");
      setViewState("invalid");
      return;
    }

    let cancelled = false;

    const loadTokenInfo = async () => {
      try {
        // Endpoint público — não exige sessão. O interceptor do axios ainda
        // tenta anexar um Authorization header se houver uma sessão
        // qualquer (ex: professor testando o próprio link), mas o backend
        // não exige isso aqui.
        const res = await api.get(`/exam-access/${token}`);
        if (cancelled) return;
        setTokenInfo(res.data);
        setViewState("form");
      } catch (error: any) {
        if (cancelled) return;
        const msg =
          error.response?.data?.message || "Link inválido ou expirado.";
        setErrorMessage(Array.isArray(msg) ? msg[0] : msg);
        setViewState("invalid");
      }
    };

    loadTokenInfo();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleJoin = async () => {
    if (!token) return;

    if (!name.trim()) {
      toast.error("Informe seu nome para continuar.");
      return;
    }

    setViewState("redeeming");

    try {
      // Se já existe uma sessão Supabase ativa (ex: um aluno já matriculado
      // que recebeu este link por engano, ou reabrindo o link depois de já
      // ter entrado), reaproveitamos ela — não força uma sessão anônima
      // por cima de uma conta real.
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        const { error: anonError } =
          await supabase.auth.signInAnonymously();

        if (anonError) {
          console.error("Erro no login anônimo do Supabase:", anonError);
          toast.error(
            "Não foi possível criar um acesso temporário no momento. Tente novamente em instantes ou peça um novo link ao professor.",
          );
          setViewState("form");
          return;
        }
      }

      const res = await api.post(`/exam-access/${token}/redeem`, {
        name: name.trim(),
        email: email.trim() || undefined,
      });

      const { problemId } = res.data;
      if (!problemId) {
        throw new Error("Resposta inesperada do servidor.");
      }

      navigate(`/guest-exam/${problemId}`, { replace: true });
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message;
      toast.error(
        Array.isArray(msg)
          ? msg[0]
          : msg || "Não foi possível entrar na prova. Tente novamente.",
      );
      setViewState("form");
    }
  };

  const formatExpiry = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-8 space-y-6">
        {viewState === "loading" && (
          <div className="flex flex-col items-center gap-3 py-10 text-muted">
            <Loader2 className="animate-spin" size={28} />
            <p className="text-sm">Verificando link de acesso...</p>
          </div>
        )}

        {viewState === "invalid" && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle size={28} className="text-destructive" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">
                Não foi possível acessar
              </h1>
              <p className="text-sm text-muted mt-1">{errorMessage}</p>
            </div>
          </div>
        )}

        {(viewState === "form" || viewState === "redeeming") && tokenInfo && (
          <>
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <GraduationCap size={28} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">
                  Você foi convidado para uma prova
                </h1>
                <p className="text-base font-semibold text-primary mt-1">
                  {tokenInfo.problemTitle}
                </p>
                {tokenInfo.teacherName && (
                  <p className="text-sm text-muted mt-0.5">
                    Professor(a): {tokenInfo.teacherName}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted bg-background border border-border rounded-full px-3 py-1">
                <Clock size={12} />
                Link válido até {formatExpiry(tokenInfo.expiresAt)}
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <Input
                label="Seu nome"
                placeholder="Como o professor vai te identificar"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={viewState === "redeeming"}
                className="bg-background"
              />
              <Input
                label="E-mail (opcional)"
                type="email"
                placeholder="Para contato, se necessário"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={viewState === "redeeming"}
                className="bg-background"
              />

              <Button
                onClick={handleJoin}
                disabled={viewState === "redeeming" || !name.trim()}
                isLoading={viewState === "redeeming"}
                className="w-full h-12 text-base font-semibold"
              >
                {viewState === "redeeming"
                  ? "Entrando..."
                  : "Entrar na prova"}
              </Button>

              <p className="text-xs text-muted text-center leading-relaxed">
                Isso cria um acesso temporário só para esta prova — não é
                necessário ter conta na plataforma.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
