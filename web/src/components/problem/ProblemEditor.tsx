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
      className="flex flex-col pb-32"
    >
      {/* NAVEGAÇÃO SUPERIOR (ESTILO STEPPER DE CRIAÇÃO) */}
      <div className="w-full border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md sticky top-0 z-40 pt-4 mb-8">
        <nav
          aria-label="Progress"
          className="overflow-x-auto hide-scrollbar px-4 sm:px-8 pb-4 max-w-7xl mx-auto"
        >
          <ol role="list" className="flex space-x-6 min-w-max items-end">
            <StepperTab
              id="basic"
              number="1"
              active={activeTab}
              onClick={setActiveTab}
              label="Informações Básicas"
            />

            {currentType === "EXERCISE" && (
              <>
                <StepperTab
                  id="env"
                  number="2"
                  active={activeTab}
                  onClick={setActiveTab}
                  label="Ambiente e Código"
                />
                <StepperTab
                  id="tests"
                  number="3"
                  active={activeTab}
                  onClick={setActiveTab}
                  label="Casos de Teste"
                />
              </>
            )}

            {currentType === "EXAM" && (
              <>
                <StepperTab
                  id="settings"
                  number="2"
                  active={activeTab}
                  onClick={setActiveTab}
                  label="Regras da Prova"
                />
                {examQuestions.map((q, idx) => (
                  <StepperTab
                    key={q.id}
                    id={`q_${idx}`}
                    number={`3.${idx + 1}`}
                    active={activeTab}
                    onClick={setActiveTab}
                    label={`Questão ${idx + 1}`}
                    hasError={!!(errors as any)?.questions?.[idx]}
                  />
                ))}
                <li className="flex items-center pb-2 ml-4">
                  <button
                    type="button"
                    onClick={() => {
                      appendQuestion(defaultQuestion());
                      setActiveTab(`q_${examQuestions.length}`);
                    }}
                    className="px-5 py-2.5 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:ring-2 focus:ring-blue-500"
                  >
                    + Nova Questão
                  </button>
                </li>
              </>
            )}
          </ol>
        </nav>
      </div>

      {/* ÁREA DE CONTEÚDO PRINCIPAL CENTRALIZADA */}
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 min-w-0">
        {activeTab === "basic" && (
          <div className="space-y-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 shadow-sm animate-in fade-in zoom-in-95 duration-300">
            <h2 className="text-2xl font-bold border-b border-gray-200 dark:border-gray-800 pb-4 mb-6 text-gray-800 dark:text-white">
              Identificação da Atividade
            </h2>

            <div>
              <label className="block text-sm font-semibold mb-2">
                Estrutura e Avaliação
              </label>
              <select
                {...register("type")}
                disabled={!!initialData?.title}
                className="w-full border p-3.5 rounded-xl bg-gray-50 dark:bg-gray-950 border-gray-300 dark:border-gray-700 disabled:opacity-50 outline-none focus:ring-2 focus:ring-blue-500"
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
                <option value="EXAM">
                  Prova (Composta por Múltiplas Questões)
                </option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold mb-2">
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
                <label className="block text-sm font-semibold mb-2">
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
              <label className="block text-sm font-semibold mb-2">
                Enunciado Completo (Markdown)
              </label>
              <textarea
                {...register("description")}
                className="w-full border p-4 rounded-xl bg-gray-50 dark:bg-gray-950 border-gray-300 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                rows={10}
                placeholder="Forneça instruções claras e concisas para a resolução..."
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
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
            <ParametersEditor
              control={control}
              register={register}
              errors={errors}
              prefix=""
            />

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 shadow-sm">
              <h3 className="text-xl font-bold border-b border-gray-200 dark:border-gray-800 pb-4 mb-6">
                Retorno da Função
              </h3>
              <select
                {...register("returnType")}
                className="w-full md:w-1/2 border p-3.5 rounded-xl bg-gray-50 dark:bg-gray-950 border-gray-300 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="void">void (Sem Retorno Computado)</option>
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
          <div className="space-y-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 shadow-sm animate-in fade-in zoom-in-95 duration-300">
            <h2 className="text-2xl font-bold border-b border-gray-200 dark:border-gray-800 pb-4 mb-6">
              Regras e Restrições Globais
            </h2>

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
                  Liberação para Estudantes (Início)
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

      {/* FOOTER FIXO (AÇÕES) */}
      <div className="fixed bottom-0 left-0 w-full bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 p-4 sm:p-6 z-50 flex justify-end gap-4 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
        <div className="w-full max-w-5xl mx-auto flex justify-end gap-4 pr-6 sm:pr-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => window.history.back()}
            className="px-8 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
          >
            Cancelar Edição
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="px-10 rounded-full shadow-xl font-bold text-base transition-transform hover:scale-[1.02]"
          >
            {isSubmitting ? "Gravando Atualizações..." : "Salvar Problema"}
          </Button>
        </div>
      </div>
    </form>
  );
}

// =======================================================================================
// COMPONENTE DE NAVEGAÇÃO SUPERIOR (STEPPER TAB)
// =======================================================================================

function StepperTab({ id, number, active, onClick, label, hasError }: any) {
  const isActive = active === id;
  return (
    <li className="flex-1 min-w-[200px]">
      <button
        type="button"
        onClick={() => onClick(id)}
        className={`group flex flex-col border-t-4 pt-4 pb-2 w-full text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 rounded-sm ${
          isActive
            ? "border-blue-600"
            : hasError
              ? "border-red-500"
              : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-500"
        }`}
      >
        <span
          className={`text-xs font-bold uppercase tracking-wider transition-colors ${
            isActive
              ? "text-blue-600 dark:text-blue-500"
              : hasError
                ? "text-red-500"
                : "text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-200"
          }`}
        >
          Passo {number}
        </span>
        <span className="text-[15px] font-semibold text-gray-900 dark:text-white mt-1 flex items-center gap-2">
          {label}
          {hasError && (
            <span className="text-red-500 text-lg leading-none">*</span>
          )}
        </span>
      </button>
    </li>
  );
}

// =======================================================================================
// LÓGICA DE DETECÇÃO E EXIBIÇÃO DE ARQUIVOS POR LINGUAGEM
// =======================================================================================

type SupportedLanguage = "Python" | "JavaScript" | "C++" | "Outros";

const LANGUAGES: { id: string; name: SupportedLanguage; ext: string }[] = [
  { id: "python", name: "Python", ext: ".py" },
  { id: "javascript", name: "JavaScript", ext: ".js" },
  { id: "cpp", name: "C++", ext: ".cpp" },
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
    <div className="space-y-6 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 bg-white dark:bg-gray-900 shadow-sm">
      <h3 className="text-xl font-bold border-b border-gray-200 dark:border-gray-800 pb-4">
        Arquivos e Código Base
      </h3>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        {activeLangs.map((langId) => {
          const langName =
            LANGUAGES.find((l) => l.id === langId)?.name || "Outros";
          return (
            <button
              key={langId}
              type="button"
              onClick={() => setActiveTab(langId)}
              className={`px-6 py-2.5 text-sm font-bold rounded-t-xl transition-colors ${
                activeTab === langId
                  ? "bg-blue-600 text-white shadow-sm"
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
            <option value="other">Outros (.txt, etc)</option>
          )}
        </select>
      </div>

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
      <div className="space-y-5">
        {fields.map((field: any, index: number) => {
          const filename = watchedFiles[index]?.name || field.name || "";
          const fileLang = getLangByExt(filename);
          if (fileLang !== activeLang) return null;

          const fileErrors = errors?.[index];

          return (
            <div
              key={field.id}
              className="border border-gray-300 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-950 focus-within:ring-2 focus-within:ring-blue-500 transition-shadow shadow-sm"
            >
              <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 p-2.5 border-b border-gray-300 dark:border-gray-700">
                <div>
                  <Input
                    {...register(`${baseName}.${index}.name` as const)}
                    className="font-mono text-sm h-9 w-64 bg-white dark:bg-black border-gray-300 dark:border-gray-800 rounded-md"
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
              <textarea
                {...register(`${baseName}.${index}.content` as const)}
                className="w-full p-4 font-mono text-[13px] bg-transparent outline-none resize-y leading-relaxed text-gray-800 dark:text-gray-200"
                rows={12}
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
        + Adicionar Novo Arquivo para{" "}
        {LANGUAGES.find((l) => l.id === activeLang)?.name || "Outros"}
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
    <div className="space-y-4 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 bg-white dark:bg-gray-900 shadow-sm">
      <h3 className="text-xl font-bold border-b border-gray-200 dark:border-gray-800 pb-4">
        Parâmetros de Entrada da Função
      </h3>
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
    <div className="space-y-6 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 bg-white dark:bg-gray-900 shadow-sm">
      <h3 className="text-xl font-bold border-b border-gray-200 dark:border-gray-800 pb-4">
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
                  className="w-full border p-4 rounded-xl font-mono text-[13px] bg-white dark:bg-black dark:border-gray-800 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
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
                  className="w-full border p-4 rounded-xl font-mono text-[13px] bg-white dark:bg-black dark:border-gray-800 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                  {...register(`${fieldName}.${index}.expectedOutput` as const)}
                />
                {tcErrors?.[index]?.expectedOutput && (
                  <p className="text-red-500 text-xs mt-1 font-medium">
                    {tcErrors[index].expectedOutput.message as string}
                  </p>
                )}
              </div>
              <label className="flex items-center gap-3 text-sm font-bold text-gray-600 dark:text-gray-400 mt-2 cursor-pointer w-max hover:text-gray-900 dark:hover:text-white transition-colors">
                <input
                  type="checkbox"
                  {...register(`${fieldName}.${index}.isHidden` as const)}
                  className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
                />
                Blind Test (Ocultar validação detalhada do aluno)
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
        <p className="text-red-500 text-sm font-bold bg-red-50 p-4 rounded-xl text-center border border-red-100">
          {tcErrors.root.message as string}
        </p>
      )}
      <Button
        type="button"
        variant="ghost"
        onClick={() => append(defaultTestCase())}
        className="font-bold border-2 border-dashed w-full py-5 rounded-xl text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
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
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-200 dark:border-gray-800 pb-4 gap-4">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
            <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">
              {index + 1}
            </span>
            Edição da Questão
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
          <label className="block text-sm font-semibold mb-2">
            Enunciado Prático (Markdown)
          </label>
          <textarea
            {...register(`${prefix}description` as const)}
            rows={6}
            className="w-full border p-4 rounded-xl bg-gray-50 dark:bg-gray-950 border-gray-300 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
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
