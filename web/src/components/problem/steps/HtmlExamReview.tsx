import { useFormContext } from "react-hook-form";
import {
  Calendar,
  Clock,
  AlertTriangle,
  Globe,
  CheckCircle,
  ListChecks,
  RotateCcw,
} from "lucide-react";

export function HtmlExamReview() {
  const { watch } = useFormContext();

  const values = watch();
  const questions = values.questions || [];

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Não definido";
    return new Date(dateStr).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  const totalRules = questions.reduce(
    (acc: number, q: any) => acc + (q.validationConfig?.rules?.length ?? 0),
    0,
  );

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* Cabeçalho */}
      <div className="border-b border-border pb-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <CheckCircle className="text-emerald-500" size={20} />
          Revisão da Prova HTML
        </h3>
        <p className="text-sm text-muted mt-1">
          Confira os detalhes antes de finalizar a criação.
        </p>
      </div>

      {/* Resumo geral */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-4 border-b border-border pb-2">
          Configurações da Avaliação
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="bg-blue-500/10 p-2 rounded-lg text-blue-400 flex-none">
                <Calendar size={16} />
              </div>
              <div>
                <span className="block text-xs text-muted uppercase tracking-wider">
                  Período de Realização
                </span>
                <div className="text-sm text-foreground font-medium mt-0.5">
                  {formatDate(values.startDate)}{" "}
                  <span className="text-muted mx-1">até</span>{" "}
                  {formatDate(values.deadline)}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-purple-500/10 p-2 rounded-lg text-purple-400 flex-none">
                <RotateCcw size={16} />
              </div>
              <div>
                <span className="block text-xs text-muted uppercase tracking-wider">
                  Tentativas por Questão
                </span>
                <div className="text-sm text-foreground font-medium mt-0.5">
                  {values.maxAttempts && values.maxAttempts > 0
                    ? `${values.maxAttempts} tentativa(s)`
                    : "Ilimitadas"}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 p-2 rounded-lg text-primary flex-none">
                <Globe size={16} />
              </div>
              <div>
                <span className="block text-xs text-muted uppercase tracking-wider">
                  Questões
                </span>
                <div className="text-sm text-foreground font-medium mt-0.5">
                  {questions.length} questão(ões)
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-400 flex-none">
                <ListChecks size={16} />
              </div>
              <div>
                <span className="block text-xs text-muted uppercase tracking-wider">
                  Total de Regras
                </span>
                <div className="text-sm text-foreground font-medium mt-0.5">
                  {totalRules} regra(s) de validação
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de questões */}
      <div className="flex flex-col gap-3">
        <h4 className="text-xs font-bold text-muted uppercase tracking-wider flex justify-between items-center">
          <span className="flex items-center gap-2">
            <Globe size={14} /> Questões ({questions.length})
          </span>
          {questions.length === 0 && (
            <span className="text-destructive flex items-center gap-1">
              <AlertTriangle size={12} /> Adicione pelo menos uma questão
            </span>
          )}
        </h4>

        {questions.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border rounded-xl bg-surface/30 text-muted text-sm">
            Nenhuma questão foi adicionada no passo anterior.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {questions.map((q: any, idx: number) => {
              const ruleCount = q.validationConfig?.rules?.length ?? 0;
              const hasRules = ruleCount > 0;

              return (
                <div
                  key={idx}
                  className={`border rounded-xl p-3 flex items-center justify-between transition-colors ${
                    hasRules
                      ? "bg-surface border-border hover:border-border/80"
                      : "bg-destructive/5 border-destructive/30"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex-none">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <span className="block text-sm font-medium text-foreground truncate">
                        {q.title || "Sem título"}
                      </span>
                      <span className="text-xs text-muted font-mono">
                        /{q.slug}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs flex-none">
                    {hasRules ? (
                      <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                        <ListChecks size={11} />
                        {ruleCount} regra{ruleCount !== 1 ? "s" : ""}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-destructive bg-destructive/10 border border-destructive/20 px-2 py-0.5 rounded">
                        <AlertTriangle size={11} />
                        Sem regras
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Aviso */}
      {questions.some((q: any) => !q.validationConfig?.rules?.length) && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <AlertTriangle
            size={16}
            className="text-amber-400 flex-none mt-0.5"
          />
          <p className="text-xs text-amber-300">
            Algumas questões estão sem regras de validação. Volte ao passo
            anterior e adicione pelo menos uma regra por questão.
          </p>
        </div>
      )}
    </div>
  );
}
