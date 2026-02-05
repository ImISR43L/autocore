import { useFieldArray, useFormContext } from "react-hook-form";
import { Plus, Trash2, ChevronDown, Type } from "lucide-react";

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
    // Aumentei o gap e removi restrições de largura
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
      {/* Grid responsivo: 1 coluna no mobile, 3 no desktop (2 para params, 1 para retorno) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full">
        {/* --- Coluna 1: Parâmetros da Função (Ocupa 2/3 do espaço) --- */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          <div className="flex justify-between items-end border-b border-gray-800 pb-3">
            <div>
              <label className="text-sm font-semibold text-white flex items-center gap-2">
                Parâmetros de Entrada
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Defina os argumentos que a função do aluno receberá.
              </p>
            </div>
            <button
              type="button"
              onClick={() => append({ name: "", type: "int" })}
              className="flex items-center gap-2 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md transition-all active:scale-95 shadow-lg shadow-blue-900/20"
            >
              <Plus size={14} /> Adicionar Parâmetro
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {fields.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 border border-dashed border-gray-800 rounded-lg bg-gray-900/30">
                <p className="text-sm text-gray-400 font-medium">
                  Nenhum parâmetro definido
                </p>
                <p className="text-xs text-gray-600 mt-1">
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
                  {/* Input de Nome (Expandido) */}
                  <div className="flex flex-col flex-1">
                    <input
                      {...register(getName(`parameters.${index}.name`))}
                      placeholder="nome_da_variavel"
                      className={`h-11 w-full bg-black/20 border ${
                        nameError
                          ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/20"
                          : "border-gray-700 focus:border-blue-500 focus:ring-blue-500/20"
                      } rounded-md px-4 text-sm text-gray-200 placeholder:text-gray-600 outline-none focus:ring-2 transition-all font-mono`}
                    />
                    {nameError && (
                      <span className="text-[10px] text-red-400 mt-1 ml-1">
                        {nameError.message as string}
                      </span>
                    )}
                  </div>

                  {/* Select de Tipo (Estilizado) */}
                  <div className="relative w-40">
                    <select
                      {...register(getName(`parameters.${index}.type`))}
                      // CORREÇÃO DE COR: bg-[#1e1e1e] e text-white
                      className="h-11 w-full appearance-none bg-[#1e1e1e] border border-gray-700 rounded-md px-4 pr-10 text-sm text-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all cursor-pointer font-mono"
                    >
                      <option value="int">Integer (int)</option>
                      <option value="float">Float</option>
                      <option value="string">String</option>
                      <option value="boolean">Boolean</option>
                      <option value="int[]">Array (int[])</option>
                      <option value="string[]">Array (string[])</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                      <ChevronDown size={14} />
                    </div>
                  </div>

                  {/* Botão de Remover */}
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="h-11 w-11 flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors border border-transparent hover:border-red-500/20"
                    title="Remover parâmetro"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* --- Coluna 2: Tipo de Retorno (Lateral - Ocupa 1/3) --- */}
        <div className="lg:col-span-1">
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 flex flex-col gap-5 sticky top-4 shadow-xl">
            <div className="flex items-center gap-3 text-gray-300 border-b border-gray-800 pb-3">
              <div className="p-2 bg-purple-500/10 rounded-md text-purple-400">
                <Type size={18} />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider block text-gray-500">
                  Configuração
                </span>
                <span className="text-sm font-semibold text-white">
                  Saída da Função
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase font-bold text-gray-500 tracking-wider">
                Tipo de Retorno
              </label>
              <div className="relative">
                <select
                  {...register(getName("returnType"))}
                  className="h-12 w-full appearance-none bg-[#000000] border border-gray-700 rounded-lg px-4 pr-10 text-sm text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all cursor-pointer font-mono"
                >
                  {/* Opções com estilo inline para garantir cor escura no dropdown nativo */}
                  <option value="void">Void (Sem retorno)</option>
                  <option value="int">Integer (int)</option>
                  <option value="float">Float</option>
                  <option value="string">String</option>
                  <option value="boolean">Boolean</option>
                  <option value="int[]">Array (int[])</option>
                  <option value="string[]">Array (string[])</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                  <ChevronDown size={16} />
                </div>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed mt-1">
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
