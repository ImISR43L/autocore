import { useState, useEffect, Suspense, lazy } from "react";
import { useFormContext, useFieldArray, Controller } from "react-hook-form";
import {
  FileCode,
  Plus,
  Trash2,
  Loader2,
  File,
  Maximize2,
  Minimize2,
} from "lucide-react";

// Lazy loading do Monaco Editor
const Editor = lazy(() => import("@monaco-editor/react"));

interface ScaffoldingConfigProps {
  basePath?: string;
}

const getLanguageFromExt = (filename: string) => {
  if (filename?.endsWith(".js")) return "javascript";
  if (filename?.endsWith(".ts")) return "typescript";
  if (filename?.endsWith(".py")) return "python";
  if (filename?.endsWith(".java")) return "java";
  if (filename?.endsWith(".cpp") || filename?.endsWith(".c")) return "cpp";
  return "plaintext";
};

export function ScaffoldingConfig({ basePath = "" }: ScaffoldingConfigProps) {
  const { control, watch } = useFormContext();
  const [activeIndex, setActiveIndex] = useState(0);
  // 1. Estado para controlar a tela cheia
  const [isFullscreen, setIsFullscreen] = useState(false);

  const getName = (name: string) => (basePath ? `${basePath}.${name}` : name);

  const { fields, append, remove } = useFieldArray({
    control,
    name: getName("starterCode"),
  });

  const currentFileName = fields[activeIndex]
    ? watch(getName(`starterCode.${activeIndex}.name`))
    : "";

  // 2. Listener para sair com ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isFullscreen]);

  return (
    // 3. Estilização Condicional do Container Principal
    <div
      className={`
        flex flex-col gap-4 transition-all duration-300
        ${
          isFullscreen
            ? "fixed inset-0 z-50 bg-[#0d1117] p-6 h-screen w-screen" // Modo Tela Cheia
            : "w-full h-full animate-in fade-in slide-in-from-bottom-4 duration-500" // Modo Normal
        }
      `}
    >
      <div className="flex justify-between items-center border-b border-gray-800 pb-2 flex-none">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <FileCode className="text-green-500" size={20} />
          {isFullscreen ? "Modo de Edição Focada" : "Código Base (Scaffolding)"}
        </h3>

        <div className="flex items-center gap-2">
          {/* 4. Botão de Toggle Tela Cheia */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="text-gray-400 hover:text-white p-1.5 rounded hover:bg-white/10 transition-colors mr-2"
            title={
              isFullscreen ? "Sair da Tela Cheia (Esc)" : "Expandir Editor"
            }
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>

          <button
            type="button"
            onClick={() => {
              append({ name: "untitled.py", content: "" });
              setActiveIndex(fields.length);
            }}
            className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded flex items-center gap-1 transition-colors"
          >
            <Plus size={14} /> Novo Arquivo
          </button>
        </div>
      </div>

      <div
        className={`border border-gray-800 rounded-md overflow-hidden bg-[#1e1e1e] flex flex-col w-full shadow-lg ${isFullscreen ? "flex-1" : "flex-1 min-h-[500px]"}`}
      >
        {/* --- File Manager Tabs --- */}
        <div className="flex bg-[#252526] overflow-x-auto no-scrollbar flex-none">
          {fields.map((field, index) => (
            <div
              key={field.id}
              onClick={() => setActiveIndex(index)}
              className={`
                group flex items-center gap-2 px-4 py-2 text-sm cursor-pointer border-r border-gray-800 select-none min-w-[120px] justify-between
                ${
                  index === activeIndex
                    ? "bg-[#1e1e1e] text-white border-t-2 border-t-green-500"
                    : "text-gray-500 hover:bg-[#2a2d2e] hover:text-gray-300"
                }
              `}
            >
              <div className="flex items-center gap-2">
                <File
                  size={14}
                  className={index === activeIndex ? "text-green-500" : ""}
                />
                <Controller
                  control={control}
                  name={getName(`starterCode.${index}.name`)}
                  render={({ field: inputField }) => (
                    <input
                      {...inputField}
                      className="bg-transparent outline-none w-24 truncate"
                      onClick={(e) => e.stopPropagation()}
                      onBlur={() => {
                        if (!inputField.value) inputField.onChange("file.txt");
                      }}
                    />
                  )}
                />
              </div>

              {fields.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const newIndex = index === 0 ? 0 : index - 1;
                    remove(index);
                    setActiveIndex(newIndex);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:bg-gray-700 rounded p-0.5 text-gray-400 hover:text-red-400 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* --- Editor Area --- */}
        <div className="flex-1 relative min-h-0">
          <Suspense
            fallback={
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 gap-2">
                <Loader2 className="animate-spin" /> Carregando Editor...
              </div>
            }
          >
            {fields.length > 0 && fields[activeIndex] && (
              <Controller
                control={control}
                name={getName(`starterCode.${activeIndex}.content`)}
                render={({ field }) => (
                  <div className="absolute inset-0">
                    <Editor
                      height="100%"
                      width="100%"
                      theme="vs-dark"
                      path={`${basePath ? basePath + "-" : ""}${fields[activeIndex].id}`}
                      language={getLanguageFromExt(currentFileName || "")}
                      value={field.value}
                      onChange={(value) => field.onChange(value)}
                      options={{
                        minimap: { enabled: false },
                        fontSize: isFullscreen ? 16 : 14, // Fonte um pouco maior no fullscreen
                        scrollBeyondLastLine: false,
                        padding: { top: 16 },
                        automaticLayout: true, // Essencial para redimensionar corretamente
                      }}
                    />
                  </div>
                )}
              />
            )}
            {fields.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                Nenhum arquivo selecionado.
              </div>
            )}
          </Suspense>
        </div>
      </div>

      <p className="text-xs text-gray-500 flex-none">
        * Este código aparecerá automaticamente para o aluno quando ele iniciar.
        {isFullscreen && " (Pressione ESC para sair)"}
      </p>
    </div>
  );
}
