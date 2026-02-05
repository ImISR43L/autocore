import { useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { Eye, Edit3 } from "lucide-react";
import "highlight.js/styles/github-dark.css"; // Estilo para código no preview

interface MarkdownInputProps {
  label: string;
  register: UseFormRegisterReturn;
  error?: string;
  placeholder?: string;
  watchValue: string; // Valor atual para o preview
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
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-end">
        <label className="text-sm font-medium text-gray-300">{label}</label>
        <div className="flex bg-gray-800 rounded p-1 gap-1">
          <button
            type="button"
            onClick={() => setIsPreview(false)}
            className={`flex items-center gap-1 px-3 py-1 text-xs rounded transition-colors ${
              !isPreview
                ? "bg-gray-700 text-white shadow-sm"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Edit3 size={12} /> Editar
          </button>
          <button
            type="button"
            onClick={() => setIsPreview(true)}
            className={`flex items-center gap-1 px-3 py-1 text-xs rounded transition-colors ${
              isPreview
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Eye size={12} /> Visualizar
          </button>
        </div>
      </div>

      <div className="relative min-h-[160px]">
        {isPreview ? (
          <div className="w-full bg-gray-900/50 border border-gray-700 rounded p-4 text-sm prose prose-invert max-w-none overflow-y-auto max-h-[400px]">
            {watchValue ? (
              <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                {watchValue}
              </ReactMarkdown>
            ) : (
              <span className="text-gray-600 italic">
                Nada para visualizar...
              </span>
            )}
          </div>
        ) : (
          <textarea
            {...register}
            rows={8}
            className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white focus:border-blue-500 outline-none transition-colors resize-y font-mono text-sm"
            placeholder={placeholder}
          />
        )}
      </div>

      {error && <span className="text-red-500 text-xs">{error}</span>}
    </div>
  );
}
