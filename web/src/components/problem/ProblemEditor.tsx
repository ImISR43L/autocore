import { useState, useEffect } from "react";
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
} from "lucide-react";

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
  // Novo prop para comunicação com o pai
  onDirtyChange?: (isDirty: boolean) => void;
}

type TabType = "general" | "code" | "validation" | "settings";

export function ProblemEditor({
  initialValues,
  onSubmit,
  mode,
  onDirtyChange,
}: ProblemEditorProps) {
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
    formState: { errors, isDirty },
  } = methods;

  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(isDirty);
    }
  }, [isDirty, onDirtyChange]);

  const handleFormSubmit = async (data: ProblemFormValues) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: "general", label: "Informações Básicas", icon: Layout },
    { id: "code", label: "Código Base & Gabarito", icon: Code2 },
    { id: "validation", label: "Casos de Teste", icon: FlaskConical },
    { id: "settings", label: "Regras e Agendamento", icon: Settings2 },
  ];

  return (
    <div className="h-full flex flex-col lg:flex-row bg-background text-foreground">
      {/* Sidebar de Navegação */}
      <div className="w-full lg:w-72 flex-none border-b lg:border-b-0 lg:border-r border-border bg-surface p-4 flex flex-row lg:flex-col gap-2 overflow-x-auto hide-scrollbar z-10">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-3 px-4 py-3.5 lg:py-3 rounded-xl font-medium transition-all duration-200 min-w-max lg:min-w-0 text-sm lg:text-base outline-none",
                isActive
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted hover:bg-surface-hover hover:text-foreground",
              )}
            >
              <Icon
                size={20}
                className={isActive ? "text-primary" : "text-muted"}
              />
              {tab.label}
            </button>
          );
        })}

        <div className="mt-auto hidden lg:block pt-6">
          <Button
            type="submit"
            onClick={handleSubmit(handleFormSubmit as any)}
            disabled={isSubmitting}
            className="w-full shadow-lg font-bold h-12 text-base transition-transform hover:scale-[1.02]"
          >
            {isSubmitting ? (
              "A Guardar..."
            ) : (
              <>
                <Save className="mr-2" size={20} />
                Guardar Problema
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Container de Formulário Injectável */}
      <FormProvider {...methods}>
        <form
          id="problem-editor-form"
          onSubmit={handleSubmit(handleFormSubmit as any)}
          className="flex-1 min-w-0 h-full flex flex-col overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
            <div className="max-w-4xl mx-auto pb-24 lg:pb-8">
              {/* === ABA: IDENTIFICAÇÃO GERAL === */}
              <div
                className={cn(
                  "animate-in fade-in zoom-in-95 duration-300",
                  activeTab !== "general" && "hidden",
                )}
              >
                <div className="space-y-6 md:space-y-8">
                  <section>
                    <h3 className="text-xl md:text-2xl font-bold text-foreground border-b border-border pb-4 flex items-center gap-3 mb-6">
                      <div className="p-2 md:p-2.5 bg-primary/10 rounded-xl text-primary">
                        <FileText size={24} />
                      </div>
                      Identidade Visual
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Input
                        label="Título da Atividade"
                        {...register("title")}
                        className="bg-background h-11 md:h-12 text-base border-border"
                        error={errors.title?.message}
                      />
                      <Input
                        label="URL do Identificador (Slug)"
                        {...register("slug")}
                        className="bg-background h-11 md:h-12 text-base font-mono border-border"
                        error={errors.slug?.message}
                      />
                    </div>

                    <div className="mt-6">
                      <label className="text-sm font-medium mb-2 block text-foreground">
                        Formato Estático
                      </label>
                      <select
                        {...register("type")}
                        disabled={mode === "EDIT"}
                        className="w-full bg-background border border-border rounded-lg p-3.5 text-base outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                      >
                        <option value="EXERCISE">
                          Atividade Lógica Padrão
                        </option>
                        <option value="EXAM">Provas (Múltiplas Frentes)</option>
                      </select>
                    </div>
                  </section>

                  <section>
                    <label className="text-sm font-medium mb-2 block text-foreground">
                      Corpo do Enunciado (Markdown Nativo)
                    </label>
                    <div
                      className={cn(
                        "rounded-xl overflow-hidden border border-border",
                        errors.description && "border-destructive",
                      )}
                    >
                      <MarkdownInput
                        label=""
                        register={register("description")}
                        watchValue={watch("description")}
                        error={errors.description?.message}
                      />
                    </div>
                  </section>
                </div>
              </div>

              {/* === ABA: GESTÃO DE CÓDIGO === */}
              <div
                className={cn(
                  "animate-in fade-in zoom-in-95 duration-300 h-full",
                  activeTab !== "code" && "hidden",
                )}
              >
                <div className="h-full min-h-[600px] flex flex-col">
                  <ScaffoldingConfig />
                </div>
              </div>

              {/* === ABA: AFERIÇÃO COMPUTACIONAL === */}
              <div
                className={cn(
                  "animate-in fade-in zoom-in-95 duration-300",
                  activeTab !== "validation" && "hidden",
                )}
              >
                <ValidationConfig />
              </div>

              {/* === ABA: TEMPO E TOLERÂNCIA === */}
              <div
                className={cn(
                  "animate-in fade-in zoom-in-95 duration-300",
                  activeTab !== "settings" && "hidden",
                )}
              >
                <div className="space-y-8 md:space-y-10">
                  <section className="space-y-6 md:space-y-8">
                    <h3 className="text-xl md:text-2xl font-bold text-foreground border-b border-border pb-4 flex items-center gap-3">
                      <div className="p-2 md:p-2.5 bg-primary/10 rounded-xl text-primary">
                        <Settings2 size={24} />
                      </div>
                      Restrições de Sistema
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                      <Input
                        label="Tempo Limite Máx (min)"
                        type="number"
                        {...register("timeLimit", { valueAsNumber: true })}
                        className="bg-background h-11 md:h-12 text-base border-border"
                      />
                      <Input
                        label="Limite de Ram alocada (MB)"
                        type="number"
                        {...register("memoryLimit", { valueAsNumber: true })}
                        className="bg-background h-11 md:h-12 text-base border-border"
                      />
                      <Input
                        label="Fluxo de Tentativas (Zero = Infinitas)"
                        type="number"
                        {...register("maxAttempts", { valueAsNumber: true })}
                        className="bg-background h-11 md:h-12 text-base border-border"
                      />
                    </div>
                  </section>

                  <section className="space-y-6 md:space-y-8">
                    <h3 className="text-xl md:text-2xl font-bold text-foreground border-b border-border pb-4 flex items-center gap-3">
                      <div className="p-2 md:p-2.5 bg-primary/10 rounded-xl text-primary">
                        <Clock size={24} />
                      </div>
                      Agendamento
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                      <Input
                        label="Data de Início"
                        type="datetime-local"
                        {...register("startDate")}
                        className="bg-background h-11 md:h-12 text-base border-border"
                      />
                      <Input
                        label="Prazo de Entrega (Deadline)"
                        type="datetime-local"
                        {...register("deadline")}
                        className="bg-background h-11 md:h-12 text-base border-border"
                      />
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>

          {/* Botão de Salvamento no Mobile */}
          <div className="lg:hidden p-4 border-t border-border bg-surface mt-auto">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full shadow-lg font-bold h-12 text-base"
            >
              {isSubmitting ? "A Guardar..." : "Guardar Problema"}
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
