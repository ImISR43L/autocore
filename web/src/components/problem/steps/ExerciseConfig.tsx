import { useFieldArray, useFormContext } from "react-hook-form";
import { Plus, Trash2, Type, CalendarClock, Settings2 } from "lucide-react"; // Importar CalendarClock
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { Select } from "../../ui/Select";
import { Card } from "../../ui/Card";

interface ExerciseConfigProps {
  basePath?: string;
}

export function ExerciseConfig({ basePath = "" }: ExerciseConfigProps) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext();

  const getName = (name: string) => (basePath ? `${basePath}.${name}` : name);

  const getError = (path: string) => {
    return path.split(".").reduce((obj, key) => obj?.[key], errors as any);
  };

  const { fields, append, remove } = useFieldArray({
    control,
    name: getName("parameters"),
  });

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full">
        {/* --- Coluna 1: Parâmetros (Ocupa 2/3 no desktop) --- */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* ... (Código da lista de parâmetros mantém igual) ... */}
          <div className="flex flex-wrap justify-between items-end border-b border-border pb-3 gap-3">
            <div>
              <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                Parâmetros de Entrada
              </label>
              <p className="text-xs text-muted mt-1">
                Argumentos que a função receberá.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => append({ name: "", type: "int" })}
              className="w-full sm:w-auto"
            >
              <Plus size={14} className="mr-2" /> Adicionar
            </Button>
          </div>

          <div className="flex flex-col gap-3">
            {fields.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border rounded-lg bg-surface/30">
                <p className="text-sm text-muted font-medium">
                  Nenhum parâmetro definido
                </p>
                <p className="text-xs text-muted mt-1">
                  A função será void() (sem argumentos).
                </p>
              </div>
            )}

            {fields.map((field, index) => {
              const nameError = getError(getName(`parameters.${index}.name`));

              return (
                <div
                  key={field.id}
                  className="group flex flex-col sm:flex-row gap-3 items-start animate-in slide-in-from-left-2 duration-300 bg-surface/50 sm:bg-transparent p-3 sm:p-0 rounded-lg border sm:border-0 border-border"
                >
                  <div className="w-full sm:flex-1">
                    <Input
                      {...register(getName(`parameters.${index}.name`))}
                      placeholder="nome_da_variavel"
                      error={nameError?.message as string}
                      className="font-mono bg-background"
                    />
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto">
                    <div className="flex-1 sm:w-40">
                      <Select
                        {...register(getName(`parameters.${index}.type`))}
                        className="font-mono bg-background"
                      >
                        <option value="int">Integer (int)</option>
                        <option value="float">Float</option>
                        <option value="string">String</option>
                        <option value="boolean">Boolean</option>
                        <option value="int[]">Array (int[])</option>
                        <option value="string[]">Array (string[])</option>
                        <option value="float[]">Array (float[])</option>
                        <option value="boolean[]">Array (boolean[])</option>
                      </Select>
                    </div>

                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => remove(index)}
                      className="px-3"
                      title="Remover parâmetro"
                    >
                      <Trash2 size={18} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* --- Coluna 2: Configurações Laterais --- */}
        <div className="lg:col-span-1 space-y-6">
          {/* Card Tipo de Retorno */}
          <Card className="p-6 flex flex-col gap-5">
            <div className="flex items-center gap-3 text-foreground border-b border-border pb-3">
              <div className="p-2 bg-primary/10 rounded-md text-primary">
                <Type size={18} />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider block text-muted">
                  Configuração
                </span>
                <span className="text-sm font-semibold text-foreground">
                  Saída da Função
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Select
                label="Tipo de Retorno"
                {...register(getName("returnType"))}
                className="font-mono bg-background"
              >
                <option value="void">Void (Sem retorno)</option>
                <option value="int">Integer (int)</option>
                <option value="float">Float</option>
                <option value="string">String</option>
                <option value="boolean">Boolean</option>
                <option value="int[]">Array (int[])</option>
                <option value="string[]">Array (string[])</option>
                <option value="float[]">Array (float[])</option>
                <option value="boolean[]">Array (boolean[])</option>
              </Select>

              <p className="text-[11px] text-muted leading-relaxed mt-1">
                O executor irá comparar o retorno com o{" "}
                <strong>Output Esperado</strong>.
              </p>
            </div>
          </Card>

          <Card className="p-6 flex flex-col gap-5">
            <div className="flex items-center gap-3 text-foreground border-b border-border pb-3">
              <div className="p-2 bg-primary/10 rounded-md text-primary">
                <Settings2 size={18} />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider block text-muted">
                  Limites
                </span>
                <span className="text-sm font-semibold text-foreground">
                  Regras de Execução
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <Input
                label="Tempo Limite (ms)"
                type="number"
                {...register(getName("timeLimit"), { valueAsNumber: true })}
                className="bg-background"
              />
              <Input
                label="Memória Limite (MB)"
                type="number"
                {...register(getName("memoryLimit"), { valueAsNumber: true })}
                className="bg-background"
              />
              <Input
                label="Tentativas (0 = Infinito)"
                type="number"
                {...register(getName("maxAttempts"), { valueAsNumber: true })}
                className="bg-background"
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
