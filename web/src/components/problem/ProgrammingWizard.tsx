import { useEffect, useState } from "react";
import { useForm, useWatch, FormProvider } from "react-hook-form";
import { useParams, useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  programmingExerciseSchema,
  programmingExamSchema,
} from "../../schemas/problem.schema";
import type { ProblemFormValues } from "../../schemas/problem.schema";
import { z } from "zod";
import Stepper from "../Stepper";
import { ExerciseConfig } from "./steps/ExerciseConfig";
import { ExamConfig } from "./steps/ExamConfig";
import { ScaffoldingConfig } from "./steps/ScaffoldingConfig";
import { ValidationConfig } from "./steps/ValidationConfig";
import { MarkdownInput } from "../inputs/MarkdownInput";
import {
  RefreshCw,
  Trash,
  FileText,
  LayoutTemplate,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";
import { useFormPersist } from "../../hooks/useFormPersist";
import { ExamQuestions } from "./steps/ExamQuestions";
import { ExamReview } from "./steps/ExamReview";

// UI Components
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { cn } from "../../lib/utils";
import { toast } from "sonner";

const programmingSchema = z.union([
  programmingExerciseSchema,
  programmingExamSchema,
]);

interface ProblemWizardProps {
  initialValues?: Partial<ProblemFormValues>;
  onSubmit: (data: ProblemFormValues) => Promise<void>;
  classroomSubject?: "PROGRAMMING" | "CHEMISTRY";
}

// CORREÇÃO: Container de Scroll que preenche o espaço disponível (flex-1)
// Removemos alturas fixas (calc) para funcionar bem em mobile com barras de endereço dinâmicas
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

const generateSlug = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-");
};

export function ProgrammingWizard({
  initialValues,
  onSubmit,
  classroomSubject = "PROGRAMMING",
}: ProblemWizardProps) {
  const params = useParams();
  const classroomId = params.id || params.classroomId || "";
  const navigate = useNavigate();
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);

  const defaults = {
    type: "EXERCISE",
    title: "",
    subject: "PROGRAMMING",
    description: "",
    slug: "",
    classroomId: classroomId,
    parameters: [],
    returnType: "void",
    testCases: [],
    questions: [],
    starterCode: [{ name: "main.py", content: "def solve():\n    pass" }],
    solutionCode: [],
    maxAttempts: 0,
    timeLimit: 1000,
    memoryLimit: 256,
    startDate: "",
    deadline: "",
  };

  const FIELD_LABELS: Record<string, string> = {
    title: "Título",
    slug: "Slug (URL interna)",
    description: "Enunciado",
    returnType: "Tipo de retorno",
    testCases: "Casos de teste",
    starterCode: "Código base",
    parameters: "Parâmetros de entrada",
    startDate: "Data de início",
    deadline: "Prazo final",
    timeLimit: "Tempo limite",
    memoryLimit: "Limite de memória",
  };

  const methods = useForm<ProblemFormValues>({
    resolver: zodResolver(programmingSchema) as any,
    defaultValues: (initialValues || defaults) as any,
    mode: "onChange",
  });

  const problemIdForDraft = (initialValues as any)?.id;
  const draftStorageKey = problemIdForDraft
    ? `problem-wizard-draft-${problemIdForDraft}`
    : "problem-wizard-draft";

  const { clearDraft } = useFormPersist(draftStorageKey, methods);

  const {
    register,
    control,
    setValue,
    reset,
    formState: { errors, touchedFields },
  } = methods;

  useEffect(() => {
    if (classroomId) {
      setValue("classroomId", classroomId, { shouldDirty: false });
    }
  }, [classroomId, setValue]);

  const handleFinalSubmit = async (data: ProblemFormValues) => {
    if (classroomId && data.classroomId !== classroomId) {
      data.classroomId = classroomId;
    }
    (data as any).subject = classroomSubject;

    // Higienização dos dados da prova (etapa anterior)
    // maxAttempts/startDate/deadline são configurações da prova inteira
    // (nível do problema pai), então não pertencem a cada questão.
    // timeLimit/memoryLimit, por outro lado, SÃO aceitos por questão pelo
    // backend (CreateQuestionDto) — mantê-los aqui permite que cada
    // questão tenha seu próprio limite de tempo/memória, em vez de um
    // valor único "global" que afetava todas as questões da prova.
    if (data.type === "EXAM" && data.questions) {
      data.questions = data.questions.map((q: any) => {
        const { maxAttempts, startDate, deadline, ...cleanQuestion } = q;
        return cleanQuestion;
      }) as any;
    }

    if (data.startDate && data.startDate !== "") {
      // O construtor do Date lê a string local do input e o .toISOString() converte para o UTC correto
      data.startDate = new Date(data.startDate).toISOString();
    }
    if (data.deadline && data.deadline !== "") {
      data.deadline = new Date(data.deadline).toISOString();
    }

    await onSubmit(data);
    clearDraft();
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

  const problemType = useWatch({ control, name: "type" });
  const titleValue = useWatch({ control, name: "title" });
  const descriptionValue = useWatch({ control, name: "description" });

  useEffect(() => {
    const currentSlug = methods.getValues("slug");
    if (titleValue && (!touchedFields.slug || !currentSlug)) {
      const slug = generateSlug(titleValue);
      setValue("slug", slug, { shouldValidate: true });
    }
  }, [titleValue, setValue, touchedFields.slug, methods]);

  const handleRegenerateSlug = () => {
    if (titleValue) {
      setValue("slug", generateSlug(titleValue), {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  };

  const handleStepInvalid = (errors: any, stepLabel: string) => {
    // Erro no step de Questões — detalhamento por questão
    if (stepLabel === "Questões" && Array.isArray(errors?.questions)) {
      const msgs: string[] = [];

      errors.questions.forEach((qErr: any, idx: number) => {
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

    // Fallback genérico para outros steps
    toast.error(
      `Passo "${stepLabel}": preencha todos os campos obrigatórios antes de continuar.`,
    );
  };

  const step2ValidationFields =
    problemType === "EXERCISE"
      ? [
          "parameters",
          "returnType",
          "startDate",
          "deadline",
          "timeLimit",
          "memoryLimit",
          "maxAttempts",
        ]
      : ["startDate", "deadline", "timeLimit", "memoryLimit", "maxAttempts"];

  return (
    // Container Principal: Flex Column + Altura total + Overflow hidden para conter scrolls internos
    <div className="h-full flex flex-col relative bg-surface rounded-xl overflow-hidden border border-border shadow-2xl">
      {/* Modal Confirmação */}
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
        <Stepper<ProblemFormValues>
          methods={methods as any}
          onComplete={handleFinalSubmit}
          onStepInvalid={handleStepInvalid}
        >
          {/* HEADER DO WIZARD */}
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

            {/* Container flexível para o Stepper não quebrar o layout */}
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

          {/* PASSO 1: IDENTIDADE */}
          <Stepper.Step
            label="Identidade"
            validationFields={["title", "slug", "description", "type"]}
          >
            <ScrollableStepContent>
              <div className="flex flex-col gap-6 sm:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Inputs de Título e Slug */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Título do Problema"
                    placeholder="Ex: Soma de Dois Números"
                    {...register("title")}
                    error={errors.title?.message}
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
                    <div className="relative group">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm font-mono select-none">
                        /
                      </span>
                      <input
                        {...register("slug")}
                        className={cn(
                          "flex h-11 sm:h-12 w-full rounded-md border border-border bg-background px-3 py-2 pl-6 text-base text-foreground placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono",
                          errors.slug &&
                            "border-destructive focus:border-destructive",
                        )}
                        placeholder="soma-dois-numeros"
                      />
                    </div>
                    {errors.slug && (
                      <span className="text-xs text-destructive">
                        {errors.slug.message}
                      </span>
                    )}
                  </div>
                </div>

                {/* Cards de Tipo de Problema (Responsivo: Stack no mobile) */}
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-medium text-muted uppercase tracking-wider flex items-center gap-2">
                    <LayoutTemplate size={14} /> Tipo de Problema
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label
                      className={cn(
                        "cursor-pointer border rounded-xl p-4 sm:p-5 flex items-center gap-4 transition-all duration-300 relative overflow-hidden group hover:bg-surface-hover select-none",
                        problemType === "EXERCISE"
                          ? "bg-primary/5 border-primary shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                          : "bg-background border-border",
                      )}
                    >
                      <input
                        type="radio"
                        value="EXERCISE"
                        {...register("type")}
                        className="absolute opacity-0"
                      />
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full border-2 flex-none flex items-center justify-center transition-colors",
                          problemType === "EXERCISE"
                            ? "border-primary"
                            : "border-muted group-hover:border-zinc-400",
                        )}
                      >
                        {problemType === "EXERCISE" && (
                          <div className="w-2.5 h-2.5 rounded-full bg-primary animate-in zoom-in" />
                        )}
                      </div>
                      <div>
                        <span
                          className={cn(
                            "block font-semibold text-lg transition-colors",
                            problemType === "EXERCISE"
                              ? "text-primary"
                              : "text-foreground",
                          )}
                        >
                          Exercício Prático
                        </span>
                        <span className="text-sm text-muted mt-1 block">
                          Focado em código, inputs e outputs.
                        </span>
                      </div>
                    </label>

                    <label
                      className={cn(
                        "cursor-pointer border rounded-xl p-4 sm:p-5 flex items-center gap-4 transition-all duration-300 relative overflow-hidden group hover:bg-surface-hover select-none",
                        problemType === "EXAM"
                          ? "bg-primary/5 border-primary shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                          : "bg-background border-border",
                      )}
                    >
                      <input
                        type="radio"
                        value="EXAM"
                        {...register("type")}
                        className="absolute opacity-0"
                      />
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full border-2 flex-none flex items-center justify-center transition-colors",
                          problemType === "EXAM"
                            ? "border-primary"
                            : "border-muted group-hover:border-zinc-400",
                        )}
                      >
                        {problemType === "EXAM" && (
                          <div className="w-2.5 h-2.5 rounded-full bg-primary animate-in zoom-in" />
                        )}
                      </div>
                      <div>
                        <span
                          className={cn(
                            "block font-semibold text-lg transition-colors",
                            problemType === "EXAM"
                              ? "text-primary"
                              : "text-foreground",
                          )}
                        >
                          Prova / Avaliação
                        </span>
                        <span className="text-sm text-muted mt-1 block">
                          Múltiplas questões, com prazos e nota.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

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
                      error={errors.description?.message}
                      placeholder="# Instruções do problema..."
                    />
                  </div>
                </div>
              </div>
            </ScrollableStepContent>
          </Stepper.Step>

          {/* PASSO 2: CONFIGURAÇÃO */}
          <Stepper.Step
            label={problemType === "EXERCISE" ? "Assinatura" : "Regras"}
            validationFields={step2ValidationFields as any}
          >
            <ScrollableStepContent isWide={true}>
              {problemType === "EXERCISE" ? <ExerciseConfig /> : <ExamConfig />}
            </ScrollableStepContent>
          </Stepper.Step>

          {/* PASSO 3 (EXERCÍCIO): TEMPLATE */}
          {problemType === "EXERCISE" && (
            <Stepper.Step label="Template" validationFields={["starterCode"]}>
              <ScrollableStepContent isWide={true}>
                {/* Altura adaptativa para o editor */}
                <div className="h-full min-h-[500px] flex flex-col">
                  <ScaffoldingConfig />
                </div>
              </ScrollableStepContent>
            </Stepper.Step>
          )}

          {/* PASSO 3 (PROVA): QUESTÕES */}
          {problemType === "EXAM" && (
            <Stepper.Step label="Questões" validationFields={["questions"]}>
              <ScrollableStepContent isWide={true}>
                <div className="h-full min-h-[500px] flex flex-col">
                  <ExamQuestions />
                </div>
              </ScrollableStepContent>
            </Stepper.Step>
          )}

          {/* PASSO 4 (EXERCÍCIO): TESTES */}
          {problemType === "EXERCISE" && (
            <Stepper.Step label="Testes" validationFields={["testCases"]}>
              <ScrollableStepContent isWide={true}>
                <ValidationConfig />
              </ScrollableStepContent>
            </Stepper.Step>
          )}

          {/* PASSO 4 (PROVA): REVISÃO */}
          {problemType === "EXAM" && (
            <Stepper.Step label="Revisão" validationFields={[]}>
              <ScrollableStepContent>
                <ExamReview />
              </ScrollableStepContent>
            </Stepper.Step>
          )}
          <Stepper.Controls />
        </Stepper>
      </FormProvider>
    </div>
  );
}
