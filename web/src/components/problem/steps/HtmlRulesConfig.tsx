import { useFieldArray, useFormContext } from "react-hook-form";
import {
  Plus,
  Trash2,
  MousePointer2,
  MousePointerClick,
  Tag,
  Type,
  Palette,
  Link2,
  ToggleLeft,
  Info,
} from "lucide-react";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { Card } from "../../ui/Card";
import { cn } from "../../../lib/utils";

// FIX (engine): "type" agora é gravado explicitamente em toda regra nova
// (antes era inferido pela presença de `attribute`/`textContains` — ver
// getRuleType abaixo, que ainda faz esse fallback só para regras
// ANTIGAS sem `type`, por retrocompatibilidade com exercícios já
// salvos). Isso evita a colisão entre o `expectedValue` de uma regra de
// atributo e o `expectedValue` (valor de propriedade CSS) da nova regra
// `computedStyle`.
type RuleType =
  | "existence"
  | "attribute"
  | "text"
  | "computedStyle"
  | "navigation"
  | "interaction";

interface HtmlRulesConfigProps {
  basePath?: string;
}

const RULE_TYPE_OPTIONS: {
  value: RuleType;
  label: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    value: "existence",
    label: "Existência",
    icon: <MousePointer2 size={14} />,
    description: "Verifica se o elemento existe no DOM",
  },
  {
    value: "attribute",
    label: "Atributo",
    icon: <Tag size={14} />,
    description: "Verifica o valor de um atributo HTML",
  },
  {
    value: "text",
    label: "Conteúdo",
    icon: <Type size={14} />,
    description: "Verifica o texto contido no elemento",
  },
  {
    value: "computedStyle",
    label: "Estilo (CSS)",
    icon: <Palette size={14} />,
    description: "Verifica uma propriedade CSS computada (cor, display, etc.)",
  },
  {
    value: "navigation",
    label: "Navegação",
    icon: <Link2 size={14} />,
    description: "Clica num link e verifica se leva à página certa",
  },
  {
    value: "interaction",
    label: "Interação (JS)",
    icon: <MousePointerClick size={14} />,
    description: "Clica/digita em sequência e verifica o resultado",
  },
];

const COMMON_SELECTORS = [
  "h1",
  "h2",
  "h3",
  "p",
  "a",
  "img",
  "ul",
  "ol",
  "li",
  "nav",
  "header",
  "footer",
  "main",
  "section",
  "article",
  "form",
  "input",
  "button",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
];

const COMMON_CSS_PROPERTIES = [
  "display",
  "color",
  "background-color",
  "font-size",
  "font-weight",
  "text-align",
  "margin",
  "padding",
  "flex-direction",
  "justify-content",
  "align-items",
  "position",
];

const MAX_INTERACTION_STEPS = 10;
const MAX_WAIT_MS_PER_STEP = 2000;

/**
 * Editor dos passos de uma regra `interaction` (Fase 3). Precisa do
 * próprio `useFieldArray` — por isso é um componente separado, e não
 * mais um bloco dentro do `.map()` de `HtmlRulesConfig`: chamar
 * `useFieldArray` diretamente dentro do `.map()` de regras violaria as
 * Rules of Hooks (o número de chamadas do hook mudaria a cada regra
 * adicionada/removida). Como componente próprio, cada linha de regra
 * `interaction` tem sua própria instância, com seu próprio hook,
 * respeitando a regra.
 */
function InteractionStepsEditor({ basePath }: { basePath: string }) {
  const { control, register, watch } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `${basePath}.steps`,
  });

  const addStep = (action: "click" | "type" | "wait") => {
    if (fields.length >= MAX_INTERACTION_STEPS) return;
    if (action === "click") append({ action: "click", selector: "" });
    else if (action === "type")
      append({ action: "type", selector: "", text: "" });
    else append({ action: "wait", ms: 500 });
  };

  return (
    <div className="sm:col-span-2 flex flex-col gap-2 border border-border rounded-lg p-3 bg-background/40">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Passos ({fields.length}/{MAX_INTERACTION_STEPS})
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => addStep("click")}
            disabled={fields.length >= MAX_INTERACTION_STEPS}
            className="text-[11px] px-2 py-1 rounded bg-surface border border-border text-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + Clicar
          </button>
          <button
            type="button"
            onClick={() => addStep("type")}
            disabled={fields.length >= MAX_INTERACTION_STEPS}
            className="text-[11px] px-2 py-1 rounded bg-surface border border-border text-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + Digitar
          </button>
          <button
            type="button"
            onClick={() => addStep("wait")}
            disabled={fields.length >= MAX_INTERACTION_STEPS}
            className="text-[11px] px-2 py-1 rounded bg-surface border border-border text-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + Esperar
          </button>
        </div>
      </div>

      {fields.length === 0 && (
        <p className="text-xs text-muted/70">
          Nenhum passo ainda — adicione pelo menos um.
        </p>
      )}

      {fields.map((field, stepIndex) => {
        const action = watch(`${basePath}.steps.${stepIndex}.action`);
        return (
          <div
            key={field.id}
            className="flex items-center gap-2 bg-surface border border-border rounded px-2 py-1.5"
          >
            <span className="text-[10px] font-mono text-muted w-16 flex-none">
              {stepIndex + 1}. {action}
            </span>
            {(action === "click" || action === "type") && (
              <input
                {...register(`${basePath}.steps.${stepIndex}.selector`)}
                placeholder="Seletor CSS"
                className="flex-1 h-7 text-xs font-mono bg-background border border-border rounded px-2 focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            )}
            {action === "type" && (
              <input
                {...register(`${basePath}.steps.${stepIndex}.text`)}
                placeholder="Texto a digitar"
                className="flex-1 h-7 text-xs bg-background border border-border rounded px-2 focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            )}
            {action === "wait" && (
              <input
                type="number"
                min={0}
                max={MAX_WAIT_MS_PER_STEP}
                {...register(`${basePath}.steps.${stepIndex}.ms`, {
                  valueAsNumber: true,
                })}
                placeholder={`ms (máx. ${MAX_WAIT_MS_PER_STEP})`}
                className="w-32 h-7 text-xs font-mono bg-background border border-border rounded px-2 focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            )}
            <button
              type="button"
              onClick={() => remove(stepIndex)}
              className="text-muted hover:text-destructive flex-none"
              title="Remover passo"
            >
              <Trash2 size={13} />
            </button>
          </div>
        );
      })}

      <p className="text-[11px] text-muted">
        Máximo {MAX_INTERACTION_STEPS} passos; esperas de até{" "}
        {MAX_WAIT_MS_PER_STEP}ms cada, somando no máximo 5000ms na regra —
        limites de segurança, não só de UX (o Chromium por trás da correção é
        compartilhado entre todas as submissões).
      </p>
    </div>
  );
}

export function HtmlRulesConfig({ basePath = "" }: HtmlRulesConfigProps) {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useFormContext();

  const getName = (name: string) => (basePath ? `${basePath}.${name}` : name);

  const getError = (path: string) =>
    path.split(".").reduce((obj, key) => obj?.[key], errors as any);

  const { fields, append, remove } = useFieldArray({
    control,
    name: getName("validationConfig.rules"),
  });

  const handleAddRule = (type: RuleType) => {
    const base = {
      selector: "",
      description: "",
      mustExist: true,
    };

    if (type === "attribute") {
      append({ ...base, type: "structural", attribute: "", expectedValue: "" });
    } else if (type === "text") {
      append({ ...base, type: "structural", textContains: "" });
    } else if (type === "computedStyle") {
      // Sem `mustExist` aqui: uma regra de estilo não tem o conceito de
      // "elemento não deveria existir", só faz sentido contra um
      // elemento que já existe.
      append({
        type: "computedStyle",
        selector: "",
        description: "",
        property: "",
        expectedValue: "",
      });
    } else if (type === "navigation") {
      // `page` aqui é a página de PARTIDA (onde `selector` deve
      // existir) — reaproveita o mesmo campo `page` das outras regras,
      // só com um rótulo diferente na UI ("Página de partida").
      append({
        type: "navigation",
        page: "",
        description: "",
        selector: "",
        expectedPage: "",
      });
    } else if (type === "interaction") {
      append({
        type: "interaction",
        description: "",
        steps: [],
        assertSelector: "",
        assertMustExist: true,
      });
    } else {
      append({ ...base, type: "structural" });
    }
  };

  // Retrocompatibilidade: regras salvas ANTES de `type` existir não têm
  // esse campo — cai no fallback por presença de campo, exatamente como
  // antes. Regras novas sempre têm `type` e são lidas direto.
  const getRuleType = (index: number): RuleType => {
    const rule = watch(getName(`validationConfig.rules.${index}`));
    if (rule?.type === "computedStyle") return "computedStyle";
    if (rule?.type === "navigation") return "navigation";
    if (rule?.type === "interaction") return "interaction";
    if (rule?.type === "structural" || rule?.type === undefined) {
      if (rule?.textContains !== undefined) return "text";
      if (rule?.attribute !== undefined) return "attribute";
      return "existence";
    }
    return "existence";
  };

  const rulesError = getError(getName("validationConfig.rules"));

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Regras de Validação
          </h3>
          <p className="text-xs text-muted mt-1">
            Defina o que o HTML do aluno deve conter para ser considerado
            correto. Cada regra aprovada vale pontos proporcionais.
          </p>
        </div>

        {/* Botões de adicionar por tipo */}
        <div className="flex flex-wrap gap-2">
          {RULE_TYPE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => handleAddRule(opt.value)}
              className="flex items-center gap-1.5 text-xs"
            >
              {opt.icon}
              <Plus size={12} />
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Erro global de regras */}
      {rulesError?.message && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
          <Info size={14} />
          {rulesError.message}
        </div>
      )}

      {/* Lista de regras */}
      {fields.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border rounded-xl bg-surface/30 gap-3">
          <MousePointer2 size={28} className="text-muted/40" />
          <p className="text-sm text-muted font-medium">
            Nenhuma regra definida
          </p>
          <p className="text-xs text-muted/60 text-center max-w-xs">
            Adicione regras usando os botões acima. Cada regra verifica um
            aspecto específico do HTML do aluno.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {fields.map((field, index) => {
            const ruleType = getRuleType(index);
            const typeConfig = RULE_TYPE_OPTIONS.find(
              (o) => o.value === ruleType,
            )!;
            const hasError = getError(
              getName(`validationConfig.rules.${index}`),
            );

            return (
              <Card
                key={field.id}
                className={cn(
                  "p-4 transition-colors",
                  hasError && "border-destructive/50 bg-destructive/5",
                )}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  {/* Badge de tipo */}
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border",
                        ruleType === "existence" &&
                          "bg-blue-500/10 text-blue-400 border-blue-500/20",
                        ruleType === "attribute" &&
                          "bg-amber-500/10 text-amber-400 border-amber-500/20",
                        ruleType === "text" &&
                          "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                        ruleType === "computedStyle" &&
                          "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20",
                        ruleType === "navigation" &&
                          "bg-sky-500/10 text-sky-400 border-sky-500/20",
                        ruleType === "interaction" &&
                          "bg-orange-500/10 text-orange-400 border-orange-500/20",
                      )}
                    >
                      {typeConfig.icon}
                      {typeConfig.label}
                    </span>
                    <span className="text-xs text-muted hidden sm:block">
                      {typeConfig.description}
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => remove(index)}
                    className="px-2 h-7 flex-none"
                    title="Remover regra"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Descrição */}
                  <Input
                    label="Descrição da Regra"
                    placeholder="Ex: Página deve ter um título principal"
                    {...register(
                      getName(`validationConfig.rules.${index}.description`),
                    )}
                    error={
                      getError(
                        getName(`validationConfig.rules.${index}.description`),
                      )?.message as string
                    }
                    className="bg-background text-sm"
                  />

                  {/* Página (Fase 2 — multi-página): comum a todos os
                      tipos. Vazio = página de entrada padrão. Em
                      "navigation" representa a página de PARTIDA, onde
                      o seletor abaixo deve existir. */}
                  <Input
                    label={
                      ruleType === "navigation"
                        ? "Página de Partida (opcional)"
                        : "Página (opcional)"
                    }
                    placeholder="Ex: index.html — deixe vazio para a página padrão"
                    {...register(
                      getName(`validationConfig.rules.${index}.page`),
                    )}
                    error={
                      getError(getName(`validationConfig.rules.${index}.page`))
                        ?.message as string
                    }
                    className="bg-background text-sm font-mono"
                  />

                  {/* Seletor CSS — não existe em "interaction": esse tipo
                      não tem um seletor de topo, só seletores por passo
                      (dentro de InteractionStepsEditor) e o de asserção
                      final (assertSelector, campo próprio abaixo). */}
                  {ruleType !== "interaction" && (
                    <div className="flex flex-col gap-1.5">
                      <Input
                        label={
                          ruleType === "navigation"
                            ? "Seletor do Link/Elemento"
                            : "Seletor CSS"
                        }
                        placeholder="Ex: h1, .titulo, #main > p"
                        {...register(
                          getName(`validationConfig.rules.${index}.selector`),
                        )}
                        error={
                          getError(
                            getName(`validationConfig.rules.${index}.selector`),
                          )?.message as string
                        }
                        className="bg-background text-sm font-mono"
                      />
                      {/* Sugestões rápidas */}
                      <div className="flex flex-wrap gap-1">
                        {COMMON_SELECTORS.slice(0, 8).map((sel) => (
                          <button
                            key={sel}
                            type="button"
                            onClick={() => {
                              const el =
                                document.querySelector<HTMLInputElement>(
                                  `[name="${getName(`validationConfig.rules.${index}.selector`)}"]`,
                                );
                              if (el) {
                                const nativeInputValueSetter =
                                  Object.getOwnPropertyDescriptor(
                                    window.HTMLInputElement.prototype,
                                    "value",
                                  )?.set;
                                nativeInputValueSetter?.call(el, sel);
                                el.dispatchEvent(
                                  new Event("input", { bubbles: true }),
                                );
                              }
                            }}
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-muted hover:text-foreground hover:border-primary/40 transition-colors"
                          >
                            {sel}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Campos extras por tipo */}
                  {ruleType === "attribute" && (
                    <>
                      <Input
                        label="Nome do Atributo"
                        placeholder="Ex: href, src, alt, class"
                        {...register(
                          getName(`validationConfig.rules.${index}.attribute`),
                        )}
                        error={
                          getError(
                            getName(
                              `validationConfig.rules.${index}.attribute`,
                            ),
                          )?.message as string
                        }
                        className="bg-background text-sm font-mono"
                      />
                      <Input
                        label="Valor Esperado (opcional)"
                        placeholder="Deixe vazio para verificar só a presença"
                        {...register(
                          getName(
                            `validationConfig.rules.${index}.expectedValue`,
                          ),
                        )}
                        className="bg-background text-sm"
                      />
                    </>
                  )}

                  {ruleType === "text" && (
                    <Input
                      label="Texto que deve conter"
                      placeholder="Ex: Bem-vindo ao meu site"
                      {...register(
                        getName(`validationConfig.rules.${index}.textContains`),
                      )}
                      error={
                        getError(
                          getName(
                            `validationConfig.rules.${index}.textContains`,
                          ),
                        )?.message as string
                      }
                      className="bg-background text-sm"
                    />
                  )}

                  {ruleType === "computedStyle" && (
                    <>
                      <div className="flex flex-col gap-1.5">
                        <Input
                          label="Propriedade CSS"
                          placeholder="Ex: display, color, background-color"
                          {...register(
                            getName(`validationConfig.rules.${index}.property`),
                          )}
                          error={
                            getError(
                              getName(
                                `validationConfig.rules.${index}.property`,
                              ),
                            )?.message as string
                          }
                          className="bg-background text-sm font-mono"
                        />
                        <div className="flex flex-wrap gap-1">
                          {COMMON_CSS_PROPERTIES.slice(0, 6).map((prop) => (
                            <button
                              key={prop}
                              type="button"
                              onClick={() => {
                                const el =
                                  document.querySelector<HTMLInputElement>(
                                    `[name="${getName(`validationConfig.rules.${index}.property`)}"]`,
                                  );
                                if (el) {
                                  const setter =
                                    Object.getOwnPropertyDescriptor(
                                      window.HTMLInputElement.prototype,
                                      "value",
                                    )?.set;
                                  setter?.call(el, prop);
                                  el.dispatchEvent(
                                    new Event("input", { bubbles: true }),
                                  );
                                }
                              }}
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-muted hover:text-foreground hover:border-primary/40 transition-colors"
                            >
                              {prop}
                            </button>
                          ))}
                        </div>
                      </div>
                      <Input
                        label="Valor Esperado"
                        placeholder="Ex: flex, rgb(255, 0, 0), 16px"
                        {...register(
                          getName(
                            `validationConfig.rules.${index}.expectedValue`,
                          ),
                        )}
                        error={
                          getError(
                            getName(
                              `validationConfig.rules.${index}.expectedValue`,
                            ),
                          )?.message as string
                        }
                        className="bg-background text-sm font-mono"
                      />
                      <p className="text-[11px] text-muted sm:col-span-2 -mt-1">
                        O valor é comparado com o CSS computado de verdade
                        (renderizado num browser real) — use o mesmo formato que
                        o browser retorna, ex: cores como{" "}
                        <code className="font-mono">rgb(255, 0, 0)</code>, não{" "}
                        <code className="font-mono">#ff0000</code>.
                      </p>
                    </>
                  )}

                  {ruleType === "navigation" && (
                    <>
                      <Input
                        label="Página Esperada Após Navegar"
                        placeholder="Ex: pagina2.html"
                        {...register(
                          getName(
                            `validationConfig.rules.${index}.expectedPage`,
                          ),
                        )}
                        error={
                          getError(
                            getName(
                              `validationConfig.rules.${index}.expectedPage`,
                            ),
                          )?.message as string
                        }
                        className="bg-background text-sm font-mono"
                      />
                      <p className="text-[11px] text-muted sm:col-span-2 -mt-1">
                        O corretor clica de verdade no seletor acima e confere
                        se o browser terminou nesta página — o nome deve bater
                        exatamente com o arquivo que o aluno enviou (o mesmo
                        nome combinado no enunciado).
                      </p>
                    </>
                  )}

                  {ruleType === "interaction" && (
                    <>
                      <InteractionStepsEditor
                        basePath={getName(`validationConfig.rules.${index}`)}
                      />

                      <div className="sm:col-span-2 flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-muted uppercase tracking-wider">
                          Asserção Final (depois dos passos)
                        </label>
                        <p className="text-[11px] text-muted -mt-1">
                          Roda depois de executar todos os passos acima — mesmo
                          vocabulário de uma regra de Existência/
                          Atributo/Conteúdo, só que checado após a interação.
                        </p>
                      </div>

                      <Input
                        label="Seletor do Elemento a Checar"
                        placeholder="Ex: #resultado, .contador"
                        {...register(
                          getName(
                            `validationConfig.rules.${index}.assertSelector`,
                          ),
                        )}
                        error={
                          getError(
                            getName(
                              `validationConfig.rules.${index}.assertSelector`,
                            ),
                          )?.message as string
                        }
                        className="bg-background text-sm font-mono"
                      />
                      <Input
                        label="Texto que Deve Conter (opcional)"
                        placeholder="Ex: Você clicou 3 vezes"
                        {...register(
                          getName(
                            `validationConfig.rules.${index}.assertTextContains`,
                          ),
                        )}
                        className="bg-background text-sm"
                      />
                      <Input
                        label="Atributo a Checar (opcional)"
                        placeholder="Ex: class, data-status"
                        {...register(
                          getName(
                            `validationConfig.rules.${index}.assertAttribute`,
                          ),
                        )}
                        className="bg-background text-sm font-mono"
                      />
                      <Input
                        label="Valor Esperado do Atributo (opcional)"
                        placeholder="Deixe vazio para verificar só a presença"
                        {...register(
                          getName(
                            `validationConfig.rules.${index}.assertExpectedValue`,
                          ),
                        )}
                        className="bg-background text-sm"
                      />

                      <div className="flex items-center gap-3 sm:col-span-2 pt-1">
                        <input
                          type="checkbox"
                          id={`assertMustExist-${index}`}
                          {...register(
                            getName(
                              `validationConfig.rules.${index}.assertMustExist`,
                            ),
                          )}
                          className="w-4 h-4 rounded border-border accent-primary"
                        />
                        <label
                          htmlFor={`assertMustExist-${index}`}
                          className="text-xs text-muted flex items-center gap-1.5 cursor-pointer select-none"
                        >
                          <ToggleLeft size={13} />
                          Elemento{" "}
                          <strong className="text-foreground">
                            deve existir
                          </strong>{" "}
                          após os passos (desmarque para verificar que está{" "}
                          <strong className="text-foreground">ausente</strong> —
                          ex: um elemento que some depois do clique)
                        </label>
                      </div>
                    </>
                  )}

                  {/* Toggle mustExist — não se aplica a computedStyle,
                      navigation nem interaction (interaction tem seu
                      próprio "assertMustExist" acima; os outros dois não
                      têm o conceito de "elemento não deveria existir") */}
                  {ruleType !== "computedStyle" &&
                    ruleType !== "navigation" &&
                    ruleType !== "interaction" && (
                      <div className="flex items-center gap-3 sm:col-span-2 pt-1">
                        <input
                          type="checkbox"
                          id={`mustExist-${index}`}
                          {...register(
                            getName(
                              `validationConfig.rules.${index}.mustExist`,
                            ),
                          )}
                          className="w-4 h-4 rounded border-border accent-primary"
                        />
                        <label
                          htmlFor={`mustExist-${index}`}
                          className="text-xs text-muted flex items-center gap-1.5 cursor-pointer select-none"
                        >
                          <ToggleLeft size={13} />
                          Elemento{" "}
                          <strong className="text-foreground">
                            deve existir
                          </strong>{" "}
                          (desmarque para verificar que o elemento está{" "}
                          <strong className="text-foreground">ausente</strong>)
                        </label>
                      </div>
                    )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Resumo */}
      {fields.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted border-t border-border pt-3">
          <span>{fields.length} regra(s) definida(s)</span>
          <span>
            Cada regra vale{" "}
            <strong className="text-foreground">
              {Math.round(100 / fields.length)}
            </strong>{" "}
            ponto(s)
          </span>
        </div>
      )}
    </div>
  );
}
