import { useFieldArray, useFormContext } from "react-hook-form";
import {
  Plus,
  Trash2,
  MousePointer2,
  Tag,
  Type,
  ToggleLeft,
  Info,
} from "lucide-react";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { Select } from "../../ui/Select";
import { Card } from "../../ui/Card";
import { cn } from "../../../lib/utils";

type RuleType = "existence" | "attribute" | "text";

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
      append({ ...base, attribute: "", expectedValue: "" });
    } else if (type === "text") {
      append({ ...base, textContains: "" });
    } else {
      append(base);
    }
  };

  const getRuleType = (index: number): RuleType => {
    const rule = watch(getName(`validationConfig.rules.${index}`));
    if (rule?.textContains !== undefined) return "text";
    if (rule?.attribute !== undefined) return "attribute";
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

                  {/* Seletor CSS */}
                  <div className="flex flex-col gap-1.5">
                    <Input
                      label="Seletor CSS"
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
                            const field =
                              document.querySelector<HTMLInputElement>(
                                `[name="${getName(`validationConfig.rules.${index}.selector`)}"]`,
                              );
                            if (field) {
                              const nativeInputValueSetter =
                                Object.getOwnPropertyDescriptor(
                                  window.HTMLInputElement.prototype,
                                  "value",
                                )?.set;
                              nativeInputValueSetter?.call(field, sel);
                              field.dispatchEvent(
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

                  {/* Toggle mustExist */}
                  <div className="flex items-center gap-3 sm:col-span-2 pt-1">
                    <input
                      type="checkbox"
                      id={`mustExist-${index}`}
                      {...register(
                        getName(`validationConfig.rules.${index}.mustExist`),
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
