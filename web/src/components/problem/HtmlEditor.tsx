import { useState, useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { htmlExerciseSchema } from "../../schemas/problem.schema";
import type { HtmlExerciseFormValues } from "../../schemas/problem.schema";
import { Save, Layout, ListChecks, Clock, Code2, Eye } from "lucide-react";
import { toast } from "sonner";

import { HtmlRulesConfig } from "./steps/HtmlRulesConfig";
import { MarkdownInput } from "../inputs/MarkdownInput";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { cn } from "../../lib/utils";

interface HtmlEditorProps {
  initialValues: any;
  onSubmit: (data: any) => Promise<void>;
  mode: "CREATE" | "EDIT";
  onDirtyChange?: (isDirty: boolean) => void;
}

type TabType = "general" | "rules" | "settings";

// Componente de preview reutilizável
function HtmlPreviewPane({ html }: { html: string }) {
  const [tab, setTab] = useState<"preview" | "code">("preview");

  return (
    <div className="flex flex-col h-full border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-surface flex-none">
        <button
          type="button"
          onClick={() => setTab("preview")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all",
            tab === "preview"
              ? "bg-primary/10 text-primary border border-primary/20"
              : "text-muted hover:text-foreground",
          )}
        >
          <Eye size={12} /> Preview
        </button>
        <button
          type="button"
          onClick={() => setTab("code")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all",
            tab === "code"
              ? "bg-primary/10 text-primary border border-primary/20"
              : "text-muted hover:text-foreground",
          )}
        >
          <Code2 size={12} /> HTML
        </button>
      </div>

      {tab === "preview" ? (
        <iframe
          srcDoc={
            html ||
            "<p style='color:#888;font-family:sans-serif;padding:1rem'>Nenhum HTML de referência definido.</p>"
          }
          className="flex-1 w-full bg-white"
          sandbox="allow-same-origin"
          title="Preview do gabarito HTML"
        />
      ) : (
        <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-foreground bg-background leading-relaxed whitespace-pre-wrap">
          {html || "// Nenhum HTML de referência"}
        </pre>
      )}
    </div>
  );
}

export function HtmlEditor({
  initialValues,
  onSubmit,
  mode,
  onDirtyChange,
}: HtmlEditorProps) {
  const [activeTab, setActiveTab] = useState<TabType>("general");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const methods = useForm<HtmlExerciseFormValues>({
    resolver: zodResolver(htmlExerciseSchema) as any,
    defaultValues: initialValues,
    mode: "onChange",
  });

  const {
    register,
    watch,
    formState: { errors, isDirty },
  } = methods;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const referenceHtml = watch("validationConfig.referenceHtml" as any) ?? "";

  // Remove "expectedValue" quando vazio, em qualquer nível do payload: um
  // input de texto não preenchido sempre retorna "" (nunca undefined), mas
  // "" significa "sem valor esperado" (checagem só de presença), não "deve
  // ser literalmente vazio".
  const stripEmptyExpectedValue = (node: any): any => {
    if (Array.isArray(node)) return node.map(stripEmptyExpectedValue);
    if (node && typeof node === "object") {
      const result: any = {};
      for (const [key, value] of Object.entries(node)) {
        if (key === "expectedValue" && value === "") continue;
        result[key] = stripEmptyExpectedValue(value);
      }
      return result;
    }
    return node;
  };

  const onFormSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      data.subject = "HTML";
      await onSubmit(stripEmptyExpectedValue(data));
    } finally {
      setIsSubmitting(false);
    }
  };

  const onInvalid = (errors: any) => {
    console.error("[HTML Editor] Erro de validação:", errors);
    toast.error("Verifique os campos obrigatórios antes de salvar.");
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
    <div className="h-full flex flex-col bg-background text-foreground font-sans selection:bg-primary/20">
      <FormProvider {...methods}>
        <form
          onSubmit={methods.handleSubmit(onFormSubmit, onInvalid)}
          className="h-full flex flex-col"
        >
          {/* HEADER / NAVIGATION */}
          <div className="flex-none border-b border-border bg-surface px-4 py-3 md:px-6 md:py-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm z-10">
            <div className="w-full md:w-auto overflow-x-auto no-scrollbar">
              <div className="flex bg-background/50 rounded-lg p-1 border border-border min-w-fit">
                <NavButton
                  tab="general"
                  icon={<Layout size={16} />}
                  label="Geral"
                />
                <NavButton
                  tab="rules"
                  icon={<ListChecks size={16} />}
                  label="Regras"
                />
                <NavButton
                  tab="settings"
                  icon={<Clock size={16} />}
                  label="Agendamento"
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

          {/* CONTENT AREA */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
            <div className="max-w-7xl mx-auto min-h-full pb-10">
              {/* ABA GERAL */}
              <div
                className={cn(
                  "space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-2",
                  activeTab === "general" ? "block" : "hidden",
                )}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                  <Input
                    label="Título da Atividade"
                    placeholder="Ex: Crie uma página HTML básica"
                    error={errors.title?.message as string}
                    {...register("title")}
                    className="h-11 md:h-12 text-base bg-surface border-border focus:border-primary"
                  />
                  <Input
                    label="Slug (URL Amigável)"
                    placeholder="pagina-html-basica"
                    error={errors.slug?.message as string}
                    {...register("slug")}
                    className="h-11 md:h-12 text-base bg-surface border-border font-mono text-muted focus:text-foreground"
                  />
                </div>

                <div className="space-y-3 h-[500px] md:h-[600px] flex flex-col">
                  <label className="text-sm font-medium text-muted uppercase tracking-wider flex items-center gap-2">
                    <Layout size={16} /> Enunciado (Markdown)
                  </label>
                  <div className="flex-1 border border-border rounded-xl overflow-hidden bg-surface shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                    <MarkdownInput
                      label=""
                      register={register("description")}
                      watchValue={watch("description") ?? ""}
                      error={errors.description?.message as string}
                      placeholder="# Descreva o exercício de HTML aqui..."
                    />
                  </div>
                </div>
              </div>

              {/* ABA REGRAS */}
              <div
                className={cn(
                  "animate-in fade-in slide-in-from-bottom-2 space-y-6",
                  activeTab === "rules" ? "block" : "hidden",
                )}
              >
                <div className="bg-surface border border-border rounded-xl p-4 md:p-6 shadow-lg">
                  <HtmlRulesConfig />
                </div>

                {/* HTML de Referência */}
                <div className="bg-surface border border-border rounded-xl p-4 md:p-6 shadow-lg space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Code2 size={15} className="text-primary" />
                      HTML de Referência{" "}
                      <span className="text-xs font-normal text-muted">
                        (opcional)
                      </span>
                    </h3>
                    <p className="text-xs text-muted mt-1">
                      Cole um HTML de exemplo que represente a solução esperada.
                      Não é usado na correção automática, mas serve como
                      visualização.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[360px]">
                    <textarea
                      {...register("validationConfig.referenceHtml" as any)}
                      placeholder={
                        "<!DOCTYPE html>\n<html>\n  <body>\n    <h1>Meu Site</h1>\n  </body>\n</html>"
                      }
                      className="h-full w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      spellCheck={false}
                    />
                    <HtmlPreviewPane html={referenceHtml} />
                  </div>
                </div>
              </div>

              {/* ABA AGENDAMENTO */}
              <div
                className={cn(
                  "animate-in fade-in slide-in-from-bottom-2",
                  activeTab === "settings" ? "block" : "hidden",
                )}
              >
                <div className="bg-surface border border-border rounded-xl p-4 md:p-10 space-y-8 shadow-lg max-w-5xl mx-auto">
                  <section className="space-y-6">
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
        </form>
      </FormProvider>
    </div>
  );
}
