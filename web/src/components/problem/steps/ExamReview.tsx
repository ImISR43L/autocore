import { useFormContext } from "react-hook-form";
import {
  Calendar,
  Clock,
  AlertTriangle,
  FileQuestion, // Agora sendo usado
  CheckCircle,
  HardDrive,
  RotateCcw,
} from "lucide-react";
import type { ProblemFormValues } from "../../../schemas/problem.schema";

type ExamValues = Extract<ProblemFormValues, { type: "EXAM" }>;

export function ExamReview() {
  const { watch } = useFormContext<ExamValues>();

  const values = watch();
  const questions = values.questions || [];

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Não definido";
    return new Date(dateStr).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="border-b border-gray-800 pb-2">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <CheckCircle className="text-green-500" size={20} />
          Revisão da Prova
        </h3>
        <p className="text-sm text-gray-400">
          Confira os detalhes antes de finalizar a criação.
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <h4 className="text-sm font-bold text-gray-400 uppercase mb-4 border-b border-gray-800 pb-2">
          Configurações da Avaliação
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="bg-blue-900/20 p-2 rounded text-blue-400">
                <Calendar size={18} />
              </div>
              <div>
                <span className="block text-xs text-gray-500 uppercase">
                  Período de Realização
                </span>
                <div className="text-sm text-foreground font-medium mt-0.5">
                  {formatDate(values.startDate)}{" "}
                  <span className="text-gray-500 mx-1">até</span>{" "}
                  {formatDate(values.deadline)}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-purple-900/20 p-2 rounded text-purple-400">
                <Clock size={18} />
              </div>
              <div>
                <span className="block text-xs text-gray-500 uppercase">
                  Limite de Tempo (Execução)
                </span>
                <div className="text-sm text-foreground font-medium mt-0.5">
                  {values.timeLimit
                    ? `${values.timeLimit / 1000} segundos`
                    : "Sem limite"}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="bg-orange-900/20 p-2 rounded text-orange-400">
                <RotateCcw size={18} />
              </div>
              <div>
                <span className="block text-xs text-gray-500 uppercase">
                  Tentativas Permitidas
                </span>
                <div className="text-sm text-foreground font-medium mt-0.5">
                  {values.maxAttempts && values.maxAttempts > 0
                    ? `${values.maxAttempts} tentativas`
                    : "Ilimitadas"}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-gray-800 p-2 rounded text-gray-400">
                <HardDrive size={18} />
              </div>
              <div>
                <span className="block text-xs text-gray-500 uppercase">
                  Limite de Memória
                </span>
                <div className="text-sm text-foreground font-medium mt-0.5">
                  {values.memoryLimit
                    ? `${values.memoryLimit} MB`
                    : "Padrão (256 MB)"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {/* CORREÇÃO: Usando FileQuestion aqui */}
        <h4 className="text-sm font-bold text-gray-400 uppercase flex justify-between items-center">
          <span className="flex items-center gap-2">
            <FileQuestion size={16} /> Questões ({questions.length})
          </span>
          {questions.length === 0 && (
            <span className="text-red-500 text-xs flex items-center gap-1">
              <AlertTriangle size={12} /> Adicione pelo menos uma questão
            </span>
          )}
        </h4>

        <div className="flex flex-col gap-2">
          {questions.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-gray-800 rounded bg-gray-900/30 text-gray-500">
              Nenhuma questão foi adicionada no passo anterior.
            </div>
          ) : (
            questions.map((q, idx) => (
              <div
                key={idx}
                className="bg-gray-900 border border-gray-800 rounded p-3 flex items-center justify-between group hover:border-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-800 text-xs font-mono text-gray-400">
                    {idx + 1}
                  </span>
                  <div>
                    <span className="block text-sm font-medium text-foreground">
                      {q.title || "Sem título"}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">
                      /{q.slug}
                    </span>
                  </div>
                </div>

                <div className="flex gap-4 text-xs text-gray-500">
                  <span title="Casos de Teste">
                    {q.testCases?.length || 0} testes
                  </span>
                  <span className="w-px h-3 bg-gray-800"></span>
                  <span
                    title="Tipo de Retorno"
                    className="font-mono text-blue-400"
                  >
                    {q.returnType}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
