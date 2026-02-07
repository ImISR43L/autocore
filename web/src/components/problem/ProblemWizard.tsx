import { useEffect, useState } from "react";
import { useForm, useWatch, FormProvider } from "react-hook-form";
import { useParams, useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { problemSchema } from "../../schemas/problem.schema";
import type { ProblemFormValues } from "../../schemas/problem.schema";
import Stepper from "../Stepper";
import { ExerciseConfig } from "./steps/ExerciseConfig";
import { ExamConfig } from "./steps/ExamConfig";
import { ScaffoldingConfig } from "./steps/ScaffoldingConfig";
import { ValidationConfig } from "./steps/ValidationConfig";
import { MarkdownInput } from "../inputs/MarkdownInput";
import {
  RefreshCw,
  Trash,
  Type,
  Link as LinkIcon,
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

interface ProblemWizardProps {
  initialValues?: Partial<ProblemFormValues>;
  onSubmit: (data: ProblemFormValues) => Promise<void>;
}

// CORREÇÃO: Container de Scroll simples que preenche o espaço disponível
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
        "mx-auto flex flex-col gap-6 pt-6 pb-10 px-4 transition-all duration-300",
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

export function ProblemWizard({ initialValues, onSubmit }: ProblemWizardProps) {
  const params = useParams();
  const classroomId = params.id || params.classroomId || "";
  const navigate = useNavigate();
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);

  const defaults = {
    type: "EXERCISE",
    title: "",
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

  const methods = useForm<ProblemFormValues>({
    resolver: zodResolver(problemSchema) as any,
    defaultValues: (initialValues || defaults) as any,
    mode: "onChange",
  });

  const { clearDraft } = useFormPersist("problem-wizard-draft", methods);

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
    await onSubmit(data);
    clearDraft();
  };

  const handleDiscardDraft = () => {
    if (confirm("Tem certeza? Isso limpará todo o formulário.")) {
      clearDraft();
      reset({ ...defaults, classroomId } as any);
    }
  };

  const handleConfirmExit = () => {
    if (!classroomId) {
      navigate("/");
      return;
    }
    navigate(`/class/${classroomId}`);
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

  const step2ValidationFields =
    problemType === "EXERCISE"
      ? ["parameters", "returnType"]
      : ["startDate", "deadline", "timeLimit", "memoryLimit", "maxAttempts"];

  return (
    // CORREÇÃO: Container principal Flex + Overflow hidden para conter tudo na tela
    <div className="h-full flex flex-col relative bg-surface rounded-xl overflow-hidden border border-border shadow-2xl">
      {/* Modal Confirmação */}
      {showExitConfirmation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-xl shadow-2xl p-6 max-w-sm w-full m-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 text-amber-500">
                <AlertTriangle size={24} />
                <h3 className="text-lg font-bold text-white">Cancelar?</h3>
              </div>
              <p className="text-sm text-muted">
                Seu progresso será salvo como rascunho.
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
        >
          {/* HEADER FIXO */}
          <div className="flex-none border-b border-border bg-surface p-4 flex items-center justify-between gap-4 z-20 relative shadow-sm">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExitConfirmation(true)}
              className="text-muted border-border hover:bg-background"
            >
              <ArrowLeft size={16} className="mr-2" /> Voltar
            </Button>

            {/* Navegação centralizada que não quebra o layout */}
            <div className="flex-1 flex justify-center min-w-0">
              <Stepper.Navigation />
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleDiscardDraft}
              className="text-muted hover:text-destructive"
            >
              <Trash size={16} className="mr-2" /> Limpar
            </Button>
          </div>

          <Stepper.Step
            label="Identidade"
            validationFields={["title", "slug", "description", "type"]}
          >
            <ScrollableStepContent>
              <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Título do Problema"
                    placeholder="Ex: Soma de Dois Números"
                    {...register("title")}
                    error={errors.title?.message}
                    className="h-12 text-base"
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
                          "flex h-12 w-full rounded-md border border-border bg-background px-3 py-2 pl-6 text-base text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono",
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

                {/* Cards de Tipo de Problema */}
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-medium text-muted uppercase tracking-wider flex items-center gap-2">
                    <LayoutTemplate size={14} /> Tipo de Problema
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label
                      className={cn(
                        "cursor-pointer border rounded-xl p-5 flex items-center gap-4 transition-all duration-300 relative overflow-hidden group hover:bg-surface-hover",
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
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
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
                              : "text-white",
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
                        "cursor-pointer border rounded-xl p-5 flex items-center gap-4 transition-all duration-300 relative overflow-hidden group hover:bg-surface-hover",
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
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
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
                              : "text-white",
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

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted uppercase tracking-wider flex items-center gap-2">
                    <FileText size={14} /> Enunciado
                  </label>
                  <div
                    className={cn(
                      "rounded-xl overflow-hidden border bg-background",
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

          <Stepper.Step
            label={problemType === "EXERCISE" ? "Assinatura" : "Regras"}
            validationFields={step2ValidationFields as any}
          >
            <ScrollableStepContent isWide={true}>
              {problemType === "EXERCISE" ? <ExerciseConfig /> : <ExamConfig />}
            </ScrollableStepContent>
          </Stepper.Step>

          {problemType === "EXERCISE" && (
            <Stepper.Step label="Template" validationFields={["starterCode"]}>
              <ScrollableStepContent isWide={true}>
                {/* Altura ajustada para não quebrar layout */}
                <div className="h-full min-h-[500px]">
                  <ScaffoldingConfig />
                </div>
              </ScrollableStepContent>
            </Stepper.Step>
          )}

          {problemType === "EXAM" && (
            <Stepper.Step label="Questões" validationFields={["questions"]}>
              <ScrollableStepContent isWide={true}>
                <div className="h-full min-h-[500px]">
                  <ExamQuestions />
                </div>
              </ScrollableStepContent>
            </Stepper.Step>
          )}

          {problemType === "EXERCISE" && (
            <Stepper.Step label="Testes" validationFields={["testCases"]}>
              <ScrollableStepContent isWide={true}>
                <ValidationConfig />
              </ScrollableStepContent>
            </Stepper.Step>
          )}

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
