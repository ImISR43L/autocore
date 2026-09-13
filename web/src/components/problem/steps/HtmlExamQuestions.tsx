import { useState } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Globe,
  AlertCircle,
  Code2,
} from "lucide-react";
import { HtmlRulesConfig } from "./HtmlRulesConfig";
import { HtmlReferenceFilesEditor } from "../HtmlReferenceFilesEditor";
import { MarkdownInput } from "../../inputs/MarkdownInput";
import { cn } from "../../../lib/utils";

export function HtmlExamQuestions() {
  const {
    control,
    register,
    watch,
    formState: { errors },
  } = useFormContext();

  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "questions",
  });

  const handleAddQuestion = () => {
    append({
      title: "Nova Questão",
      description: "",
      slug: `q${fields.length + 1}`,
      validationConfig: { rules: [] },
    });
    setExpandedIndex(fields.length);
  };

  const hasQuestionError = (index: number) => {
    return !!(errors as any)?.questions?.[index];
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-border pb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Globe className="text-primary" size={20} />
            Questões da Prova
          </h3>
          <p className="text-xs text-muted mt-1">
            Cada questão possui seu próprio conjunto de regras de validação
            HTML.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddQuestion}
          className="flex items-center gap-1.5 text-sm bg-primary hover:bg-primary-dark text-primary-foreground px-3 py-1.5 rounded-lg transition-colors font-medium"
        >
          <Plus size={16} /> Adicionar Questão
        </button>
      </div>

      {/* Lista de Questões */}
      <div className="flex flex-col gap-3">
        {fields.length === 0 && (
          <div className="text-center py-12 border border-dashed border-border rounded-xl bg-surface/30 text-muted">
            <Globe size={36} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">Nenhuma questão adicionada.</p>
            <p className="text-xs mt-1">
              Clique em "Adicionar Questão" para começar.
            </p>
          </div>
        )}

        {fields.map((field, index) => {
          const isExpanded = expandedIndex === index;
          const basePath = `questions.${index}`;
          const currentDesc = watch(`${basePath}.description`);
          const hasError = hasQuestionError(index);
          const ruleCount =
            watch(`${basePath}.validationConfig.rules`)?.length ?? 0;

          return (
            <div
              key={field.id}
              className={cn(
                "border rounded-xl bg-surface overflow-hidden transition-colors",
                hasError ? "border-destructive/50" : "border-border",
              )}
            >
              {/* Accordion Header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-hover transition-colors"
                onClick={() => setExpandedIndex(isExpanded ? null : index)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isExpanded ? (
                    <ChevronDown size={18} className="text-muted flex-none" />
                  ) : (
                    <ChevronRight size={18} className="text-muted flex-none" />
                  )}
                  <span
                    className={cn(
                      "font-medium truncate",
                      hasError ? "text-destructive" : "text-foreground",
                    )}
                  >
                    Questão {index + 1}:{" "}
                    {watch(`${basePath}.title`) || "Sem título"}
                  </span>

                  {hasError && (
                    <span className="text-destructive flex items-center gap-1 text-xs bg-destructive/10 px-2 py-0.5 rounded border border-destructive/20 flex-none">
                      <AlertCircle size={12} /> Inválida
                    </span>
                  )}

                  {!hasError && ruleCount > 0 && (
                    <span className="text-xs text-muted bg-surface border border-border px-2 py-0.5 rounded flex-none">
                      {ruleCount} regra{ruleCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(index);
                    if (expandedIndex === index) setExpandedIndex(null);
                  }}
                  className="text-muted hover:text-destructive transition-colors p-1 flex-none"
                  title="Remover questão"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Accordion Body */}
              {isExpanded && (
                <div className="border-t border-border bg-background/30 flex flex-col gap-6 p-4 sm:p-6">
                  {/* Título e Slug */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted uppercase tracking-wider">
                        Título da Questão
                      </label>
                      <input
                        {...register(`${basePath}.title`)}
                        className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      />
                      {(errors as any)?.questions?.[index]?.title && (
                        <span className="text-xs text-destructive">
                          {(errors as any).questions[index].title.message}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-muted uppercase tracking-wider">
                        Slug (URL Interna)
                      </label>
                      <input
                        {...register(`${basePath}.slug`)}
                        className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      />
                    </div>
                  </div>

                  {/* Enunciado */}
                  <div className="flex flex-col gap-1.5 min-h-[280px]">
                    <MarkdownInput
                      label="Enunciado da Questão"
                      register={register(`${basePath}.description`)}
                      watchValue={currentDesc}
                      placeholder="Descreva o que o aluno deve criar em HTML..."
                    />
                  </div>

                  <hr className="border-border" />

                  {/* Regras de Validação HTML */}
                  <div className="flex flex-col gap-3">
                    <h4 className="text-sm font-bold text-primary uppercase tracking-wider">
                      Regras de Validação HTML
                    </h4>
                    <HtmlRulesConfig basePath={basePath} />
                  </div>

                  <hr className="border-border" />

                  {/* HTML de Referência por questão (múltiplas páginas) */}
                  <div className="flex flex-col gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Code2 size={14} className="text-primary" />
                        HTML de Referência{" "}
                        <span className="text-xs font-normal text-muted">
                          (opcional)
                        </span>
                      </h4>
                      <p className="text-xs text-muted mt-1">
                        Escreva o HTML esperado para esta questão — adicione
                        quantas páginas precisar. Não é usado na correção
                        automática, serve como referência visual.
                      </p>
                    </div>
                    <HtmlReferenceFilesEditor basePath={basePath} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
