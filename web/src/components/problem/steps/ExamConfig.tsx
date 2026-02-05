import { useFormContext } from "react-hook-form";
import { CalendarClock, Zap, ShieldAlert, Cpu } from "lucide-react";
import type { ProblemFormValues } from "../../../schemas/problem.schema";

type ExamValues = Extract<ProblemFormValues, { type: "EXAM" }>;

export function ExamConfig() {
  const {
    register,
    formState: { errors },
  } = useFormContext<ExamValues>();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Coluna 1: Datas */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2 border-b border-gray-800 pb-2">
          <CalendarClock className="text-purple-500" size={20} />
          Janela de Tempo
        </h3>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-300">
            Início da Prova
          </label>
          <input
            type="datetime-local"
            {...register("startDate")}
            className="bg-gray-900 border border-gray-700 rounded p-2 text-white focus:border-purple-500 outline-none transition-colors"
          />
          {errors.startDate && (
            <span className="text-red-500 text-xs">
              {errors.startDate.message}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-300">
            Prazo Final (Deadline)
          </label>
          <input
            type="datetime-local"
            {...register("deadline")}
            className="bg-gray-900 border border-gray-700 rounded p-2 text-white focus:border-purple-500 outline-none transition-colors"
          />
          <p className="text-xs text-gray-500">
            Após esta data, submissões serão rejeitadas.
          </p>
          {errors.deadline && (
            <span className="text-red-500 text-xs">
              {errors.deadline.message}
            </span>
          )}
        </div>
      </div>

      {/* Coluna 2: Restrições */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2 border-b border-gray-800 pb-2">
          <ShieldAlert className="text-yellow-500" size={20} />
          Restrições de Execução
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-1">
              <Zap size={14} /> Tempo Limite (ms)
            </label>
            <input
              type="number"
              placeholder="Ex: 1000"
              {...register("timeLimit")}
              className="bg-gray-900 border border-gray-700 rounded p-2 text-white focus:border-yellow-500 outline-none transition-colors"
            />
            {errors.timeLimit && (
              <span className="text-red-500 text-xs">
                {errors.timeLimit.message}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-1">
              <Cpu size={14} /> Memória (MB)
            </label>
            <input
              type="number"
              placeholder="Ex: 256"
              {...register("memoryLimit")}
              className="bg-gray-900 border border-gray-700 rounded p-2 text-white focus:border-yellow-500 outline-none transition-colors"
            />
            {errors.memoryLimit && (
              <span className="text-red-500 text-xs">
                {errors.memoryLimit.message}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-2">
          <label className="text-sm font-medium text-gray-300">
            Tentativas Máximas (0 = Ilimitado)
          </label>
          <input
            type="number"
            placeholder="0"
            {...register("maxAttempts")}
            className="bg-gray-900 border border-gray-700 rounded p-2 text-white focus:border-yellow-500 outline-none transition-colors"
          />
          {errors.maxAttempts && (
            <span className="text-red-500 text-xs">
              {errors.maxAttempts.message}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
