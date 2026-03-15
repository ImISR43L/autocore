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

  // Redirecionamento de segurança caso o tipo mude
  useEffect(() => {
    if (
      currentType === "EXERCISE" &&
      (activeTab === "settings" || activeTab.startsWith("q_"))
    ) {
      setActiveTab("basic");
    } else if (currentType === "EXAM" && ["env", "tests"].includes(activeTab)) {
      setActiveTab("basic");
    }
  }, [currentType, activeTab]);

  return (
    <form
      onSubmit={handleSubmit(onSubmit as any)}
      className="relative flex flex-col md:flex-row gap-8 items-start pb-24"
    >
      {/* NAVEGAÇÃO LATERAL (SIDEBAR TABS) */}
      <div className="w-full md:w-64 shrink-0 flex flex-col gap-2 md:sticky md:top-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
        <SidebarButton
          id="basic"
          active={activeTab}
          onClick={setActiveTab}
          label="Informações Básicas"
        />

        {currentType === "EXERCISE" && (
          <>
            <SidebarButton
              id="env"
              active={activeTab}
              onClick={setActiveTab}
              label="Ambiente e Código"
            />
            <SidebarButton
              id="tests"
              active={activeTab}
              onClick={setActiveTab}
              label="Casos de Teste"
            />
          </>
        )}

        {currentType === "EXAM" && (
          <>
            <SidebarButton
              id="settings"
              active={activeTab}
              onClick={setActiveTab}
              label="Regras da Prova"
            />
            <div className="pt-6 pb-2 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider border-t border-gray-100 dark:border-gray-800 mt-4">
              Questões Inclusas
            </div>
            {examQuestions.map((q, idx) => (
              <SidebarButton
                key={q.id}
                id={`q_${idx}`}
                active={activeTab}
                onClick={setActiveTab}
                label={`Questão ${idx + 1}`}
                hasError={!!(errors as any)?.questions?.[idx]}
              />
            ))}
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                appendQuestion(defaultQuestion());
                setActiveTab(`q_${examQuestions.length}`);
              }}
              className="border-dashed border-2 justify-center mt-2 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              + Nova Questão
            </Button>
          </>
        )}
      </div>

      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      <div className="flex-1 w-full min-w-0">
        {activeTab === "basic" && (
          <div className="space-y-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 sm:p-8 shadow-sm animate-in fade-in">
            <h2 className="text-2xl font-bold border-b border-gray-200 dark:border-gray-800 pb-4 mb-6 text-gray-800 dark:text-gray-100">
              1. Informações Básicas
            </h2>

            <div>
              <label className="block text-sm font-semibold mb-2">
                Tipo de Estrutura
              </label>
              <select
                {...register("type")}
                disabled={!!initialData?.title}
                className="w-full border p-3 rounded-lg bg-gray-50 dark:bg-gray-950 border-gray-300 dark:border-gray-700 disabled:opacity-50"
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
                <option value="EXERCISE">Exercício Único</option>
                <option value="EXAM">Prova (Múltiplas Questões)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Título do Desafio
                </label>
                <Input
                  {...register("title")}
                  className="p-3"
                  placeholder="Ex: Algoritmo de Dijkstra"
                />
                {errors.title && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.title.message as string}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Identificador (Slug)
                </label>
                <Input
                  {...register("slug")}
                  className="p-3"
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
              <label className="block text-sm font-semibold mb-2">
                Descrição / Enunciado
              </label>
              <textarea
                {...register("description")}
                className="w-full border p-4 rounded-lg bg-gray-50 dark:bg-gray-950 border-gray-300 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                rows={8}
                placeholder="Forneça instruções claras e concisas..."
              />
              {errors.description && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.description.message as string}
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === "env" && currentType === "EXERCISE" && (
          <div className="space-y-8 animate-in fade-in">
            <ParametersEditor
              control={control}
              register={register}
              errors={errors}
              prefix=""
            />

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
              <h3 className="text-xl font-bold border-b border-gray-200 dark:border-gray-800 pb-4 mb-6">
                Retorno da Função
              </h3>
              <select
                {...register("returnType")}
                className="w-full md:w-1/2 border p-3 rounded-lg bg-gray-50 dark:bg-gray-950 border-gray-300 dark:border-gray-700"
              >
                <option value="void">void (Sem Retorno / Print)</option>
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
              prefix=""
            />
          </div>
        )}

        {activeTab === "tests" && currentType === "EXERCISE" && (
          <div className="animate-in fade-in">
            <TestCasesEditor
              control={control}
              register={register}
              errors={errors}
              prefix=""
            />
          </div>
        )}

        {activeTab === "settings" && currentType === "EXAM" && (
          <div className="space-y-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 sm:p-8 shadow-sm animate-in fade-in">
            <h2 className="text-2xl font-bold border-b border-gray-200 dark:border-gray-800 pb-4 mb-6">
              Regras de Execução da Prova
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Tentativas Máximas
                </label>
                <Input
                  type="number"
                  {...register("maxAttempts")}
                  className="p-3"
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
                  className="p-3"
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
                  className="p-3"
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
                  Data de Liberação (Início)
                </label>
                <Input
                  type="datetime-local"
                  {...register("startDate")}
                  className="p-3"
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
                  className="p-3"
                />
                {(errors as any).deadline && (
                  <p className="text-red-500 text-sm mt-1">
                    {(errors as any).deadline.message as string}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab.startsWith("q_") && currentType === "EXAM" && (
          <QuestionEditor
            index={parseInt(activeTab.split("_")[1])}
            control={control}
            register={register}
            errors={errors}
            remove={(idx: number) => {
              removeQuestion(idx);
              setActiveTab("basic");
            }}
          />
        )}
      </div>

      {/* FLOAT BUTTON BAR */}
      <div className="fixed bottom-6 right-6 lg:right-10 flex gap-4 z-50">
        <Button
          type="button"
          variant="ghost"
          onClick={() => window.history.back()}
          className="px-6 bg-white dark:bg-gray-900 shadow-md rounded-full border border-gray-200 dark:border-gray-800"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="px-8 shadow-xl font-bold rounded-full transition-transform hover:scale-105"
        >
          {isSubmitting ? "A Processar..." : "Salvar Problema"}
        </Button>
      </div>
    </form>
  );
}

function SidebarButton({ id, active, onClick, label, hasError }: any) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`text-left px-5 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-between ${
        active === id
          ? "bg-blue-600 text-white shadow-md scale-100"
          : "bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 scale-95 origin-left"
      }`}
    >
      <span>{label}</span>
      {hasError && (
        <span
          className={`font-bold ${active === id ? "text-red-200" : "text-red-500"}`}
        >
          *
        </span>
      )}
    </button>
  );
}

// =======================================================================================
// LÓGICA DE DETECÇÃO E EXIBIÇÃO DE ARQUIVOS POR LINGUAGEM
// =======================================================================================

type SupportedLanguage =
  | "Python"
  | "JavaScript"
  | "TypeScript"
  | "Java"
  | "C"
  | "C++"
  | "C#"
  | "Go"
  | "Ruby"
  | "PHP"
  | "Outros";

const LANGUAGES: { id: string; name: SupportedLanguage; ext: string }[] = [
  { id: "python", name: "Python", ext: ".py" },
  { id: "javascript", name: "JavaScript", ext: ".js" },
  { id: "typescript", name: "TypeScript", ext: ".ts" },
  { id: "java", name: "Java", ext: ".java" },
  { id: "c", name: "C", ext: ".c" },
  { id: "cpp", name: "C++", ext: ".cpp" },
  { id: "csharp", name: "C#", ext: ".cs" },
  { id: "go", name: "Go", ext: ".go" },
  { id: "ruby", name: "Ruby", ext: ".rb" },
  { id: "php", name: "PHP", ext: ".php" },
];

const getLangByExt = (filename: string): string => {
  if (!filename) return "other";
  const ext = filename.slice(filename.lastIndexOf("."));
  const lang = LANGUAGES.find((l) => l.ext === ext);
  return lang ? lang.id : "other";
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
  const activeLangs = Array.from(
    new Set(allFiles.map((f) => getLangByExt(f?.name || ""))),
  ).filter(Boolean);

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
    const ext = lang ? lang.ext : ".txt";

    starterArray.append({ name: `main${ext}`, content: "" });
    solutionArray.append({ name: `main${ext}`, content: "" });
    setActiveTab(langId);
    e.target.value = "";
  };

  return (
    <div className="space-y-6 border border-gray-200 dark:border-gray-800 rounded-xl p-6 sm:p-8 bg-white dark:bg-gray-900 shadow-sm animate-in slide-in-from-bottom-2">
      <h3 className="text-xl font-bold border-b border-gray-200 dark:border-gray-800 pb-4">
        Arquivos e Código Base
      </h3>

      {/* MENU SUPERIOR (TABS DE LINGUAGENS) */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        {activeLangs.map((langId) => {
          const langName =
            LANGUAGES.find((l) => l.id === langId)?.name || "Outros";
          return (
            <button
              key={langId}
              type="button"
              onClick={() => setActiveTab(langId)}
              className={`px-5 py-2 text-sm font-bold rounded-t-lg transition-colors ${
                activeTab === langId
                  ? "bg-blue-600 text-white shadow-inner"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
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
          {!activeLangs.includes("other") && (
            <option value="other">Outros</option>
          )}
        </select>
      </div>

      {/* COLUNAS DE ARQUIVOS DA LINGUAGEM ATIVA */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 pt-4">
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
    </div>
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
    LANGUAGES.find((l) => l.id === activeLang)?.ext || ".txt";

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-800 dark:text-gray-200">
        {title}
      </h4>
      <div className="space-y-4">
        {fields.map((field: any, index: number) => {
          const filename = watchedFiles[index]?.name || field.name || "";
          const fileLang = getLangByExt(filename);
          if (fileLang !== activeLang) return null;

          const fileErrors = errors?.[index];

          return (
            <div
              key={field.id}
              className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-950 focus-within:ring-2 focus-within:ring-blue-500 transition-shadow"
            >
              <div className="flex items-center justify-between bg-gray-200 dark:bg-gray-800 p-2 border-b border-gray-300 dark:border-gray-700">
                <div>
                  <Input
                    {...register(`${baseName}.${index}.name` as const)}
                    className="font-mono text-sm h-8 w-64 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700"
                    placeholder="nome_do_arquivo.ext"
                  />
                  {fileErrors?.name && (
                    <p className="text-red-500 text-xs mt-1">
                      {fileErrors.name.message}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => remove(index)}
                  className="ml-4"
                >
                  X
                </Button>
              </div>
              <textarea
                {...register(`${baseName}.${index}.content` as const)}
                className="w-full p-4 font-mono text-sm bg-transparent outline-none resize-y"
                rows={10}
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
        className="w-full border-dashed border-2 py-3 text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800"
        onClick={() =>
          append({ name: `novo_arquivo${currentLangExt}`, content: "" })
        }
      >
        + Adicionar Ficheiro (
        {LANGUAGES.find((l) => l.id === activeLang)?.name || "Outros"})
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
    <div className="space-y-4 border border-gray-200 dark:border-gray-800 rounded-xl p-6 bg-white dark:bg-gray-900 shadow-sm">
      <h3 className="text-xl font-bold border-b border-gray-200 dark:border-gray-800 pb-4">
        Parâmetros de Entrada
      </h3>
      {fields.map((field, index) => (
        <div key={field.id} className="flex gap-4 items-start">
          <div className="flex-1">
            <Input
              placeholder="Nome (ex: target_arr)"
              {...register(`${fieldName}.${index}.name` as const)}
              className="p-3"
            />
            {paramErrors?.[index]?.name && (
              <p className="text-red-500 text-xs mt-1">
                {paramErrors[index].name.message as string}
              </p>
            )}
          </div>
          <div className="flex-1">
            <select
              {...register(`${fieldName}.${index}.type` as const)}
              className="w-full border p-3 rounded-lg bg-gray-50 dark:bg-gray-950 border-gray-300 dark:border-gray-700"
            >
              <option value="int">int</option>
              <option value="float">float</option>
              <option value="string">string</option>
              <option value="boolean">boolean</option>
              <option value="int[]">int[]</option>
              <option value="string[]">string[]</option>
            </select>
          </div>
          <Button
            type="button"
            variant="danger"
            className="px-4 py-3"
            onClick={() => remove(index)}
          >
            X
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        className="w-full border-dashed border-2 py-3 font-semibold text-blue-600 dark:text-blue-400"
        onClick={() => append({ name: "", type: "int" })}
      >
        + Adicionar Parâmetro Opcional
      </Button>
    </div>
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
    <div className="space-y-6 border border-gray-200 dark:border-gray-800 rounded-xl p-6 bg-white dark:bg-gray-900 shadow-sm animate-in slide-in-from-bottom-2">
      <h3 className="text-xl font-bold border-b border-gray-200 dark:border-gray-800 pb-4">
        Casos de Teste Lógicos
      </h3>
      <div className="space-y-4">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="border border-gray-200 dark:border-gray-700 p-5 rounded-xl flex flex-col md:flex-row gap-6 items-start bg-gray-50 dark:bg-gray-950"
          >
            <div className="flex-1 w-full space-y-4">
              <div>
                <label className="text-sm font-semibold mb-2 block">
                  Inputs (Entrada Computada)
                </label>
                <textarea
                  placeholder="Ex: 5\n10"
                  rows={2}
                  className="w-full border p-3 rounded font-mono text-sm bg-white dark:bg-gray-900 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                  {...register(`${fieldName}.${index}.input` as const)}
                />
                {tcErrors?.[index]?.input && (
                  <p className="text-red-500 text-xs mt-1">
                    {tcErrors[index].input.message as string}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-semibold mb-2 block">
                  Output Final Esperado (Gabarito)
                </label>
                <textarea
                  placeholder="Ex: 15"
                  rows={2}
                  className="w-full border p-3 rounded font-mono text-sm bg-white dark:bg-gray-900 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                  {...register(`${fieldName}.${index}.expectedOutput` as const)}
                />
                {tcErrors?.[index]?.expectedOutput && (
                  <p className="text-red-500 text-xs mt-1">
                    {tcErrors[index].expectedOutput.message as string}
                  </p>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mt-2 cursor-pointer w-max">
                <input
                  type="checkbox"
                  {...register(`${fieldName}.${index}.isHidden` as const)}
                  className="w-4 h-4 rounded text-blue-600"
                />
                Blind Test (Ocultar validação detalhada do aluno)
              </label>
            </div>
            <Button
              type="button"
              variant="danger"
              onClick={() => remove(index)}
              className="mt-8 md:mt-0"
            >
              Remover Teste
            </Button>
          </div>
        ))}
      </div>
      {tcErrors?.root && (
        <p className="text-red-500 text-sm font-bold bg-red-50 p-3 rounded">
          {tcErrors.root.message as string}
        </p>
      )}
      <Button
        type="button"
        variant="ghost"
        onClick={() => append(defaultTestCase())}
        className="font-bold border-2 border-dashed w-full py-4 text-blue-600 dark:text-blue-400"
      >
        + Adicionar Novo Caso de Teste
      </Button>
    </div>
  );
}

function QuestionEditor({ index, control, register, errors, remove }: any) {
  const prefix = `questions.${index}.`;
  const qError = errors?.questions?.[index];

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-200 dark:border-gray-800 pb-4 gap-4">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            Editando: Questão {index + 1}
          </h2>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => remove(index)}
          >
            Excluir Questão
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold mb-2">
              Título da Questão
            </label>
            <Input
              {...register(`${prefix}title` as const)}
              className="p-3"
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
              Identificador (Slug)
            </label>
            <Input
              {...register(`${prefix}slug` as const)}
              className="p-3"
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
          <label className="block text-sm font-semibold mb-2">
            Enunciado Prático
          </label>
          <textarea
            {...register(`${prefix}description` as const)}
            rows={5}
            className="w-full border p-4 rounded-lg bg-gray-50 dark:bg-gray-950 border-gray-300 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
          />
          {qError?.description && (
            <p className="text-red-500 text-sm mt-1">
              {qError.description.message as string}
            </p>
          )}
        </div>
      </div>

      <ParametersEditor
        control={control}
        register={register}
        errors={errors}
        prefix={prefix}
      />

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-xl font-bold border-b border-gray-200 dark:border-gray-800 pb-4 mb-6">
          Retorno da Função
        </h3>
        <select
          {...register(`${prefix}returnType` as const)}
          className="w-full md:w-1/2 border p-3 rounded-lg bg-gray-50 dark:bg-gray-950 border-gray-300 dark:border-gray-700"
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
