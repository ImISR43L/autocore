import { useState, useEffect } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Plus, X, Code2, Eye, FileCode2 } from "lucide-react";
import { Input } from "../ui/Input";
import { cn } from "../../lib/utils";

interface HtmlReferenceFilesEditorProps {
  // "" para o exercício avulso (HtmlEditor), "questions.3" para a
  // questão de índice 3 de uma prova (HtmlExamQuestions) — mesmo padrão
  // de basePath já usado em HtmlRulesConfig.
  basePath?: string;
}

/**
 * Editor + preview de MÚLTIPLAS páginas de referência (Fase de preview
 * multi-arquivo). Substitui o antigo textarea único de
 * `validationConfig.referenceHtml` por um array `referenceFiles`
 * (mesmo shape de FileEntry: nome + conteúdo) com abas — uma aba por
 * arquivo, e dentro de cada uma o alternador Preview/HTML que já
 * existia.
 *
 * IMPORTANTE — isto é preview, não correção: roda inteiramente no
 * browser do professor via `<iframe srcDoc>`, sem `allow-scripts` (só
 * `allow-same-origin`, igual antes). Não passa pelo HtmlExecutorService,
 * não sobe Chromium no backend, não navega de fato entre páginas — um
 * link para outra página de referência não é clicável dentro do
 * preview; o professor troca de aba manualmente pra ver cada página.
 * Isso é uma limitação consciente: dar navegação real aqui exigiria
 * interceptar cliques dentro do iframe pra trocar a aba ativa, o que é
 * complexidade de implementação extra, não custo de servidor — fica pra
 * uma iteração futura se valer a pena.
 *
 * RETROCOMPATIBILIDADE: exercícios salvos antes desta mudança têm
 * `validationConfig.referenceHtml` (string única) e nunca tiveram
 * `referenceFiles`. Na primeira renderização, se `referenceFiles` vier
 * vazio/ausente e `referenceHtml` tiver conteúdo, migramos esse
 * conteúdo pra `referenceFiles[0]` (nome "index.html") — sem apagar
 * `referenceHtml` do estado do formulário (não precisa: ele só deixa de
 * ser lido por esta tela nova pra frente).
 */
export function HtmlReferenceFilesEditor({
  basePath = "",
}: HtmlReferenceFilesEditorProps) {
  const { control, register, watch } = useFormContext();

  const getName = (name: string) => (basePath ? `${basePath}.${name}` : name);

  const { fields, append, remove } = useFieldArray({
    control,
    name: getName("validationConfig.referenceFiles"),
  });

  const legacyReferenceHtml = watch(
    getName("validationConfig.referenceHtml") as any,
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [previewTab, setPreviewTab] = useState<"preview" | "code">("preview");

  // Migração automática de referenceHtml -> referenceFiles[0], uma
  // única vez (não roda de novo mesmo que o campo legado mude depois —
  // ele só serve de ponto de partida quando não existe nada em
  // referenceFiles ainda).
  useEffect(() => {
    if (fields.length === 0 && legacyReferenceHtml) {
      append({ name: "index.html", content: legacyReferenceHtml });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddPage = () => {
    append({ name: `pagina${fields.length + 1}.html`, content: "" });
    setActiveIndex(fields.length);
  };

  const handleRemovePage = (idx: number) => {
    remove(idx);
    setActiveIndex((current) => {
      if (idx < current) return current - 1;
      if (idx === current) return Math.max(0, current - 1);
      return current;
    });
  };

  const safeActiveIndex = Math.min(activeIndex, Math.max(fields.length - 1, 0));
  const activeContent =
    watch(
      getName(
        `validationConfig.referenceFiles.${safeActiveIndex}.content`,
      ) as any,
    ) ?? "";

  return (
    <div className="flex flex-col gap-3">
      {/* Abas de página */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {fields.map((field, idx) => {
          const fileName = watch(
            getName(`validationConfig.referenceFiles.${idx}.name`) as any,
          );
          const isActive = idx === safeActiveIndex;
          return (
            <div
              key={field.id}
              className={cn(
                "flex items-center gap-1 rounded-lg border pl-3 pr-1 py-1.5 transition-colors",
                isActive
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-surface border-border text-muted hover:text-foreground",
              )}
            >
              <button
                type="button"
                onClick={() => setActiveIndex(idx)}
                className="flex items-center gap-1.5 text-xs font-mono font-medium"
              >
                <FileCode2 size={12} />
                {fileName || `página ${idx + 1}`}
              </button>
              {fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemovePage(idx)}
                  className="text-muted hover:text-destructive p-0.5"
                  title="Remover página"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={handleAddPage}
          className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-dashed border-border text-muted hover:text-foreground hover:border-primary/40 transition-colors"
        >
          <Plus size={12} /> Página
        </button>
      </div>

      {fields.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border rounded-xl bg-surface/30 text-muted text-sm">
          Nenhuma página de referência ainda — clique em "Página" para
          adicionar uma.
        </div>
      ) : (
        <>
          <Input
            label="Nome do Arquivo"
            placeholder="Ex: index.html, sobre.html, projetos.html"
            {...register(
              getName(
                `validationConfig.referenceFiles.${safeActiveIndex}.name`,
              ),
            )}
            className="bg-background text-sm font-mono max-w-xs"
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[360px]">
            <textarea
              {...register(
                getName(
                  `validationConfig.referenceFiles.${safeActiveIndex}.content`,
                ),
              )}
              placeholder={
                "<!DOCTYPE html>\n<html>\n  <body>\n    <h1>Meu Site</h1>\n  </body>\n</html>"
              }
              className="h-full w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              spellCheck={false}
            />
            <ReferenceHtmlPreviewPane
              html={activeContent}
              tab={previewTab}
              setTab={setPreviewTab}
            />
          </div>

          {fields.length > 1 && (
            <p className="text-[11px] text-muted">
              Cada página é só um preview independente — um link
              apontando pra outra página de referência não navega
              sozinho aqui dentro; troque de aba manualmente pra
              conferir cada uma.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function ReferenceHtmlPreviewPane({
  html,
  tab,
  setTab,
}: {
  html: string;
  tab: "preview" | "code";
  setTab: (t: "preview" | "code") => void;
}) {
  return (
    <div className="flex flex-col h-full border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-surface flex-none">
        <button
          type="button"
          onClick={() => setTab("preview")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all",
            tab === "preview"
              ? "bg-primary/10 text-primary border border-primary/20"
              : "text-muted hover:text-foreground",
          )}
        >
          <Eye size={12} /> Preview
        </button>
        <button
          type="button"
          onClick={() => setTab("code")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all",
            tab === "code"
              ? "bg-primary/10 text-primary border border-primary/20"
              : "text-muted hover:text-foreground",
          )}
        >
          <Code2 size={12} /> HTML
        </button>
      </div>

      {tab === "preview" ? (
        <iframe
          srcDoc={
            html ||
            "<p style='color:#888;font-family:sans-serif;padding:1rem;text-align:center'>Nenhum HTML de referência definido.</p>"
          }
          className="flex-1 w-full bg-white"
          sandbox="allow-same-origin"
          title="Preview do gabarito HTML"
        />
      ) : (
        <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-foreground bg-background leading-relaxed whitespace-pre-wrap">
          {html || "// Nenhum HTML de referência"}
        </pre>
      )}
    </div>
  );
}
