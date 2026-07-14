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
  subject: z
    .enum(["PROGRAMMING", "CHEMISTRY", "HTML", "SQL", "SQL_MODELING"])
    .default("PROGRAMMING"),
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

// 3.5 Detalhes Exclusivos de SQL
//
// Fase 1 cobre só EXERCISE (sem prova de SQL por enquanto — mesmo recorte
// que Química, que também não tem *ExamSettingsSchema). `testCases` reusa
// o mesmo testCaseSchema de Programming, mas com sentido diferente dos
// campos (ver SqlSubmissionsProcessor no backend):
//   - input:          DML de seed opcional deste caso (pode ficar vazio
//                      de fato — mas o schema abaixo exige >=1 caractere
//                      pelo mesmo motivo do testCaseSchema genérico; se
//                      o exercício não precisa de seed extra, usar um
//                      comentário SQL como "-- sem seed adicional").
//   - expectedOutput: o result set esperado, serializado como JSON
//                      (array de objetos). Preenchido automaticamente
//                      pelo botão de dry-run em SqlValidationConfig (via
//                      POST /problems/dry-run-sql), ou digitado à mão
//                      pelo professor se preferir.
export const sqlDetailsSchema = z.object({
  sqlSchema: z.string().min(1, "O schema de referência (DDL) é obrigatório"),
  sqlOrderSensitive: z.boolean().default(false),
  testCases: z
    .array(testCaseSchema)
    .min(1, "Adicione pelo menos um caso de teste"),
});

// 3.6 Detalhes Exclusivos de Modelagem Conceitual (Fase 2 — SQL_MODELING)
//
// Espelha ErModel em web/src/types/erModel.ts (frontend) e
// submission.entity.ts (backend) — os três precisam ficar em sincronia
// manual se o shape mudar.
//
// `referenceModel` é OPCIONAL de propósito: a Fase 2a (visualizador +
// correção manual) funciona sem gabarito formal, o professor avalia o
// diagrama do aluno de olho. Um corretor automático futuro (Fase 2b) é
// que passaria a exigir isso preenchido.
const erAttributeSchema = z.object({
  name: z.string(),
  isPK: z.boolean().default(false),
  isFK: z.boolean().default(false),
  type: z.string().optional(),
});

const erEntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  attributes: z.array(erAttributeSchema).default([]),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
});

const erRelationshipSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  cardinality: z.enum(["1:1", "1:N", "N:M"]),
  name: z.string().optional(),
});

export const erModelSchema = z.object({
  entities: z.array(erEntitySchema).default([]),
  relationships: z.array(erRelationshipSchema).default([]),
});

export const sqlModelingDetailsSchema = z.object({
  referenceModel: erModelSchema.default({ entities: [], relationships: [] }),
});

// --- 4. Schemas de Prova (Exams) ---
// Mantemos a prova focada em programação para já
const programmingQuestionSchema = z
  .object({
    // Presente apenas quando a questão já existe (edição). Permite ao
    // backend atualizar a questão-filha existente em vez de recriar,
    // preservando o histórico de submissões dos alunos.
    id: z.string().optional(),
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

export const sqlExerciseSchema = baseProblemSchema
  .extend({ type: z.literal("EXERCISE"), subject: z.literal("SQL") })
  .merge(sqlDetailsSchema)
  .superRefine((data, ctx) => {
    refineDates(data, ctx);
  });

export const sqlModelingExerciseSchema = baseProblemSchema
  .extend({
    type: z.literal("EXERCISE"),
    subject: z.literal("SQL_MODELING"),
  })
  .merge(sqlModelingDetailsSchema)
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
  sqlExerciseSchema,
  sqlModelingExerciseSchema,
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
export type SqlExerciseFormValues = z.infer<typeof sqlExerciseSchema>;
export type SqlModelingExerciseFormValues = z.infer<
  typeof sqlModelingExerciseSchema
>;
export type HtmlRule = z.infer<typeof htmlRuleSchema>;
