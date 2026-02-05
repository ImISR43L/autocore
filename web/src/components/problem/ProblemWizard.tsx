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
  Link,
  FileText,
  LayoutTemplate,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";
import { useFormPersist } from "../../hooks/useFormPersist";
import { ExamQuestions } from "./steps/ExamQuestions";
import { ExamReview } from "./steps/ExamReview";

interface ProblemWizardProps {
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
  <div className="h-[calc(100vh-280px)] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
    <div
      className={`mx-auto flex flex-col gap-6 pt-4 pb-10 transition-all duration-300 ${
        isWide ? "w-full max-w-[98%]" : "w-full max-w-5xl"
      }`}
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
  // --- CORREÇÃO 1: Robustez na captura do ID ---
  const params = useParams();
  // Tenta pegar 'id' ou 'classroomId', garantindo que não seja undefined
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
      console.error("Classroom ID não encontrado para navegação.");
      // Fallback para a home se der erro
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
    <div className="h-full flex flex-col relative bg-black/20 rounded-xl border border-gray-800 shadow-2xl overflow-hidden">
      {/* Modal de Confirmação (Mantido igual) */}
      {showExitConfirmation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl p-6 max-w-sm w-full m-4 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 text-amber-500">
                <div className="p-2 bg-amber-500/10 rounded-full">
                  <AlertTriangle size={24} />
                </div>
                <h3 className="text-lg font-bold text-white">
                  Cancelar Criação?
                </h3>
              </div>

              <p className="text-sm text-gray-400 leading-relaxed">
                Você está prestes a sair do assistente. Seu progresso atual
                permanecerá salvo como rascunho.
              </p>

              <div className="flex gap-3 mt-2 justify-end">
                <button
                  onClick={() => setShowExitConfirmation(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  Continuar
                </button>
                <button
                  onClick={handleConfirmExit}
                  className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg shadow-lg shadow-red-900/20 transition-all"
                >
                  Sair
                </button>
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
          {/* --- HEADER FIXO (Ajustado tamanho dos botões) --- */}
          <div className="flex-none border-b border-gray-800 bg-gray-900/50 backdrop-blur p-4 flex items-center justify-between gap-4">
            {/* CORREÇÃO 2: Botões Maiores (text-sm, px-4, py-2) */}
            <button
              onClick={() => setShowExitConfirmation(true)}
              className="text-sm font-medium text-gray-400 hover:text-white flex items-center gap-2 transition-colors px-4 py-2 rounded-lg border border-gray-800 hover:border-gray-600 bg-black/40 hover:bg-white/5"
              title="Voltar para a turma"
              type="button"
            >
              <ArrowLeft size={16} />
              <span className="hidden md:inline">Voltar</span>
            </button>

            <div className="flex-1 flex justify-center overflow-hidden">
              <Stepper.Navigation />
            </div>

            <button
              onClick={handleDiscardDraft}
              className="text-sm font-medium text-gray-500 hover:text-red-400 flex items-center gap-2 transition-colors px-4 py-2 rounded-lg border border-gray-800 hover:border-red-500/30 hover:bg-red-500/10 bg-black/40"
              title="Descartar Rascunho e Começar do Zero"
              type="button"
            >
              <Trash size={16} />
              <span className="hidden md:inline">Limpar</span>
            </button>
          </div>

          <Stepper.Step
            label="Identidade"
            validationFields={["title", "slug", "description", "type"]}
          >
            <ScrollableStepContent>
              {/* Conteúdo do Step 1 (Identidade) Mantido Igual */}
              <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                      <Type size={12} /> Título do Problema
                    </label>
                    <input
                      {...register("title")}
                      className={`h-11 bg-black/20 border ${
                        errors.title
                          ? "border-red-500/50 focus:border-red-500"
                          : "border-gray-700 focus:border-blue-500"
                      } rounded-md px-3 text-white placeholder:text-gray-600 outline-none focus:ring-2 transition-all`}
                      placeholder="Ex: Soma de Dois Números"
                    />
                    {errors.title && (
                      <span className="text-[10px] text-red-400">
                        {errors.title.message}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-end">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <Link size={12} /> URL Amigável (Slug)
                      </label>
                      <button
                        type="button"
                        onClick={handleRegenerateSlug}
                        className="text-gray-500 hover:text-blue-400 transition-colors p-1 rounded hover:bg-blue-500/10"
                      >
                        <RefreshCw size={12} />
                      </button>
                    </div>
                    <div className="relative group">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-sm font-mono select-none">
                        /
                      </span>
                      <input
                        {...register("slug")}
                        className={`h-11 w-full bg-black/20 border ${
                          errors.slug
                            ? "border-red-500/50"
                            : "border-gray-700 focus:border-blue-500"
                        } rounded-md pl-6 pr-3 text-white font-mono text-sm outline-none transition-all`}
                        placeholder="soma-dois-numeros"
                      />
                    </div>
                    {errors.slug && (
                      <span className="text-[10px] text-red-400">
                        {errors.slug.message}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <LayoutTemplate size={12} /> Tipo de Problema
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label
                      className={`cursor-pointer border rounded-lg p-4 flex items-center gap-4 transition-all duration-300 relative overflow-hidden group ${
                        problemType === "EXERCISE"
                          ? "bg-blue-500/10 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                          : "bg-gray-900 border-gray-800 hover:border-gray-700"
                      }`}
                    >
                      <input
                        type="radio"
                        value="EXERCISE"
                        {...register("type")}
                        className="absolute opacity-0"
                      />
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                          problemType === "EXERCISE"
                            ? "border-blue-500"
                            : "border-gray-600 group-hover:border-gray-500"
                        }`}
                      >
                        {problemType === "EXERCISE" && (
                          <div className="w-2 h-2 rounded-full bg-blue-500 animate-in zoom-in" />
                        )}
                      </div>
                      <div>
                        <span
                          className={`block font-semibold transition-colors ${
                            problemType === "EXERCISE"
                              ? "text-blue-400"
                              : "text-white"
                          }`}
                        >
                          Exercício Prático
                        </span>
                        <span className="text-xs text-gray-500 mt-0.5 block">
                          Focado em código, inputs e outputs.
                        </span>
                      </div>
                    </label>

                    <label
                      className={`cursor-pointer border rounded-lg p-4 flex items-center gap-4 transition-all duration-300 relative overflow-hidden group ${
                        problemType === "EXAM"
                          ? "bg-purple-500/10 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.1)]"
                          : "bg-gray-900 border-gray-800 hover:border-gray-700"
                      }`}
                    >
                      <input
                        type="radio"
                        value="EXAM"
                        {...register("type")}
                        className="absolute opacity-0"
                      />
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                          problemType === "EXAM"
                            ? "border-purple-500"
                            : "border-gray-600 group-hover:border-gray-500"
                        }`}
                      >
                        {problemType === "EXAM" && (
                          <div className="w-2 h-2 rounded-full bg-purple-500 animate-in zoom-in" />
                        )}
                      </div>
                      <div>
                        <span
                          className={`block font-semibold transition-colors ${
                            problemType === "EXAM"
                              ? "text-purple-400"
                              : "text-white"
                          }`}
                        >
                          Prova / Avaliação
                        </span>
                        <span className="text-xs text-gray-500 mt-0.5 block">
                          Múltiplas questões, com prazos e nota.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <FileText size={12} /> Enunciado
                  </label>
                  <div
                    className={`rounded-lg overflow-hidden border ${
                      errors.description
                        ? "border-red-500/50"
                        : "border-gray-700"
                    }`}
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
                <div className="h-full min-h-[600px]">
                  <ScaffoldingConfig />
                </div>
              </ScrollableStepContent>
            </Stepper.Step>
          )}

          {problemType === "EXAM" && (
            <Stepper.Step label="Questões" validationFields={["questions"]}>
              <ScrollableStepContent isWide={true}>
                <div className="h-full min-h-[600px]">
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
