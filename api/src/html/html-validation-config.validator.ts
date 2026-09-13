import {
  HtmlRule,
  HtmlValidationConfig,
  InteractionStep,
} from './html-rule.types';

// Tetos de segurança pra regras de interação — únicos que existem só no
// backend, não repetidos do Zod (o Zod já aplica os mesmos números do
// lado do editor; aqui é a garantia de verdade contra POST direto na
// API). Ver justificativa completa em html-rule.types.ts::InteractionHtmlRule.
const MAX_INTERACTION_STEPS = 10;
const MAX_WAIT_MS_PER_STEP = 2000;
const MAX_TOTAL_WAIT_MS_PER_RULE = 5000;

/**
 * Validação de forma de HtmlValidationConfig no lado do servidor.
 *
 * Hoje `Problem.validationConfig` chega como `Record<string, any>` livre
 * tanto em CreateProblemDto quanto em CreateQuestionDto — só o Zod do
 * wizard (problem.schema.ts) valida o shape de `rules`. Isso era
 * tolerável enquanto uma regra só lia seletor/atributo/texto contra uma
 * árvore DOM estática. Deixa de ser aceitável a partir do momento em que
 * existir um tipo `interaction` (Fase 3) com passos que rodam de verdade
 * num browser controlado pelo HtmlExecutorService — um payload malformado
 * ou malicioso batendo direto na API (sem passar pelo wizard) teria
 * alcance real sobre timeouts, contagem de passos, etc.
 *
 * NÃO wired ainda: precisa ser chamado em ProblemsService.create()/
 * update() (arquivo ainda não revisado nesta refatoração) sempre que
 * `dto.subject === SubjectType.HTML` — tanto para validationConfig do
 * problema raiz (EXERCISE) quanto para o de cada item em `questions`
 * (EXAM) — lançando BadRequestException com os erros retornados abaixo
 * se a lista não vier vazia.
 */
export function validateHtmlValidationConfigShape(config: unknown): string[] {
  const errors: string[] = [];
  const cfg = config as HtmlValidationConfig | undefined;

  if (!cfg || !Array.isArray(cfg.rules) || cfg.rules.length === 0) {
    return ['Adicione pelo menos uma regra de validação HTML.'];
  }

  cfg.rules.forEach((rule, index) => validateRule(rule, index, errors));
  return errors;
}

function validateRule(rule: HtmlRule, index: number, errors: string[]): void {
  const prefix = `Regra ${index + 1}`;

  if (!rule || typeof rule !== 'object') {
    errors.push(`${prefix}: formato inválido.`);
    return;
  }
  if (!rule.description || typeof rule.description !== 'string') {
    errors.push(`${prefix}: descrição é obrigatória.`);
  }
  // `page` é sempre opcional e, quando presente, só precisa ser uma
  // string não vazia — não dá pra validar contra os arquivos reais aqui
  // (a submissão do aluno ainda nem existe neste momento, é o professor
  // configurando o gabarito). Um `page` que não existir na submissão vira
  // falha normal da regra em tempo de correção, não erro de configuração.
  if (
    rule.page !== undefined &&
    (typeof rule.page !== 'string' || !rule.page)
  ) {
    errors.push(`${prefix}: "page" deve ser um nome de arquivo não vazio.`);
  }

  if (rule.type === 'computedStyle') {
    if (!rule.selector || typeof rule.selector !== 'string') {
      errors.push(`${prefix}: seletor CSS é obrigatório.`);
    }
    if (!rule.property || typeof rule.property !== 'string') {
      errors.push(`${prefix}: propriedade CSS é obrigatória.`);
    }
    if (!rule.expectedValue || typeof rule.expectedValue !== 'string') {
      errors.push(`${prefix}: valor esperado é obrigatório.`);
    }
    return;
  }

  if (rule.type === 'navigation') {
    if (!rule.selector || typeof rule.selector !== 'string') {
      errors.push(`${prefix}: seletor do link/elemento é obrigatório.`);
    }
    if (!rule.expectedPage || typeof rule.expectedPage !== 'string') {
      errors.push(`${prefix}: página esperada após a navegação é obrigatória.`);
    }
    return;
  }

  if (rule.type === 'interaction') {
    validateInteractionRule(rule, prefix, errors);
    return;
  }

  // structural (com ou sem `type` explícito, por retrocompatibilidade)
  if (!rule.selector || typeof rule.selector !== 'string') {
    errors.push(`${prefix}: seletor CSS é obrigatório.`);
  }
}

function validateInteractionRule(
  rule: Extract<HtmlRule, { type: 'interaction' }>,
  prefix: string,
  errors: string[],
): void {
  if (!rule.assertSelector || typeof rule.assertSelector !== 'string') {
    errors.push(`${prefix}: seletor de asserção final é obrigatório.`);
  }

  if (!Array.isArray(rule.steps) || rule.steps.length === 0) {
    errors.push(`${prefix}: adicione pelo menos um passo de interação.`);
    return;
  }
  if (rule.steps.length > MAX_INTERACTION_STEPS) {
    errors.push(
      `${prefix}: no máximo ${MAX_INTERACTION_STEPS} passos por regra (enviado: ${rule.steps.length}).`,
    );
  }

  let totalWaitMs = 0;
  rule.steps.forEach((step: InteractionStep, stepIdx: number) => {
    const stepPrefix = `${prefix}, passo ${stepIdx + 1}`;
    if (!step || typeof step !== 'object') {
      errors.push(`${stepPrefix}: formato inválido.`);
      return;
    }
    if (step.action === 'click') {
      if (!step.selector || typeof step.selector !== 'string') {
        errors.push(`${stepPrefix}: seletor é obrigatório para "click".`);
      }
    } else if (step.action === 'type') {
      if (!step.selector || typeof step.selector !== 'string') {
        errors.push(`${stepPrefix}: seletor é obrigatório para "type".`);
      }
      if (typeof step.text !== 'string') {
        errors.push(`${stepPrefix}: texto é obrigatório para "type".`);
      }
    } else if (step.action === 'wait') {
      if (typeof step.ms !== 'number' || step.ms < 0) {
        errors.push(`${stepPrefix}: "ms" deve ser um número não negativo.`);
      } else if (step.ms > MAX_WAIT_MS_PER_STEP) {
        errors.push(
          `${stepPrefix}: espera máxima de ${MAX_WAIT_MS_PER_STEP}ms por passo (enviado: ${step.ms}ms).`,
        );
      } else {
        totalWaitMs += step.ms;
      }
    } else {
      errors.push(
        `${stepPrefix}: ação "${(step as any).action}" desconhecida.`,
      );
    }
  });

  if (totalWaitMs > MAX_TOTAL_WAIT_MS_PER_RULE) {
    errors.push(
      `${prefix}: soma das esperas não pode passar de ${MAX_TOTAL_WAIT_MS_PER_RULE}ms por regra (somado: ${totalWaitMs}ms).`,
    );
  }
}
