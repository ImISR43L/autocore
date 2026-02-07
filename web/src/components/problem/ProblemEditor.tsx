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
  Clock,
  // ArrowLeft, // Removido
} from "lucide-react";
// import { useNavigate } from "react-router-dom"; // Removido pois não será mais usado aqui

// Reutilizando os componentes existentes
import { ScaffoldingConfig } from "./steps/ScaffoldingConfig";
import { ValidationConfig } from "./steps/ValidationConfig";
import { MarkdownInput } from "../inputs/MarkdownInput";

// UI Components do Design System
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { cn } from "../../lib/utils";

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
  // const navigate = useNavigate(); // Não é mais necessário
  const [activeTab, setActiveTab] = useState<TabType>("general");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const methods = useForm<ProblemFormValues>({
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

  // Botão de Navegação Interna (Abas)
  const NavButton = ({
    tab,
    icon,
    label,
  }: {
    tab: TabType;
    icon: React.ReactNode;
    label: string;
  }) => (
    <button
      type="button"
      onClick={() => setActiveTab(tab)}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary",
        activeTab === tab
          ? "bg-primary/10 text-primary border border-primary/20 shadow-sm"
          : "text-muted hover:text-zinc-100 hover:bg-surface-hover",
      )}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="h-full flex flex-col bg-background text-zinc-100 font-sans selection:bg-primary/20">
      <FormProvider {...methods}>
        <form
          onSubmit={handleSubmit(onFormSubmit)}
          className="h-full flex flex-col"
        >
          {/* --- HEADER / NAVIGATION --- */}
          <div className="flex-none border-b border-border bg-surface px-6 py-4 flex items-center justify-between gap-4 shadow-sm z-10">
            <div className="flex items-center gap-4">
              {/* REMOVIDO: Botão de Voltar e Divisor. 
                    A página pai (EditProblem ou CreateProblem) já deve fornecer a navegação de retorno.
                */}

              <div className="flex bg-background/50 rounded-lg p-1 border border-border">
                <NavButton
                  tab="general"
                  icon={<Layout size={18} />}
                  label="Geral"
                />
                <NavButton
                  tab="code"
                  icon={<Code2 size={18} />}
                  label="Código"
                />
                <NavButton
                  tab="validation"
                  icon={<FlaskConical size={18} />}
                  label="Testes"
                />
                <NavButton
                  tab="settings"
                  icon={<Settings2 size={18} />}
                  label="Ajustes"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              isLoading={isSubmitting}
              className="px-8 h-11 text-base font-semibold shadow-md shadow-primary/10"
            >
              <Save size={20} className="mr-2" />
              {mode === "EDIT" ? "Salvar Alterações" : "Criar Atividade"}
            </Button>
          </div>

          {/* --- CONTENT AREA --- */}
          <div className="flex-1 overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
            <div className="max-w-7xl mx-auto min-h-full">
              {/* ABA GERAL */}
              <div
                className={cn(
                  "space-y-8 animate-in fade-in slide-in-from-bottom-2",
                  activeTab === "general" ? "block" : "hidden",
                )}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Input
                    label="Título da Atividade"
                    placeholder="Ex: Soma de Vetores"
                    error={errors.title?.message}
                    {...register("title")}
                    className="h-12 text-base bg-surface border-border focus:border-primary"
                  />
                  <Input
                    label="Slug (URL Amigável)"
                    placeholder="soma-de-vetores"
                    error={errors.slug?.message}
                    {...register("slug")}
                    className="h-12 text-base bg-surface border-border font-mono text-muted focus:text-zinc-100"
                  />
                </div>

                <div className="space-y-3 h-[600px] flex flex-col">
                  <label className="text-sm font-medium text-muted uppercase tracking-wider flex items-center gap-2">
                    <FileText size={16} /> Enunciado (Markdown)
                  </label>
                  <div className="flex-1 border border-border rounded-xl overflow-hidden bg-surface shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                    <MarkdownInput
                      label="" // Label já renderizado acima
                      register={register("description")}
                      watchValue={watch("description")}
                      error={errors.description?.message}
                      placeholder="# Descreva o problema detalhadamente aqui..."
                    />
                  </div>
                </div>
              </div>

              {/* ABA CÓDIGO */}
              <div
                className={cn(
                  "h-full animate-in fade-in slide-in-from-bottom-2",
                  activeTab === "code" ? "block" : "hidden",
                )}
              >
                <div className="bg-surface border border-border rounded-xl p-1 h-[750px] shadow-lg">
                  <ScaffoldingConfig />
                </div>
              </div>

              {/* ABA VALIDAÇÃO */}
              <div
                className={cn(
                  "animate-in fade-in slide-in-from-bottom-2",
                  activeTab === "validation" ? "block" : "hidden",
                )}
              >
                <div className="bg-surface border border-border rounded-xl p-6 shadow-lg">
                  <ValidationConfig />
                </div>
              </div>

              {/* ABA CONFIGURAÇÕES */}
              <div
                className={cn(
                  "animate-in fade-in slide-in-from-bottom-2",
                  activeTab === "settings" ? "block" : "hidden",
                )}
              >
                <div className="bg-surface border border-border rounded-xl p-10 space-y-12 shadow-lg max-w-5xl mx-auto">
                  <section className="space-y-8">
                    <h3 className="text-2xl font-bold text-zinc-100 border-b border-border pb-4 flex items-center gap-3">
                      <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                        <Settings2 size={28} />
                      </div>
                      Regras de Execução
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <Input
                        label="Tempo Limite (ms)"
                        type="number"
                        {...register("timeLimit", { valueAsNumber: true })}
                        className="bg-background h-12 text-base border-border"
                      />
                      <Input
                        label="Memória Limite (MB)"
                        type="number"
                        {...register("memoryLimit", { valueAsNumber: true })}
                        className="bg-background h-12 text-base border-border"
                      />
                      <Input
                        label="Tentativas (0 = Infinito)"
                        type="number"
                        {...register("maxAttempts", { valueAsNumber: true })}
                        className="bg-background h-12 text-base border-border"
                      />
                    </div>
                  </section>

                  <section className="space-y-8">
                    <h3 className="text-2xl font-bold text-zinc-100 border-b border-border pb-4 flex items-center gap-3">
                      <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                        <Clock size={28} />
                      </div>
                      Agendamento
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <Input
                        label="Data de Início"
                        type="datetime-local"
                        {...register("startDate")}
                        className="bg-background h-12 text-base border-border"
                      />
                      <Input
                        label="Prazo de Entrega (Deadline)"
                        type="datetime-local"
                        {...register("deadline")}
                        className="bg-background h-12 text-base border-border"
                      />
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
