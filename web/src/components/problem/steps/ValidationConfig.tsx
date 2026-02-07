import { useState, useEffect, Suspense, lazy, useMemo } from "react";
import { useFormContext, useFieldArray, Controller } from "react-hook-form";
import {
  FlaskConical,
  Plus,
  Trash2,
  Play,
  CheckCircle,
  XCircle,
  Loader2,
  FileJson,
  Code2,
  RotateCcw,
  Maximize2,
  Minimize2,
  RefreshCw,
  EyeOff,
} from "lucide-react";
import { dryRunProblem } from "../../../lib/api";
import { toast } from "sonner";
import { cn } from "../../../lib/utils";

const Editor = lazy(() => import("@monaco-editor/react"));

interface ValidationConfigProps {
  basePath?: string;
}

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
  const {
    register,
    control,
    getValues,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext();

  const [isRunning, setIsRunning] = useState(false);
  const [runResults, setRunResults] = useState<any>(null);
  const [activeSolutionTab, setActiveSolutionTab] = useState(0);
  const [isSolutionFullscreen, setIsSolutionFullscreen] = useState(false);

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

  const { fields: solutionFields, replace: replaceSolution } = useFieldArray({
    control,
    name: getName("solutionCode"),
  });

  const starterCode = watch(getName("starterCode"));
  const parameters = watch(getName("parameters")) || [];
  const firstSolutionContent = watch(getName(`solutionCode.0.content`));
  const firstSolutionName = watch(getName(`solutionCode.0.name`));

  const cleanCopy = (files: any[]) => {
    return JSON.parse(JSON.stringify(files)).map(
      ({ id, ...rest }: any) => rest,
    );
  };

  useEffect(() => {
    const currentStarter = starterCode || [];
    if (currentStarter.length === 0) return;

    const currentSolution = getValues(getName("solutionCode")) || [];

    if (currentSolution.length === 0) {
      replaceSolution(cleanCopy(currentStarter));
      return;
    }

    const starterLang = getLanguageFromExt(currentStarter[0]?.name || "");
    const solutionLang = getLanguageFromExt(currentSolution[0]?.name || "");
    const hasLangMismatch = starterLang !== solutionLang;

    const hasStructureMismatch =
      currentStarter.length !== currentSolution.length ||
      currentStarter.some((file: any, index: number) => {
        return (
          !currentSolution[index] || file.name !== currentSolution[index].name
        );
      });

    if (hasLangMismatch || hasStructureMismatch) {
      replaceSolution(cleanCopy(currentStarter));
      if (hasLangMismatch) {
        toast.info(`Gabarito atualizado para ${starterLang} (Sincronizado).`);
      }
    }
  }, [JSON.stringify(starterCode), replaceSolution, getValues, getName]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSolutionFullscreen)
        setIsSolutionFullscreen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isSolutionFullscreen]);

  const currentLang = useMemo(
    () => getLanguageFromExt(firstSolutionName || ""),
    [firstSolutionName],
  );
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
    if (!firstSolutionContent) return false;
    let regex: RegExp;
    if (currentLang === "python") regex = /def\s+solve\s*\(([^)]*)\)/;
    else if (currentLang === "javascript")
      regex = /function\s+solve\s*\(([^)]*)\)/;
    else regex = /(?:int|void)\s+(?:solve|main)\s*\(([^)]*)\)/;
    const match = firstSolutionContent.match(regex);
    if (!match) return false;
    return match[1].trim() !== expectedParamsString;
  }, [firstSolutionContent, expectedParamsString, currentLang]);

  const handleSyncParams = () => {
    if (!firstSolutionContent) return;
    let regex: RegExp;
    if (currentLang === "python") regex = /(def\s+solve\s*\()([^)]*)(\))/;
    else if (currentLang === "javascript")
      regex = /(function\s+solve\s*\()([^)]*)(\))/;
    else regex = /((?:int|void)\s+(?:solve|main)\s*\()([^)]*)(\))/;
    const newContent = firstSolutionContent.replace(
      regex,
      `$1${expectedParamsString}$3`,
    );
    if (newContent !== firstSolutionContent) {
      setValue(getName(`solutionCode.0.content`), newContent, {
        shouldDirty: true,
      });
      toast.success("Parâmetros do gabarito atualizados!");
    }
  };

  const handleResetSolution = () => {
    const starter = getValues(getName("starterCode"));
    if (starter && starter.length > 0) {
      replaceSolution(cleanCopy(starter));
      toast.info("Solução reiniciada para o código original do template.");
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
    const solutionCode = getValues(getName("solutionCode"));
    const testCases = getValues(getName("testCases"));
    const parameters = getValues(getName("parameters"));
    const returnType = getValues(getName("returnType"));

    if (!solutionCode?.length)
      return toast.error("Escreva uma solução de referência.");
    if (!testCases?.length) return toast.error("Adicione casos de teste.");

    setIsRunning(true);
    setRunResults(null);

    const sanitize = (list: any[]) =>
      list?.map(({ id, ...rest }: any) => rest) || [];

    try {
      const result = await dryRunProblem({
        starterCode: sanitize(solutionCode),
        testCases: sanitize(testCases),
        parameters: sanitize(parameters),
        returnType,
        language: getLanguageFromExt(solutionCode[0].name),
      });

      setRunResults(result);
      if (result.success) toast.success("Solução válida!");
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
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10 w-full">
      {/* SEÇÃO 1: EDITOR DO GABARITO */}
      <div
        className={`flex flex-col gap-3 transition-all duration-300 ${
          isSolutionFullscreen
            ? "fixed inset-0 z-50 bg-[#0d1117] p-6 h-screen w-screen"
            : "w-full"
        }`}
      >
        <div className="border-b border-border pb-2 flex justify-between items-end flex-none">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Code2 className="text-primary" size={20} />
                {isSolutionFullscreen
                  ? "Edição: Gabarito"
                  : "Solução de Referência"}
              </h3>
              {!isSolutionFullscreen && (
                <p className="text-sm text-muted">Código validador (oculto).</p>
              )}
            </div>
            {parameters.length > 0 && (
              <button
                onClick={handleSyncParams}
                disabled={!isParamsOutOfSync}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded text-[10px] border",
                  isParamsOutOfSync
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    : "bg-surface-hover text-muted border-transparent opacity-50",
                )}
              >
                <RefreshCw size={12} />{" "}
                {isParamsOutOfSync ? "Sincronizar" : "Sincronizado"}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSolutionFullscreen(!isSolutionFullscreen)}
              className="text-muted hover:text-white p-1.5 rounded hover:bg-white/10"
            >
              {isSolutionFullscreen ? (
                <Minimize2 size={18} />
              ) : (
                <Maximize2 size={18} />
              )}
            </button>
            <button
              onClick={handleResetSolution}
              className="text-xs text-muted hover:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-white/5"
            >
              <RotateCcw size={12} /> Restaurar
            </button>
          </div>
        </div>
        <div
          className={`border border-border rounded-md overflow-hidden bg-surface flex flex-col w-full shadow-lg ${
            isSolutionFullscreen ? "flex-1" : "h-[500px]"
          }`}
        >
          <div className="flex bg-background/50 overflow-x-auto flex-none">
            {solutionFields.map((field, index) => (
              <div
                key={field.id}
                onClick={() => setActiveSolutionTab(index)}
                className={cn(
                  "px-4 py-2 text-sm cursor-pointer border-r border-border select-none",
                  index === activeSolutionTab
                    ? "bg-surface text-white border-t-2 border-t-primary"
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
                <div className="absolute inset-0 flex items-center justify-center text-muted gap-2">
                  <Loader2 className="animate-spin" /> Carregando...
                </div>
              }
            >
              {solutionFields.length > 0 &&
                solutionFields[activeSolutionTab] && (
                  <Controller
                    control={control}
                    name={getName(`solutionCode.${activeSolutionTab}.content`)}
                    render={({ field }) => (
                      <div className="absolute inset-0">
                        <Editor
                          key={`${solutionFields[activeSolutionTab].id}-${watch(
                            getName(`solutionCode.${activeSolutionTab}.name`),
                          )}`}
                          height="100%"
                          width="100%"
                          theme="vs-dark"
                          path={`sol-${basePath}-${solutionFields[activeSolutionTab].id}`}
                          language={getLanguageFromExt(
                            watch(
                              getName(`solutionCode.${activeSolutionTab}.name`),
                            ) || "",
                          )}
                          value={field.value}
                          onChange={(value) => field.onChange(value)}
                          options={{
                            minimap: { enabled: false },
                            fontSize: isSolutionFullscreen ? 16 : 14,
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

      {/* SEÇÃO 2: CASOS DE TESTE */}
      <div className="flex flex-col gap-4 w-full">
        <div className="flex justify-between items-end border-b border-border pb-2">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <FlaskConical className="text-primary" size={20} /> Testes
          </h3>
          <div className="flex gap-2">
            <button
              onClick={handleExportTests}
              className="px-3 py-1.5 border border-border rounded text-muted hover:text-white"
            >
              <FileJson size={16} />
            </button>
            <button
              onClick={handleDryRun}
              disabled={isRunning}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded border transition-colors",
                isRunning
                  ? "bg-surface border-border text-muted"
                  : "bg-primary/10 border-primary text-primary hover:bg-primary hover:text-primary-foreground",
              )}
            >
              {isRunning ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Play size={16} />
              )}{" "}
              {isRunning ? "Validando..." : "Validar"}
            </button>
            <button
              onClick={() =>
                appendTest({ input: "", expectedOutput: "", isHidden: false })
              }
              className="bg-surface hover:bg-surface-hover text-white px-3 py-1.5 rounded flex items-center gap-1 border border-border transition-colors"
            >
              <Plus size={16} /> Add
            </button>
          </div>
        </div>

        {/* RESULTADOS DA EXECUÇÃO */}
        {runResults && (
          <div
            className={cn(
              "border rounded p-3",
              runResults.success
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-destructive/50 bg-destructive/10 text-destructive",
            )}
          >
            <div className="flex items-center gap-2 font-bold mb-2">
              {runResults.success ? (
                <CheckCircle size={18} />
              ) : (
                <XCircle size={18} />
              )}
              {runResults.success ? "Sucesso!" : "Falha nos testes."}
            </div>
            {!runResults.success && runResults.results && (
              <div className="flex flex-col gap-2 mt-2">
                {runResults.results
                  .filter((r: any) => r.status !== "ACCEPTED")
                  .map((res: any, i: number) => (
                    <div
                      key={i}
                      className="bg-black/40 p-2 rounded text-xs border border-destructive/30"
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

        {/* LISTA DE TESTES (Fonte Aumentada) */}
        {testFields.map((field, index) => {
          const expectedError = getError(
            getName(`testCases.${index}.expectedOutput`),
          );

          return (
            <div
              key={field.id}
              className="bg-surface border border-border rounded-lg p-4 relative group"
            >
              <div className="flex justify-between mb-2">
                <span className="text-sm bg-background px-2 py-0.5 rounded text-muted font-medium">
                  Case #{index + 1}
                </span>
                <button
                  onClick={() => removeTest(index)}
                  className="text-muted hover:text-destructive"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs uppercase font-bold text-muted">
                    Input
                  </label>
                  <textarea
                    {...register(getName(`testCases.${index}.input`))}
                    className="bg-background border border-border rounded p-2 text-base text-zinc-300 font-mono w-full resize-none outline-none focus:border-primary transition-all"
                    placeholder="Input"
                    rows={2}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs uppercase font-bold text-muted">
                    Output
                  </label>
                  <textarea
                    {...register(getName(`testCases.${index}.expectedOutput`))}
                    className={cn(
                      "bg-background border rounded p-2 text-base text-zinc-300 font-mono w-full resize-none outline-none transition-all",
                      expectedError
                        ? "border-destructive focus:border-destructive"
                        : "border-border focus:border-primary",
                    )}
                    placeholder="Output"
                    rows={2}
                  />
                  {expectedError && (
                    <span className="text-destructive text-xs">
                      {expectedError.message as string}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-2 flex items-center">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-muted hover:text-zinc-300 select-none">
                  <input
                    type="checkbox"
                    {...register(getName(`testCases.${index}.isHidden`))}
                    className="rounded bg-background border-border text-primary focus:ring-0 focus:ring-offset-0 w-3 h-3"
                  />
                  <span>Ocultar este caso de teste dos alunos?</span>
                  {watch(getName(`testCases.${index}.isHidden`)) && (
                    <EyeOff size={12} className="text-yellow-500" />
                  )}
                </label>
              </div>
            </div>
          );
        })}
        {testFields.length === 0 && (
          <div className="text-center py-8 text-muted border border-dashed border-border rounded-lg">
            Nenhum caso de teste adicionado.
          </div>
        )}
      </div>
    </div>
  );
}
