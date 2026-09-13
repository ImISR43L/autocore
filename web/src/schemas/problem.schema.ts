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
//
// FIX (engine — troca jsdom por Playwright): antes, uma única regra
// genérica com todos os campos opcionais (attribute/expectedValue/
// textContains) cobria os três tipos visuais do editor (existência/
// atributo/texto) — o "tipo" nunca existiu no dado, só na UI
// (HtmlRulesConfig::getRuleType, inferido por presença de campo). Isso
// quebra ao introduzir `computedStyle`, que também precisa de um
// `expectedValue` com significado diferente (valor de propriedade CSS
// computada de verdade via browser real, não valor de atributo HTML) —
// o mesmo nome de campo não pode servir pros dois sem ambiguidade.
//
// RETROCOMPATIBILIDADE: todo exercício de HTML já salvo em produção tem
// regras SEM `type` nenhum (Problem.validationConfig é jsonb solto, sem
// migration possível). `legacyStructuralRuleSchema` cobre exatamente
// esse shape antigo, campo a campo idêntico ao htmlRuleSchema anterior.
// Regras novas devem sempre gravar `type: "structural"` explicitamente
// — ver handleAddRule em HtmlRulesConfig.tsx — e é isso que evita a
// colisão de `expectedValue` entre os dois tipos daqui em diante.
const legacyStructuralRuleSchema = z.object({
  type: z.undefined().optional(),
  selector: z.string().min(1, "Seletor CSS é obrigatório"),
  description: z.string().min(1, "Descrição da regra é obrigatória"),
  attribute: z.string().optional(),
  expectedValue: z.string().optional(),
  textContains: z.string().optional(),
  mustExist: z.boolean().default(true),
});

// FASE 2 (multi-página): `page` é o nome do arquivo .html onde a regra
// deve ser avaliada — opcional, ausência = página de entrada padrão.
// Não validamos contra nomes "esperados" de arquivo aqui: a convenção
// de nomenclatura é comunicada só pelo enunciado (decisão consciente),
// então qualquer string não vazia é aceita — um nome que o aluno nunca
// criou vira falha normal da regra em tempo de correção, não erro de
// configuração do professor.
const pageFieldSchema = z.string().min(1).optional();

const structuralRuleSchema = z.object({
  type: z.literal("structural"),
  page: pageFieldSchema,
  selector: z.string().min(1, "Seletor CSS é obrigatório"),
  description: z.string().min(1, "Descrição da regra é obrigatória"),
  attribute: z.string().optional(),
  expectedValue: z.string().optional(),
  textContains: z.string().optional(),
  mustExist: z.boolean().default(true),
});

// NOVO: verifica uma propriedade CSS computada de verdade (resolvida por
// um Chromium real via HtmlExecutorService — jsdom não suportava isto de
// forma confiável, era a causa raiz da limitação anterior). Diferente da
// regra estrutural de atributo, `expectedValue` aqui é sempre
// obrigatório: não existe "só checar presença" para uma propriedade CSS
// — todo elemento sempre tem algum valor computado pra qualquer
// propriedade, então "presença" não é uma checagem que faz sentido.
const computedStyleRuleSchema = z.object({
  type: z.literal("computedStyle"),
  page: pageFieldSchema,
  selector: z.string().min(1, "Seletor CSS é obrigatório"),
  description: z.string().min(1, "Descrição da regra é obrigatória"),
  property: z
    .string()
    .min(1, "Propriedade CSS é obrigatória (ex: display, color)"),
  expectedValue: z.string().min(1, "Valor esperado é obrigatório"),
});

// NOVO (Fase 2): simula clicar num link e verificar em qual página o
// browser realmente aterrissou — não dá pra checar isso só olhando o
// HTML estático, precisa navegar de verdade (ver
// HtmlExecutorService/HtmlValidatorService). `page` aqui é a página de
// PARTIDA (onde `selector` deve existir); `expectedPage` é o arquivo
// esperado depois do clique. Os dois são nomes de arquivo da própria
// submissão, nunca URLs.
const navigationRuleSchema = z.object({
  type: z.literal("navigation"),
  page: pageFieldSchema,
  description: z.string().min(1, "Descrição da regra é obrigatória"),
  selector: z.string().min(1, "Seletor do link/elemento é obrigatório"),
  expectedPage: z
    .string()
    .min(1, "Página esperada após a navegação é obrigatória"),
});

// NOVO (Fase 3 — JS vanilla): simula uma sequência de ações do usuário
// (clicar, digitar, esperar) e checa o resultado — a peça mais arriscada
// das três fases, por isso os tetos abaixo não são só UX, são limite de
// segurança real (espelhados 1:1 no backend, ver
// html-validation-config.validator.ts, porque o Zod aqui só protege
// quem passa pelo wizard, não um POST direto na API).
//
// MAX_STEPS=10, MAX_WAIT_MS_PER_STEP=2000, soma de waits ≤5000ms por
// regra: números escolhidos pra manter o pior caso de uma regra
// individual bem abaixo do teto duro de execução do
// HtmlExecutorService (20s, compartilhado entre TODAS as regras da
// submissão) — sem isso, uma regra sozinha já poderia consumir o
// processo Chromium compartilhado por perto do tempo todo disponível.
const MAX_INTERACTION_STEPS = 10;
const MAX_WAIT_MS_PER_STEP = 2000;
const MAX_TOTAL_WAIT_MS_PER_RULE = 5000;

const interactionClickStepSchema = z.object({
  action: z.literal("click"),
  selector: z.string().min(1, "Seletor é obrigatório"),
});

const interactionTypeStepSchema = z.object({
  action: z.literal("type"),
  selector: z.string().min(1, "Seletor é obrigatório"),
  text: z.string().max(200, "Texto muito longo (máx. 200 caracteres)"),
});

const interactionWaitStepSchema = z.object({
  action: z.literal("wait"),
  ms: z.coerce
    .number()
    .int()
    .min(0)
    .max(
      MAX_WAIT_MS_PER_STEP,
      `Espera máxima de ${MAX_WAIT_MS_PER_STEP}ms por passo`,
    ),
});

const interactionStepSchema = z.discriminatedUnion("action", [
  interactionClickStepSchema,
  interactionTypeStepSchema,
  interactionWaitStepSchema,
]);

const interactionRuleSchema = z
  .object({
    type: z.literal("interaction"),
    page: pageFieldSchema,
    description: z.string().min(1, "Descrição da regra é obrigatória"),
    steps: z
      .array(interactionStepSchema)
      .min(1, "Adicione pelo menos um passo de interação")
      .max(
        MAX_INTERACTION_STEPS,
        `No máximo ${MAX_INTERACTION_STEPS} passos por regra`,
      ),
    // Asserção final, depois de executar todos os `steps` — mesmo
    // vocabulário de uma regra estrutural, ver comentário em
    // html-rule.types.ts::InteractionHtmlRule.
    assertSelector: z.string().min(1, "Seletor de asserção é obrigatório"),
    assertMustExist: z.boolean().default(true),
    assertAttribute: z.string().optional(),
    assertExpectedValue: z.string().optional(),
    assertTextContains: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const totalWaitMs = data.steps
      .filter((s) => s.action === "wait")
      .reduce((sum, s) => sum + (s as { ms: number }).ms, 0);
    if (totalWaitMs > MAX_TOTAL_WAIT_MS_PER_RULE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Soma das esperas não pode passar de ${MAX_TOTAL_WAIT_MS_PER_RULE}ms por regra (somado: ${totalWaitMs}ms)`,
        path: ["steps"],
      });
    }
  });

export const htmlRuleSchema = z.union([
  legacyStructuralRuleSchema,
  structuralRuleSchema,
  computedStyleRuleSchema,
  navigationRuleSchema,
  interactionRuleSchema,
]);

// Uma página de referência (Fase de preview multi-arquivo): mesmo shape
// de fileEntrySchema (nome + conteúdo), reexportado aqui com nome
// próprio porque semanticamente é "página de referência do professor",
// não "arquivo de starter code do aluno" — mesmo que o formato seja
// idêntico.
const referenceFileSchema = fileEntrySchema;

export const htmlDetailsSchema = z.object({
  validationConfig: z
    .object({
      rules: z
        .array(htmlRuleSchema)
        .min(1, "Adicione pelo menos uma regra de validação"),
      // Campo legado (uma única página) — nunca mais escrito por telas
      // novas, mantido só pra ler exercícios salvos antes de
      // referenceFiles existir. Ver html-rule.types.ts::HtmlValidationConfig.
      referenceHtml: z.string().optional(),
      referenceFiles: z.array(referenceFileSchema).optional(),
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
      referenceHtml: z.string().optional(),
      referenceFiles: z.array(referenceFileSchema).optional(),
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
