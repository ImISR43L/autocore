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

  // Assegura que abas inválidas não fiquem presas ao trocar o Tipo de Problema
  useEffect(() => {
    if (
      currentType === "EXERCISE" &&
      ["settings", "questions"].includes(activeTab)
    ) {
      setActiveTab("basic");
    } else if (currentType === "EXAM" && ["env", "tests"].includes(activeTab)) {
      setActiveTab("basic");
    }
  }, [currentType, activeTab]);

  return (
    <form
      onSubmit={handleSubmit(onSubmit as any)}
      className="space-y-6 pb-24 relative"
    >
      {/* TABS PRINCIPAIS */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 overflow-x-auto hide-scrollbar sticky top-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md z-40">
        <TabButton
          id="basic"
          label="Informações Básicas"
          activeTab={activeTab}
          onClick={setActiveTab}
        />

        {currentType === "EXERCISE" && (
          <>
            <TabButton
              id="env"
              label="Ambiente e Código"
              activeTab={activeTab}
              onClick={setActiveTab}
            />
            <TabButton
              id="tests"
              label="Casos de Teste"
              activeTab={activeTab}
              onClick={setActiveTab}
            />
          </>
        )}

        {currentType === "EXAM" && (
          <>
            <TabButton
              id="settings"
              label="Limites e Regras"
              activeTab={activeTab}
              onClick={setActiveTab}
            />
            <TabButton
              id="questions"
              label="Questões da Prova"
              activeTab={activeTab}
              onClick={setActiveTab}
            />
          </>
        )}
      </div>

      {/* CONTEÚDO DAS TABS */}
      <div className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 animate-in fade-in duration-300 min-h-[500px]">
        {activeTab === "basic" && (
          <div className="space-y-6 max-w-3xl">
            <div>
              <label className="block text-sm font-semibold mb-2">
                Tipo de Estrutura
              </label>
              <select
                {...register("type")}
                disabled={!!initialData?.title}
                className="w-full border p-3 rounded-lg bg-gray-50 dark:bg-gray-950 border-gray-300 dark:border-gray-700 disabled:opacity-50 outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
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
                className="w-full border p-4 rounded-lg bg-gray-50 dark:bg-gray-950 border-gray-300 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
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
          <div className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-gray-50 dark:bg-gray-800/40 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
              <ParametersEditor
                control={control}
                register={register}
                errors={errors}
                prefix=""
              />
              <div>
                <label className="block text-sm font-semibold mb-3">
                  Tipo de Retorno da Função
                </label>
                <select
                  {...register("returnType")}
                  className="w-full border p-3 rounded-lg bg-white dark:bg-gray-950 border-gray-300 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="void">void (Sem Retorno)</option>
                  <option value="int">int</option>
                  <option value="float">float</option>
                  <option value="string">string</option>
                  <option value="boolean">boolean</option>
                  <option value="int[]">int[]</option>
                  <option value="string[]">string[]</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <CodeFilesEditor
                control={control}
                register={register}
                errors={errors}
                prefix=""
                name="starterCode"
                label="Código Base Inicial (Starter Code)"
              />
              <CodeFilesEditor
                control={control}
                register={register}
                errors={errors}
                prefix=""
                name="solutionCode"
                label="Gabarito da Solução"
              />
            </div>
          </div>
        )}

        {activeTab === "tests" && currentType === "EXERCISE" && (
          <TestCasesEditor
            control={control}
            register={register}
            errors={errors}
            prefix=""
          />
        )}

        {activeTab === "settings" && currentType === "EXAM" && (
          <div className="max-w-4xl space-y-8 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 dark:bg-gray-800/40 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 dark:bg-gray-800/40 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
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

        {activeTab === "questions" && currentType === "EXAM" && (
          <ExamQuestions
            control={control}
            register={register}
            errors={errors}
          />
        )}
      </div>

      {/* FLOAT BUTTON BAR */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 lg:left-auto lg:translate-x-0 lg:right-6 flex gap-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md p-4 rounded-full border border-gray-200 dark:border-gray-800 shadow-2xl z-50">
        <Button
          type="button"
          variant="ghost"
          onClick={() => window.history.back()}
          className="px-8 rounded-full"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="px-10 rounded-full shadow-md font-bold transition-all"
        >
          {isSubmitting ? "A Processar..." : "Guardar Alterações do Problema"}
        </Button>
      </div>
    </form>
  );
}

function TabButton({
  id,
  label,
  activeTab,
  onClick,
}: {
  id: string;
  label: string;
  activeTab: string;
  onClick: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`py-4 px-8 font-bold text-sm border-b-2 transition-all whitespace-nowrap ${
        activeTab === id
          ? "border-blue-600 text-blue-700 dark:border-blue-500 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10"
          : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-700"
      }`}
    >
      {label}
    </button>
  );
}

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

const getLanguageFromFilename = (filename: string): SupportedLanguage => {
  if (!filename) return "Outros";
  if (filename.endsWith(".py")) return "Python";
  if (filename.endsWith(".js")) return "JavaScript";
  if (filename.endsWith(".ts")) return "TypeScript";
  if (filename.endsWith(".java")) return "Java";
  if (filename.endsWith(".c")) return "C";
  if (filename.endsWith(".cpp")) return "C++";
  if (filename.endsWith(".cs")) return "C#";
  if (filename.endsWith(".go")) return "Go";
  if (filename.endsWith(".rb")) return "Ruby";
  if (filename.endsWith(".php")) return "PHP";
  return "Outros";
};

const LANGUAGES: { name: SupportedLanguage; ext: string }[] = [
  { name: "Python", ext: ".py" },
  { name: "JavaScript", ext: ".js" },
  { name: "TypeScript", ext: ".ts" },
  { name: "Java", ext: ".java" },
  { name: "C", ext: ".c" },
  { name: "C++", ext: ".cpp" },
  { name: "C#", ext: ".cs" },
  { name: "Go", ext: ".go" },
  { name: "Ruby", ext: ".rb" },
  { name: "PHP", ext: ".php" },
];

function CodeFilesEditor({
  control,
  register,
  errors,
  prefix,
  name,
  label,
}: {
  control: Control<any>;
  register: UseFormRegister<any>;
  errors: any;
  prefix: string;
  name: string;
  label: string;
}) {
  const fieldName = prefix ? `${prefix}${name}` : name;
  const { fields, append, remove } = useFieldArray({
    control,
    name: fieldName as any,
  });

  const watchedNames = useWatch({
    control,
    name: fields.map((_, index) => `${fieldName}.${index}.name` as const),
  }) as string[];

  const currentNames = fields.map((field: any, i) =>
    watchedNames && watchedNames[i] !== undefined
      ? watchedNames[i]
      : field.name,
  );
  const presentLanguages = Array.from(
    new Set(currentNames.map(getLanguageFromFilename)),
  );
  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>(
    presentLanguages[0] || "Python",
  );

  useEffect(() => {
    if (
      presentLanguages.length > 0 &&
      !presentLanguages.includes(selectedLang)
    ) {
      setSelectedLang(presentLanguages[0]);
    }
  }, [presentLanguages, selectedLang]);

  const availableToAdd = LANGUAGES.filter(
    (l) => !presentLanguages.includes(l.name),
  );

  const handleAddLanguage = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const langName = e.target.value as SupportedLanguage | "";
    if (!langName) return;

    if (langName === "Outros") {
      append({ name: `arquivo.txt`, content: "" });
      setSelectedLang("Outros");
    } else {
      const lang = LANGUAGES.find((l) => l.name === langName);
      if (lang) {
        append({ name: `main${lang.ext}`, content: "" });
        setSelectedLang(lang.name);
      }
    }
    e.target.value = "";
  };

  const fileErrors = prefix
    ? errors?.questions?.[parseInt(prefix.split(".")[1])]?.[name]
    : errors?.[name];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
        {label}
      </h3>

      {/* MENU DE ABAS INTERNAS (LINGUAGENS) */}
      <div className="flex flex-wrap gap-2 items-center border-b border-gray-200 dark:border-gray-700 pb-2">
        {presentLanguages.map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => setSelectedLang(lang)}
            className={`px-4 py-2 rounded-t-lg text-sm font-semibold transition-colors ${
              selectedLang === lang
                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border-b-2 border-blue-600"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:hover:bg-gray-700"
            }`}
          >
            {lang}
          </button>
        ))}

        <select
          onChange={handleAddLanguage}
          className="ml-auto text-sm border-none bg-transparent font-bold text-blue-600 dark:text-blue-400 focus:ring-0 cursor-pointer outline-none hover:text-blue-800 transition-colors"
        >
          <option value="">+ Selecionar Linguagem...</option>
          {availableToAdd.map((l) => (
            <option key={l.name} value={l.name}>
              {l.name}
            </option>
          ))}
          {!presentLanguages.includes("Outros") && (
            <option value="Outros">Outros Formatos</option>
          )}
        </select>
      </div>

      {/* FICHEIROS DA LINGUAGEM ATUAL */}
      <div className="space-y-4 pt-2">
        {fields.map((field: any, index) => {
          if (getLanguageFromFilename(currentNames[index]) !== selectedLang)
            return null;

          return (
            <div
              key={field.id}
              className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-950 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 transition-shadow"
            >
              <div className="flex justify-between items-center gap-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-3">
                <div className="flex-1">
                  <Input
                    placeholder="ex: main.py"
                    {...register(`${fieldName}.${index}.name` as const)}
                    className="font-mono text-sm p-1.5 h-8 bg-transparent border-transparent hover:bg-white dark:hover:bg-gray-950 focus:bg-white focus:border-gray-300 max-w-[250px]"
                  />
                  {fileErrors?.[index]?.name && (
                    <p className="text-red-500 text-xs mt-1 px-1">
                      {fileErrors[index].name.message}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                >
                  Excluir Arquivo
                </Button>
              </div>
              <div>
                <textarea
                  rows={10}
                  className="w-full p-4 font-mono text-sm bg-transparent outline-none resize-y"
                  placeholder={`Insira a lógica de programação principal aqui...`}
                  {...register(`${fieldName}.${index}.content` as const)}
                  spellCheck="false"
                />
              </div>
            </div>
          );
        })}

        <Button
          type="button"
          variant="ghost"
          className="w-full py-3 border-dashed border-2 border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 font-semibold transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
          onClick={() => {
            const ext =
              LANGUAGES.find((l) => l.name === selectedLang)?.ext || ".txt";
            append({ name: `novo_arquivo${ext}`, content: "" });
          }}
        >
          + Adicionar Outro Arquivo ({selectedLang})
        </Button>
      </div>
    </div>
  );
}

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
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
        Parâmetros de Entrada
      </h3>
      {fields.map((field, index) => (
        <div key={field.id} className="flex gap-4 items-start">
          <div className="flex-1">
            <Input
              placeholder="Nome (ex: arr1)"
              {...register(`${fieldName}.${index}.name` as const)}
              className="p-2 text-sm"
            />
            {paramErrors?.[index]?.name && (
              <p className="text-red-500 text-xs mt-1">
                {paramErrors[index].name.message}
              </p>
            )}
          </div>
          <div className="flex-1">
            <select
              {...register(`${fieldName}.${index}.type` as const)}
              className="w-full border p-2 text-sm rounded-lg bg-white dark:bg-gray-950 border-gray-300 dark:border-gray-700 outline-none"
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
            className="px-3"
            onClick={() => remove(index)}
          >
            X
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        className="text-sm font-medium w-full text-left p-0 text-blue-600 hover:text-blue-800"
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
    <div className="space-y-5 animate-in slide-in-from-bottom-2">
      <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
        Casos de Teste Lógicos
      </h3>
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="border border-gray-200 dark:border-gray-700 p-5 rounded-xl flex flex-col md:flex-row gap-6 items-start bg-gray-50 dark:bg-black/20"
        >
          <div className="flex-1 w-full space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Inputs (Entrada de Dados)
              </label>
              <textarea
                placeholder="Ex: 5\n10"
                rows={2}
                className="w-full border p-3 rounded-lg font-mono text-sm bg-white dark:bg-gray-950 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                {...register(`${fieldName}.${index}.input` as const)}
              />
              {tcErrors?.[index]?.input && (
                <p className="text-red-500 text-xs mt-1">
                  {tcErrors[index].input.message}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Output Final Esperado (Gabarito Exato)
              </label>
              <textarea
                placeholder="Ex: 15"
                rows={2}
                className="w-full border p-3 rounded-lg font-mono text-sm bg-white dark:bg-gray-950 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                {...register(`${fieldName}.${index}.expectedOutput` as const)}
              />
              {tcErrors?.[index]?.expectedOutput && (
                <p className="text-red-500 text-xs mt-1">
                  {tcErrors[index].expectedOutput.message}
                </p>
              )}
            </div>
            <label className="flex items-center gap-3 text-sm font-medium text-gray-700 dark:text-gray-300 mt-2 cursor-pointer w-max">
              <input
                type="checkbox"
                {...register(`${fieldName}.${index}.isHidden` as const)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              Blind Test (Ocultar do utilizador até validação final)
            </label>
          </div>
          <Button
            type="button"
            variant="danger"
            onClick={() => remove(index)}
            className="mt-8 md:mt-0 whitespace-nowrap"
          >
            Excluir Teste
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        onClick={() => append(defaultTestCase())}
        className="font-bold text-blue-600 dark:text-blue-400"
      >
        + Criar Caso de Teste
      </Button>
    </div>
  );
}

function ExamQuestions({
  control,
  register,
  errors,
}: {
  control: Control<any>;
  register: UseFormRegister<any>;
  errors: any;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "questions",
  });
  const [activeQ, setActiveQ] = useState(0);

  useEffect(() => {
    if (activeQ >= fields.length && fields.length > 0)
      setActiveQ(fields.length - 1);
  }, [fields.length, activeQ]);

  if (fields.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl">
        <p className="text-gray-500 mb-4 text-lg">
          Esta prova não possui questões atreladas.
        </p>
        <Button
          type="button"
          onClick={() => append(defaultQuestion())}
          className="px-8 shadow-md"
        >
          Criar Primeira Questão
        </Button>
      </div>
    );
  }

  const prefix = `questions.${activeQ}.`;
  const qError = errors?.questions?.[activeQ];

  return (
    <div className="flex flex-col xl:flex-row gap-8 items-start animate-in fade-in">
      {/* SIDEBAR DE NAVEGAÇÃO DAS QUESTÕES */}
      <div className="w-full xl:w-72 shrink-0 flex flex-col gap-2 bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-200 dark:border-gray-700 xl:sticky xl:top-24">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 px-2">
          Roteiro da Prova
        </h4>
        {fields.map((field, index) => (
          <button
            key={field.id}
            type="button"
            onClick={() => setActiveQ(index)}
            className={`px-4 py-3 text-left rounded-lg text-sm font-semibold transition-all ${
              activeQ === index
                ? "bg-blue-600 text-white shadow-md"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            Questão {index + 1}
            {errors?.questions?.[index] && (
              <span className="ml-2 text-red-300 font-black">*</span>
            )}
          </button>
        ))}
        <div className="pt-4 mt-2 border-t border-gray-200 dark:border-gray-700">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              append(defaultQuestion());
              setActiveQ(fields.length);
            }}
            className="w-full justify-center border-2 border-dashed border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-400 hover:bg-gray-100"
          >
            + Acrescentar Questão
          </Button>
        </div>
      </div>

      {/* ÁREA DE TRABALHO DA QUESTÃO SELECIONADA */}
      <div className="flex-1 w-full space-y-10 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm p-6 sm:p-8 rounded-2xl relative min-w-0">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-gray-200 dark:border-gray-800 pb-6">
          <h3 className="text-2xl font-bold text-gray-800 dark:text-white">
            Editando: Questão {activeQ + 1}
          </h3>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => remove(activeQ)}
          >
            Descartar Questão
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold mb-2">
              Título Contextual
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
              Módulo Identificador
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
            Lógica ou Enunciado da Prova
          </label>
          <textarea
            {...register(`${prefix}description` as const)}
            rows={5}
            className="w-full border p-4 rounded-lg bg-gray-50 dark:bg-gray-950 border-gray-300 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Estabeleça os critérios de avaliação e limitações..."
          />
          {qError?.description && (
            <p className="text-red-500 text-sm mt-1">
              {qError.description.message as string}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-gray-50 dark:bg-gray-800/40 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <ParametersEditor
            control={control}
            register={register}
            errors={errors}
            prefix={prefix}
          />
          <div>
            <label className="block text-sm font-semibold mb-3">
              Requisito de Retorno da Questão
            </label>
            <select
              {...register(`${prefix}returnType` as const)}
              className="w-full border p-3 rounded-lg bg-white dark:bg-gray-950 border-gray-300 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
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
        </div>

        {/* CÓDIGO DA QUESTÃO */}
        <div className="space-y-8">
          <CodeFilesEditor
            control={control}
            register={register}
            errors={errors}
            prefix={prefix}
            name="starterCode"
            label="1. Base Inicial Fornecida ao Estudante"
          />
          <CodeFilesEditor
            control={control}
            register={register}
            errors={errors}
            prefix={prefix}
            name="solutionCode"
            label="2. Motor de Solução Ideal (Gabarito Oculto)"
          />
        </div>

        {/* TESTES DA QUESTÃO */}
        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
          <TestCasesEditor
            control={control}
            register={register}
            errors={errors}
            prefix={prefix}
          />
        </div>
      </div>
    </div>
  );
}
