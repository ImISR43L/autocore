import { useForm, useFieldArray } from "react-hook-form";
import type { Control, UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  problemSchema,
  type ProblemFormValues,
} from "../../schemas/problem.schema";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

// FÁBRICAS DE VALORES PADRÃO
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

  return (
    <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-10 pb-20">
      {/* REGIÃO 1: Informações Básicas */}
      <section className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 space-y-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 border-b border-gray-200 dark:border-gray-800 pb-4">
          1. Informações Básicas
        </h2>

        <div>
          <label className="block text-sm font-semibold mb-2">
            Tipo de Atividade
          </label>
          <select
            {...register("type")}
            disabled={!!initialData?.title} // Impede alterar o tipo se estivermos a editar um problema já existente
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
          {!!initialData?.title && (
            <p className="text-xs text-gray-500 mt-1">
              O tipo de estrutura não pode ser alterado após a criação.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold mb-2">Título</label>
            <Input
              {...register("title")}
              className="p-3"
              placeholder="Ex: Soma de Arrays"
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
              placeholder="ex: soma-de-arrays"
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
            Descrição Completa
          </label>
          <textarea
            {...register("description")}
            className="w-full border p-4 rounded-lg bg-gray-50 dark:bg-gray-950 border-gray-300 dark:border-gray-700"
            rows={6}
            placeholder="Forneça instruções claras e concisas para a resolução do problema..."
          />
          {errors.description && (
            <p className="text-red-500 text-sm mt-1">
              {errors.description.message as string}
            </p>
          )}
        </div>
      </section>

      {/* REGIÃO 2: Configurações de Execução (Apenas Provas) */}
      {/* REGIÃO 2: Configurações de Execução (Apenas Provas) */}
      {currentType === "EXAM" && (
        <section className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 space-y-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 border-b border-gray-200 dark:border-gray-800 pb-4">
            2. Limites e Regras da Prova
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-semibold mb-2">
                Máximo de Tentativas (0 = Infinito)
              </label>
              <Input
                type="number"
                {...register("maxAttempts")}
                className="p-3"
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
              <Input type="number" {...register("timeLimit")} className="p-3" />
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
                Data de Lançamento / Início
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
                Data de Entrega / Encerramento
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
        </section>
      )}

      {/* REGIÃO 3: Estrutura Profunda (Exercício Único ou Array de Questões) */}
      {currentType === "EXERCISE" ? (
        <section className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 space-y-8">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 border-b border-gray-200 dark:border-gray-800 pb-4">
            3. Ambiente de Avaliação e Código
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <ParametersEditor
              control={control}
              register={register}
              errors={errors}
              prefix=""
            />
            <div>
              <label className="block text-sm font-semibold mb-2">
                Tipo de Retorno da Função
              </label>
              <select
                {...register("returnType")}
                className="w-full border p-3 rounded-lg bg-gray-50 dark:bg-gray-950 border-gray-300 dark:border-gray-700"
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

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 pt-4">
            <CodeFilesEditor
              control={control}
              register={register}
              errors={errors}
              prefix=""
              name="starterCode"
              label="Código Base Inicial"
            />
            <CodeFilesEditor
              control={control}
              register={register}
              errors={errors}
              prefix=""
              name="solutionCode"
              label="Gabarito"
            />
          </div>

          <div className="pt-8 border-t border-gray-200 dark:border-gray-800">
            <TestCasesEditor
              control={control}
              register={register}
              errors={errors}
              prefix=""
            />
          </div>
        </section>
      ) : (
        <section className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 space-y-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 border-b border-gray-200 dark:border-gray-800 pb-4">
            3. Questões Aninhadas
          </h2>
          <ExamQuestions
            control={control}
            register={register}
            errors={errors}
          />
        </section>
      )}

      {/* FLOAT BUTTON BAR */}
      <div className="flex justify-end gap-4 pt-4 sticky bottom-6 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xl z-50">
        <Button
          type="button"
          variant="ghost"
          onClick={() => window.history.back()}
          className="px-6"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="px-10 py-3 text-base shadow-md font-semibold transition-all"
        >
          {isSubmitting ? "A Processar..." : "Guardar Alterações"}
        </Button>
      </div>
    </form>
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
        Variáveis e Parâmetros
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
              className="w-full border p-2 text-sm rounded-lg bg-gray-50 dark:bg-gray-950 border-gray-300 dark:border-gray-700"
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
        className="text-sm font-medium"
        onClick={() => append({ name: "", type: "int" })}
      >
        + Adicionar Parâmetro
      </Button>
    </div>
  );
}

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
  const fileErrors = prefix
    ? errors?.questions?.[parseInt(prefix.split(".")[1])]?.[name]
    : errors?.[name];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
        {label}
      </h3>
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50 dark:bg-black/20 space-y-3"
        >
          <div className="flex justify-between items-center gap-4">
            <div className="flex-1">
              <Input
                placeholder="Nome do arquivo (ex: main.py, script.js)"
                {...register(`${fieldName}.${index}.name` as const)}
                className="font-mono text-sm p-2"
              />
              {fileErrors?.[index]?.name && (
                <p className="text-red-500 text-xs mt-1">
                  {fileErrors[index].name.message}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => remove(index)}
            >
              Excluir Arquivo
            </Button>
          </div>
          <div>
            <textarea
              rows={9}
              className="w-full border p-3 rounded-lg font-mono text-sm bg-white dark:bg-gray-950 border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder={`Escreva o conteúdo para o arquivo em questão...\n\nNota: A extensão do arquivo acima determina a linguagem avaliada.`}
              {...register(`${fieldName}.${index}.content` as const)}
            />
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        className="text-sm font-medium"
        onClick={() => append({ name: "main.py", content: "" })}
      >
        + Adicionar Novo Ficheiro
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
    <div className="space-y-5">
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
                Inputs (Entrada)
              </label>
              <textarea
                placeholder="Ex: 5\n10"
                rows={2}
                className="w-full border p-3 rounded-lg font-mono text-sm bg-white dark:bg-gray-950 dark:border-gray-700"
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
                Output Final Esperado
              </label>
              <textarea
                placeholder="Ex: 15"
                rows={2}
                className="w-full border p-3 rounded-lg font-mono text-sm bg-white dark:bg-gray-950 dark:border-gray-700"
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
              Ocultar este teste do conhecimento dos alunos (Blind Test)
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
      {tcErrors?.root && (
        <p className="text-red-500 text-sm font-bold bg-red-50 p-2 rounded">
          {tcErrors.root.message}
        </p>
      )}
      <Button
        type="button"
        variant="ghost"
        onClick={() => append(defaultTestCase())}
        className="font-semibold text-blue-600 dark:text-blue-400"
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

  return (
    <div className="space-y-12">
      {fields.map((field, index) => {
        const qError = errors?.questions?.[index];
        const prefix = `questions.${index}.`;

        return (
          <div
            key={field.id}
            className="border-2 border-gray-200 dark:border-gray-700 p-8 rounded-2xl relative space-y-8 bg-white dark:bg-gray-800/40"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-200 dark:border-gray-700 pb-5 gap-4">
              <h4 className="text-2xl font-black text-gray-800 dark:text-white">
                Questão Número {index + 1}
              </h4>
              <Button
                type="button"
                variant="danger"
                onClick={() => remove(index)}
              >
                Remover Questão Permanentemente
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
                  placeholder="Ex: Fibonacci Recursivo"
                />
                {qError?.title && (
                  <p className="text-red-500 text-sm mt-1">
                    {qError.title.message as string}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Identificador Específico (Slug)
                </label>
                <Input
                  {...register(`${prefix}slug` as const)}
                  className="p-3"
                  placeholder="ex: fibonacci-recursivo"
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
                Enunciado da Questão
              </label>
              <textarea
                {...register(`${prefix}description` as const)}
                rows={5}
                className="w-full border p-4 rounded-lg bg-gray-50 dark:bg-gray-950 border-gray-300 dark:border-gray-700"
                placeholder="Escreva as premissas deste desafio específico..."
              />
              {qError?.description && (
                <p className="text-red-500 text-sm mt-1">
                  {qError.description.message as string}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-gray-200 dark:border-gray-700 pt-8">
              <ParametersEditor
                control={control}
                register={register}
                errors={errors}
                prefix={prefix}
              />
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Tipo de Retorno da Avaliação
                </label>
                <select
                  {...register(`${prefix}returnType` as const)}
                  className="w-full border p-3 rounded-lg bg-gray-50 dark:bg-gray-950 border-gray-300 dark:border-gray-700"
                >
                  <option value="void">void (Sem Retorno Lógico)</option>
                  <option value="int">int</option>
                  <option value="float">float</option>
                  <option value="string">string</option>
                  <option value="boolean">boolean</option>
                  <option value="int[]">int[]</option>
                  <option value="string[]">string[]</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-6">
              <CodeFilesEditor
                control={control}
                register={register}
                errors={errors}
                prefix={prefix}
                name="starterCode"
                label="Apoio Base para o Aluno (Starter Code)"
              />
              <CodeFilesEditor
                control={control}
                register={register}
                errors={errors}
                prefix={prefix}
                name="solutionCode"
                label="Solução Oficial (Gabarito)"
              />
            </div>

            <div className="pt-6 border-t border-gray-200 dark:border-gray-700 mt-6">
              <TestCasesEditor
                control={control}
                register={register}
                errors={errors}
                prefix={prefix}
              />
            </div>
          </div>
        );
      })}

      {errors?.questions?.root && (
        <p className="text-red-500 font-bold bg-red-50 p-4 rounded text-center">
          {errors.questions.root.message as string}
        </p>
      )}

      <Button
        type="button"
        onClick={() => append(defaultQuestion())}
        className="w-full py-6 border-dashed border-2 bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-bold text-lg"
      >
        + Adicionar Nova Questão à Estrutura da Prova
      </Button>
    </div>
  );
}
