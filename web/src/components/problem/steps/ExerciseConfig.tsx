import { useFieldArray, useFormContext } from "react-hook-form";
import { Plus, Trash2, ChevronDown, Type } from "lucide-react";
import { cn } from "../../../lib/utils";

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
        {/* --- Coluna 1: Parâmetros --- */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          <div className="flex justify-between items-end border-b border-border pb-3">
            <div>
              <label className="text-sm font-semibold text-white flex items-center gap-2">
                Parâmetros de Entrada
              </label>
              <p className="text-xs text-muted mt-1">
                Defina os argumentos que a função do aluno receberá.
              </p>
            </div>
            <button
              type="button"
              onClick={() => append({ name: "", type: "int" })}
              className="flex items-center gap-2 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-all active:scale-95 shadow-lg shadow-primary/20"
            >
              <Plus size={14} /> Adicionar Parâmetro
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {fields.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border rounded-lg bg-surface/30">
                <p className="text-sm text-muted font-medium">
                  Nenhum parâmetro definido
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  A função será void() (sem argumentos).
                </p>
              </div>
            )}

            {fields.map((field, index) => {
              const nameError = getError(getName(`parameters.${index}.name`));

              return (
                <div
                  key={field.id}
                  className="group flex gap-4 items-start animate-in slide-in-from-left-2 duration-300"
                >
                  <div className="flex flex-col flex-1">
                    <input
                      {...register(getName(`parameters.${index}.name`))}
                      placeholder="nome_da_variavel"
                      className={cn(
                        "h-11 w-full bg-background border rounded-md px-4 text-sm text-zinc-200 placeholder:text-muted outline-none focus:ring-2 transition-all font-mono",
                        nameError
                          ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                          : "border-border focus:border-primary focus:ring-primary/20",
                      )}
                    />
                    {nameError && (
                      <span className="text-[10px] text-destructive mt-1 ml-1">
                        {nameError.message as string}
                      </span>
                    )}
                  </div>

                  <div className="relative w-40">
                    <select
                      {...register(getName(`parameters.${index}.type`))}
                      className="h-11 w-full appearance-none bg-background border border-border rounded-md px-4 pr-10 text-sm text-zinc-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer font-mono"
                    >
                      <option value="int">Integer (int)</option>
                      <option value="float">Float</option>
                      <option value="string">String</option>
                      <option value="boolean">Boolean</option>
                      <option value="int[]">Array (int[])</option>
                      <option value="string[]">Array (string[])</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                      <ChevronDown size={14} />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="h-11 w-11 flex items-center justify-center text-muted hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors border border-transparent hover:border-destructive/20"
                    title="Remover parâmetro"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* --- Coluna 2: Tipo de Retorno --- */}
        <div className="lg:col-span-1">
          <div className="bg-surface/50 border border-border rounded-xl p-6 flex flex-col gap-5 sticky top-4 shadow-xl">
            <div className="flex items-center gap-3 text-zinc-300 border-b border-border pb-3">
              <div className="p-2 bg-primary/10 rounded-md text-primary">
                <Type size={18} />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider block text-muted">
                  Configuração
                </span>
                <span className="text-sm font-semibold text-white">
                  Saída da Função
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase font-bold text-muted tracking-wider">
                Tipo de Retorno
              </label>
              <div className="relative">
                <select
                  {...register(getName("returnType"))}
                  className="h-12 w-full appearance-none bg-background border border-border rounded-lg px-4 pr-10 text-sm text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer font-mono"
                >
                  <option value="void">Void (Sem retorno)</option>
                  <option value="int">Integer (int)</option>
                  <option value="float">Float</option>
                  <option value="string">String</option>
                  <option value="boolean">Boolean</option>
                  <option value="int[]">Array (int[])</option>
                  <option value="string[]">Array (string[])</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                  <ChevronDown size={16} />
                </div>
              </div>
              <p className="text-[11px] text-muted leading-relaxed mt-1">
                O avaliador (executor) irá comparar o valor retornado pela
                função do aluno com o <strong>Output Esperado</strong> dos
                testes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
