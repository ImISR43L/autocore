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
import { cn } from "../../../lib/utils";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";

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
  const { control, watch, setValue } = useFormContext();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [currentLang, setCurrentLang] = useState<LangKey>("python");
  const [pendingLang, setPendingLang] = useState<LangKey | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const getName = (name: string) => (basePath ? `${basePath}.${name}` : name);

  const { fields, append, remove } = useFieldArray({
    control,
    name: getName("starterCode"),
  });

  const parameters = watch(getName("parameters")) || [];
  const firstFileName = watch(getName(`starterCode.0.name`));
  const firstFileContent = watch(getName(`starterCode.0.content`));

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
    setCurrentLang(lang);

    if (fields.length > 0) {
      setValue(
        getName(`starterCode.0`),
        { name: template.name, content: template.content },
        { shouldDirty: true },
      );
      setActiveIndex(0);
    } else {
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
      className={cn(
        "flex flex-col gap-4 transition-all duration-300 h-full",
        isFullscreen
          ? "fixed inset-0 z-50 bg-background p-4 h-screen w-screen"
          : "relative",
      )}
    >
      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in p-4">
          <Card className="p-6 max-w-sm w-full space-y-4 bg-surface border-border">
            <div className="flex items-center gap-3 text-amber-500">
              <AlertTriangle size={24} />
              <h3 className="text-lg font-bold text-white">
                Alterar Linguagem?
              </h3>
            </div>
            <p className="text-sm text-muted">
              Isso substituirá seu código atual pelo template.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => setShowConfirmModal(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={() => pendingLang && applyLanguageSwitch(pendingLang)}
              >
                Confirmar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Toolbar Responsiva */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border pb-2 flex-none">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <FileCode className="text-primary" size={20} />
            {isFullscreen ? "Modo Focado" : "Código Base"}
          </h3>
          {parameters.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleSyncParams}
              disabled={!isParamsOutOfSync}
              className={cn(
                "h-7 text-xs px-2 transition-all border",
                isParamsOutOfSync
                  ? "border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10 animate-pulse"
                  : "border-transparent text-muted opacity-50 hover:bg-transparent cursor-default",
              )}
            >
              <RefreshCw
                size={12}
                className={cn("mr-1", isParamsOutOfSync && "animate-spin-slow")}
              />
              {isParamsOutOfSync
                ? "Sincronizar Assinatura"
                : "Assinatura Sincronizada"}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <select
              value={currentLang}
              onChange={(e) => handleLanguageChange(e.target.value as LangKey)}
              className="h-9 w-full appearance-none bg-surface border border-border rounded-md px-3 pr-8 text-sm text-zinc-100 focus:ring-1 focus:ring-primary outline-none cursor-pointer"
            >
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
              <option value="cpp">C++</option>
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
          </div>

          <Button
            size="sm"
            variant="secondary"
            onClick={handleAddFile}
            className="h-9"
          >
            <Plus size={14} />{" "}
            <span className="hidden xs:inline ml-1">Arquivo</span>
          </Button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 text-muted hover:text-white transition-colors"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      <div
        className={cn(
          "border border-border rounded-md overflow-hidden bg-surface flex flex-col shadow-lg",
          isFullscreen ? "flex-1" : "flex-1 min-h-[400px]", // Garante altura mínima mas permite flexibilidade
        )}
      >
        <div className="flex bg-background/50 overflow-x-auto no-scrollbar flex-none border-b border-border">
          {fields.map((field, index) => (
            <div
              key={field.id}
              onClick={() => setActiveIndex(index)}
              className={cn(
                "group flex items-center gap-2 px-4 py-2.5 text-sm cursor-pointer border-r border-border select-none min-w-[120px] justify-between transition-colors",
                index === activeIndex
                  ? "bg-surface text-white border-t-2 border-t-primary"
                  : "text-muted hover:bg-surface-hover",
              )}
            >
              <div className="flex items-center gap-2">
                <File
                  size={14}
                  className={index === activeIndex ? "text-primary" : ""}
                />
                <Controller
                  control={control}
                  name={getName(`starterCode.${index}.name`)}
                  render={({ field: inputField }) => (
                    <input
                      {...inputField}
                      className="bg-transparent outline-none w-20 sm:w-24 truncate text-sm"
                      onClick={(e) => e.stopPropagation()}
                      onBlur={() => {
                        if (!inputField.value) inputField.onChange("file.txt");
                      }}
                    />
                  )}
                />
              </div>
              {fields.length > 1 && (
                <Trash2
                  size={14}
                  className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    const newIndex = index === 0 ? 0 : index - 1;
                    remove(index);
                    setActiveIndex(newIndex);
                  }}
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex-1 relative min-h-0">
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full text-muted">
                <Loader2 className="animate-spin mr-2" /> Carregando...
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
                      key={`${fields[activeIndex].id}-${currentLang}-${activeIndex}`}
                      height="100%"
                      width="100%"
                      theme="vs-dark"
                      path={`${basePath ? basePath + "-" : ""}${fields[activeIndex].id}-${currentLang}-${activeIndex}`}
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
              <div className="absolute inset-0 flex items-center justify-center text-muted">
                Nenhum arquivo selecionado.
              </div>
            )}
          </Suspense>
        </div>
      </div>
      <p className="text-xs text-muted flex-none">
        * Este código aparecerá automaticamente para o aluno.{" "}
        {isFullscreen && " (Pressione ESC para sair)"}
      </p>
    </div>
  );
}
