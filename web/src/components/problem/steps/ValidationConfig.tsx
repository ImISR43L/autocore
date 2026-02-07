import { useState, useEffect, Suspense, lazy, useMemo } from "react";
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
  RefreshCw,
} from "lucide-react";
import { dryRunProblem } from "../../../lib/api";
import { toast } from "sonner";
import { Button } from "../../ui/Button";
import { cn } from "../../../lib/utils";

// Editor Lazy Loading
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
  } = useFieldArray({ control, name: getName("testCases") });
  const { fields: solutionFields, replace: replaceSolution } = useFieldArray({
    control,
    name: getName("solutionCode"),
  });

  const starterCode = watch(getName("starterCode"));
  const parameters = watch(getName("parameters")) || [];
  const firstSolutionContent = watch(getName(`solutionCode.0.content`));
  const firstSolutionName = watch(getName(`solutionCode.0.name`));

  const cleanCopy = (files: any[]) =>
    JSON.parse(JSON.stringify(files)).map(({ id, ...rest }: any) => rest);

  // Lógica de Sincronização Automática do Gabarito (Mantida)
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

    if (starterLang !== solutionLang) {
      replaceSolution(cleanCopy(currentStarter));
      toast.info(`Gabarito atualizado para ${starterLang} (Sincronizado).`);
    }
  }, [JSON.stringify(starterCode), replaceSolution, getValues, getName]);

  const currentLang = useMemo(
    () => getLanguageFromExt(firstSolutionName || ""),
    [firstSolutionName],
  );

  const expectedParamsString = useMemo(() => {
    if (!parameters || parameters.length === 0) return "";
    if (currentLang === "python" || currentLang === "javascript") {
      return parameters.map((p: any) => p.name).join(", ");
    }
    // Lógica simplificada para cpp neste contexto de display, mantendo a original se precisar
    return "";
  }, [parameters, currentLang]);

  const isParamsOutOfSync = useMemo(() => {
    if (!firstSolutionContent) return false;
    let regex: RegExp;
    if (currentLang === "python") regex = /def\s+solve\s*\(([^)]*)\)/;
    else if (currentLang === "javascript")
      regex = /function\s+solve\s*\(([^)]*)\)/;
    else return false;

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
    else return;

    const newContent = firstSolutionContent.replace(
      regex,
      `$1${expectedParamsString}$3`,
    );
    setValue(getName(`solutionCode.0.content`), newContent, {
      shouldDirty: true,
    });
    toast.success("Parâmetros do gabarito atualizados!");
  };

  const handleResetSolution = () => {
    const starter = getValues(getName("starterCode"));
    if (starter && starter.length > 0) {
      replaceSolution(cleanCopy(starter));
      toast.info("Solução reiniciada.");
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
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full pb-8">
      {/* SEÇÃO 1: EDITOR DO GABARITO */}
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
              <Button
                size="sm"
                variant="outline"
                onClick={handleSyncParams}
                disabled={!isParamsOutOfSync}
                className="h-7 text-xs px-2"
              >
                <RefreshCw size={12} className="mr-1" />{" "}
                {isParamsOutOfSync ? "Sincronizar" : "Sincronizado"}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSolutionFullscreen(!isSolutionFullscreen)}
              className="p-2 text-muted hover:text-white transition-colors"
            >
              {isSolutionFullscreen ? (
                <Minimize2 size={18} />
              ) : (
                <Maximize2 size={18} />
              )}
            </button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleResetSolution}
              className="h-8 text-xs"
            >
              <RotateCcw size={12} className="mr-1" /> Restaurar
            </Button>
          </div>
        </div>

        <div
          className={cn(
            "border border-border rounded-md overflow-hidden bg-surface flex flex-col shadow-lg",
            isSolutionFullscreen ? "flex-1" : "h-[400px]",
          )}
        >
          <div className="flex bg-background/50 overflow-x-auto no-scrollbar flex-none border-b border-border">
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
                <div className="flex items-center justify-center h-full text-muted">
                  Carregando...
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
                          key={`${solutionFields[activeSolutionTab].id}`}
                          height="100%"
                          theme="vs-dark"
                          language={getLanguageFromExt(
                            watch(
                              getName(`solutionCode.${activeSolutionTab}.name`),
                            ) || "",
                          )}
                          value={field.value}
                          onChange={(value) => field.onChange(value)}
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

      {/* SEÇÃO 2: CASOS DE TESTE */}
      <div className="flex flex-col gap-6 w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b border-border pb-3 gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <FlaskConical className="text-primary" size={20} /> Testes &
              Validação
            </h3>
            <p className="text-xs text-muted mt-1">
              Defina entradas e saídas esperadas.
            </p>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportTests}
              title="Exportar JSON"
            >
              <FileJson size={16} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDryRun}
              disabled={isRunning}
              className="flex-1 sm:flex-none border-primary text-primary hover:bg-primary/10"
            >
              {isRunning ? (
                <Loader2 size={16} className="animate-spin mr-2" />
              ) : (
                <Play size={16} className="mr-2" />
              )}
              Validar Solução
            </Button>
            <Button
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
                {runResults.success ? "Sucesso!" : "Falha nos testes."}
              </span>
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
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-muted hover:text-zinc-300 select-none">
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
                      onClick={() => removeTest(index)}
                      className="text-muted hover:text-destructive transition-colors"
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
                      className="w-full bg-background border border-border rounded-md p-3 text-base text-zinc-100 font-mono resize-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all min-h-[80px]"
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
                        "w-full bg-background border rounded-md p-3 text-base text-zinc-100 font-mono resize-none focus:outline-none transition-all min-h-[80px]",
                        expectedError
                          ? "border-destructive focus:border-destructive"
                          : "border-border focus:border-primary focus:ring-1 focus:ring-primary/20",
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
            <div className="text-center py-12 border-2 border-dashed border-border rounded-xl bg-surface/30 text-muted">
              <FlaskConical size={32} className="mx-auto mb-2 opacity-50" />
              <p>Nenhum caso de teste adicionado.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  appendTest({ input: "", expectedOutput: "", isHidden: false })
                }
                className="mt-4"
              >
                Adicionar Primeiro Teste
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
