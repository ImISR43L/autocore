import { useState, useEffect, Suspense, lazy } from "react";
import { useFormContext, useFieldArray, Controller } from "react-hook-form";
import {
  FlaskConical,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Play,
  CheckCircle,
  XCircle,
  Loader2,
  FileJson,
  Code2,
  RotateCcw,
  Maximize2, // Novo
  Minimize2, // Novo
} from "lucide-react";
import { dryRunProblem } from "../../../lib/api";
import { toast } from "sonner";

const Editor = lazy(() => import("@monaco-editor/react"));

interface ValidationConfigProps {
  basePath?: string;
}

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

  // 1. Estado para Tela Cheia do Gabarito
  const [isSolutionFullscreen, setIsSolutionFullscreen] = useState(false);

  const getName = (name: string) => (basePath ? `${basePath}.${name}` : name);

  const getError = (path: string) => {
    return path.split(".").reduce((obj, key) => obj?.[key], errors as any);
  };

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

  // --- AUTO-SYNC ---
  useEffect(() => {
    const currentSolution = getValues(getName("solutionCode"));
    const starter = getValues(getName("starterCode"));

    if (
      (!currentSolution || currentSolution.length === 0) &&
      starter &&
      starter.length > 0
    ) {
      replaceSolution(JSON.parse(JSON.stringify(starter)));
    }
  }, []);

  // 2. Listener para sair com ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSolutionFullscreen) {
        setIsSolutionFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isSolutionFullscreen]);

  const handleResetSolution = () => {
    const starter = getValues(getName("starterCode"));
    if (starter && starter.length > 0) {
      setValue(getName("solutionCode"), JSON.parse(JSON.stringify(starter)));
      toast.info("Solução reiniciada para o código original do template.");
    } else {
      toast.error("Não há código inicial definido para restaurar.");
    }
  };

  const handleExportTests = () => {
    const tests = getValues(getName("testCases"));
    if (tests && tests.length > 0) {
      navigator.clipboard.writeText(JSON.stringify(tests, null, 2));
      toast.success("Casos de teste copiados (JSON)!");
    } else {
      toast.warning("Nenhum caso de teste para exportar.");
    }
  };

  const handleDryRun = async () => {
    const solutionCode = getValues(getName("solutionCode"));
    const testCases = getValues(getName("testCases"));
    const parameters = getValues(getName("parameters"));
    const returnType = getValues(getName("returnType"));

    if (!solutionCode || solutionCode.length === 0)
      return toast.error("Escreva uma solução de referência para testar.");
    if (!testCases || testCases.length === 0)
      return toast.error("Adicione pelo menos um caso de teste.");

    setIsRunning(true);
    setRunResults(null);

    try {
      const result = await dryRunProblem({
        starterCode: solutionCode,
        testCases,
        parameters,
        returnType,
        language: "python", // TODO: Dinâmico
      });

      setRunResults(result);
      if (result.success)
        toast.success("Solução válida! Todos os testes passaram.");
      else toast.warning("A solução falhou em alguns testes.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao executar Dry Run.");
    } finally {
      setIsRunning(false);
    }
  };

  const getLanguageFromExt = (filename: string) => {
    if (filename?.endsWith(".js")) return "javascript";
    if (filename?.endsWith(".py")) return "python";
    if (filename?.endsWith(".cpp")) return "cpp";
    return "plaintext";
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10 w-full">
      {/* --- SEÇÃO 1: SOLUÇÃO DE REFERÊNCIA (Com suporte a Fullscreen) --- */}
      <div
        className={`
            flex flex-col gap-3 transition-all duration-300
            ${
              isSolutionFullscreen
                ? "fixed inset-0 z-50 bg-[#0d1117] p-6 h-screen w-screen" // Modo Focado
                : "w-full" // Modo Normal
            }
        `}
      >
        <div className="border-b border-gray-800 pb-2 flex justify-between items-end flex-none">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Code2 className="text-green-500" size={20} />
              {isSolutionFullscreen
                ? "Modo de Edição: Gabarito"
                : "Solução de Referência (Gabarito)"}
            </h3>
            {!isSolutionFullscreen && (
              <p className="text-sm text-gray-400">
                Código para validação (invisível para o aluno).
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Botão de Toggle Fullscreen */}
            <button
              type="button"
              onClick={() => setIsSolutionFullscreen(!isSolutionFullscreen)}
              className="text-gray-400 hover:text-white p-1.5 rounded hover:bg-white/10 transition-colors"
              title={
                isSolutionFullscreen
                  ? "Sair da Tela Cheia (Esc)"
                  : "Expandir Editor"
              }
            >
              {isSolutionFullscreen ? (
                <Minimize2 size={18} />
              ) : (
                <Maximize2 size={18} />
              )}
            </button>

            <button
              type="button"
              onClick={handleResetSolution}
              className="text-xs text-gray-500 hover:text-white flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-white/5"
              title="Restaurar código do template"
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
                className={`px-4 py-2 text-sm cursor-pointer border-r border-gray-800 select-none ${
                  index === activeSolutionTab
                    ? "bg-[#1e1e1e] text-white border-t-2 border-t-green-500"
                    : "text-gray-500 hover:bg-[#2a2d2e]"
                }`}
              >
                {watch(getName(`solutionCode.${index}.name`))}
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
              {solutionFields.length > 0 &&
                solutionFields[activeSolutionTab] && (
                  <Controller
                    control={control}
                    name={getName(`solutionCode.${activeSolutionTab}.content`)}
                    render={({ field }) => (
                      <div className="absolute inset-0">
                        <Editor
                          height="100%"
                          width="100%"
                          theme="vs-dark"
                          path={`solution-${basePath ? basePath + "-" : ""}${solutionFields[activeSolutionTab].id}`}
                          language={getLanguageFromExt(
                            watch(
                              getName(`solutionCode.${activeSolutionTab}.name`),
                            ) || "",
                          )}
                          value={field.value}
                          onChange={(value) => field.onChange(value)}
                          options={{
                            minimap: { enabled: false },
                            fontSize: isSolutionFullscreen ? 16 : 14, // Fonte maior no foco
                            scrollBeyondLastLine: false,
                            padding: { top: 16 },
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

        {isSolutionFullscreen && (
          <p className="text-xs text-gray-500 flex-none text-center">
            Pressione ESC para sair do modo tela cheia.
          </p>
        )}
      </div>

      {/* --- SEÇÃO 2: CASOS DE TESTE --- */}
      <div className="flex flex-col gap-4 w-full">
        {/* ... (Conteúdo de Testes inalterado) ... */}
        <div className="flex justify-between items-end border-b border-gray-800 pb-2">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <FlaskConical className="text-orange-500" size={20} />
              Gerenciador de Testes
            </h3>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleExportTests}
              className="flex items-center gap-1 text-sm border border-gray-700 text-gray-400 hover:text-white px-3 py-1.5 rounded transition-colors"
              title="Copiar JSON"
            >
              <FileJson size={16} />
            </button>

            <button
              type="button"
              onClick={handleDryRun}
              disabled={isRunning}
              className={`flex items-center gap-2 text-sm font-medium border px-4 py-1.5 rounded transition-all shadow-lg
                    ${
                      isRunning
                        ? "border-gray-700 bg-gray-800 text-gray-500 cursor-wait"
                        : "border-green-600 bg-green-600/10 text-green-500 hover:bg-green-600 hover:text-white"
                    }`}
            >
              {isRunning ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Play size={16} fill="currentColor" />
              )}
              {isRunning ? "Validando..." : "Validar (Dry Run)"}
            </button>

            <button
              type="button"
              onClick={() =>
                appendTest({ input: "", expectedOutput: "", isHidden: false })
              }
              className="flex items-center gap-1 text-sm bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded transition-colors"
            >
              <Plus size={16} /> Add
            </button>
          </div>
        </div>

        {/* Resultados do Dry Run */}
        {runResults && (
          <div
            className={`border rounded-lg overflow-hidden animate-in zoom-in-95 duration-300 w-full ${
              runResults.success
                ? "border-green-800 bg-green-950/20"
                : "border-red-800 bg-red-950/20"
            }`}
          >
            <div
              className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b ${
                runResults.success
                  ? "border-green-800 text-green-400"
                  : "border-red-800 text-red-400"
              }`}
            >
              {runResults.success ? (
                <CheckCircle size={18} />
              ) : (
                <XCircle size={18} />
              )}
              {runResults.success
                ? "Sucesso: A solução passou em todos os testes."
                : "Falha: Revise a solução ou outputs."}
            </div>
            {!runResults.success && (
              <div className="max-h-60 overflow-y-auto p-2 flex flex-col gap-2">
                {runResults.results
                  .filter((r: any) => r.status !== "ACCEPTED")
                  .map((res: any, idx: number) => (
                    <div
                      key={idx}
                      className="text-xs bg-black/40 rounded p-2 border border-red-900/30"
                    >
                      <div className="font-bold text-red-400 mb-1 flex items-center gap-1">
                        <XCircle size={12} /> Caso #{idx + 1} (Input:{" "}
                        {res.input})
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-gray-500">Esperado:</span>{" "}
                          <pre className="text-gray-300">
                            {res.expectedOutput}
                          </pre>
                        </div>
                        <div>
                          <span className="text-gray-500">Recebido:</span>{" "}
                          <pre className="text-yellow-300">
                            {res.actualOutput}
                          </pre>
                        </div>
                      </div>
                      {res.error && (
                        <div className="mt-1 text-red-400 font-mono bg-red-950/30 p-1">
                          {res.error}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Lista de Testes */}
        <div className="flex flex-col gap-4 w-full">
          {testFields.map((field, index) => {
            const expectedError = getError(
              getName(`testCases.${index}.expectedOutput`),
            );

            return (
              <div
                key={field.id}
                className="bg-gray-900 border border-gray-800 rounded-lg p-4 relative group w-full shadow-sm hover:border-gray-700 transition-colors"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-mono text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
                    Case #{index + 1}
                  </span>
                  <div className="flex gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-400 hover:text-white">
                      <input
                        type="checkbox"
                        {...register(getName(`testCases.${index}.isHidden`))}
                        className="peer hidden"
                      />
                      <span className="peer-checked:hidden flex items-center gap-1">
                        <Eye size={14} /> Público
                      </span>
                      <span className="hidden peer-checked:flex items-center gap-1 text-yellow-500">
                        <EyeOff size={14} /> Oculto
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => removeTest(index)}
                      className="text-gray-600 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 w-full">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-gray-500">
                      Input
                    </label>
                    <textarea
                      {...register(getName(`testCases.${index}.input`))}
                      rows={2}
                      className="w-full bg-black/20 border border-gray-700 rounded p-2 text-sm text-gray-300 font-mono outline-none focus:border-orange-500 resize-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-gray-500">
                      Output
                    </label>
                    <textarea
                      {...register(
                        getName(`testCases.${index}.expectedOutput`),
                      )}
                      rows={2}
                      className={`w-full bg-black/20 border ${expectedError ? "border-red-500" : "border-gray-700"} rounded p-2 text-sm text-gray-300 font-mono outline-none focus:border-orange-500 resize-none`}
                    />
                    {expectedError && (
                      <span className="text-red-500 text-xs">
                        {expectedError.message as string}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {testFields.length === 0 && (
            <div className="text-center py-4 text-gray-500 text-sm">
              Nenhum caso de teste.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
