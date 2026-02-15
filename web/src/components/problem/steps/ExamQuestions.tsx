import { useState } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileQuestion,
  AlertCircle, // Adicionei para indicar erro visualmente
} from "lucide-react";
import { ExerciseConfig } from "./ExerciseConfig";
import { ScaffoldingConfig } from "./ScaffoldingConfig";
import { ValidationConfig } from "./ValidationConfig";
import { MarkdownInput } from "../../inputs/MarkdownInput";

export function ExamQuestions() {
  const {
    control,
    register,
    watch,
    formState: { errors }, // Agora sendo usado
  } = useFormContext();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "questions",
  });

  const handleAddQuestion = () => {
    append({
      title: "Nova Questão",
      description: "",
      slug: `q${fields.length + 1}`,
      parameters: [],
      returnType: "void",
      starterCode: [{ name: "main.py", content: "def solve():\n    pass" }],
      solutionCode: [],
      testCases: [],
    });
    setExpandedIndex(fields.length);
  };

  // Helper para checar se existe erro dentro de uma questão específica
  const hasQuestionError = (index: number) => {
    // Acessa errors.questions[index] de forma segura
    const questionErrors = (errors as any)?.questions?.[index];
    return !!questionErrors;
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex justify-between items-center border-b border-gray-800 pb-2">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <FileQuestion className="text-purple-500" size={20} />
          Questões da Prova
        </h3>
        <button
          type="button"
          onClick={handleAddQuestion}
          className="flex items-center gap-1 text-sm bg-purple-600 hover:bg-purple-700 text-foreground px-3 py-1.5 rounded transition-colors"
        >
          <Plus size={16} /> Adicionar Questão
        </button>
      </div>

      <div className="flex flex-col gap-4 overflow-y-auto pr-2 pb-10">
        {fields.length === 0 && (
          <div className="text-center py-10 border border-dashed border-gray-800 rounded bg-gray-900/30 text-gray-500">
            Nenhuma questão adicionada a esta prova.
          </div>
        )}

        {fields.map((field, index) => {
          const isExpanded = expandedIndex === index;
          const basePath = `questions.${index}`;
          const currentDesc = watch(`${basePath}.description`);
          const hasError = hasQuestionError(index); // Verifica erro

          return (
            <div
              key={field.id}
              // Aplica borda vermelha se houver erro na questão
              className={`border rounded-lg bg-gray-900 overflow-hidden transition-colors ${
                hasError ? "border-red-500/50" : "border-gray-800"
              }`}
            >
              {/* Header do Accordion */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800/50 transition-colors"
                onClick={() => setExpandedIndex(isExpanded ? null : index)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown size={18} />
                  ) : (
                    <ChevronRight size={18} />
                  )}
                  <span
                    className={`font-medium ${hasError ? "text-red-400" : "text-foreground"}`}
                  >
                    Questão {index + 1}:{" "}
                    {watch(`${basePath}.title`) || "Sem título"}
                  </span>

                  {/* Ícone de alerta se houver erro */}
                  {hasError && (
                    <span className="text-red-500 flex items-center gap-1 text-xs bg-red-950/30 px-2 py-0.5 rounded border border-red-900/50">
                      <AlertCircle size={12} /> Inválido
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(index);
                  }}
                  className="text-gray-500 hover:text-red-500 p-1"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {isExpanded && (
                <div className="p-4 border-t border-gray-800 flex flex-col gap-6 bg-[#1a1a1a]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-gray-400">
                        Título da Questão
                      </label>
                      <input
                        {...register(`${basePath}.title`)}
                        className="bg-gray-800 border border-gray-700 rounded p-2 text-foreground text-sm focus:border-purple-500 outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-gray-400">
                        Slug (URL Interna)
                      </label>
                      <input
                        {...register(`${basePath}.slug`)}
                        className="bg-gray-800 border border-gray-700 rounded p-2 text-foreground text-sm font-mono focus:border-purple-500 outline-none"
                      />
                    </div>
                  </div>

                  <MarkdownInput
                    label="Enunciado"
                    register={register(`${basePath}.description`)}
                    watchValue={currentDesc}
                    placeholder="Descreva a questão..."
                  />

                  <hr className="border-gray-800" />

                  <div className="flex flex-col gap-2">
                    <h4 className="text-sm font-bold text-blue-400 uppercase">
                      Assinatura & Regras
                    </h4>
                    <ExerciseConfig basePath={basePath} />
                  </div>

                  <div className="flex flex-col gap-2 w-full">
                    <h4 className="text-sm font-bold text-green-400 uppercase">
                      Código Base
                    </h4>
                    {/* A IDE vai tentar ocupar 100% deste container */}
                    <ScaffoldingConfig basePath={basePath} />
                  </div>

                  <div className="flex flex-col gap-2 mt-4">
                    <h4 className="text-sm font-bold text-orange-400 uppercase">
                      Testes & Validação
                    </h4>
                    <ValidationConfig basePath={basePath} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
