import { useFormContext } from "react-hook-form";
import { CalendarClock, Zap, ShieldAlert } from "lucide-react";
import type { ProblemFormValues } from "../../../schemas/problem.schema";
import { Input } from "../../ui/Input";
import { Card } from "../../ui/Card";

type ExamValues = Extract<ProblemFormValues, { type: "EXAM" }>;

export function ExamConfig() {
  const {
    register,
    formState: { errors },
  } = useFormContext<ExamValues>();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Coluna 1: Datas */}
      <Card className="p-6 space-y-6">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 border-b border-border pb-3">
          <CalendarClock className="text-primary" size={20} />
          Janela de Tempo
        </h3>

        <div className="space-y-4">
          <Input
            type="datetime-local"
            label="Início da Prova"
            {...register("startDate")}
            error={errors.startDate?.message}
            className="bg-background"
          />

          <Input
            type="datetime-local"
            label="Prazo Final (Deadline)"
            {...register("deadline")}
            error={errors.deadline?.message}
            className="bg-background"
          />
        </div>
      </Card>

      {/* Coluna 2: Regras */}
      <Card className="p-6 space-y-6">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 border-b border-border pb-3">
          <ShieldAlert className="text-primary" size={20} />
          Regras da Prova
        </h3>

        <Input
          type="number"
          label="Tentativas Máximas (0 = Ilimitado)"
          placeholder="0"
          {...register("maxAttempts", { valueAsNumber: true })}
          error={errors.maxAttempts?.message}
          className="bg-background"
        />

        <div className="flex items-start gap-3 p-3 bg-background rounded-lg border border-border mt-2">
          <Zap size={16} className="text-yellow-500 mt-0.5 flex-none" />
          <p className="text-xs text-muted">
            <strong className="text-foreground">Modo Prova:</strong> O feedback
            será limitado. Alunos não verão os casos de teste ocultos até o fim
            do prazo. O tempo limite e a memória de execução são configurados
            individualmente em cada questão, na etapa "Questões".
          </p>
        </div>
      </Card>
    </div>
  );
}
