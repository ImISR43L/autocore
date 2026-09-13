/**
 * Contrato de regras do corretor de HTML.
 *
 * IMPORTANTE — retrocompatibilidade: `Problem.validationConfig` é jsonb
 * solto, sem migration. Todo exercício de HTML já criado tem regras SEM
 * o campo `type` (o shape antigo de `HtmlRule` em html-validator.service.ts
 * nunca teve esse campo — o tipo era inferido pela UI via presença de
 * `attribute`/`textContains`, ver HtmlRulesConfig.tsx::getRuleType).
 *
 * Por isso `type` é OPCIONAL em StructuralHtmlRule: ausência de `type`
 * continua significando "regra estrutural", exatamente como antes.
 * Regras novas devem sempre gravar `type: 'structural'` explicitamente
 * (é isso que evita a colisão de `expectedValue` com ComputedStyleHtmlRule
 * — union discriminada, não mais um objeto genérico com campos opcionais
 * demais).
 *
 * FASE 2 (multi-página): `page` é o nome do arquivo .html (como o aluno
 * nomeou na submissão) onde a regra deve ser avaliada. Ausente = página
 * de entrada padrão (index.html, ou o primeiro .html enviado — mesmo
 * fallback de sempre). Não há validação de que esse nome bate com algo
 * "esperado" pelo exercício — a convenção de nomes é comunicada só pelo
 * enunciado (decisão consciente, não lacuna), então uma regra pode
 * referenciar uma página que o aluno nunca criou; isso vira falha normal
 * da regra ("página não encontrada"), não erro de configuração.
 */

export interface StructuralHtmlRule {
  type?: 'structural';
  page?: string;
  selector: string;
  description: string;
  attribute?: string;
  expectedValue?: string;
  textContains?: string;
  mustExist?: boolean;
}

export interface ComputedStyleHtmlRule {
  type: 'computedStyle';
  page?: string;
  selector: string;
  description: string;
  // Nome da propriedade CSS em kebab-case (ex: "background-color"),
  // igual ao que getComputedStyle().getPropertyValue() espera — não o
  // camelCase de CSSStyleDeclaration (ex: backgroundColor). O professor
  // digita a propriedade como escreveria no próprio CSS.
  property: string;
  expectedValue: string;
}

/**
 * NOVO (Fase 2): simula "o aluno clica num link e deve cair na página
 * certa" — a peça de multi-página que não dá pra checar só olhando o
 * HTML estático (o `href` podia apontar pra qualquer lugar; isto navega
 * de verdade e confere onde o browser realmente aterrissou).
 *
 * `page` aqui é a página de PARTIDA (onde o link/seletor deve existir);
 * `expectedPage` é o nome do arquivo esperado depois do clique. Os dois
 * são nomes de arquivo da própria submissão, nunca URLs — o executor
 * nunca navega pra fora do site estático da submissão de qualquer forma
 * (ver HtmlExecutorService), então não faria sentido aceitar outra coisa
 * aqui.
 */
export interface NavigationHtmlRule {
  type: 'navigation';
  page?: string;
  description: string;
  selector: string;
  expectedPage: string;
}

/**
 * NOVO (Fase 3 — JS vanilla): não é "rodar o JS e ver se compila", é
 * simular uma sequência de ações do usuário (clicar, digitar, esperar)
 * e checar o resultado — como teste de comportamento de UI deveria
 * funcionar. É a peça mais arriscada das três fases, de propósito
 * construída por último, depois do motor e do sandbox de rede já
 * validados nas Fases 1 e 2.
 *
 * Limites embutidos no PRÓPRIO SHAPE (não só documentação) — refletidos
 * em problem.schema.ts (Zod) e html-validation-config.validator.ts
 * (checagem server-side): no máximo 10 passos por regra, no máximo
 * 2000ms por `wait`, soma de todos os `wait` de uma regra ≤ 5000ms. Isso
 * é defesa em profundidade: o teto duro de verdade continua sendo
 * HARD_EXECUTION_TIMEOUT_MS no HtmlExecutorService (backstop por cima de
 * qualquer soma de waits "legítima" que ainda assim escape do previsto),
 * mas sem um limite no schema um professor (ou alguém batendo direto na
 * API) poderia pedir uma regra com dezenas de `wait` de 2000ms cada,
 * desperdiçando o processo Chromium compartilhado por todas as
 * submissões até o timeout duro cortar.
 */
export type InteractionStep =
  | { action: 'click'; selector: string }
  | { action: 'type'; selector: string; text: string }
  | { action: 'wait'; ms: number };

export interface InteractionHtmlRule {
  type: 'interaction';
  page?: string;
  description: string;
  steps: InteractionStep[];
  // Asserção final, depois de executar todos os `steps` — mesmo
  // vocabulário de uma regra estrutural (existência/atributo/texto),
  // porque é exatamente o mesmo tipo de checagem, só que "depois de
  // interagir" em vez de "direto na carga da página".
  assertSelector: string;
  assertMustExist?: boolean;
  assertAttribute?: string;
  assertExpectedValue?: string;
  assertTextContains?: string;
}

export type HtmlRule =
  | StructuralHtmlRule
  | ComputedStyleHtmlRule
  | NavigationHtmlRule
  | InteractionHtmlRule;

export interface ReferenceFile {
  name: string;
  content: string;
}

export interface HtmlValidationConfig {
  rules: HtmlRule[];
  /**
   * @deprecated Substituído por `referenceFiles` (suporte a múltiplas
   * páginas de referência, ex: portfólio com index/sobre/projetos).
   * Mantido só pra exercícios salvos antes dessa mudança — nunca é
   * escrito por telas novas do editor, só lido se `referenceFiles`
   * estiver ausente. Nenhum dos dois é lido pelo motor de correção
   * (HtmlExecutorService/HtmlValidatorService): isso é preview do
   * professor, puramente client-side, não influencia a nota do aluno.
   */
  referenceHtml?: string;
  referenceFiles?: ReferenceFile[];
}

export function isComputedStyleRule(
  rule: HtmlRule,
): rule is ComputedStyleHtmlRule {
  return rule.type === 'computedStyle';
}

export function isNavigationRule(rule: HtmlRule): rule is NavigationHtmlRule {
  return rule.type === 'navigation';
}

export function isInteractionRule(rule: HtmlRule): rule is InteractionHtmlRule {
  return rule.type === 'interaction';
}

/**
 * Usado pelo HtmlGradingStrategy para decidir, POR SUBMISSÃO, se a
 * correção deve rodar inline (sync) ou ser enfileirada — não a estratégia
 * inteira, só o caso concreto que tem regra `interaction` no gabarito.
 * `interaction` é a única categoria cujo pior caso pode legitimamente
 * levar segundos (passos + wait, ver HtmlExecutorService); estrutural,
 * computedStyle e navigation continuam na casa dos milissegundos, então
 * não faz sentido pagar o overhead de fila pra eles.
 */
export function hasInteractionRules(
  config: HtmlValidationConfig | null | undefined,
): boolean {
  return !!config?.rules?.some((rule) => rule.type === 'interaction');
}
