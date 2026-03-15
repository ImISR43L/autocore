import { useState, useEffect } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import type { Control, UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  problemSchema,
  type ProblemFormValues,
} from "../../schemas/problem.schema";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Card } from "../ui/Card";
import { MarkdownInput } from "../inputs/MarkdownInput";

// --- UTILITÁRIOS E FÁBRICAS DE VALORES ---
const defaultFile = () => ({ name: "main.py", content: "" });
const defaultTestCase = () => ({
  input: "",
  expectedOutput: "",
  isHidden: false,
});

const defaultExerciseDetails = () => ({
  parameters: [],
  returnType: "void",
  starterCode: [defaultFile()],
  solutionCode: [defaultFile()],
  testCases: [defaultTestCase()],
});

const defaultQuestion = () => ({
  title: "",
  slug: "",
  description: "",
  ...defaultExerciseDetails(),
});

interface ProblemEditorProps {
  initialData?: Partial<ProblemFormValues>;
  onSubmit: (data: ProblemFormValues) => Promise<void>;
  isSubmitting: boolean;
}

export function ProblemEditor({
  initialData,
  onSubmit,
  isSubmitting,
}: ProblemEditorProps) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProblemFormValues>({
    resolver: zodResolver(problemSchema) as any,
    defaultValues: initialData || {
      type: "EXERCISE",
      title: "",
      slug: "",
      description: "",
      ...defaultExerciseDetails(),
    },
  });

  const currentType = watch("type");
  const [activeTab, setActiveTab] = useState("basic");

  const {
    fields: examQuestions,
    append: appendQuestion,
    remove: removeQuestion,
  } = useFieldArray({ control, name: "questions" });

  // Configuração dos passos do Stepper
  const steps =
    currentType === "EXERCISE"
      ? [
          { id: "basic", label: "Identificação e Enunciado" },
          { id: "params", label: "Configuração de Parâmetros" },
          { id: "code", label: "Código e Gabarito" },
          { id: "tests", label: "Casos de Teste" },
        ]
      : [
          { id: "basic", label: "Identificação e Enunciado" },
          { id: "settings", label: "Regras da Prova" },
          ...examQuestions.map((_, idx) => ({
            id: `q_${idx}`,
            label: `Questão ${idx + 1}`,
          })),
        ];

  useEffect(() => {
    if (!steps.find((s) => s.id === activeTab)) {
      setActiveTab("basic");
    }
  }, [currentType, activeTab, steps.length]);

  return (
    <form
      onSubmit={handleSubmit(onSubmit as any)}
      className="flex flex-col pb-32"
    >
      {/* NAVEGAÇÃO SUPERIOR (STEPPER HORIZONTAL) */}
      <div className="w-full bg-white/80 dark:bg-gray-950/80 backdrop-blur-md sticky top-0 z-40 mb-8 pt-4 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="overflow-x-auto hide-scrollbar px-4 sm:px-8 pb-6 max-w-7xl mx-auto">
          <ol className="flex items-center w-full min-w-max space-x-2 sm:space-x-4">
            {steps.map((step, idx) => {
              const isActive = activeTab === step.id;
              const isPast = steps.findIndex((s) => s.id === activeTab) > idx;
              const hasError =
                step.id.startsWith("q_") &&
                !!(errors as any)?.questions?.[idx - 2];

              return (
                <li
                  key={step.id}
                  className={`flex items-center ${idx !== steps.length - 1 ? "w-full sm:w-auto sm:flex-1" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveTab(step.id)}
                    className="flex items-center flex-row focus:outline-none group"
                  >
                    <span
                      className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shrink-0 transition-colors ${
                        isActive
                          ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                          : isPast
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                            : hasError
                              ? "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400"
                              : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-gray-700"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span
                      className={`ml-3 whitespace-nowrap font-semibold text-sm transition-colors ${
                        isActive
                          ? "text-gray-900 dark:text-white"
                          : hasError
                            ? "text-red-500"
                            : "text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300"
                      }`}
                    >
                      {step.label}
                    </span>
                  </button>
                  {idx !== steps.length - 1 && (
                    <div
                      className={`hidden sm:block w-12 xl:w-24 h-0.5 mx-4 rounded ${isPast ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"}`}
                    />
                  )}
                </li>
              );
            })}

            {currentType === "EXAM" && (
              <li className="flex items-center ml-4 pl-4 border-l border-gray-200 dark:border-gray-700">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-sm font-bold"
                  onClick={() => {
                    appendQuestion(defaultQuestion());
                    setActiveTab(`q_${examQuestions.length}`);
                  }}
                >
                  + Nova Questão
                </Button>
              </li>
            )}
          </ol>
        </div>
      </div>

      {/* ÁREA DE CONTEÚDO PRINCIPAL (CARDS) */}
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 min-w-0">
        {activeTab === "basic" && (
          <Card className="p-8 shadow-sm animate-in fade-in zoom-in-95 duration-300">
            <h2 className="text-2xl font-bold border-b border-gray-200 dark:border-gray-800 pb-4 mb-6 text-gray-800 dark:text-white">
              Identificação e Enunciado
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                  Tipo de Avaliação
                </label>
                <select
                  {...register("type")}
                  disabled={!!initialData?.title}
                  className="w-full border p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-700 disabled:opacity-50 outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                  onChange={(e) => {
                    const newType = e.target.value as "EXERCISE" | "EXAM";
                    setValue("type", newType);
                    if (newType === "EXAM") {
                      setValue("questions", [defaultQuestion()]);
                    } else {
                      setValue("testCases", [defaultTestCase()]);
                      setValue("starterCode", [defaultFile()]);
                      setValue("solutionCode", [defaultFile()]);
                    }
                  }}
                >
                  <option value="EXERCISE">Exercício Isolado</option>
                  <option value="EXAM">Prova (Múltiplas Questões)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                    Título do Problema
                  </label>
                  <Input
                    {...register("title")}
                    className="p-3.5 rounded-xl"
                    placeholder="Ex: Algoritmo de Dijkstra"
                  />
                  {errors.title && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.title.message as string}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                    Identificador URL (Slug)
                  </label>
                  <Input
                    {...register("slug")}
                    className="p-3.5 rounded-xl"
                    placeholder="ex: algoritmo-dijkstra"
                  />
                  {errors.slug && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.slug.message as string}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <MarkdownInput
                  label="Enunciado Completo (Markdown)"
                  register={register("description")}
                  watchValue={watch("description")}
                />
                {errors.description && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.description.message as string}
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

        {activeTab === "params" && currentType === "EXERCISE" && (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <ParametersEditor
              control={control}
              register={register}
              errors={errors}
              prefix=""
            />
          </div>
        )}

        {activeTab === "code" && currentType === "EXERCISE" && (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <LanguageManager
              control={control}
              register={register}
              errors={errors}
              prefix=""
            />
          </div>
        )}

        {activeTab === "tests" && currentType === "EXERCISE" && (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <TestCasesEditor
              control={control}
              register={register}
              errors={errors}
              prefix=""
            />
          </div>
        )}

        {activeTab === "settings" && currentType === "EXAM" && (
          <Card className="p-8 shadow-sm animate-in fade-in zoom-in-95 duration-300">
            <h2 className="text-2xl font-bold border-b border-gray-200 dark:border-gray-800 pb-4 mb-6">
              Regras e Restrições Globais
            </h2>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Tentativas Máximas
                  </label>
                  <Input
                    type="number"
                    {...register("maxAttempts")}
                    className="p-3.5 rounded-xl"
                    placeholder="0 = Infinitas"
                  />
                  {(errors as any).maxAttempts && (
                    <p className="text-red-500 text-sm mt-1">
                      {(errors as any).maxAttempts.message as string}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Tempo Limite (minutos)
                  </label>
                  <Input
                    type="number"
                    {...register("timeLimit")}
                    className="p-3.5 rounded-xl"
                  />
                  {(errors as any).timeLimit && (
                    <p className="text-red-500 text-sm mt-1">
                      {(errors as any).timeLimit.message as string}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Limite de Memória (MB)
                  </label>
                  <Input
                    type="number"
                    {...register("memoryLimit")}
                    className="p-3.5 rounded-xl"
                  />
                  {(errors as any).memoryLimit && (
                    <p className="text-red-500 text-sm mt-1">
                      {(errors as any).memoryLimit.message as string}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Liberação (Início)
                  </label>
                  <Input
                    type="datetime-local"
                    {...register("startDate")}
                    className="p-3.5 rounded-xl"
                  />
                  {(errors as any).startDate && (
                    <p className="text-red-500 text-sm mt-1">
                      {(errors as any).startDate.message as string}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Prazo Final (Encerramento)
                  </label>
                  <Input
                    type="datetime-local"
                    {...register("deadline")}
                    className="p-3.5 rounded-xl"
                  />
                  {(errors as any).deadline && (
                    <p className="text-red-500 text-sm mt-1">
                      {(errors as any).deadline.message as string}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}

        {activeTab.startsWith("q_") && currentType === "EXAM" && (
          <QuestionEditor
            index={parseInt(activeTab.split("_")[1])}
            control={control}
            register={register}
            watch={watch}
            errors={errors}
            remove={(idx: number) => {
              removeQuestion(idx);
              setActiveTab("basic");
            }}
          />
        )}
      </div>

      {/* FOOTER FIXO (AÇÕES DE SALVAMENTO) */}
      <div className="fixed bottom-0 left-0 w-full bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 p-4 sm:p-6 z-50 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
        <div className="w-full max-w-7xl mx-auto flex justify-end gap-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => window.history.back()}
            className="px-8 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:bg-gray-50"
          >
            Cancelar Edição
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="px-10 rounded-full shadow-xl font-bold text-base transition-transform hover:scale-[1.02] bg-blue-600 text-white"
          >
            {isSubmitting ? "Gravando Atualizações..." : "Salvar Problema"}
          </Button>
        </div>
      </div>
    </form>
  );
}

// =======================================================================================
// LÓGICA DE DETECÇÃO E EXIBIÇÃO DE ARQUIVOS (LIMITADO AS LINGUAGENS SUPORTADAS)
// =======================================================================================

type SupportedLanguage = "Python" | "Javascript" | "C++";

const LANGUAGES: { id: string; name: SupportedLanguage; ext: string }[] = [
  { id: "python", name: "Python", ext: ".py" },
  { id: "javascript", name: "Javascript", ext: ".js" },
  { id: "cpp", name: "C++", ext: ".cpp" },
];

const getLangByExt = (filename: string): string => {
  if (!filename) return "python";
  const ext = filename.slice(filename.lastIndexOf("."));
  const lang = LANGUAGES.find((l) => l.ext === ext);
  return lang ? lang.id : "python";
};

function LanguageManager({
  control,
  register,
  errors,
  prefix,
}: {
  control: Control<any>;
  register: UseFormRegister<any>;
  errors: any;
  prefix: string;
}) {
  const starterName = prefix ? `${prefix}starterCode` : "starterCode";
  const solutionName = prefix ? `${prefix}solutionCode` : "solutionCode";

  const starterArray = useFieldArray({ control, name: starterName as any });
  const solutionArray = useFieldArray({ control, name: solutionName as any });

  const watchedStarter =
    (useWatch({ control, name: starterName as any }) as
      | { name?: string; content?: string }[]
      | undefined) || [];
  const watchedSolution =
    (useWatch({ control, name: solutionName as any }) as
      | { name?: string; content?: string }[]
      | undefined) || [];

  const allFiles = [...watchedStarter, ...watchedSolution];
  // Filtra apenas linguagens estritamente suportadas, fallback padrão para Python se vazio
  const activeLangs = Array.from(
    new Set(allFiles.map((f) => getLangByExt(f?.name || ""))),
  ).filter((l) => LANGUAGES.some((sl) => sl.id === l));

  const [activeTab, setActiveTab] = useState<string>(
    activeLangs[0] || "python",
  );

  useEffect(() => {
    if (activeLangs.length > 0 && !activeLangs.includes(activeTab)) {
      setActiveTab(activeLangs[0]);
    }
  }, [activeLangs, activeTab]);

  const handleAddLang = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const langId = e.target.value;
    if (!langId) return;
    const lang = LANGUAGES.find((l) => l.id === langId);
    if (lang) {
      starterArray.append({ name: `main${lang.ext}`, content: "" });
      solutionArray.append({ name: `main${lang.ext}`, content: "" });
      setActiveTab(langId);
    }
    e.target.value = "";
  };

  return (
    <Card className="p-8 shadow-sm">
      <h3 className="text-xl font-bold border-b border-gray-200 dark:border-gray-800 pb-4 mb-6">
        Código e Gabarito
      </h3>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        {activeLangs.map((langId) => {
          const langName = LANGUAGES.find((l) => l.id === langId)?.name;
          return (
            <button
              key={langId}
              type="button"
              onClick={() => setActiveTab(langId)}
              className={`px-6 py-2.5 text-sm font-bold rounded-t-xl transition-colors ${
                activeTab === langId
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-b-2 border-blue-600"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:hover:bg-gray-700"
              }`}
            >
              {langName}
            </button>
          );
        })}
        <select
          onChange={handleAddLang}
          className="ml-auto text-sm border-none bg-transparent font-bold text-blue-600 dark:text-blue-400 cursor-pointer outline-none focus:ring-0"
        >
          <option value="">+ Selecionar Linguagem</option>
          {LANGUAGES.filter((l) => !activeLangs.includes(l.id)).map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 pt-6">
        <FileGroupEditor
          title="Starter Code (Visível para o Aluno)"
          fields={starterArray.fields}
          watchedFiles={watchedStarter}
          append={starterArray.append}
          remove={starterArray.remove}
          register={register}
          errors={
            prefix
              ? errors?.questions?.[parseInt(prefix.split(".")[1])]?.starterCode
              : errors?.starterCode
          }
          baseName={starterName}
          activeLang={activeTab}
        />
        <FileGroupEditor
          title="Solution Code (Gabarito de Validação)"
          fields={solutionArray.fields}
          watchedFiles={watchedSolution}
          append={solutionArray.append}
          remove={solutionArray.remove}
          register={register}
          errors={
            prefix
              ? errors?.questions?.[parseInt(prefix.split(".")[1])]
                  ?.solutionCode
              : errors?.solutionCode
          }
          baseName={solutionName}
          activeLang={activeTab}
        />
      </div>
    </Card>
  );
}

function FileGroupEditor({
  title,
  fields,
  watchedFiles,
  append,
  remove,
  register,
  errors,
  baseName,
  activeLang,
}: any) {
  const currentLangExt =
    LANGUAGES.find((l) => l.id === activeLang)?.ext || ".py";

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-800 dark:text-gray-200">
        {title}
      </h4>
      <div className="space-y-5">
        {fields.map((field: any, index: number) => {
          const filename = watchedFiles[index]?.name || field.name || "";
          const fileLang = getLangByExt(filename);
          if (fileLang !== activeLang) return null;

          const fileErrors = errors?.[index];

          return (
            <div
              key={field.id}
              className="border border-gray-300 dark:border-gray-700 rounded-xl overflow-hidden bg-[#1e1e1e] focus-within:ring-2 focus-within:ring-blue-500 transition-shadow shadow-sm flex flex-col"
            >
              <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-2.5 border-b border-gray-300 dark:border-gray-700">
                <div>
                  <Input
                    {...register(`${baseName}.${index}.name` as const)}
                    className="font-mono text-sm h-9 w-64 bg-white dark:bg-black border-gray-300 dark:border-gray-700 rounded-md px-3"
                    placeholder="nome_do_arquivo.ext"
                  />
                  {fileErrors?.name && (
                    <p className="text-red-500 text-xs mt-1 font-medium">
                      {fileErrors.name.message}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => remove(index)}
                  className="ml-4 font-bold rounded-lg px-3"
                >
                  Remover
                </Button>
              </div>
              {/* Fallback de Code Editor (Textarea com fonte monospaced clara, simulando Monaco) */}
              <textarea
                {...register(`${baseName}.${index}.content` as const)}
                className="w-full p-4 font-mono text-[14px] bg-transparent text-gray-100 outline-none resize-y leading-relaxed"
                rows={15}
                spellCheck="false"
                placeholder="// Insira a lógica de programação principal aqui..."
              />
            </div>
          );
        })}
      </div>
      <Button
        type="button"
        variant="ghost"
        className="w-full border-dashed border-2 py-4 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-semibold"
        onClick={() =>
          append({ name: `novo_arquivo${currentLangExt}`, content: "" })
        }
      >
        + Adicionar Novo Arquivo (
        {LANGUAGES.find((l) => l.id === activeLang)?.name})
      </Button>
    </div>
  );
}

// =======================================================================================
// SUBCOMPONENTES SECUNDÁRIOS
// =======================================================================================

function ParametersEditor({
  control,
  register,
  errors,
  prefix,
}: {
  control: Control<any>;
  register: UseFormRegister<any>;
  errors: any;
  prefix: string;
}) {
  const fieldName = prefix ? `${prefix}parameters` : "parameters";
  const { fields, append, remove } = useFieldArray({
    control,
    name: fieldName as any,
  });
  const paramErrors = prefix
    ? errors?.questions?.[parseInt(prefix.split(".")[1])]?.parameters
    : errors?.parameters;

  return (
    <Card className="p-8 shadow-sm">
      <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 pb-4 mb-6">
        <h3 className="text-xl font-bold">Configuração de Parâmetros</h3>
        <select
          {...register(prefix ? `${prefix}returnType` : "returnType")}
          className="border p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="" disabled>
            Tipo de Retorno
          </option>
          <option value="void">void (Sem Retorno / Print)</option>
          <option value="int">int</option>
          <option value="float">float</option>
          <option value="string">string</option>
          <option value="boolean">boolean</option>
          <option value="int[]">int[]</option>
          <option value="string[]">string[]</option>
        </select>
      </div>

      <div className="space-y-4">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="flex gap-4 items-start bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800"
          >
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-500 mb-1.5 block uppercase tracking-wider">
                Nome da Variável
              </label>
              <Input
                placeholder="Ex: target_arr"
                {...register(`${fieldName}.${index}.name` as const)}
                className="p-3 bg-white dark:bg-black rounded-xl"
              />
              {paramErrors?.[index]?.name && (
                <p className="text-red-500 text-xs mt-1.5 font-medium">
                  {paramErrors[index].name.message as string}
                </p>
              )}
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-500 mb-1.5 block uppercase tracking-wider">
                Tipo Primitivo
              </label>
              <select
                {...register(`${fieldName}.${index}.type` as const)}
                className="w-full border p-3 rounded-xl bg-white dark:bg-black border-gray-300 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="int">int</option>
                <option value="float">float</option>
                <option value="string">string</option>
                <option value="boolean">boolean</option>
                <option value="int[]">int[]</option>
                <option value="string[]">string[]</option>
              </select>
            </div>
            <div className="pt-6">
              <Button
                type="button"
                variant="danger"
                className="px-4 py-3 rounded-xl font-bold"
                onClick={() => remove(index)}
              >
                X
              </Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          className="w-full border-dashed border-2 py-4 rounded-xl font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          onClick={() => append({ name: "", type: "int" })}
        >
          + Adicionar Parâmetro Requerido
        </Button>
      </div>
    </Card>
  );
}

function TestCasesEditor({
  control,
  register,
  errors,
  prefix,
}: {
  control: Control<any>;
  register: UseFormRegister<any>;
  errors: any;
  prefix: string;
}) {
  const fieldName = prefix ? `${prefix}testCases` : "testCases";
  const { fields, append, remove } = useFieldArray({
    control,
    name: fieldName as any,
  });
  const tcErrors = prefix
    ? errors?.questions?.[parseInt(prefix.split(".")[1])]?.testCases
    : errors?.testCases;

  return (
    <Card className="p-8 shadow-sm">
      <h3 className="text-xl font-bold border-b border-gray-200 dark:border-gray-800 pb-4 mb-6">
        Casos de Teste Lógicos
      </h3>
      <div className="space-y-4">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="border border-gray-200 dark:border-gray-700 p-6 rounded-2xl flex flex-col lg:flex-row gap-8 items-start bg-gray-50 dark:bg-gray-950"
          >
            <div className="flex-1 w-full space-y-5">
              <div>
                <label className="text-sm font-bold mb-2 block text-gray-700 dark:text-gray-300">
                  Inputs (Entrada Computada)
                </label>
                <textarea
                  placeholder="Ex: 5\n10"
                  rows={2}
                  className="w-full border p-4 rounded-xl font-mono text-[14px] bg-white dark:bg-black dark:border-gray-800 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  {...register(`${fieldName}.${index}.input` as const)}
                />
                {tcErrors?.[index]?.input && (
                  <p className="text-red-500 text-xs mt-1 font-medium">
                    {tcErrors[index].input.message as string}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-bold mb-2 block text-gray-700 dark:text-gray-300">
                  Output Final Esperado (Gabarito)
                </label>
                <textarea
                  placeholder="Ex: 15"
                  rows={2}
                  className="w-full border p-4 rounded-xl font-mono text-[14px] bg-white dark:bg-black dark:border-gray-800 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  {...register(`${fieldName}.${index}.expectedOutput` as const)}
                />
                {tcErrors?.[index]?.expectedOutput && (
                  <p className="text-red-500 text-xs mt-1 font-medium">
                    {tcErrors[index].expectedOutput.message as string}
                  </p>
                )}
              </div>

              {/* TOGGLE SWITCH ESTILO "OCULTAR" */}
              <label className="flex items-center gap-3 text-sm font-bold text-gray-600 dark:text-gray-400 mt-4 cursor-pointer w-max hover:text-gray-900 dark:hover:text-white transition-colors">
                <div className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    {...register(`${fieldName}.${index}.isHidden` as const)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </div>
                Ocultar este teste do aluno (Blind Test)
              </label>
            </div>
            <Button
              type="button"
              variant="danger"
              onClick={() => remove(index)}
              className="mt-4 lg:mt-0 px-6 py-3 rounded-xl shadow-sm font-bold"
            >
              Excluir Teste
            </Button>
          </div>
        ))}
      </div>
      {tcErrors?.root && (
        <p className="text-red-500 text-sm font-bold bg-red-50 p-4 rounded-xl text-center border border-red-100 mt-4">
          {tcErrors.root.message as string}
        </p>
      )}
      <Button
        type="button"
        variant="ghost"
        onClick={() => append(defaultTestCase())}
        className="font-bold border-2 border-dashed w-full py-5 mt-6 rounded-xl text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
      >
        + Adicionar Novo Caso de Teste
      </Button>
    </Card>
  );
}

function QuestionEditor({
  index,
  control,
  register,
  watch,
  errors,
  remove,
}: any) {
  const prefix = `questions.${index}.`;
  const qError = errors?.questions?.[index];

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
      <Card className="p-8 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-200 dark:border-gray-800 pb-4 mb-6 gap-4">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
            <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">
              {index + 1}
            </span>
            Identificação da Questão
          </h2>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => remove(index)}
            className="font-bold rounded-xl px-5 py-2"
          >
            Descartar Esta Questão
          </Button>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold mb-2">
                Título da Questão
              </label>
              <Input
                {...register(`${prefix}title` as const)}
                className="p-3.5 rounded-xl"
                placeholder="Ex: Cifra de César"
              />
              {qError?.title && (
                <p className="text-red-500 text-sm mt-1">
                  {qError.title.message as string}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">
                Identificador Contextual (Slug)
              </label>
              <Input
                {...register(`${prefix}slug` as const)}
                className="p-3.5 rounded-xl"
                placeholder="ex: cifra-cesar"
              />
              {qError?.slug && (
                <p className="text-red-500 text-sm mt-1">
                  {qError.slug.message as string}
                </p>
              )}
            </div>
          </div>

          <div>
            <MarkdownInput
              label="Enunciado Prático (Markdown)"
              register={register(`${prefix}description` as const)}
              watchValue={watch(`${prefix}description`)}
            />
            {qError?.description && (
              <p className="text-red-500 text-sm mt-1">
                {qError.description.message as string}
              </p>
            )}
          </div>
        </div>
      </Card>

      <ParametersEditor
        control={control}
        register={register}
        errors={errors}
        prefix={prefix}
      />

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 shadow-sm">
        <h3 className="text-xl font-bold border-b border-gray-200 dark:border-gray-800 pb-4 mb-6">
          Retorno da Função
        </h3>
        <select
          {...register(`${prefix}returnType` as const)}
          className="w-full md:w-1/2 border p-3.5 rounded-xl bg-gray-50 dark:bg-gray-950 border-gray-300 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="void">void (Apenas Print/Mutação)</option>
          <option value="int">int</option>
          <option value="float">float</option>
          <option value="string">string</option>
          <option value="boolean">boolean</option>
          <option value="int[]">int[]</option>
          <option value="string[]">string[]</option>
        </select>
      </div>

      <LanguageManager
        control={control}
        register={register}
        errors={errors}
        prefix={prefix}
      />

      <TestCasesEditor
        control={control}
        register={register}
        errors={errors}
        prefix={prefix}
      />
    </div>
  );
}
