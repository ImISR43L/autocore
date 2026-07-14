import { useEffect, useState } from "react";
import { useForm, useWatch, FormProvider } from "react-hook-form";
import { useParams, useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { sqlExerciseSchema } from "../../schemas/problem.schema";
import type { ProblemFormValues } from "../../schemas/problem.schema";
import Stepper from "../Stepper";
import { SqlSchemaConfig } from "./steps/SqlSchemaConfig";
import { SqlValidationConfig } from "./steps/SqlValidationConfig";
import { MarkdownInput } from "../inputs/MarkdownInput";
import {
  RefreshCw,
  Trash,
  FileText,
  ArrowLeft,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { useFormPersist } from "../../hooks/useFormPersist";

import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { cn } from "../../lib/utils";

interface SqlWizardProps {
  initialValues?: Partial<ProblemFormValues>;
  onSubmit: (data: ProblemFormValues) => Promise<void>;
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

export function SqlWizard({ initialValues, onSubmit }: SqlWizardProps) {
  const params = useParams();
  const classroomId = params.id || params.classroomId || "";
  const navigate = useNavigate();
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);

  const defaults = {
    type: "EXERCISE",
    title: "",
    subject: "SQL",
    description: "",
    slug: "",
    classroomId,
    sqlSchema: "",
    sqlOrderSensitive: false,
    testCases: [],
    maxAttempts: 0,
    startDate: "",
    deadline: "",
  };

  const methods = useForm<ProblemFormValues>({
    resolver: zodResolver(sqlExerciseSchema) as any,
    defaultValues: (initialValues || defaults) as any,
    mode: "onChange",
  });

  const problemIdForDraft = (initialValues as any)?.id;
  const draftStorageKey = problemIdForDraft
    ? `problem-wizard-draft-sql-${problemIdForDraft}`
    : "problem-wizard-draft-sql";

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
    (data as any).subject = "SQL";
    (data as any).type = "EXERCISE";

    if (data.startDate && data.startDate !== "") {
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

  const handleStepInvalid = (_errors: any, stepLabel: string) => {
    toast_error(stepLabel);
  };

  // Wrapper local só para manter a mesma mensagem de erro dos outros
  // wizards sem precisar importar toast diretamente neste arquivo duas vezes.
  const toast_error = (stepLabel: string) => {
    import("sonner").then(({ toast }) =>
      toast.error(
        `Passo "${stepLabel}": preencha todos os campos obrigatórios antes de continuar.`,
      ),
    );
  };

  return (
    <div className="h-full flex flex-col relative bg-surface rounded-xl overflow-hidden border border-border shadow-2xl">
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

          {/* PASSO 1: IDENTIDADE */}
          <Stepper.Step
            label="Identidade"
            validationFields={["title", "slug", "description"]}
          >
            <ScrollableStepContent>
              <div className="flex flex-col gap-6 sm:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Título do Exercício"
                    placeholder="Ex: Clientes com Pedidos"
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
                        placeholder="clientes-com-pedidos"
                      />
                    </div>
                    {errors.slug && (
                      <span className="text-xs text-destructive">
                        {errors.slug.message as string}
                      </span>
                    )}
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
                      error={errors.description?.message as string}
                      placeholder="# O que o aluno precisa consultar..."
                    />
                  </div>
                </div>
              </div>
            </ScrollableStepContent>
          </Stepper.Step>

          {/* PASSO 2: SCHEMA DE REFERÊNCIA */}
          <Stepper.Step label="Schema" validationFields={["sqlSchema"]}>
            <ScrollableStepContent isWide={true}>
              <div className="h-full min-h-[500px] flex flex-col">
                <SqlSchemaConfig />
              </div>
            </ScrollableStepContent>
          </Stepper.Step>

          {/* PASSO 3: TESTES */}
          <Stepper.Step label="Testes" validationFields={["testCases"]}>
            <ScrollableStepContent isWide={true}>
              <SqlValidationConfig />
            </ScrollableStepContent>
          </Stepper.Step>

          {/* PASSO 4: AJUSTES */}
          <Stepper.Step
            label="Ajustes"
            validationFields={["startDate", "deadline", "maxAttempts"]}
          >
            <ScrollableStepContent>
              <div className="bg-surface border border-border rounded-xl p-4 md:p-10 space-y-8 shadow-lg max-w-3xl mx-auto">
                <section className="space-y-6">
                  <h3 className="text-xl font-bold text-foreground border-b border-border pb-4 flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                      <Clock size={24} />
                    </div>
                    Agendamento e Tentativas
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  <Input
                    label="Tentativas (0 = Infinito)"
                    type="number"
                    {...register("maxAttempts", { valueAsNumber: true })}
                    className="bg-background h-11 md:h-12 text-base border-border max-w-xs"
                  />
                </section>
              </div>
            </ScrollableStepContent>
          </Stepper.Step>

          <Stepper.Controls />
        </Stepper>
      </FormProvider>
    </div>
  );
}
