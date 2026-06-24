import { useState, useEffect } from "react";
import { useForm, useWatch, FormProvider } from "react-hook-form";
import { useParams, useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  htmlExerciseSchema,
  htmlExamSchema,
} from "../../schemas/problem.schema";
import Stepper from "../Stepper";
import { HtmlRulesConfig } from "./steps/HtmlRulesConfig";
import { HtmlExamQuestions } from "./steps/HtmlExamQuestions";
import { HtmlExamReview } from "./steps/HtmlExamReview";
import { ExamConfig } from "./steps/ExamConfig";
import { MarkdownInput } from "../inputs/MarkdownInput";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { cn } from "../../lib/utils";
import { toast } from "sonner";
import { useFormPersist } from "../../hooks/useFormPersist";
import {
  ArrowLeft,
  Trash,
  AlertTriangle,
  RefreshCw,
  Code2,
  Eye,
  Clock,
  LayoutTemplate,
  FileText,
} from "lucide-react";

const htmlSchema = z.union([htmlExerciseSchema, htmlExamSchema]);

interface HtmlWizardProps {
  initialValues?: any;
  onSubmit: (data: any) => Promise<void>;
}

const ScrollableStepContent = ({
  children,
  isWide = false,
}: {
  children: React.ReactNode;
  isWide?: boolean;
}) => (
  <div className="h-full w-full overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
    <div
      className={cn(
        "mx-auto flex flex-col gap-6 pt-6 pb-10 px-4 sm:px-6 transition-all duration-300",
        isWide ? "max-w-[98%]" : "max-w-5xl",
      )}
    >
      {children}
    </div>
  </div>
);

const generateSlug = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-");

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
            "<p style='color:#888;font-family:sans-serif;padding:1rem;text-align:center'>Nenhum HTML de referência definido.</p>"
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

export function HtmlWizard({ initialValues, onSubmit }: HtmlWizardProps) {
  const params = useParams();
  const classroomId = params.id || params.classroomId || "";
  const navigate = useNavigate();
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);

  const defaults = {
    type: "EXERCISE",
    title: "",
    subject: "HTML",
    description: "",
    slug: "",
    classroomId,
    validationConfig: { rules: [] },
    questions: [],
    startDate: "",
    deadline: "",
    maxAttempts: 0,
  };

  const FIELD_LABELS: Record<string, string> = {
    title: "título",
    slug: "slug",
    description: "enunciado",
    "validationConfig.rules": "regras de validação",
    questions: "questões",
    startDate: "data de início",
    deadline: "prazo final",
  };

  const methods = useForm({
    resolver: zodResolver(htmlSchema) as any,
    defaultValues: (initialValues || defaults) as any,
    mode: "onChange",
  });

  const {
    register,
    control,
    setValue,
    reset,
    formState: { errors, touchedFields },
  } = methods;

  const { clearDraft } = useFormPersist("html_wizard_draft", methods);

  const problemType = useWatch({ control, name: "type" });
  const titleValue = useWatch({ control, name: "title" });
  const descriptionValue = useWatch({ control, name: "description" });
  const referenceHtml =
    methods.watch("validationConfig.referenceHtml" as any) ?? "";

  useEffect(() => {
    if (classroomId)
      setValue("classroomId", classroomId, { shouldDirty: false });
  }, [classroomId, setValue]);

  useEffect(() => {
    const currentSlug = methods.getValues("slug");
    if (titleValue && (!touchedFields.slug || !currentSlug)) {
      setValue("slug", generateSlug(titleValue), { shouldValidate: true });
    }
  }, [titleValue, setValue, touchedFields.slug, methods]);

  const handleRegenerateSlug = () => {
    if (titleValue)
      setValue("slug", generateSlug(titleValue), {
        shouldValidate: true,
        shouldDirty: true,
      });
  };

  // Remove "expectedValue" quando vazio, em qualquer nível do payload: um
  // input de texto não preenchido sempre retorna "" (nunca undefined), mas
  // "" significa "sem valor esperado" (checagem só de presença), não "deve
  // ser literalmente vazio". Cobre tanto `validationConfig.rules` (exercício)
  // quanto `questions[].validationConfig.rules` (prova).
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

  const handleFinalSubmit = async (data: any) => {
    if (classroomId && data.classroomId !== classroomId)
      data.classroomId = classroomId;
    data.subject = "HTML";
    if (data.startDate && data.startDate !== "")
      data.startDate = new Date(data.startDate).toISOString();
    if (data.deadline && data.deadline !== "")
      data.deadline = new Date(data.deadline).toISOString();
    try {
      await onSubmit(stripEmptyExpectedValue(data));
      clearDraft();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao criar atividade HTML.");
    }
  };

  const handleDiscardDraft = () => {
    if (confirm("Tem a certeza? Isto limpará todo o formulário.")) {
      clearDraft();
      reset({ ...defaults, classroomId } as any);
    }
  };

  const handleConfirmExit = () => {
    if (!classroomId) {
      navigate("/");
      return;
    }
    navigate(`/class/${classroomId}`, { state: { activeTab: "classwork" } });
  };

  const handleStepInvalid = (errs: any, stepLabel: string) => {
    if (stepLabel === "Questões" && Array.isArray(errs?.questions)) {
      const msgs: string[] = [];
      errs.questions.forEach((qErr: any, idx: number) => {
        if (!qErr) return;
        const badFields = Object.keys(qErr)
          .map((f) => FIELD_LABELS[f] ?? f)
          .join(", ");
        msgs.push(`Questão ${idx + 1}: verifique ${badFields}`);
      });
      if (msgs.length > 0) {
        msgs.forEach((msg) => toast.error(msg, { duration: 6000 }));
        return;
      }
    }
    const firstField = Object.keys(errs)[0];
    const label = FIELD_LABELS[firstField] ?? firstField;
    toast.error(
      `Passo "${stepLabel}": verifique o campo "${label}" antes de continuar.`,
      { duration: 5000 },
    );
  };

  const step2ValidationFields =
    problemType === "EXERCISE"
      ? ["validationConfig.rules"]
      : ["startDate", "deadline", "maxAttempts"];

  return (
    <div className="h-full flex flex-col relative bg-surface rounded-xl overflow-hidden border border-border shadow-2xl">
      {/* Modal de confirmação de saída */}
      {showExitConfirmation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <div className="bg-surface border border-border rounded-xl shadow-2xl p-6 max-w-sm w-full animate-in zoom-in-95">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 text-amber-500">
                <AlertTriangle size={24} />
                <h3 className="text-lg font-bold text-foreground">Cancelar?</h3>
              </div>
              <p className="text-sm text-muted">
                O seu progresso será salvo como rascunho.
              </p>
              <div className="flex gap-3 mt-2 justify-end">
                <Button
                  variant="ghost"
                  onClick={() => setShowExitConfirmation(false)}
                >
                  Continuar
                </Button>
                <Button variant="danger" onClick={handleConfirmExit}>
                  Sair
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <FormProvider {...methods}>
        <Stepper
          methods={methods as any}
          onComplete={handleFinalSubmit}
          onStepInvalid={handleStepInvalid}
        >
          {/* HEADER: Voltar | Navegação | Limpar */}
          <div className="flex-none border-b border-border bg-surface p-3 sm:p-4 flex items-center justify-between gap-3 z-20 relative shadow-sm">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExitConfirmation(true)}
              className="text-muted border-border hover:bg-background px-2 sm:px-3"
            >
              <ArrowLeft size={16} className="sm:mr-2" />
              <span className="hidden sm:inline">Voltar</span>
            </Button>

            <div className="flex-1 flex justify-center min-w-0 px-2">
              <Stepper.Navigation />
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleDiscardDraft}
              className="text-muted hover:text-destructive px-2 sm:px-3"
            >
              <Trash size={16} className="sm:mr-2" />
              <span className="hidden sm:inline">Limpar</span>
            </Button>
          </div>

          {/* ── PASSO 1: IDENTIDADE ── */}
          <Stepper.Step
            label="Identidade"
            validationFields={["title", "slug", "description", "type"]}
          >
            <ScrollableStepContent>
              <div className="flex flex-col gap-6 sm:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Título e Slug */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Título da Atividade"
                    placeholder="Ex: Crie uma página de portfólio"
                    {...register("title")}
                    error={errors.title?.message as string}
                    className="h-11 sm:h-12 text-base"
                  />
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-medium text-muted uppercase tracking-wider">
                        URL Amigável (Slug)
                      </label>
                      <button
                        type="button"
                        onClick={handleRegenerateSlug}
                        className="text-muted hover:text-primary transition-colors p-1"
                        title="Regerar Slug"
                      >
                        <RefreshCw size={12} />
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm font-mono select-none">
                        /
                      </span>
                      <input
                        {...register("slug")}
                        className={cn(
                          "flex h-11 sm:h-12 w-full rounded-md border border-border bg-background px-3 py-2 pl-6 text-base text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono",
                          errors.slug &&
                            "border-destructive focus:border-destructive",
                        )}
                        placeholder="pagina-portfolio"
                      />
                    </div>
                    {errors.slug && (
                      <span className="text-xs text-destructive">
                        {errors.slug.message as string}
                      </span>
                    )}
                  </div>
                </div>

                {/* Tipo de Problema */}
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-medium text-muted uppercase tracking-wider flex items-center gap-2">
                    <LayoutTemplate size={14} /> Tipo de Problema
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(["EXERCISE", "EXAM"] as const).map((type) => (
                      <label
                        key={type}
                        className={cn(
                          "cursor-pointer border rounded-xl p-4 sm:p-5 flex items-center gap-4 transition-all duration-300 relative overflow-hidden group hover:bg-surface-hover select-none",
                          problemType === type
                            ? "bg-primary/5 border-primary shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                            : "bg-background border-border",
                        )}
                      >
                        <input
                          type="radio"
                          value={type}
                          {...register("type")}
                          className="absolute opacity-0"
                        />
                        <div
                          className={cn(
                            "w-5 h-5 rounded-full border-2 flex-none flex items-center justify-center transition-colors",
                            problemType === type
                              ? "border-primary"
                              : "border-muted group-hover:border-zinc-400",
                          )}
                        >
                          {problemType === type && (
                            <div className="w-2.5 h-2.5 rounded-full bg-primary animate-in zoom-in" />
                          )}
                        </div>
                        <div>
                          <span
                            className={cn(
                              "block font-semibold text-lg transition-colors",
                              problemType === type
                                ? "text-primary"
                                : "text-foreground",
                            )}
                          >
                            {type === "EXERCISE"
                              ? "Exercício Prático"
                              : "Prova / Avaliação"}
                          </span>
                          <span className="text-sm text-muted mt-1 block">
                            {type === "EXERCISE"
                              ? "Aluno escreve HTML validado por regras."
                              : "Múltiplas questões HTML com prazos e nota."}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Enunciado */}
                <div className="flex flex-col gap-2 flex-1 min-h-[300px]">
                  <label className="text-xs font-medium text-muted uppercase tracking-wider flex items-center gap-2">
                    <FileText size={14} /> Enunciado
                  </label>
                  <div
                    className={cn(
                      "flex-1 rounded-xl overflow-hidden border bg-background flex flex-col",
                      errors.description
                        ? "border-destructive"
                        : "border-border",
                    )}
                  >
                    <MarkdownInput
                      label=""
                      register={register("description")}
                      watchValue={descriptionValue}
                      error={errors.description?.message as string}
                      placeholder="# Instruções do exercício de HTML..."
                    />
                  </div>
                </div>
              </div>
            </ScrollableStepContent>
          </Stepper.Step>

          {/* ── PASSO 2 (EXERCÍCIO): REGRAS ── */}
          {problemType === "EXERCISE" && (
            <Stepper.Step
              label="Regras"
              validationFields={step2ValidationFields as any}
            >
              <ScrollableStepContent isWide>
                <div className="flex flex-col gap-6">
                  <div className="bg-surface border border-border rounded-xl p-4 md:p-6 shadow-sm">
                    <HtmlRulesConfig />
                  </div>

                  {/* HTML de Referência */}
                  <div className="bg-surface border border-border rounded-xl p-4 md:p-6 shadow-sm space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Code2 size={15} className="text-primary" />
                        HTML de Referência{" "}
                        <span className="text-xs font-normal text-muted">
                          (opcional)
                        </span>
                      </h3>
                      <p className="text-xs text-muted mt-1">
                        Cole um HTML de exemplo da solução. Não é usado na
                        validação automática, serve apenas como referência
                        visual.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[320px]">
                      <textarea
                        {...methods.register(
                          "validationConfig.referenceHtml" as any,
                        )}
                        placeholder={
                          "<!DOCTYPE html>\n<html>\n  <body>\n    <h1>Meu Site</h1>\n  </body>\n</html>"
                        }
                        className="h-full w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        spellCheck={false}
                      />
                      <HtmlPreviewPane html={referenceHtml} />
                    </div>
                  </div>

                  {/* Agendamento */}
                  <div className="bg-surface border border-border rounded-xl p-4 md:p-6 shadow-sm space-y-4">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Clock size={15} className="text-primary" /> Agendamento{" "}
                      <span className="text-xs font-normal text-muted">
                        (opcional)
                      </span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Input
                        label="Data de Início"
                        type="datetime-local"
                        {...register("startDate")}
                        className="bg-background h-11 text-base border-border"
                      />
                      <Input
                        label="Prazo de Entrega"
                        type="datetime-local"
                        {...register("deadline")}
                        className="bg-background h-11 text-base border-border"
                      />
                    </div>
                  </div>
                </div>
              </ScrollableStepContent>
            </Stepper.Step>
          )}

          {/* ── PASSO 2 (PROVA): CONFIGURAÇÃO ── */}
          {problemType === "EXAM" && (
            <Stepper.Step
              label="Regras"
              validationFields={step2ValidationFields as any}
            >
              <ScrollableStepContent isWide>
                <ExamConfig />
              </ScrollableStepContent>
            </Stepper.Step>
          )}

          {/* ── PASSO 3 (PROVA): QUESTÕES ── */}
          {problemType === "EXAM" && (
            <Stepper.Step label="Questões" validationFields={["questions"]}>
              <ScrollableStepContent isWide>
                <HtmlExamQuestions />
              </ScrollableStepContent>
            </Stepper.Step>
          )}

          {/* ── PASSO 4 (PROVA): REVISÃO ── */}
          {problemType === "EXAM" && (
            <Stepper.Step label="Revisão" validationFields={[]}>
              <ScrollableStepContent>
                <HtmlExamReview />
              </ScrollableStepContent>
            </Stepper.Step>
          )}

          <Stepper.Controls />
        </Stepper>
      </FormProvider>
    </div>
  );
}
