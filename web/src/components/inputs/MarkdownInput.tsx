import { useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { Eye, Edit3, Info, X } from "lucide-react";
import { cn } from "../../lib/utils";
import remarkBreaks from "remark-breaks";
import "highlight.js/styles/github-dark.css";
import { useMonacoTheme } from "../../hooks/useMonacoTheme";

interface MarkdownInputProps {
  label: string;
  register: UseFormRegisterReturn;
  error?: string;
  placeholder?: string;
  watchValue: string;
}

export function MarkdownInput({
  label,
  register,
  error,
  placeholder,
  watchValue,
}: MarkdownInputProps) {
  const [isPreview, setIsPreview] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  useMonacoTheme();

  return (
    <div className="flex flex-col gap-2 flex-1 w-full h-full">
      {/* HEADER */}
      <div className="flex flex-wrap justify-between items-end gap-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted">{label}</label>
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="text-muted hover:text-primary transition-colors focus:outline-none flex items-center justify-center rounded-full p-0.5"
            title="Como usar o Markdown"
          >
            <Info size={16} />
          </button>
        </div>

        <div className="flex bg-surface border border-border rounded-lg p-1 gap-1">
          <button
            type="button"
            onClick={() => setIsPreview(false)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
              !isPreview
                ? "bg-background text-foreground shadow-sm"
                : "text-muted hover:text-foreground hover:bg-white/5",
            )}
          >
            <Edit3 size={14} /> Editar
          </button>
          <button
            type="button"
            onClick={() => setIsPreview(true)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
              isPreview
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted hover:text-foreground hover:bg-white/5",
            )}
          >
            <Eye size={14} /> Visualizar
          </button>
        </div>
      </div>

      {/* GUIA DE MARKDOWN (Colapsável) */}
      {showGuide && (
        <div className="bg-surface/50 border border-primary/20 p-4 rounded-xl text-sm relative animate-in fade-in slide-in-from-top-2 shadow-sm">
          <button
            type="button"
            onClick={() => setShowGuide(false)}
            className="absolute top-3 right-3 text-muted hover:text-foreground transition-colors focus:outline-none"
          >
            <X size={16} />
          </button>
          <h4 className="font-semibold text-primary mb-3 flex items-center gap-2">
            <Info size={16} /> Guia Rápido de Formatação
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 font-mono text-xs">
            <div className="flex justify-between items-center bg-background/50 p-2 rounded border border-border/50">
              <span className="text-muted">**Negrito**</span>
              <span className="font-sans font-bold text-foreground">
                Negrito
              </span>
            </div>
            <div className="flex justify-between items-center bg-background/50 p-2 rounded border border-border/50">
              <span className="text-muted">*Itálico*</span>
              <span className="font-sans italic text-foreground">Itálico</span>
            </div>
            <div className="flex justify-between items-center bg-background/50 p-2 rounded border border-border/50">
              <span className="text-muted"># Título Principal</span>
              <span className="font-sans font-bold text-foreground text-sm">
                Título Principal
              </span>
            </div>
            <div className="flex justify-between items-center bg-background/50 p-2 rounded border border-border/50">
              <span className="text-muted">[Link](https://...)</span>
              <span className="font-sans text-blue-400 underline">Link</span>
            </div>
            <div className="col-span-1 sm:col-span-2 bg-background/50 p-2 rounded border border-border/50">
              <span className="text-muted">```python</span>
              <br />
              <span className="text-foreground">
                print("Código envolto por três crases")
              </span>
              <br />
              <span className="text-muted">```</span>
            </div>
          </div>
        </div>
      )}

      {/* ÁREA PRINCIPAL DE CONTEÚDO */}
      {/* flex-1 garante que isso preencha o tamanho do contêiner pai */}
      <div className="flex-1 flex flex-col min-h-[300px] w-full">
        {isPreview ? (
          <div className="flex-1 w-full h-full bg-surface border border-border rounded-xl p-4 text-sm prose dark:prose-invert max-w-none overflow-y-auto break-words custom-scrollbar prose-p:text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-a:text-primary prose-code:text-foreground prose-li:text-foreground">
            {watchValue ? (
              <ReactMarkdown
                rehypePlugins={[rehypeHighlight]}
                remarkPlugins={[remarkBreaks]}
              >
                {watchValue}
              </ReactMarkdown>
            ) : (
              <span className="text-muted italic">Nada para visualizar...</span>
            )}
          </div>
        ) : (
          <textarea
            {...register}
            className={cn(
              "flex-1 w-full bg-surface border border-border rounded-xl p-4 text-foreground text-base sm:text-sm",
              "focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all resize-y font-mono leading-relaxed break-words",
              error &&
                "border-destructive focus:border-destructive focus:ring-destructive/20",
            )}
            placeholder={placeholder}
          />
        )}
      </div>

      {error && <span className="text-destructive text-xs">{error}</span>}
    </div>
  );
}
