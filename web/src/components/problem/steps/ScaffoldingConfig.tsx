import { useState, useEffect, Suspense, lazy, useMemo, useRef } from "react";
import { useFormContext, useFieldArray, Controller } from "react-hook-form";
import {
  FileCode,
  Plus,
  Trash2,
  Loader2,
  File,
  Maximize2,
  Minimize2,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../../lib/utils";
import { Button } from "../../ui/Button";
import { useMonacoTheme } from "../../../hooks/useMonacoTheme";

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
    content: "def solve():\n    # TODO: Implementar solução\n    pass",
  },
  javascript: {
    name: "index.js",
    content: `/*\n * O sistema trata a leitura/escrita dos I/Os.\n * Implemente sua lógica na função solve.\n */\nfunction solve() {\n    // TODO: Implementar solução\n    return 0;\n}`,
  },
  cpp: {
    name: "main.cpp",
    content: `#include <iostream>\n#include <vector>\n#include <string>\n\nusing namespace std;\n\nvoid solve() {\n    // TODO: Implementar solução\n}`,
  },
};

const STANDARD_NAMES = [
  "main.py",
  "index.js",
  "main.cpp",
  "main.java",
  "main.c",
];

export function ScaffoldingConfig({ basePath = "" }: ScaffoldingConfigProps) {
  const editorRef = useRef<any>(null);
  const { control, watch, setValue, getValues } = useFormContext();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [, setIsLightMode] = useState(
    !document.documentElement.classList.contains("dark"),
  );

  const monacoTheme = useMonacoTheme();

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsLightMode(!document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const getName = (name: string) => (basePath ? `${basePath}.${name}` : name);

  const { fields, append, remove } = useFieldArray({
    control,
    name: getName("starterCode"),
  });

  const parameters = watch(getName("parameters")) || [];
  const allowedLanguages: LangKey[] = watch(getName("allowedLanguages")) || [
    "python",
  ];
  const [viewLang, setViewLang] = useState<LangKey>(
    allowedLanguages[0] || "python",
  );

  // 1. Geração Reativa Linear (Sem useMemo)
  // RHF pode mutar propriedades internas do array "parameters" durante a digitação mantendo a mesma referência.
  // Evitar o useMemo assegura que cada tecla digitada injete o novo Regex no código imediatamente.
  const validParams = parameters.filter(
    (p: any) => p && p.name && p.name.trim() !== "",
  );
  let expectedParamsString = "";

  if (validParams.length > 0) {
    if (viewLang === "python") {
      const pyTypeMap: Record<string, string> = {
        int: "int",
        float: "float",
        string: "str",
        boolean: "bool",
        "int[]": "list[int]",
        "float[]": "list[float]",
        "string[]": "list[str]",
        "boolean[]": "list[bool]",
      };
      expectedParamsString = validParams
        .map((p: any) => `${p.name.trim()}: ${pyTypeMap[p.type] || "Any"}`)
        .join(", ");
    } else if (viewLang === "javascript") {
      expectedParamsString = validParams
        .map((p: any) => p.name.trim())
        .join(", ");
    } else if (viewLang === "cpp") {
      const cppTypeMap: Record<string, string> = {
        int: "int",
        float: "float",
        string: "string",
        boolean: "bool",
        "int[]": "vector<int>",
        "float[]": "vector<float>",
        "string[]": "vector<string>",
        "boolean[]": "vector<bool>",
      };
      expectedParamsString = validParams
        .map((p: any) => `${cppTypeMap[p.type] || "auto"} ${p.name.trim()}`)
        .join(", ");
    }
  }

  const visibleFiles = useMemo(() => {
    return fields
      .map((field: any, index) => ({ field, index }))
      .filter(({ field }) => {
        const extLang = getLanguageFromExt(field.name || "");
        return extLang === viewLang || extLang === "plaintext";
      });
  }, [fields, viewLang]);

  useEffect(() => {
    if (
      visibleFiles.length > 0 &&
      !visibleFiles.find((f) => f.index === activeIndex)
    ) {
      setActiveIndex(visibleFiles[0].index);
    }
  }, [viewLang, visibleFiles, activeIndex]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isFullscreen]);

  const toggleLanguage = (lang: LangKey) => {
    const current = new Set(allowedLanguages);
    if (current.has(lang)) {
      if (current.size === 1)
        return toast.error("É necessário permitir pelo menos uma linguagem.");
      current.delete(lang);

      const newStarter = getValues(getName("starterCode")).filter(
        (f: any) => getLanguageFromExt(f.name) !== lang,
      );
      setValue(getName("starterCode"), newStarter, { shouldDirty: true });

      if (viewLang === lang) setViewLang(Array.from(current)[0] as LangKey);
    } else {
      current.add(lang);
      const template = TEMPLATES[lang];
      const existing = getValues(getName("starterCode")) || [];

      if (!existing.some((f: any) => f.name === template.name)) {
        // 2. Pré-injeção de template
        // Ao invés de inserir o código puro e cruzar os dedos pro Regex pegar em tempo real,
        // mapeamos e formatamos os parâmetros estritamente ANTES de acoplar o arquivo no estado do Monaco
        let injectedParams = "";
        if (validParams.length > 0) {
          if (lang === "python") {
            const pyMap: Record<string, string> = {
              int: "int",
              float: "float",
              string: "str",
              boolean: "bool",
              "int[]": "list[int]",
              "float[]": "list[float]",
              "string[]": "list[str]",
              "boolean[]": "list[bool]",
            };
            injectedParams = validParams
              .map((p: any) => `${p.name.trim()}: ${pyMap[p.type] || "Any"}`)
              .join(", ");
          } else if (lang === "javascript") {
            injectedParams = validParams
              .map((p: any) => p.name.trim())
              .join(", ");
          } else if (lang === "cpp") {
            const cppMap: Record<string, string> = {
              int: "int",
              float: "float",
              string: "string",
              boolean: "bool",
              "int[]": "vector<int>",
              "float[]": "vector<float>",
              "string[]": "vector<string>",
              "boolean[]": "vector<bool>",
            };
            injectedParams = validParams
              .map((p: any) => `${cppMap[p.type] || "auto"} ${p.name.trim()}`)
              .join(", ");
          }
        }

        let regex: RegExp;
        if (lang === "python") regex = /(def\s+solve\s*\()([^)]*)(\))/;
        else if (lang === "javascript")
          regex = /(function\s+solve\s*\()([^)]*)(\))/;
        else regex = /((?:[a-zA-Z0-9_<>:\[\]]+\s+)+solve\s*\()([^)]*)(\))/;

        const preFormattedContent = template.content.replace(
          regex,
          `$1${injectedParams}$3`,
        );

        setValue(
          getName("starterCode"),
          [...existing, { name: template.name, content: preFormattedContent }],
          { shouldDirty: true },
        );
      }
      setViewLang(lang);
    }
    setValue(getName("allowedLanguages"), Array.from(current), {
      shouldDirty: true,
    });
  };

  const currentMainFileMeta = useMemo(() => {
    return visibleFiles.find((f) => STANDARD_NAMES.includes(f.field.name));
  }, [visibleFiles]);

  const currentMainFileContent = currentMainFileMeta
    ? watch(getName(`starterCode.${currentMainFileMeta.index}.content`))
    : null;

  useEffect(() => {
    if (!currentMainFileMeta || typeof currentMainFileContent !== "string")
      return;

    let regex: RegExp;
    if (viewLang === "python") regex = /(def\s+solve\s*\()([^)]*)(\))/;
    else if (viewLang === "javascript")
      regex = /(function\s+solve\s*\()([^)]*)(\))/;
    else regex = /((?:[a-zA-Z0-9_<>:\[\]]+\s+)+solve\s*\()([^)]*)(\))/;

    const match = currentMainFileContent.match(regex);

    if (match && match[2].trim() !== expectedParamsString) {
      const newText = match[0].replace(regex, `$1${expectedParamsString}$3`);

      const editorModel = editorRef.current?.getModel();

      if (editorModel && editorModel.getValue() === currentMainFileContent) {
        const matches = editorModel.findMatches(
          regex.source,
          false,
          true,
          false,
          null,
          false,
        );

        if (matches && matches.length > 0) {
          editorRef.current.executeEdits("sync-signature", [
            {
              range: matches[0].range,
              text: newText,
              forceMoveMarkers: true,
            },
          ]);

          setValue(
            getName(`starterCode.${currentMainFileMeta.index}.content`),
            editorModel.getValue(),
            { shouldDirty: true },
          );
          return;
        }
      }

      const fallbackContent = currentMainFileContent.replace(
        regex,
        `$1${expectedParamsString}$3`,
      );

      setValue(
        getName(`starterCode.${currentMainFileMeta.index}.content`),
        fallbackContent,
        { shouldDirty: true },
      );
    }
  }, [
    expectedParamsString,
    currentMainFileContent,
    currentMainFileMeta,
    getName,
    setValue,
    viewLang,
  ]);

  const handleAddFile = () => {
    const extMap = { python: ".py", javascript: ".js", cpp: ".cpp" };
    const ext = extMap[viewLang];
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-3 flex-none">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <FileCode className="text-primary" size={20} />
            {isFullscreen ? "Modo Focado" : "Código Base"}
          </h3>

          <div className="flex gap-2 ml-2 bg-surface p-1 rounded-md border border-border">
            {(["python", "javascript", "cpp"] as LangKey[]).map((lang) => {
              const isActive = allowedLanguages.includes(lang);
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => toggleLanguage(lang)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded transition-all flex items-center gap-1.5",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted hover:text-foreground hover:bg-surface-hover",
                  )}
                >
                  {isActive && <Check size={12} />}
                  {lang === "javascript"
                    ? "JS"
                    : lang === "python"
                      ? "Python"
                      : "C++"}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleAddFile}
            className="h-9"
          >
            <Plus size={14} className="mr-1" /> Arquivo
          </Button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 text-muted hover:text-foreground transition-colors"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border/50">
        {allowedLanguages.map((lang) => (
          <button
            key={`view-${lang}`}
            type="button"
            onClick={() => setViewLang(lang)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              viewLang === lang
                ? "border-primary text-foreground"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            Configurar{" "}
            {lang === "javascript"
              ? "JS"
              : lang.charAt(0).toUpperCase() + lang.slice(1)}
          </button>
        ))}
      </div>

      <div
        className={cn(
          "border border-border rounded-md overflow-hidden bg-surface flex flex-col shadow-lg",
          isFullscreen ? "flex-1" : "flex-1 min-h-[400px]",
        )}
      >
        <div className="flex bg-background/50 overflow-x-auto no-scrollbar flex-none border-b border-border">
          {visibleFiles.map(({ field, index }) => {
            const isMainFile = STANDARD_NAMES.includes(field.name);
            return (
              <div
                key={field.id}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "group flex items-center gap-2 px-4 py-2.5 text-sm cursor-pointer border-r border-border select-none min-w-[120px] justify-between transition-colors",
                  index === activeIndex
                    ? "bg-surface text-foreground border-t-2 border-t-primary"
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
                        readOnly={isMainFile}
                        className={cn(
                          "bg-transparent outline-none w-20 sm:w-24 truncate text-sm transition-opacity",
                          isMainFile && "cursor-default opacity-80",
                        )}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={(e) => {
                          if (isMainFile) return;
                          let newName = e.target.value.trim();
                          if (!newName) newName = "file.txt";

                          const isDuplicate = fields.some(
                            (f: any, i) =>
                              i !== index &&
                              f.name?.toLowerCase() === newName.toLowerCase(),
                          );

                          if (STANDARD_NAMES.includes(newName.toLowerCase())) {
                            toast.error(
                              "Este nome é reservado para arquivos principais.",
                            );
                            inputField.onChange(`helper_${newName}`);
                          } else if (isDuplicate) {
                            toast.error("Já existe um arquivo com este nome.");
                            inputField.onChange(`copy_${newName}`);
                          } else {
                            inputField.onChange(newName);
                          }
                        }}
                      />
                    )}
                  />
                </div>
                {!isMainFile && (
                  <button
                    type="button"
                    aria-label="Remover arquivo"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(index);
                    }}
                    className="p-2 -mr-2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-destructive/10 text-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex-1 relative min-h-0">
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full text-muted">
                <Loader2 className="animate-spin mr-2" /> Carregando...
              </div>
            }
          >
            {visibleFiles.length > 0 && fields[activeIndex] && (
              <Controller
                control={control}
                name={getName(`starterCode.${activeIndex}.content`)}
                render={({ field }) => (
                  <div className="absolute inset-0">
                    <Editor
                      key={`${fields[activeIndex].id}-${activeIndex}`}
                      height="100%"
                      width="100%"
                      theme={monacoTheme}
                      language={getLanguageFromExt(
                        (fields[activeIndex] as any).name,
                      )}
                      value={field.value}
                      onChange={(value) => field.onChange(value)}
                      onMount={(editor) => {
                        editorRef.current = editor;
                      }}
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
            {visibleFiles.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-muted">
                Nenhum arquivo para esta linguagem.
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
