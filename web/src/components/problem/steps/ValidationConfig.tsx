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
} from "lucide-react";
import { dryRunProblem } from "../../../lib/api";
import { toast } from "sonner";

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
  const { register, control, getValues, setValue, watch } = useFormContext();

  const [isRunning, setIsRunning] = useState(false);
  const [runResults, setRunResults] = useState<any>(null);
  const [activeSolutionTab, setActiveSolutionTab] = useState(0);
  const [isSolutionFullscreen, setIsSolutionFullscreen] = useState(false);

  const getName = (name: string) => (basePath ? `${basePath}.${name}` : name);

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

  // --- SINCRONIZAÇÃO SCADFFOLDING -> VALIDATION ---
  useEffect(() => {
    const currentStarter = starterCode || [];
    if (currentStarter.length === 0) return;

    const currentSolution = getValues(getName("solutionCode")) || [];

    // 1. Inicializa se estiver vazio
    if (currentSolution.length === 0) {
      replaceSolution(cleanCopy(currentStarter));
      return;
    }

    // 2. Verifica Mismatches
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

    // 3. Aplica sincronização se necessário
    if (hasLangMismatch || hasStructureMismatch) {
      replaceSolution(cleanCopy(currentStarter));

      if (hasLangMismatch) {
        toast.info(`Gabarito atualizado para ${starterLang} (Sincronizado).`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(starterCode), replaceSolution, getValues, getName]);
  // ^^^ O JSON.stringify aqui é OBRIGATÓRIO para detectar a mudança feita pelo setValue no outro componente.

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSolutionFullscreen)
        setIsSolutionFullscreen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isSolutionFullscreen]);

  // Lógica de DryRun e Parâmetros (inalterada)
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
      navigator.clipboard.writeText(JSON.stringify(tests, null, 2));
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
    try {
      const result = await dryRunProblem({
        starterCode: solutionCode,
        testCases,
        parameters,
        returnType,
        language: getLanguageFromExt(solutionCode[0].name),
      });
      setRunResults(result);
      if (result.success) toast.success("Solução válida!");
      else toast.warning("Solução falhou em alguns testes.");
    } catch (error) {
      console.error(error);
      toast.error("Erro na execução.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10 w-full">
      <div
        className={`flex flex-col gap-3 transition-all duration-300 ${isSolutionFullscreen ? "fixed inset-0 z-50 bg-[#0d1117] p-6 h-screen w-screen" : "w-full"}`}
      >
        <div className="border-b border-gray-800 pb-2 flex justify-between items-end flex-none">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Code2 className="text-green-500" size={20} />
                {isSolutionFullscreen
                  ? "Edição: Gabarito"
                  : "Solução de Referência"}
              </h3>
              {!isSolutionFullscreen && (
                <p className="text-sm text-gray-400">
                  Código validador (oculto).
                </p>
              )}
            </div>
            {parameters.length > 0 && (
              <button
                onClick={handleSyncParams}
                disabled={!isParamsOutOfSync}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] border ${isParamsOutOfSync ? "bg-amber-500/10 text-amber-400 border-amber-500/30" : "bg-gray-800 text-gray-500 border-transparent opacity-50"}`}
              >
                <RefreshCw size={12} />{" "}
                {isParamsOutOfSync ? "Sincronizar" : "Sincronizado"}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSolutionFullscreen(!isSolutionFullscreen)}
              className="text-gray-400 hover:text-white p-1.5 rounded hover:bg-white/10"
            >
              {isSolutionFullscreen ? (
                <Minimize2 size={18} />
              ) : (
                <Maximize2 size={18} />
              )}
            </button>
            <button
              onClick={handleResetSolution}
              className="text-xs text-gray-500 hover:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-white/5"
            >
              <RotateCcw size={12} /> Restaurar
            </button>
          </div>
        </div>
        <div
          className={`border border-gray-800 rounded-md overflow-hidden bg-[#1e1e1e] flex flex-col w-full shadow-lg ${isSolutionFullscreen ? "flex-1" : "h-[500px]"}`}
        >
          <div className="flex bg-[#252526] overflow-x-auto flex-none">
            {solutionFields.map((field, index) => (
              <div
                key={field.id}
                onClick={() => setActiveSolutionTab(index)}
                className={`px-4 py-2 text-sm cursor-pointer border-r border-gray-800 select-none ${index === activeSolutionTab ? "bg-[#1e1e1e] text-white border-t-2 border-t-green-500" : "text-gray-500 hover:bg-[#2a2d2e]"}`}
              >
                {watch(getName(`solutionCode.${index}.name`))}
              </div>
            ))}
          </div>
          <div className="flex-1 relative min-h-0">
            <Suspense
              fallback={
                <div className="absolute inset-0 flex items-center justify-center text-gray-500 gap-2">
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
                          key={`${solutionFields[activeSolutionTab].id}-${watch(getName(`solutionCode.${activeSolutionTab}.name`))}`}
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
      {/* (Código de testes mantido, apenas encurtado na visualização) */}
      <div className="flex flex-col gap-4 w-full">
        <div className="flex justify-between items-end border-b border-gray-800 pb-2">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <FlaskConical className="text-orange-500" size={20} /> Testes
          </h3>
          <div className="flex gap-2">
            <button
              onClick={handleExportTests}
              className="px-3 py-1.5 border border-gray-700 rounded text-gray-400 hover:text-white"
            >
              <FileJson size={16} />
            </button>
            <button
              onClick={handleDryRun}
              disabled={isRunning}
              className={`flex items-center gap-2 px-4 py-1.5 rounded border ${isRunning ? "bg-gray-800 border-gray-700 text-gray-500" : "bg-green-600/10 border-green-600 text-green-500 hover:bg-green-600 hover:text-white"}`}
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
              className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded flex items-center gap-1"
            >
              <Plus size={16} /> Add
            </button>
          </div>
        </div>
        {runResults && (
          <div
            className={`border rounded p-3 ${runResults.success ? "border-green-800 bg-green-950/20 text-green-400" : "border-red-800 bg-red-950/20 text-red-400"}`}
          >
            <div className="flex items-center gap-2 font-bold mb-2">
              {runResults.success ? (
                <CheckCircle size={18} />
              ) : (
                <XCircle size={18} />
              )}
              {runResults.success ? "Sucesso!" : "Falha nos testes."}
            </div>
          </div>
        )}
        {testFields.map((field, index) => (
          <div
            key={field.id}
            className="bg-gray-900 border border-gray-800 rounded-lg p-4 relative group"
          >
            <div className="flex justify-between mb-2">
              <span className="text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-500">
                Case #{index + 1}
              </span>
              <button
                onClick={() => removeTest(index)}
                className="text-gray-600 hover:text-red-500"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <textarea
                {...register(getName(`testCases.${index}.input`))}
                className="bg-black/20 border border-gray-700 rounded p-2 text-sm text-gray-300 font-mono w-full"
                placeholder="Input"
                rows={2}
              />
              <textarea
                {...register(getName(`testCases.${index}.expectedOutput`))}
                className="bg-black/20 border border-gray-700 rounded p-2 text-sm text-gray-300 font-mono w-full"
                placeholder="Output"
                rows={2}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
