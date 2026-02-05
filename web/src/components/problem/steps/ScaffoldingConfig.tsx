import { useState, useEffect, Suspense, lazy, useMemo } from "react";
import { useFormContext, useFieldArray, Controller } from "react-hook-form";
import {
  FileCode,
  Plus,
  Trash2,
  Loader2,
  File,
  Maximize2,
  Minimize2,
  ChevronDown,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

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

type LangKey = "python" | "javascript" | "cpp";

const TEMPLATES: Record<LangKey, { name: string; content: string }> = {
  python: {
    name: "main.py",
    content: "def solve():\n    pass",
  },
  javascript: {
    name: "main.js",
    content: `/*\n * Recebe o input como string e deve retornar o resultado.\n * O sistema trata a leitura/escrita.\n */\nfunction solve(input) {\n    // TODO: Implementar lógica\n    return 0;\n}`,
  },
  cpp: {
    name: "main.cpp",
    content: `#include <iostream>\n\nusing namespace std;\n\nint main() {\n    // Otimização de I/O\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n\n    // TODO: Implementar solução\n    return 0;\n}`,
  },
};

export function ScaffoldingConfig({ basePath = "" }: ScaffoldingConfigProps) {
  // Removido getValues que não estava sendo usado
  const { control, watch, setValue } = useFormContext();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Estado local para controle IMEDIATO da UI
  const [currentLang, setCurrentLang] = useState<LangKey>("python");
  const [pendingLang, setPendingLang] = useState<LangKey | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const getName = (name: string) => (basePath ? `${basePath}.${name}` : name);

  // Removido replace que não estava sendo usado
  const { fields, append, remove } = useFieldArray({
    control,
    name: getName("starterCode"),
  });

  const parameters = watch(getName("parameters")) || [];

  // Watchers para detectar mudanças externas e inicialização
  const firstFileName = watch(getName(`starterCode.0.name`));
  const firstFileContent = watch(getName(`starterCode.0.content`));

  // Sincroniza estado local com o formulário ao montar (caso venha do banco de dados)
  useEffect(() => {
    if (firstFileName) {
      const detected = getLanguageFromExt(firstFileName) as LangKey;
      if (["python", "javascript", "cpp"].includes(detected)) {
        setCurrentLang((prev) => (prev !== detected ? detected : prev));
      }
    }
  }, [firstFileName]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isFullscreen]);

  const expectedParamsString = useMemo(() => {
    if (!parameters || parameters.length === 0) return "";

    if (currentLang === "python" || currentLang === "javascript") {
      return parameters.map((p: any) => p.name).join(", ");
    } else if (currentLang === "cpp") {
      const typeMap: Record<string, string> = {
        int: "int",
        integer: "int",
        float: "double",
        string: "string",
        boolean: "bool",
        char: "char",
      };
      return parameters
        .map((p: any) => `${typeMap[p.type] || "auto"} ${p.name}`)
        .join(", ");
    }
    return "";
  }, [parameters, currentLang]);

  const isParamsOutOfSync = useMemo(() => {
    if (!firstFileContent) return false;
    let regex: RegExp;
    if (currentLang === "python") regex = /def\s+solve\s*\(([^)]*)\)/;
    else if (currentLang === "javascript")
      regex = /function\s+solve\s*\(([^)]*)\)/;
    else regex = /(?:int|void)\s+(?:solve|main)\s*\(([^)]*)\)/;

    const match = firstFileContent.match(regex);
    if (!match) return false;
    return match[1].trim() !== expectedParamsString;
  }, [firstFileContent, expectedParamsString, currentLang]);

  const handleSyncParams = () => {
    if (!firstFileContent) return;
    let regex: RegExp;
    if (currentLang === "python") regex = /(def\s+solve\s*\()([^)]*)(\))/;
    else if (currentLang === "javascript")
      regex = /(function\s+solve\s*\()([^)]*)(\))/;
    else regex = /((?:int|void)\s+(?:solve|main)\s*\()([^)]*)(\))/;

    const newContent = firstFileContent.replace(
      regex,
      `$1${expectedParamsString}$3`,
    );
    if (newContent !== firstFileContent) {
      setValue(getName(`starterCode.0.content`), newContent, {
        shouldDirty: true,
      });
      toast.success("Parâmetros atualizados!");
    } else {
      toast.info("Função principal não encontrada.");
    }
  };

  const handleLanguageChange = (newLang: LangKey) => {
    if (newLang === currentLang) return;

    if (fields.length > 0) {
      const currentTemplate = TEMPLATES[currentLang]?.content || "";
      const isDirty =
        firstFileContent && firstFileContent.trim() !== currentTemplate.trim();

      if (isDirty) {
        setPendingLang(newLang);
        setShowConfirmModal(true);
      } else {
        applyLanguageSwitch(newLang);
      }
    } else {
      applyLanguageSwitch(newLang);
    }
  };

  const applyLanguageSwitch = (lang: LangKey) => {
    const template = TEMPLATES[lang];

    // 1. Atualiza UI imediatamente (Para o usuário ver a troca no select)
    setCurrentLang(lang);

    // 2. Lógica Híbrida:
    // Se já existem arquivos, usamos setValue no índice 0. Isso é MAIS RÁPIDO e SEGURO
    // para o react-hook-form propagar mudanças para o ValidationConfig.
    if (fields.length > 0) {
      setValue(
        getName(`starterCode.0`),
        {
          name: template.name,
          content: template.content,
        },
        { shouldDirty: true },
      );

      setActiveIndex(0);
    } else {
      // Se não tem nada, usamos append
      append({ name: template.name, content: template.content });
      setActiveIndex(0);
    }

    setShowConfirmModal(false);
    setPendingLang(null);
  };

  const handleAddFile = () => {
    const extMap = { python: ".py", javascript: ".js", cpp: ".cpp" };
    const ext = extMap[currentLang];
    append({ name: `module${ext}`, content: "" });
    setActiveIndex(fields.length);
  };

  return (
    <div
      className={`flex flex-col gap-4 transition-all duration-300 ${isFullscreen ? "fixed inset-0 z-50 bg-[#0d1117] p-6 h-screen w-screen" : "w-full h-full animate-in fade-in slide-in-from-bottom-4 duration-500"}`}
    >
      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl p-6 max-w-sm w-full m-4 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 text-amber-500">
                <div className="p-2 bg-amber-500/10 rounded-full">
                  <AlertTriangle size={24} />
                </div>
                <h3 className="text-lg font-bold text-white">
                  Alterar Linguagem?
                </h3>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                Você editou o código. Trocar para{" "}
                <strong className="text-white">
                  {" "}
                  {pendingLang?.toUpperCase()}{" "}
                </strong>{" "}
                irá resetar o arquivo atual.
              </p>
              <div className="flex gap-3 mt-2 justify-end">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() =>
                    pendingLang && applyLanguageSwitch(pendingLang)
                  }
                  className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white rounded-lg shadow-lg transition-all"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center border-b border-gray-800 pb-2 flex-none">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <FileCode className="text-green-500" size={20} />
            {isFullscreen
              ? "Modo de Edição Focada"
              : "Código Base (Scaffolding)"}
          </h3>
          {parameters.length > 0 && (
            <button
              type="button"
              onClick={handleSyncParams}
              disabled={!isParamsOutOfSync}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium transition-all border ${isParamsOutOfSync ? "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20" : "bg-gray-800 text-gray-500 border-transparent opacity-50 cursor-default"}`}
            >
              <RefreshCw size={12} />{" "}
              {isParamsOutOfSync ? "Sincronizar Params" : "Sincronizado"}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="text-gray-400 hover:text-white p-1.5 rounded hover:bg-white/10 transition-colors"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <div className="flex items-center bg-gray-800 rounded-md p-0.5 border border-gray-700">
            <div className="relative">
              <select
                value={currentLang}
                onChange={(e) =>
                  handleLanguageChange(e.target.value as LangKey)
                }
                className="appearance-none bg-transparent text-xs font-medium text-gray-300 pl-3 pr-7 py-1.5 outline-none cursor-pointer hover:text-white"
              >
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
                <option value="cpp">C++</option>
              </select>
              <ChevronDown
                size={12}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
              />
            </div>
            <div className="w-[1px] h-4 bg-gray-600 mx-1"></div>
            <button
              type="button"
              onClick={handleAddFile}
              className="text-xs font-medium text-white px-3 py-1.5 rounded hover:bg-gray-700 flex items-center gap-1 transition-colors"
            >
              <Plus size={14} /> Novo Arquivo
            </button>
          </div>
        </div>
      </div>

      <div
        className={`border border-gray-800 rounded-md overflow-hidden bg-[#1e1e1e] flex flex-col w-full shadow-lg ${isFullscreen ? "flex-1" : "flex-1 min-h-[500px]"}`}
      >
        <div className="flex bg-[#252526] overflow-x-auto no-scrollbar flex-none">
          {fields.map((field, index) => (
            <div
              key={field.id}
              onClick={() => setActiveIndex(index)}
              className={`group flex items-center gap-2 px-4 py-2 text-sm cursor-pointer border-r border-gray-800 select-none min-w-[120px] justify-between ${index === activeIndex ? "bg-[#1e1e1e] text-white border-t-2 border-t-green-500" : "text-gray-500 hover:bg-[#2a2d2e] hover:text-gray-300"}`}
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
                      // CRÍTICO: Key com currentLang força renderização visual instantânea
                      key={`${fields[activeIndex].id}-${currentLang}-${activeIndex}`}
                      height="100%"
                      width="100%"
                      theme="vs-dark"
                      path={`${basePath ? basePath + "-" : ""}${fields[activeIndex].id}-${currentLang}-${activeIndex}`}
                      // CRÍTICO: Usa estado local para linguagem, desacoplando do delay do Form
                      language={currentLang}
                      value={field.value}
                      onChange={(value) => field.onChange(value)}
                      options={{
                        minimap: { enabled: false },
                        fontSize: isFullscreen ? 16 : 14,
                        scrollBeyondLastLine: false,
                        padding: { top: 16 },
                        automaticLayout: true,
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
        * Este código aparecerá automaticamente para o aluno.{" "}
        {isFullscreen && " (Pressione ESC para sair)"}
      </p>
    </div>
  );
}
