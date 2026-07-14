import { Suspense, lazy, useState } from "react";
import { useFieldArray, useFormContext, Controller } from "react-hook-form";
import {
  FlaskConical,
  Plus,
  Trash2,
  Play,
  Loader2,
  EyeOff,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../ui/Button";
import { cn } from "../../../lib/utils";
import { useMonacoTheme } from "../../../hooks/useMonacoTheme";
import { dryRunSqlTestCase } from "../../../lib/api";

const Editor = lazy(() => import("@monaco-editor/react"));

interface SqlValidationConfigProps {
  basePath?: string;
}

export function SqlValidationConfig({
  basePath = "",
}: SqlValidationConfigProps) {
  const {
    control,
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext();
  const monacoTheme = useMonacoTheme();
  const [runningIndex, setRunningIndex] = useState<number | null>(null);
  const [referenceQuery, setReferenceQuery] = useState("");

  const getName = (name: string) => (basePath ? `${basePath}.${name}` : name);
  const getError = (path: string) =>
    path.split(".").reduce((obj, key) => obj?.[key], errors as any);

  const { fields, append, remove } = useFieldArray({
    control,
    name: getName("testCases"),
  });

  const sqlSchema = watch(getName("sqlSchema")) || "";

  const handleAddTestCase = () => {
    append({
      input: "-- sem seed adicional além do schema base",
      expectedOutput: "[]",
      isHidden: false,
    });
  };

  const handleDryRun = async (index: number) => {
    if (!referenceQuery.trim()) {
      toast.error("Escreva a consulta de gabarito antes de rodar.");
      return;
    }
    if (!sqlSchema.trim()) {
      toast.error("Defina o schema de referência (DDL) primeiro.");
      return;
    }

    setRunningIndex(index);
    try {
      const result = await dryRunSqlTestCase({
        sqlSchema,
        seedDml: watch(getName(`testCases.${index}.input`)),
        referenceQuery,
      });

      if (!result.success) {
        toast.error(
          result.error || `Erro ao rodar a consulta (${result.status}).`,
        );
        return;
      }

      setValue(
        getName(`testCases.${index}.expectedOutput`),
        JSON.stringify(result.rows ?? [], null, 2),
        { shouldValidate: true, shouldDirty: true },
      );
      toast.success(
        `Gabarito rodado: ${result.rows?.length ?? 0} linha(s) capturada(s).`,
      );
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Erro ao rodar a consulta de gabarito.",
      );
    } finally {
      setRunningIndex(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-2">
        <label className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Play size={16} className="text-primary" />
          Consulta de Gabarito (opcional, só para o dry-run)
        </label>
        <p className="text-xs text-muted">
          Não é salva no problema — serve só para gerar o resultado esperado de
          cada caso de teste abaixo.
        </p>
        <textarea
          value={referenceQuery}
          onChange={(e) => setReferenceQuery(e.target.value)}
          placeholder="SELECT id, nome FROM clientes WHERE ..."
          rows={3}
          className="font-mono text-sm bg-background border border-border rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>

      <div className="flex justify-between items-center border-b border-border pb-3">
        <div>
          <label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FlaskConical size={16} /> Casos de Teste
          </label>
          <p className="text-xs text-muted mt-1">
            Cada caso roda contra o schema base + o seed DML abaixo (se houver).
          </p>
        </div>
        <Button type="button" size="sm" onClick={handleAddTestCase}>
          <Plus size={14} className="mr-2" /> Adicionar Caso
        </Button>
      </div>

      {getError(getName("testCases")) &&
        !Array.isArray(getError(getName("testCases"))) && (
          <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
            <AlertTriangle size={14} />
            {getError(getName("testCases"))?.message as string}
          </div>
        )}

      <div className="flex flex-col gap-4">
        {fields.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border rounded-lg bg-surface/30">
            <p className="text-sm text-muted font-medium">
              Nenhum caso de teste definido
            </p>
          </div>
        )}

        {fields.map((field, index) => {
          const caseError = (getError(getName("testCases")) as any)?.[index];

          return (
            <div
              key={field.id}
              className={cn(
                "border rounded-lg bg-surface/50 p-4 flex flex-col gap-3",
                caseError ? "border-destructive/50" : "border-border",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  Caso {index + 1}
                </span>
                <div className="flex items-center gap-3">
                  <Controller
                    control={control}
                    name={getName(`testCases.${index}.isHidden`)}
                    render={({ field: hiddenField }) => (
                      <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!hiddenField.value}
                          onChange={(e) =>
                            hiddenField.onChange(e.target.checked)
                          }
                        />
                        <EyeOff size={12} /> Oculto
                      </label>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDryRun(index)}
                    disabled={runningIndex === index}
                    title="Rodar consulta de gabarito contra este caso"
                  >
                    {runningIndex === index ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Play size={14} />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => remove(index)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted uppercase tracking-wider">
                    Seed DML (opcional, além do schema base)
                  </label>
                  <div className="h-40 relative border border-border rounded-md overflow-hidden">
                    <Suspense
                      fallback={
                        <div className="h-full flex items-center justify-center text-muted text-xs">
                          Carregando...
                        </div>
                      }
                    >
                      <Controller
                        control={control}
                        name={getName(`testCases.${index}.input`)}
                        render={({ field: inputField }) => (
                          <div className="absolute inset-0">
                            <Editor
                              height="100%"
                              width="100%"
                              theme={monacoTheme}
                              language="sql"
                              value={inputField.value}
                              onChange={(value) =>
                                inputField.onChange(value || "")
                              }
                              options={{
                                minimap: { enabled: false },
                                fontSize: 13,
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                              }}
                            />
                          </div>
                        )}
                      />
                    </Suspense>
                  </div>
                  {caseError?.input && (
                    <span className="text-xs text-destructive">
                      {caseError.input.message}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted uppercase tracking-wider">
                    Resultado Esperado (JSON)
                  </label>
                  <textarea
                    {...register(getName(`testCases.${index}.expectedOutput`))}
                    rows={7}
                    placeholder='[{"id": 1, "nome": "Ana"}]'
                    className="font-mono text-xs bg-background border border-border rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  {caseError?.expectedOutput && (
                    <span className="text-xs text-destructive">
                      {caseError.expectedOutput.message}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
