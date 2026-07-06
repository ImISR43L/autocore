import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  X,
  Link2,
  Copy,
  Trash2,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
} from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { cn } from "../../lib/utils";

interface ExamAccessToken {
  id: string;
  token: string;
  expiresAt: string;
  revoked: boolean;
  createdAt: string;
}

interface ExamAccessPanelProps {
  problemId: string;
  problemTitle: string;
  open: boolean;
  onClose: () => void;
}

export function ExamAccessPanel({
  problemId,
  problemTitle,
  open,
  onClose,
}: ExamAccessPanelProps) {
  const [tokens, setTokens] = useState<ExamAccessToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expiresInHours, setExpiresInHours] = useState<number>(24);

  const loadTokens = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/problems/${problemId}/access-tokens`);
      setTokens(res.data);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar links de acesso.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadTokens();
    // Reseta o formulário de geração toda vez que o painel é reaberto.
    if (open) setExpiresInHours(24);
  }, [open, problemId]);

  if (!open) return null;

  const buildShareUrl = (rawToken: string) =>
    `${window.location.origin}/exam-access/${rawToken}`;

  const handleCopy = async (rawToken: string) => {
    try {
      await navigator.clipboard.writeText(buildShareUrl(rawToken));
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar. Copie manualmente.");
    }
  };

  const handleGenerate = async () => {
    if (!expiresInHours || expiresInHours < 1) {
      toast.error("Informe uma validade de pelo menos 1 hora.");
      return;
    }
    setIsGenerating(true);
    try {
      const res = await api.post(`/problems/${problemId}/access-tokens`, {
        expiresInHours,
      });
      setTokens((prev) => [res.data, ...prev]);
      toast.success("Link de acesso gerado!");
    } catch (error: any) {
      const msg = error.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : msg || "Erro ao gerar link.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevoke = async (tokenId: string) => {
    if (!confirm("Revogar este link? Quem ainda não entrou não conseguirá mais usá-lo.")) {
      return;
    }
    try {
      const res = await api.delete(`/access-tokens/${tokenId}`);
      setTokens((prev) =>
        prev.map((t) => (t.id === tokenId ? res.data : t)),
      );
      toast.success("Link revogado.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao revogar o link.");
    }
  };

  const getTokenStatus = (t: ExamAccessToken) => {
    if (t.revoked) return { label: "Revogado", tone: "muted" as const };
    if (new Date(t.expiresAt) < new Date())
      return { label: "Expirado", tone: "muted" as const };
    return { label: "Ativo", tone: "active" as const };
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 border-b border-border flex-none">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-none">
              <Link2 size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-foreground">
                Links de acesso temporário
              </h3>
              <p className="text-sm text-muted truncate">{problemTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground p-1 rounded-md hover:bg-surface-hover transition-colors flex-none"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Corpo (rolável) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Formulário de geração */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted">
              Gerar novo link
            </label>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Input
                  type="number"
                  min={1}
                  max={24 * 30}
                  label="Validade (horas)"
                  value={expiresInHours}
                  onChange={(e) =>
                    setExpiresInHours(Number(e.target.value))
                  }
                  className="bg-background"
                />
              </div>
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                isLoading={isGenerating}
                className="h-11 px-4 whitespace-nowrap"
              >
                <Plus size={18} className="mr-1.5" />
                Gerar link
              </Button>
            </div>
            <p className="text-xs text-muted">
              Qualquer pessoa com o link consegue entrar nesta prova
              específica, mesmo sem estar matriculada na turma ou sem conta
              na plataforma.
            </p>
          </div>

          <div className="border-t border-border" />

          {/* Lista de tokens existentes */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted">
              Links gerados
            </label>

            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted">
                <Loader2 className="animate-spin" size={20} />
              </div>
            ) : tokens.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-border rounded-lg text-sm text-muted">
                Nenhum link gerado ainda para esta prova.
              </div>
            ) : (
              <div className="space-y-2">
                {tokens.map((t) => {
                  const status = getTokenStatus(t);
                  const isActive = status.tone === "active";
                  return (
                    <div
                      key={t.id}
                      className="border border-border rounded-lg p-3 space-y-2 bg-background"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1",
                            isActive
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-muted/10 text-muted",
                          )}
                        >
                          {isActive ? (
                            <CheckCircle2 size={12} />
                          ) : (
                            <XCircle size={12} />
                          )}
                          {status.label}
                        </span>
                        <span className="text-xs text-muted flex items-center gap-1">
                          <Clock size={12} />
                          Expira em {formatDate(t.expiresAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs bg-surface border border-border rounded px-2 py-1.5 truncate text-muted">
                          {buildShareUrl(t.token)}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-none"
                          onClick={() => handleCopy(t.token)}
                          title="Copiar link"
                        >
                          <Copy size={14} />
                        </Button>
                        {isActive && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 flex-none text-destructive hover:bg-destructive/10"
                            onClick={() => handleRevoke(t.id)}
                            title="Revogar link"
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
