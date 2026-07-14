import { Suspense, lazy } from "react";
import { useFormContext } from "react-hook-form";
import { Database, ArrowUpDown } from "lucide-react";
import { Card } from "../../ui/Card";
import { useMonacoTheme } from "../../../hooks/useMonacoTheme";

const Editor = lazy(() => import("@monaco-editor/react"));

interface SqlSchemaConfigProps {
  basePath?: string;
}

export function SqlSchemaConfig({ basePath = "" }: SqlSchemaConfigProps) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext();
  const monacoTheme = useMonacoTheme();

  const getName = (name: string) => (basePath ? `${basePath}.${name}` : name);
  const getError = (path: string) =>
    path.split(".").reduce((obj, key) => obj?.[key], errors as any);

  const sqlSchemaValue = watch(getName("sqlSchema")) || "";
  const orderSensitive = watch(getName("sqlOrderSensitive")) || false;
  const schemaError = getError(getName("sqlSchema"));

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full">
      <Card className="p-4 flex flex-col gap-3 flex-1 min-h-[400px]">
        <div className="flex items-center gap-3 text-foreground border-b border-border pb-3">
          <div className="p-2 bg-primary/10 rounded-md text-primary">
            <Database size={18} />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider block text-muted">
              Gabarito Estrutural
            </span>
            <span className="text-sm font-semibold text-foreground">
              Schema de Referência (DDL)
            </span>
          </div>
        </div>

        <p className="text-xs text-muted leading-relaxed">
          Este DDL é executado em um schema efêmero e isolado antes de cada
          submissão (ver <code>SqlExecutorService</code> no backend). Defina
          aqui as tabelas contra as quais a consulta do aluno vai rodar —{" "}
          <code>CREATE TABLE</code>, chaves primárias e estrangeiras.
        </p>

        <div
          className={`flex-1 relative min-h-0 rounded-lg overflow-hidden border ${
            schemaError ? "border-destructive" : "border-border"
          }`}
        >
          <Suspense
            fallback={
              <div className="h-full flex items-center justify-center text-muted text-sm">
                Carregando editor...
              </div>
            }
          >
            <div className="absolute inset-0">
              <Editor
                height="100%"
                width="100%"
                theme={monacoTheme}
                language="sql"
                value={sqlSchemaValue}
                onChange={(value) =>
                  setValue(getName("sqlSchema"), value || "", {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                options={{
                  minimap: { enabled: false },
                  automaticLayout: true,
                  fontSize: 14,
                  scrollBeyondLastLine: false,
                  padding: { top: 16 },
                }}
              />
            </div>
          </Suspense>
        </div>
        {schemaError && (
          <span className="text-xs text-destructive">
            {schemaError.message as string}
          </span>
        )}
        {/* Campo continua registrado no form mesmo controlado via setValue
            acima, para o resolver do zod enxergar o valor no submit. */}
        <input type="hidden" {...register(getName("sqlSchema"))} />
      </Card>

      <Card className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-md text-primary">
            <ArrowUpDown size={18} />
          </div>
          <div>
            <span className="text-sm font-semibold text-foreground block">
              Comparação sensível à ordem
            </span>
            <span className="text-xs text-muted">
              Ative se o exercício exige <code>ORDER BY</code> explícito no
              resultado. Desativado (padrão): duas queries que retornam as
              mesmas linhas em ordens diferentes são consideradas equivalentes.
            </span>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={orderSensitive}
          onClick={() =>
            setValue(getName("sqlOrderSensitive"), !orderSensitive, {
              shouldDirty: true,
            })
          }
          className={`relative inline-flex h-6 w-11 flex-none items-center rounded-full transition-colors ${
            orderSensitive ? "bg-primary" : "bg-border"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              orderSensitive ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </Card>
    </div>
  );
}
