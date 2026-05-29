import { z } from "zod";

// --- 1. Blocos Fundamentais (Building Blocks) ---
const parameterSchema = z.object({
  name: z
    .string()
    .min(1, "Nome do parâmetro é obrigatório")
    .regex(
      /^[a-zA-Z_][a-zA-Z0-9_]*$/,
      "Nome inválido (use apenas letras, números e _)",
    ),
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

// --- 2. Schema Base Compartilhado (Shared Base Schema) ---
// Contém APENAS o que existe em todas as disciplinas (Título, Descrição, Datas, etc.)
export const baseProblemSchema = z.object({
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
  subject: z.enum(["PROGRAMMING", "CHEMISTRY", "HTML"]).default("PROGRAMMING"),
  classroomId: z.string().min(1, "A vinculação a uma turma é obrigatória"),
  maxAttempts: z.coerce.number().int().min(0).optional(),
  startDate: z
    .string()
    .refine((val) => val === "" || !isNaN(Date.parse(val)), {
      message: "Data inválida",
    })
    .optional()
    .or(z.literal("")),
  deadline: z
    .string()
    .refine((val) => val === "" || !isNaN(Date.parse(val)), {
      message: "Data inválida",
    })
    .optional()
    .or(z.literal("")),
});

// --- 3. Schemas Específicos por Disciplina (Domain-Specific Schemas) ---

// 3.1 Detalhes Exclusivos de Programação
export const programmingDetailsSchema = z.object({
  timeLimit: z.coerce.number().int().min(1).optional(),
  memoryLimit: z.coerce.number().int().min(1).optional(),
  parameters: z.array(parameterSchema).default([]),
  returnType: z.string().default("void"),
  starterCode: z
    .array(fileEntrySchema)
    .min(1, "Pelo menos um arquivo inicial é necessário"),
  solutionCode: z.array(fileEntrySchema).default([]),
  testCases: z.array(testCaseSchema).default([]),
});

// 3.2 Detalhes Exclusivos de Química
export const chemistryDetailsSchema = z.object({
  validationConfig: z
    .object({
      expectedSmiles: z.string().min(1, "O gabarito não pode estar vazio"),
    })
    .optional(),
});

// 3.3 Detalhes Exclusivos de HTML
export const htmlRuleSchema = z.object({
  selector: z.string().min(1, "Seletor CSS é obrigatório"),
  description: z.string().min(1, "Descrição da regra é obrigatória"),
  attribute: z.string().optional(),
  expectedValue: z.string().optional(),
  textContains: z.string().optional(),
  mustExist: z.boolean().default(true),
});

export const htmlDetailsSchema = z.object({
  validationConfig: z
    .object({
      rules: z
        .array(htmlRuleSchema)
        .min(1, "Adicione pelo menos uma regra de validação"),
    })
    .optional(),
});

// 3.4 Questão de Prova HTML
const htmlQuestionSchema = z.object({
  title: z.string().min(1, "Título da questão é obrigatório"),
  description: z.string().min(1, "Descrição é obrigatória"),
  slug: z.string().min(1, "Slug é obrigatório"),
  validationConfig: z
    .object({
      rules: z
        .array(htmlRuleSchema)
        .min(1, "Adicione pelo menos uma regra de validação"),
    })
    .optional(),
});

export const htmlExamSettingsSchema = z.object({
  questions: z
    .array(htmlQuestionSchema)
    .min(1, "A prova deve ter pelo menos uma questão")
    .default([]),
});

// --- 4. Schemas de Prova (Exams) ---
// Mantemos a prova focada em programação para já
const programmingQuestionSchema = z
  .object({
    title: z.string().min(1, "Título da questão é obrigatório"),
    description: z.string().min(1, "Descrição é obrigatória"),
    slug: z.string().min(1, "Slug é obrigatório"),
  })
  .merge(programmingDetailsSchema);

export const programmingExamSettingsSchema = z.object({
  questions: z
    .array(programmingQuestionSchema)
    .min(1, "A prova deve ter pelo menos uma questão")
    .default([]),
});

// --- 5. Funções de Validação Customizadas (Super Refines) ---
const refineDates = (data: any, ctx: z.RefinementCtx) => {
  if (
    data.startDate &&
    data.deadline &&
    data.startDate !== "" &&
    data.deadline !== ""
  ) {
    if (new Date(data.startDate) >= new Date(data.deadline)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A data de entrega deve ser posterior à data de início",
        path: ["deadline"],
      });
    }
  }
};

const refineProgrammingTests = (
  data: any,
  ctx: z.RefinementCtx,
  pathPrefix: (string | number)[] = [],
) => {
  const hasParameters = data.parameters && data.parameters.length > 0;
  const hasReturn =
    data.returnType &&
    data.returnType !== "void" &&
    data.returnType.trim() !== "";
  const hasNoTests = !data.testCases || data.testCases.length === 0;

  if (hasParameters && hasReturn && hasNoTests) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Obrigatório: Adicione pelo menos 1 caso de teste pois há parâmetros e retorno definidos.",
      path: [...pathPrefix, "testCases"],
    });
  }
};

// --- 6. Schemas Finais exportados para os Wizards ---

export const programmingExerciseSchema = baseProblemSchema
  .extend({ type: z.literal("EXERCISE"), subject: z.literal("PROGRAMMING") })
  .merge(programmingDetailsSchema)
  .superRefine((data, ctx) => {
    refineDates(data, ctx);
    refineProgrammingTests(data, ctx);
  });

export const chemistryExerciseSchema = baseProblemSchema
  .extend({ type: z.literal("EXERCISE"), subject: z.literal("CHEMISTRY") })
  .merge(chemistryDetailsSchema)
  .superRefine((data, ctx) => {
    refineDates(data, ctx);
  });

export const programmingExamSchema = baseProblemSchema
  .extend({ type: z.literal("EXAM"), subject: z.literal("PROGRAMMING") })
  .merge(programmingExamSettingsSchema)
  .superRefine((data, ctx) => {
    refineDates(data, ctx);
    data.questions.forEach((q, idx) =>
      refineProgrammingTests(q, ctx, ["questions", idx]),
    );
  });

export const htmlExerciseSchema = baseProblemSchema
  .extend({ type: z.literal("EXERCISE"), subject: z.literal("HTML") })
  .merge(htmlDetailsSchema)
  .superRefine((data, ctx) => {
    refineDates(data, ctx);
  });

export const htmlExamSchema = baseProblemSchema
  .extend({ type: z.literal("EXAM"), subject: z.literal("HTML") })
  .merge(htmlExamSettingsSchema)
  .superRefine((data, ctx) => {
    refineDates(data, ctx);
  });

// --- 7. Schema Global (União para tipagem do formulário geral) ---
export const problemSchema = z.union([
  programmingExerciseSchema,
  programmingExamSchema,
  chemistryExerciseSchema,
  htmlExerciseSchema,
  htmlExamSchema,
]);

// Tipos Inferidos exportados
export type ProblemFormValues = z.infer<typeof problemSchema>;
export type ProgrammingExerciseFormValues = z.infer<
  typeof programmingExerciseSchema
>;
export type ChemistryExerciseFormValues = z.infer<
  typeof chemistryExerciseSchema
>;
export type HtmlExerciseFormValues = z.infer<typeof htmlExerciseSchema>;
export type HtmlExamFormValues = z.infer<typeof htmlExamSchema>;
export type HtmlRule = z.infer<typeof htmlRuleSchema>;
