import { useState, useEffect } from "react";
import { useForm, Controller, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { sqlModelingExerciseSchema } from "../../schemas/problem.schema";
import {
  Save,
  Layout,
  Network,
  Settings2,
  FileText,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

import { ErDiagramCanvas } from "../erDiagram/ErDiagramCanvas";
import { EMPTY_ER_MODEL } from "../../types/erModel";
import type { ErModel } from "../../types/erModel";
import { MarkdownInput } from "../inputs/MarkdownInput";

import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { cn } from "../../lib/utils";

interface SqlModelingEditorProps {
  initialValues: any;
  onSubmit: (data: any) => Promise<void>;
  mode: "CREATE" | "EDIT";
  onDirtyChange?: (isDirty: boolean) => void;
}

type TabType = "general" | "model" | "settings";

export function SqlModelingEditor({
  initialValues,
  onSubmit,
  mode,
  onDirtyChange,
}: SqlModelingEditorProps) {
  const [activeTab, setActiveTab] = useState<TabType>("general");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // FIX (mesmo cuidado documentado no SqlModelingWizard): o
  // ErDiagramCanvas só lê `initialValue` uma vez, no mount, via
  // Controller. Isso exige que `initialValues.referenceModel` já esteja
  // resolvido ANTES deste componente montar — EditProblem.tsx só chama
  // <SqlModelingEditor initialValues={problem} .../> depois que `problem`
  // termina de carregar (isLoading guard), então isso já é garantido pelo
  // fluxo existente. Se este componente algum dia for montado antes dos
  // dados chegarem, o diagrama nasceria vazio e ficaria "preso" vazio.
  const methods = useForm({
    resolver: zodResolver(sqlModelingExerciseSchema) as any,
    defaultValues: {
      ...initialValues,
      referenceModel: initialValues?.referenceModel || EMPTY_ER_MODEL,
    },
    mode: "onChange",
  });

  const {
    register,
    control,
    watch,
    formState: { errors, isDirty },
  } = methods;

  useEffect(() => {
    if (onDirtyChange) onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  const onFormSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      data.subject = "SQL_MODELING";
      data.type = "EXERCISE";
      await onSubmit(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onInvalid = () => {
    toast.error("Preencha todos os campos obrigatórios antes de continuar.");
  };

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
        "flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-lg text-xs md:text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary flex-1 md:flex-none justify-center whitespace-nowrap",
        activeTab === tab
          ? "bg-primary/10 text-primary border border-primary/20 shadow-sm"
          : "text-muted hover:text-foreground hover:bg-surface-hover",
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div className="h-full flex flex-col bg-background text-foreground font-sans selection:bg-primary/20 relative">
      <FormProvider {...methods}>
        <form
          onSubmit={methods.handleSubmit(onFormSubmit, onInvalid)}
          className="h-full flex flex-col"
        >
          <div className="flex-none border-b border-border bg-surface px-4 py-3 md:px-6 md:py-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm z-10">
            <div className="w-full md:w-auto overflow-x-auto no-scrollbar">
              <div className="flex bg-background/50 rounded-lg p-1 border border-border min-w-fit">
                <NavButton tab="general" icon={<Layout size={16} />} label="Geral" />
                <NavButton
                  tab="model"
                  icon={<Network size={16} />}
                  label="Gabarito"
                />
                <NavButton
                  tab="settings"
                  icon={<Settings2 size={16} />}
                  label="Ajustes"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              isLoading={isSubmitting}
              className="w-full md:w-auto px-8 h-10 md:h-11 text-sm md:text-base font-semibold shadow-md shadow-primary/10"
            >
              <Save size={18} className="mr-2" />
              {mode === "EDIT" ? "Salvar Alterações" : "Criar Atividade"}
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
            <div className="max-w-7xl mx-auto min-h-full pb-10">
              <div
                className={cn(
                  "space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-2",
                  activeTab === "general" ? "block" : "hidden",
                )}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                  <Input
                    label="Título do Exercício"
                    placeholder="Ex: Modelagem de uma Biblioteca"
                    error={errors.title?.message as string}
                    {...register("title")}
                    className="h-11 md:h-12 text-base bg-surface border-border focus:border-primary"
                  />
                  <Input
                    label="Slug (URL Amigável)"
                    placeholder="modelagem-de-uma-biblioteca"
                    error={errors.slug?.message as string}
                    {...register("slug")}
                    className="h-11 md:h-12 text-base bg-surface border-border font-mono text-muted focus:text-foreground"
                  />
                </div>

                <div className="space-y-3 h-[500px] md:h-[600px] flex flex-col">
                  <label className="text-sm font-medium text-muted uppercase tracking-wider flex items-center gap-2">
                    <FileText size={16} /> Enunciado (Markdown)
                  </label>
                  <div className="flex-1 border border-border rounded-xl overflow-hidden bg-surface shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                    <MarkdownInput
                      label=""
                      register={register("description")}
                      watchValue={watch("description")}
                      error={errors.description?.message as string}
                      placeholder="# Descreva o domínio que o aluno precisa modelar..."
                    />
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  "h-full animate-in fade-in slide-in-from-bottom-2",
                  activeTab === "model" ? "block" : "hidden",
                )}
              >
                <div className="bg-surface border border-border rounded-xl p-1 h-[600px] md:h-[750px] shadow-lg overflow-hidden">
                  <Controller
                    control={control}
                    name={"referenceModel" as any}
                    render={({ field }) => (
                      <ErDiagramCanvas
                        initialValue={(field.value as ErModel) || EMPTY_ER_MODEL}
                        onChange={field.onChange}
                        className="rounded-lg overflow-hidden"
                      />
                    )}
                  />
                </div>
              </div>

              <div
                className={cn(
                  "animate-in fade-in slide-in-from-bottom-2",
                  activeTab === "settings" ? "block" : "hidden",
                )}
              >
                <div className="bg-surface border border-border rounded-xl p-4 md:p-10 space-y-8 md:space-y-12 shadow-lg max-w-5xl mx-auto">
                  <section className="space-y-6 md:space-y-8">
                    <h3 className="text-xl md:text-2xl font-bold text-foreground border-b border-border pb-4 flex items-center gap-3">
                      <div className="p-2 md:p-2.5 bg-primary/10 rounded-xl text-primary">
                        <Clock size={24} />
                      </div>
                      Agendamento e Tentativas
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
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
                      <Input
                        label="Tentativas (0 = Infinito)"
                        type="number"
                        {...register("maxAttempts", { valueAsNumber: true })}
                        className="bg-background h-11 md:h-12 text-base border-border"
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
