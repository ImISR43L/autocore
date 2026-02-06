import { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { problemSchema } from "../../schemas/problem.schema";
import type { ProblemFormValues } from "../../schemas/problem.schema";
import {
  Save,
  Layout,
  Code2,
  FlaskConical,
  Settings2,
  FileText,
} from "lucide-react";

// Reutilizando os componentes existentes
import { ScaffoldingConfig } from "./steps/ScaffoldingConfig";
import { ValidationConfig } from "./steps/ValidationConfig";
import { MarkdownInput } from "../inputs/MarkdownInput";

interface ProblemEditorProps {
  initialValues: ProblemFormValues;
  onSubmit: (data: ProblemFormValues) => Promise<void>;
  mode: "CREATE" | "EDIT";
}

type TabType = "general" | "code" | "validation" | "settings";

export function ProblemEditor({
  initialValues,
  onSubmit,
  mode,
}: ProblemEditorProps) {
  const [activeTab, setActiveTab] = useState<TabType>("general");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const methods = useForm<ProblemFormValues>({
    // CORREÇÃO: 'as any' resolve o conflito de tipos estritos entre Zod (Opcional) e Interface (Obrigatório/Array)
    resolver: zodResolver(problemSchema) as any,
    defaultValues: initialValues,
    mode: "onChange",
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = methods;

  const onFormSubmit = async (data: ProblemFormValues) => {
    setIsSubmitting(true);
    await onSubmit(data);
    setIsSubmitting(false);
  };

  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      <FormProvider {...methods}>
        <form
          onSubmit={handleSubmit(onFormSubmit)}
          className="h-full flex flex-col"
        >
          {/* --- BARRA DE NAVEGAÇÃO / ABAS --- */}
          <div className="flex items-center gap-1 p-2 border-b border-gray-800 bg-[#161b22]">
            <NavButton
              active={activeTab === "general"}
              onClick={() => setActiveTab("general")}
              icon={<Layout size={16} />}
              label="Geral"
            />
            <NavButton
              active={activeTab === "code"}
              onClick={() => setActiveTab("code")}
              icon={<Code2 size={16} />}
              label="Código Base"
            />
            <NavButton
              active={activeTab === "validation"}
              onClick={() => setActiveTab("validation")}
              icon={<FlaskConical size={16} />}
              label="Testes & Validação"
            />
            <NavButton
              active={activeTab === "settings"}
              onClick={() => setActiveTab("settings")}
              icon={<Settings2 size={16} />}
              label="Configurações"
            />

            <div className="flex-1" />

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="animate-spin">⌛</span>
              ) : (
                <Save size={16} />
              )}
              {mode === "EDIT" ? "Salvar Alterações" : "Criar Atividade"}
            </button>
          </div>

          {/* --- ÁREA DE CONTEÚDO (Scrollável) --- */}
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-700">
            <div className="max-w-6xl mx-auto">
              {/* ABA GERAL: Título, Descrição, Slug */}
              <div
                className={
                  activeTab === "general" ? "block space-y-6" : "hidden"
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">
                      Título da Atividade
                    </label>
                    <input
                      {...register("title")}
                      className="w-full h-10 bg-[#0d1117] border border-gray-700 rounded px-3 text-white focus:border-blue-500 outline-none transition-colors"
                      placeholder="Ex: Soma de Vetores"
                    />
                    {errors.title && (
                      <span className="text-xs text-red-400">
                        {errors.title.message}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">
                      Slug (URL)
                    </label>
                    <input
                      {...register("slug")}
                      className="w-full h-10 bg-[#0d1117] border border-gray-700 rounded px-3 text-gray-400 font-mono text-sm focus:border-blue-500 outline-none transition-colors"
                    />
                    {errors.slug && (
                      <span className="text-xs text-red-400">
                        {errors.slug.message}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2 h-[500px] flex flex-col">
                  <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <FileText size={16} /> Enunciado (Markdown)
                  </label>
                  <div className="flex-1 border border-gray-700 rounded overflow-hidden">
                    <MarkdownInput
                      label=""
                      register={register("description")}
                      watchValue={watch("description")}
                      error={errors.description?.message}
                      placeholder="Descreva o problema aqui..."
                    />
                  </div>
                </div>
              </div>

              {/* ABA CÓDIGO: ScaffoldingConfig */}
              <div className={activeTab === "code" ? "block h-full" : "hidden"}>
                <div className="bg-[#161b22] border border-gray-800 rounded-lg p-1 h-[600px]">
                  <ScaffoldingConfig />
                </div>
              </div>

              {/* ABA VALIDAÇÃO: ValidationConfig */}
              <div className={activeTab === "validation" ? "block" : "hidden"}>
                <div className="bg-[#161b22] border border-gray-800 rounded-lg p-4">
                  <ValidationConfig />
                </div>
              </div>

              {/* ABA CONFIGURAÇÕES: Prazos, Limites */}
              <div
                className={
                  activeTab === "settings" ? "block space-y-6" : "hidden"
                }
              >
                <div className="bg-[#161b22] border border-gray-800 rounded-lg p-6 space-y-6">
                  <h3 className="text-lg font-semibold text-white border-b border-gray-800 pb-2">
                    Regras de Execução
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-400">
                        Tempo Limite (ms)
                      </label>
                      <input
                        type="number"
                        {...register("timeLimit", { valueAsNumber: true })}
                        className="w-full h-10 bg-[#0d1117] border border-gray-700 rounded px-3 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-400">
                        Memória Limite (MB)
                      </label>
                      <input
                        type="number"
                        {...register("memoryLimit", { valueAsNumber: true })}
                        className="w-full h-10 bg-[#0d1117] border border-gray-700 rounded px-3 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-400">
                        Tentativas (0 = Infinito)
                      </label>
                      <input
                        type="number"
                        {...register("maxAttempts", { valueAsNumber: true })}
                        className="w-full h-10 bg-[#0d1117] border border-gray-700 rounded px-3 text-white"
                      />
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold text-white border-b border-gray-800 pb-2 pt-4">
                    Agendamento
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-400">
                        Data de Início
                      </label>
                      <input
                        type="datetime-local"
                        {...register("startDate")}
                        className="w-full h-10 bg-[#0d1117] border border-gray-700 rounded px-3 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-400">
                        Prazo de Entrega (Deadline)
                      </label>
                      <input
                        type="datetime-local"
                        {...register("deadline")}
                        className="w-full h-10 bg-[#0d1117] border border-gray-700 rounded px-3 text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}

// Botão de Aba Auxiliar
function NavButton({ active, onClick, icon, label }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
        ${
          active
            ? "bg-blue-600/10 text-blue-400 border border-blue-600/20"
            : "text-gray-400 hover:text-white hover:bg-white/5"
        }
      `}
    >
      {icon}
      {label}
    </button>
  );
}
