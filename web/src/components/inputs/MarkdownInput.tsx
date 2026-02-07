import { useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { Eye, Edit3 } from "lucide-react";
import { cn } from "../../lib/utils";
import "highlight.js/styles/github-dark.css";

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

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex justify-between items-end">
        <label className="text-sm font-medium text-muted">{label}</label>
        <div className="flex bg-surface border border-border rounded-lg p-1 gap-1">
          <button
            type="button"
            onClick={() => setIsPreview(false)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
              !isPreview
                ? "bg-zinc-700 text-white shadow-sm"
                : "text-muted hover:text-zinc-100 hover:bg-white/5",
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
                : "text-muted hover:text-zinc-100 hover:bg-white/5",
            )}
          >
            <Eye size={14} /> Visualizar
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-[200px]">
        {isPreview ? (
          <div className="w-full h-full bg-surface border border-border rounded-xl p-4 text-sm prose prose-invert max-w-none overflow-y-auto">
            {watchValue ? (
              <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
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
              "w-full h-full bg-surface border border-border rounded-xl p-4 text-zinc-100",
              "focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all resize-none font-mono text-sm",
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
