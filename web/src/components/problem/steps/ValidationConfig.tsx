import { useState, useEffect, Suspense, lazy, useMemo, useRef } from "react";
import { useFormContext, useFieldArray, Controller } from "react-hook-form";
import {
  FlaskConical,
  Plus,
  Trash2,
  Play,
  Loader2,
  FileJson,
  CheckCircle,
  XCircle,
  EyeOff,
  RotateCcw,
  Code2,
  Maximize2,
  Minimize2,
  AlertTriangle,
} from "lucide-react";
import { dryRunProblem } from "../../../lib/api";
import { toast } from "sonner";
import { Button } from "../../ui/Button";
import { cn } from "../../../lib/utils";
import { useMonacoTheme } from "../../../hooks/useMonacoTheme";

const Editor = lazy(() => import("@monaco-editor/react"));

interface ValidationConfigProps {
  basePath?: string;
}

type LangKey = "python" | "javascript" | "cpp";
const STANDARD_NAMES = [
  "main.py",
  "index.js",
  "main.cpp",
  "main.java",
  "main.c",
];

const getLanguageFromExt = (filename: string) => {
  if (!filename) return "plaintext";
  if (filename.endsWith(".js")) return "javascript";
  if (filename.endsWith(".ts")) return "typescript";
  if (filename.endsWith(".py")) return "python";
  if (filename.endsWith(".java")) return "java";
  if (filename.endsWith(".cpp") || filename.endsWith(".c")) return "cpp";
  return "plaintext";
};

export function ValidationConfig({ basePath = "" }: ValidationConfigProps) {
  const editorRef = useRef<any>(null);
  const {
    register,
    control,
    getValues,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext();
  const monacoTheme = useMonacoTheme();

  const [isRunning, setIsRunning] = useState(false);
  const [runResults, setRunResults] = useState<any>(null);
  const [activeSolutionTab, setActiveSolutionTab] = useState(0);
  const [isSolutionFullscreen, setIsSolutionFullscreen] = useState(false);
  const [remountKey, setRemountKey] = useState(0);
  const [, setIsLightMode] = useState(
    !document.documentElement.classList.contains("dark"),
  );

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
  const getError = (path: string) =>
    path.split(".").reduce((obj, key) => obj?.[key], errors as any);

  const {
    fields: testFields,
    append: appendTest,
    remove: removeTest,
  } = useFieldArray({
    control,
    name: getName("testCases"),
  });

  const { fields: solutionFields } = useFieldArray({
    control,
    name: getName("solutionCode"),
  });

  // Watchers Base
  const starterCode = watch(getName("starterCode")) || [];
  const parameters = watch(getName("parameters")) || [];
  const returnType = watch(getName("returnType")) || "void";
  const allowedLanguages: LangKey[] = watch(getName("allowedLanguages")) || [
    "python",
  ];

  // Abas e Visualização
  const [activeMainTab, setActiveMainTab] = useState<"code" | "tests">("code");
  const [viewLang, setViewLang] = useState<LangKey>(
    allowedLanguages[0] || "python",
  );

  // Ajusta a linguagem de visualização caso a linguagem atual seja removida na aba anterior
  useEffect(() => {
    if (allowedLanguages.length > 0 && !allowedLanguages.includes(viewLang)) {
      setViewLang(allowedLanguages[0]);
    }
  }, [allowedLanguages, viewLang]);

  const requiresTestCases =
    parameters.length > 0 && returnType !== "void" && returnType.trim() !== "";
  const isMissingRequiredTests = requiresTestCases && testFields.length === 0;

  // Filtra arquivos da solução pela linguagem selecionada
  const visibleFiles = useMemo(() => {
    return solutionFields
      .map((field: any, index) => ({ field, index }))
      .filter(({ field }) => {
        const extLang = getLanguageFromExt(field.name || "");
        return extLang === viewLang || extLang === "plaintext";
      });
  }, [solutionFields, viewLang]);

  useEffect(() => {
    if (
      visibleFiles.length > 0 &&
      !visibleFiles.find((f) => f.index === activeSolutionTab)
    ) {
      setActiveSolutionTab(visibleFiles[0].index);
    }
  }, [viewLang, visibleFiles, activeSolutionTab]);

  const cleanCopy = (files: any[]) => {
    if (!files) return [];
    return JSON.parse(JSON.stringify(files)).map((file: any) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...rest } = file;
      return rest;
    });
  };

  const forceUpdateSolution = (newCode: any[]) => {
    setValue(getName("solutionCode"), newCode, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    setTimeout(() => setRemountKey((prev) => prev + 1), 0);
  };

  // Sincronia Automática Inicial (StarterCode -> SolutionCode)
  useEffect(() => {
    // Evita executar enquanto o React Hook Form não tiver injetado os valores padrão corretamente
    if (!starterCode || starterCode.length === 0) {
      return;
    }

    const currentSolution = getValues(getName("solutionCode")) || [];

    // Se realmente não há nenhum solutionCode (modo CREATE puro), injetamos uma cópia limpa do starterCode
    if (currentSolution.length === 0) {
      forceUpdateSolution(cleanCopy(starterCode));
      return;
    }

    let hasChanges = false;
    const newSolution = [...currentSolution];

    // 1. Remove arquivos do gabarito que foram apagados no código base
    for (let i = newSolution.length - 1; i >= 0; i--) {
      if (!starterCode.some((sc: any) => sc.name === newSolution[i].name)) {
        newSolution.splice(i, 1);
        hasChanges = true;
      }
    }

    // 2. Adiciona novos arquivos criados no código base para dentro do gabarito
    // (Mantém o 'content' vazio ou o do template, mas NÃO sobrescreve os que já existem)
    for (const sc of starterCode) {
      if (!newSolution.some((sol: any) => sol.name === sc.name)) {
        newSolution.push({ ...sc });
        hasChanges = true;
      }
    }

    if (hasChanges) {
      forceUpdateSolution(cleanCopy(newSolution));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(starterCode)]);

  // Construção Reativa da Assinatura
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
        float: "double",
        string: "string",
        boolean: "bool",
        "int[]": "vector<int>",
        "float[]": "vector<double>",
        "string[]": "vector<string>",
        "boolean[]": "vector<bool>",
      };
      expectedParamsString = validParams
        .map((p: any) => `${cppTypeMap[p.type] || "auto"} ${p.name.trim()}`)
        .join(", ");
    }
  }

  const currentMainFileMeta = useMemo(() => {
    return visibleFiles.find((f) => STANDARD_NAMES.includes(f.field.name));
  }, [visibleFiles]);

  const currentMainFileContent = currentMainFileMeta
    ? watch(getName(`solutionCode.${currentMainFileMeta.index}.content`))
    : null;

  // Sincronia Automática da Assinatura via Monaco AST
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
            getName(`solutionCode.${currentMainFileMeta.index}.content`),
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
        getName(`solutionCode.${currentMainFileMeta.index}.content`),
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

  const handleResetSolution = () => {
    const latestStarter = getValues(getName("starterCode"));
    if (latestStarter && latestStarter.length > 0) {
      forceUpdateSolution(cleanCopy(latestStarter));
      setActiveSolutionTab(visibleFiles[0]?.index || 0);
      toast.success("Gabarito restaurado para o template original.");
    } else {
      toast.warning("Não há código base para restaurar.");
    }
  };

  const handleExportTests = () => {
    const tests = getValues(getName("testCases"));
    if (tests && tests.length > 0) {
      const cleanTests = tests.map(({ id, ...rest }: any) => rest);
      navigator.clipboard.writeText(JSON.stringify(cleanTests, null, 2));
      toast.success("JSON copiado!");
    }
  };

  const handleDryRun = async () => {
    const allSCode = getValues(getName("solutionCode")) || [];
    const tCases = getValues(getName("testCases"));
    const params = getValues(getName("parameters"));
    const retType = getValues(getName("returnType"));

    // Pega apenas os arquivos da linguagem sendo visualizada no momento
    const sCode = allSCode.filter((f: any) => {
      const extLang = getLanguageFromExt(f.name);
      return extLang === viewLang || extLang === "plaintext";
    });

    if (!sCode?.length)
      return toast.error(`Escreva uma solução em ${viewLang.toUpperCase()}.`);
    if (!tCases?.length) return toast.error("Adicione casos de teste.");

    setIsRunning(true);
    setRunResults(null);

    const sanitize = (list: any[]) =>
      list?.map(({ id, ...rest }: any) => rest) || [];

    try {
      const result = await dryRunProblem({
        starterCode: sanitize(sCode),
        testCases: sanitize(tCases),
        parameters: sanitize(params),
        returnType: retType,
        language: viewLang, // O backend agora saberá qual a linguagem alvo
      });

      setRunResults(result);
      if (result.success)
        toast.success(`Solução em ${viewLang.toUpperCase()} válida!`);
      else toast.warning("Solução falhou em alguns testes.");
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message || "Erro na execução.";
      toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full pb-8">
      {/* NAVEGAÇÃO POR ABAS (CÓDIGO vs TESTES) */}
      <div className="flex border-b border-border">
        <button
          type="button"
          className={cn(
            "px-6 py-3 border-b-2 font-medium text-sm transition-colors flex items-center gap-2",
            activeMainTab === "code"
              ? "border-primary text-primary bg-primary/5"
              : "border-transparent text-muted hover:text-foreground hover:bg-surface",
          )}
          onClick={() => setActiveMainTab("code")}
        >
          <Code2 size={18} /> Código & Configuração
        </button>
        <button
          type="button"
          className={cn(
            "px-6 py-3 border-b-2 font-medium text-sm transition-colors flex items-center gap-2",
            activeMainTab === "tests"
              ? "border-primary text-primary bg-primary/5"
              : "border-transparent text-muted hover:text-foreground hover:bg-surface",
            isMissingRequiredTests &&
              activeMainTab !== "tests" &&
              "text-destructive",
          )}
          onClick={() => setActiveMainTab("tests")}
        >
          <FlaskConical size={18} /> Casos de Teste
          {isMissingRequiredTests && (
            <AlertTriangle
              size={16}
              className="text-destructive animate-pulse motion-reduce:animate-none"
            />
          )}
        </button>
      </div>

      {/* ABA 1: EDITOR DO GABARITO */}
      <div
        className={cn(
          "flex flex-col gap-4",
          activeMainTab !== "code" && "hidden",
        )}
      >
        <div
          className={cn(
            "flex flex-col gap-3 transition-all duration-300",
            isSolutionFullscreen
              ? "fixed inset-0 z-50 bg-background p-4 h-screen w-screen"
              : "w-full",
          )}
        >
          <div className="border-b border-border pb-2 flex flex-wrap justify-between items-end flex-none gap-3">
            <div className="flex items-center gap-3">
              <div>
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Code2 className="text-primary" size={20} />
                  {isSolutionFullscreen
                    ? "Edição: Gabarito"
                    : "Solução de Referência"}
                </h3>
                {!isSolutionFullscreen && (
                  <p className="text-sm text-muted">
                    Código validador (oculto).
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSolutionFullscreen(!isSolutionFullscreen)}
                className="p-2 text-muted hover:text-foreground transition-colors"
              >
                {isSolutionFullscreen ? (
                  <Minimize2 size={18} />
                ) : (
                  <Maximize2 size={18} />
                )}
              </button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleResetSolution}
                className="h-8 text-xs"
              >
                <RotateCcw size={12} className="mr-1" /> Restaurar Tudo
              </Button>
            </div>
          </div>

          {/* Sub-Abas de Linguagem para o Gabarito */}
          <div className="flex gap-1 border-b border-border/50">
            {allowedLanguages.map((lang) => (
              <button
                key={`val-view-${lang}`}
                type="button"
                onClick={() => setViewLang(lang)}
                className={cn(
                  "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                  viewLang === lang
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted hover:text-foreground",
                )}
              >
                Gabarito{" "}
                {lang === "javascript"
                  ? "JS"
                  : lang.charAt(0).toUpperCase() + lang.slice(1)}
              </button>
            ))}
          </div>

          <div
            key={`editor-container-${remountKey}`}
            className={cn(
              "border border-border rounded-md overflow-hidden bg-surface flex flex-col shadow-lg",
              isSolutionFullscreen ? "flex-1" : "h-[400px]",
            )}
          >
            <div className="flex bg-background/50 overflow-x-auto no-scrollbar flex-none border-b border-border">
              {visibleFiles.map(({ field, index }) => (
                <div
                  key={field.id}
                  onClick={() => setActiveSolutionTab(index)}
                  className={cn(
                    "px-4 py-2 text-sm cursor-pointer border-r border-border select-none",
                    index === activeSolutionTab
                      ? "bg-surface text-foreground border-t-2 border-t-primary"
                      : "text-muted hover:bg-surface-hover",
                  )}
                >
                  {watch(getName(`solutionCode.${index}.name`))}
                </div>
              ))}
            </div>
            <div className="flex-1 relative min-h-0">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center h-full text-muted">
                    Carregando...
                  </div>
                }
              >
                {visibleFiles.length > 0 &&
                  solutionFields[activeSolutionTab] && (
                    <Controller
                      control={control}
                      name={getName(
                        `solutionCode.${activeSolutionTab}.content`,
                      )}
                      render={({ field }) => (
                        <div className="absolute inset-0">
                          <Editor
                            key={`${field.name}-${remountKey}`}
                            height="100%"
                            theme={monacoTheme}
                            language={getLanguageFromExt(
                              watch(
                                getName(
                                  `solutionCode.${activeSolutionTab}.name`,
                                ),
                              ) || "",
                            )}
                            value={field.value}
                            onChange={(value) => field.onChange(value)}
                            onMount={(editor) => {
                              editorRef.current = editor;
                            }}
                            options={{
                              minimap: { enabled: false },
                              fontSize: 14,
                              automaticLayout: true,
                            }}
                          />
                        </div>
                      )}
                    />
                  )}
              </Suspense>
            </div>
          </div>
        </div>
      </div>

      {/* ABA 2: CASOS DE TESTE */}
      <div
        className={cn(
          "flex flex-col gap-6 w-full",
          activeMainTab !== "tests" && "hidden",
        )}
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b border-border pb-3 gap-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <FlaskConical className="text-primary" size={20} /> Testes &
              Validação
            </h3>
            <p className="text-xs text-muted mt-1">
              Defina entradas e saídas esperadas.
            </p>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleExportTests}
              title="Exportar JSON"
            >
              <FileJson size={16} />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDryRun}
              disabled={isRunning || testFields.length === 0}
              className="flex-1 sm:flex-none border-primary text-primary hover:bg-primary/10"
            >
              {isRunning ? (
                <Loader2
                  size={16}
                  className="animate-spin motion-reduce:animate-none mr-2"
                />
              ) : (
                <Play size={16} className="mr-2" />
              )}
              Validar Solução (
              {viewLang === "javascript" ? "JS" : viewLang.toUpperCase()})
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() =>
                appendTest({ input: "", expectedOutput: "", isHidden: false })
              }
              className="flex-1 sm:flex-none"
            >
              <Plus size={16} className="mr-1" /> Add
            </Button>
          </div>
        </div>

        {runResults && (
          <div
            className={cn(
              "border rounded-lg p-4 transition-all animate-in zoom-in-95",
              runResults.success
                ? "border-primary/30 bg-primary/5"
                : "border-destructive/30 bg-destructive/5",
            )}
          >
            <div className="flex items-center gap-2 font-bold mb-2">
              {runResults.success ? (
                <CheckCircle className="text-primary" />
              ) : (
                <XCircle className="text-destructive" />
              )}
              <span
                className={
                  runResults.success ? "text-primary" : "text-destructive"
                }
              >
                {runResults.success
                  ? `Sucesso em ${viewLang.toUpperCase()}!`
                  : "Falha nos testes."}
              </span>
            </div>
            {!runResults.success && runResults.results && (
              <div className="flex flex-col gap-2 mt-2">
                {runResults.results
                  .filter((r: any) => r.status !== "ACCEPTED")
                  .map((res: any, i: number) => (
                    <div
                      key={i}
                      className="bg-background/40 p-2 rounded text-xs border border-destructive/30"
                    >
                      <div className="font-mono text-muted mb-1">
                        Input: {res.input}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          Esperado:{" "}
                          <span className="text-primary">
                            {res.expectedOutput}
                          </span>
                        </div>
                        <div>
                          Obtido:{" "}
                          <span className="text-destructive">
                            {res.actualOutput}
                          </span>
                        </div>
                      </div>
                      {res.error && (
                        <div className="text-destructive mt-1 font-mono">
                          {res.error}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {testFields.map((field, index) => {
            const expectedError = getError(
              getName(`testCases.${index}.expectedOutput`),
            );
            return (
              <div
                key={field.id}
                className="bg-surface border border-border rounded-lg p-4 relative group animate-in slide-in-from-left-2"
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium text-muted bg-background px-2 py-1 rounded">
                    Caso #{index + 1}
                  </span>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-muted hover:text-foreground select-none">
                      <input
                        type="checkbox"
                        {...register(getName(`testCases.${index}.isHidden`))}
                        className="rounded bg-background border-border text-primary focus:ring-0 w-3.5 h-3.5"
                      />
                      <span className="hidden sm:inline">Caso Oculto?</span>
                      {watch(getName(`testCases.${index}.isHidden`)) && (
                        <EyeOff size={14} className="text-yellow-500" />
                      )}
                    </label>
                    <button
                      type="button"
                      aria-label={`Remover caso de teste ${index + 1}`}
                      onClick={() => removeTest(index)}
                      className="p-2 -mr-2 text-muted hover:text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-muted uppercase">
                      Entrada (Input)
                    </label>
                    <textarea
                      {...register(getName(`testCases.${index}.input`))}
                      className="w-full bg-background border border-border rounded-md p-3 text-base text-foreground font-mono resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary transition-all min-h-[80px]"
                      placeholder="Ex: 10 20"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-muted uppercase">
                      Saída Esperada
                    </label>
                    <textarea
                      {...register(
                        getName(`testCases.${index}.expectedOutput`),
                      )}
                      className={cn(
                        "w-full bg-background border rounded-md p-3 text-base text-foreground font-mono resize-none focus-visible:outline-none focus-visible:ring-2 transition-all min-h-[80px]",
                        expectedError
                          ? "border-destructive focus-visible:ring-destructive focus-visible:border-destructive"
                          : "border-border focus-visible:ring-primary focus-visible:border-primary",
                      )}
                      placeholder="Ex: 30"
                    />
                    {expectedError && (
                      <span className="text-xs text-destructive">
                        {expectedError.message as string}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {testFields.length === 0 && (
            <div
              className={cn(
                "text-center py-12 border-2 border-dashed rounded-xl transition-colors",
                isMissingRequiredTests
                  ? "border-destructive/50 bg-destructive/10 text-destructive"
                  : "border-border bg-surface/30 text-muted",
              )}
            >
              {isMissingRequiredTests ? (
                <AlertTriangle
                  size={32}
                  className="mx-auto mb-2 text-destructive animate-pulse motion-reduce:animate-none"
                />
              ) : (
                <FlaskConical size={32} className="mx-auto mb-2 opacity-50" />
              )}
              <p className="font-medium max-w-md mx-auto">
                {isMissingRequiredTests
                  ? "Atenção: Como sua atividade possui parâmetros e retorno definidos, é obrigatório adicionar pelo menos um caso de teste."
                  : "Nenhum caso de teste adicionado."}
              </p>
              <Button
                type="button"
                variant={isMissingRequiredTests ? "danger" : "outline"}
                size="sm"
                onClick={() =>
                  appendTest({ input: "", expectedOutput: "", isHidden: false })
                }
                className="mt-4"
              >
                <Plus size={16} className="mr-2" /> Adicionar Primeiro Teste
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
