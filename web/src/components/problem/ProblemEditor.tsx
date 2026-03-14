import { useForm, useFieldArray } from "react-hook-form";
import type { Control, UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  problemSchema,
  type ProblemFormValues,
} from "../../schemas/problem.schema";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

// --- FÁBRICAS DE VALORES PADRÃO ---
const defaultTestCase = () => ({
  input: "",
  expectedOutput: "",
  isHidden: false,
});

const defaultExerciseDetails = () => ({
  parameters: [],
  returnType: "void",
  starterCode: [{ name: "main.js", content: "" }],
  solutionCode: [],
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
    <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-8">
      {/* INFORMAÇÕES BÁSICAS */}
      <div className="space-y-4 border-b pb-6">
        <h2 className="text-xl font-bold">Informações Básicas</h2>

        <div>
          <label className="block text-sm font-medium">Tipo</label>
          <select
            {...register("type")}
            className="w-full border p-2 rounded bg-transparent"
            onChange={(e) => {
              const newType = e.target.value as "EXERCISE" | "EXAM";
              setValue("type", newType);
              if (newType === "EXAM") {
                setValue("questions", [defaultQuestion()]);
              } else {
                setValue("testCases", [defaultTestCase()]);
              }
            }}
          >
            <option value="EXERCISE">Exercício (Isolado)</option>
            <option value="EXAM">Prova (Múltiplas Questões)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Título</label>
          <Input {...register("title")} />
          {errors.title && (
            <p className="text-red-500 text-sm">{errors.title.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium">Slug</label>
          <Input {...register("slug")} />
          {errors.slug && (
            <p className="text-red-500 text-sm">{errors.slug.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium">Descrição</label>
          <textarea
            {...register("description")}
            className="w-full border p-2 rounded bg-transparent"
            rows={4}
          />
          {errors.description && (
            <p className="text-red-500 text-sm">{errors.description.message}</p>
          )}
        </div>
      </div>

      {/* RENDERIZAÇÃO CONDICIONAL BASEADA NO TIPO */}
      {currentType === "EXERCISE" ? (
        <ExerciseTestCases
          control={control}
          register={register}
          errors={errors as any}
        />
      ) : (
        <ExamSettings
          control={control}
          register={register}
          errors={errors as any}
        />
      )}

      {/* SUBMISSÃO */}
      <div className="flex justify-end gap-2 pt-6">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

// ============================================================================
// COMPONENTES INTERNOS PARA GERENCIAMENTO DE ARRAYS (EVITA RE-RENDER GLOBAL)
// ============================================================================

function ExerciseTestCases({
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
    name: "testCases",
  });

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Casos de Teste do Exercício</h3>
      {fields.map((field, index) => (
        <TestCaseItem
          key={field.id}
          index={index}
          prefix="testCases"
          register={register}
          errors={errors?.testCases?.[index]}
          onRemove={() => remove(index)}
        />
      ))}
      {errors?.testCases?.root && (
        <p className="text-red-500 text-sm">
          {errors.testCases.root.message as string}
        </p>
      )}
      <Button type="button" onClick={() => append(defaultTestCase())}>
        + Adicionar Caso de Teste
      </Button>
    </div>
  );
}

function ExamSettings({
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
    <div className="space-y-8">
      <div className="grid grid-cols-3 gap-4 border p-4 rounded bg-opacity-10 bg-gray-500">
        <div>
          <label className="block text-sm font-medium">Máx. Tentativas</label>
          <Input type="number" {...register("maxAttempts")} />
        </div>
        <div>
          <label className="block text-sm font-medium">
            Tempo Limite (min)
          </label>
          <Input type="number" {...register("timeLimit")} />
        </div>
        <div>
          <label className="block text-sm font-medium">
            Limite Memória (MB)
          </label>
          <Input type="number" {...register("memoryLimit")} />
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-xl font-bold">Questões da Prova</h3>
        {fields.map((field, index) => {
          const qError = errors?.questions?.[index];

          return (
            <div
              key={field.id}
              className="border p-6 rounded-lg space-y-4 relative"
            >
              <div className="absolute top-4 right-4">
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => remove(index)}
                >
                  Remover Questão
                </Button>
              </div>

              <h4 className="font-semibold text-lg">Questão {index + 1}</h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium">
                    Título da Questão
                  </label>
                  <Input {...register(`questions.${index}.title` as const)} />
                  {qError?.title && (
                    <p className="text-red-500 text-sm">
                      {qError.title.message as string}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium">
                    Slug da Questão
                  </label>
                  <Input {...register(`questions.${index}.slug` as const)} />
                  {qError?.slug && (
                    <p className="text-red-500 text-sm">
                      {qError.slug.message as string}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium">
                  Descrição da Questão
                </label>
                <textarea
                  {...register(`questions.${index}.description` as const)}
                  className="w-full border p-2 rounded bg-transparent"
                  rows={3}
                />
                {qError?.description && (
                  <p className="text-red-500 text-sm">
                    {qError.description.message as string}
                  </p>
                )}
              </div>

              <ExamQuestionTestCases
                control={control}
                questionIndex={index}
                register={register}
                errors={qError?.testCases}
              />
            </div>
          );
        })}
        {errors?.questions?.root && (
          <p className="text-red-500 text-sm">
            {errors.questions.root.message as string}
          </p>
        )}
        <Button type="button" onClick={() => append(defaultQuestion())}>
          + Adicionar Questão
        </Button>
      </div>
    </div>
  );
}

function ExamQuestionTestCases({
  control,
  questionIndex,
  register,
  errors,
}: {
  control: Control<any>;
  questionIndex: number;
  register: UseFormRegister<any>;
  errors: any;
}) {
  const prefix = `questions.${questionIndex}.testCases` as const;
  const { fields, append, remove } = useFieldArray({ control, name: prefix });

  return (
    <div className="space-y-4 pt-4 border-t">
      <h5 className="font-medium">
        Casos de Teste (Questão {questionIndex + 1})
      </h5>
      {fields.map((field, index) => (
        <TestCaseItem
          key={field.id}
          index={index}
          prefix={prefix}
          register={register}
          errors={errors?.[index]}
          onRemove={() => remove(index)}
        />
      ))}
      <Button type="button" onClick={() => append(defaultTestCase())}>
        + Adicionar Caso de Teste na Questão
      </Button>
    </div>
  );
}

function TestCaseItem({
  index,
  prefix,
  register,
  errors,
  onRemove,
}: {
  index: number;
  prefix: string;
  register: UseFormRegister<any>;
  errors: any;
  onRemove: () => void;
}) {
  return (
    <div className="border p-4 rounded flex gap-4 items-start bg-black/5">
      <div className="flex-1 space-y-2">
        <Input
          placeholder="Entrada"
          {...register(`${prefix}.${index}.input` as const)}
        />
        {errors?.input?.message && (
          <p className="text-red-500 text-sm">
            {errors.input.message as string}
          </p>
        )}

        <Input
          placeholder="Saída Esperada"
          {...register(`${prefix}.${index}.expectedOutput` as const)}
        />
        {errors?.expectedOutput?.message && (
          <p className="text-red-500 text-sm">
            {errors.expectedOutput.message as string}
          </p>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            {...register(`${prefix}.${index}.isHidden` as const)}
          />
          Caso de teste oculto
        </label>
      </div>
      <Button type="button" variant="danger" onClick={onRemove}>
        Remover
      </Button>
    </div>
  );
}
