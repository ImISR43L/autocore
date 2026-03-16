import { z } from "zod";

// --- Blocos Fundamentais (Building Blocks) ---

const parameterSchema = z.object({
  name: z
    .string()
    .min(1, "Nome do parâmetro é obrigatório")
    .regex(
      /^[a-zA-Z_][a-zA-Z0-9_]*$/,
      "Nome inválido (use apenas letras, números e _)",
    ),
  // CORREÇÃO CRÍTICA AQUI:
  // Removemos o { errorMap: ... } que estava causando o crash "(intermediate value) is null".
  // Usamos errorMap ou params padrões suportados.
  type: z
    .enum([
      "int",
      "float",
      "string",
      "boolean",
      "int[]",
      "string[]",
      "float[]",
      "boolean[]",
    ])
    .refine((val) => val, { message: "Inválido" }),
});

const fileEntrySchema = z.object({
  name: z
    .string()
    .min(1, "Nome do arquivo é obrigatório")
    .regex(/^[\w.-]+$/, "Nome de arquivo inválido"),
  content: z.string().default(""),
});

export const testCaseSchema = z.object({
  id: z.string().optional(),
  input: z.string().min(1, "Entrada é obrigatória"),
  expectedOutput: z.string().min(1, "Saída esperada é obrigatória"),
  isHidden: z.boolean().default(false),
});

// --- Schemas por Etapa (Progressive Disclosure) ---

export const basicInfoSchema = z.object({
  title: z.string().min(3, "Título deve ter pelo menos 3 caracteres"),
  slug: z
    .string()
    .min(3, "Slug muito curto")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug deve conter apenas letras minúsculas, números e hifens",
    ),
  description: z.string().min(10, "Descrição muito curta"),
  type: z.enum(["EXERCISE", "EXAM"]),
  classroomId: z.string().min(1, "A vinculação a uma turma é obrigatória"),
});

export const exerciseDetailsSchema = z.object({
  parameters: z.array(parameterSchema).default([]),
  returnType: z.string().default("void"),
  starterCode: z
    .array(fileEntrySchema)
    .min(1, "Pelo menos um arquivo inicial é necessário"),
  solutionCode: z.array(fileEntrySchema).default([]),
  testCases: z.array(testCaseSchema).default([]),
});

const questionSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  slug: z.string(),
  parameters: z.array(parameterSchema),
  returnType: z.string(),
  starterCode: z.array(fileEntrySchema),
  testCases: z.array(testCaseSchema),
});

export const examQuestionsSchema = z.object({
  questions: z
    .array(questionSchema)
    .min(1, "A prova deve ter pelo menos uma questão")
    .optional(),
});

const nestedQuestionSchema = z
  .object({
    title: z.string().min(1, "Título da questão é obrigatório"),
    description: z.string().min(1, "Descrição é obrigatória"),
    slug: z.string().min(1, "Slug é obrigatório"),
  })
  .merge(exerciseDetailsSchema); // Herda parameters, starterCode, testCases...

// Configurações da Prova (Datas/Limites)
export const examSettingsSchema = z
  .object({
    maxAttempts: z.coerce.number().int().min(0).optional(),
    timeLimit: z.coerce.number().int().min(1).optional(),
    memoryLimit: z.coerce.number().int().min(1).optional(),
    startDate: z
      .string()
      .datetime({ message: "Data inválida" })
      .optional()
      .or(z.literal("")),
    deadline: z
      .string()
      .datetime({ message: "Data inválida" })
      .optional()
      .or(z.literal("")),
    // --- O CAMPO QUE FALTAVA ---
    questions: z.array(nestedQuestionSchema).default([]),
  })
  .refine(
    (data) => {
      if (
        data.startDate &&
        data.deadline &&
        data.startDate !== "" &&
        data.deadline !== ""
      ) {
        return new Date(data.startDate) < new Date(data.deadline);
      }
      return true;
    },
    {
      message: "A data de entrega deve ser posterior à data de início",
      path: ["deadline"],
    },
  );

// --- Schema Unificado (Discriminated Union) ---
export const problemSchema = z
  .discriminatedUnion("type", [
    basicInfoSchema
      .extend({ type: z.literal("EXERCISE") })
      .merge(exerciseDetailsSchema),
    basicInfoSchema
      .extend({ type: z.literal("EXAM") })
      .merge(examSettingsSchema),
  ])
  .superRefine((data, ctx) => {
    const checkTestCases = (
      parameters: any[],
      returnType: string,
      testCases: any[],
      pathPrefix: (string | number)[],
    ) => {
      const hasParameters = parameters && parameters.length > 0;
      const hasReturn =
        returnType && returnType !== "void" && returnType.trim() !== "";
      const hasNoTests = !testCases || testCases.length === 0;

      if (hasParameters && hasReturn && hasNoTests) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Obrigatório: Adicione pelo menos 1 caso de teste pois há parâmetros e retorno definidos.",
          path: [...pathPrefix, "testCases"],
        });
      }
    };

    if (data.type === "EXERCISE") {
      checkTestCases(data.parameters, data.returnType, data.testCases, []);
    } else if (data.type === "EXAM") {
      data.questions.forEach((question, index) => {
        checkTestCases(
          question.parameters,
          question.returnType,
          question.testCases,
          ["questions", index],
        );
      });
    }
  });

export type ProblemFormValues = z.infer<typeof problemSchema>;
