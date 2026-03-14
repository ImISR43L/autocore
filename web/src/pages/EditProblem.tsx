import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ProblemEditor } from "../components/problem/ProblemEditor";
import type { ProblemFormValues } from "../schemas/problem.schema";
import { api } from "../lib/api";

export default function EditProblem() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [initialData, setInitialData] = useState<ProblemFormValues | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProblem = async () => {
      try {
        const response = await api.get(`/problems/${id}`);
        const rawData = response.data;

        // Clonar dados para mutação de hidratação
        const formattedData: any = { ...rawData };

        // Formatar datas do formato ISO para o input type="datetime-local" (YYYY-MM-DDThh:mm)
        if (rawData.startDate)
          formattedData.startDate = new Date(rawData.startDate)
            .toISOString()
            .slice(0, 16);
        if (rawData.deadline)
          formattedData.deadline = new Date(rawData.deadline)
            .toISOString()
            .slice(0, 16);

        // Normalização de arrays essenciais com base no tipo
        if (rawData.type === "EXAM") {
          // Na API as questões de uma prova vêm na propriedade `children`
          formattedData.questions = (rawData.children || []).map(
            (child: any) => ({
              title: child.title || "",
              slug: child.slug || "",
              description: child.description || "",
              starterCode: child.starterCode?.length
                ? child.starterCode
                : [{ name: "main.py", content: "" }],
              solutionCode: child.solutionCode?.length
                ? child.solutionCode
                : [{ name: "main.py", content: "" }],
              testCases: child.testCases?.length
                ? child.testCases
                : [{ input: "", expectedOutput: "", isHidden: false }],
              parameters: child.parameters || [],
              returnType: child.returnType || "void",
            }),
          );
        } else {
          // Se for Exercício Isolado
          formattedData.starterCode = rawData.starterCode?.length
            ? rawData.starterCode
            : [{ name: "main.py", content: "" }];
          formattedData.solutionCode = rawData.solutionCode?.length
            ? rawData.solutionCode
            : [{ name: "main.py", content: "" }];
          formattedData.testCases = rawData.testCases?.length
            ? rawData.testCases
            : [{ input: "", expectedOutput: "", isHidden: false }];
          formattedData.parameters = rawData.parameters || [];
          formattedData.returnType = rawData.returnType || "void";
        }

        setInitialData(formattedData);
      } catch (err) {
        setError(
          "Falha ao carregar os detalhes do problema. Verifique a conexão.",
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchProblem();
    } else {
      setError("ID do problema não fornecido na URL.");
      setIsLoading(false);
    }
  }, [id]);

  const handleSubmit = async (data: ProblemFormValues) => {
    setIsSubmitting(true);
    try {
      await api.put(`/problems/${id}`, data);
      navigate("/dashboard");
    } catch (err) {
      console.error("Erro ao guardar edições:", err);
      alert(
        "Ocorreu um erro ao guardar as alterações no banco de dados. Verifique os logs.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading)
    return (
      <div className="p-12 text-center text-lg text-gray-600">
        A carregar ambiente de edição...
      </div>
    );
  if (error)
    return (
      <div className="p-12 text-center text-lg text-red-500 font-medium">
        Erro: {error}
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto p-6 lg:p-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Editor de Problema
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Atualize as informações, o código base, o gabarito e os limites de
          execução diretamente abaixo.
        </p>
      </div>

      {initialData && (
        <ProblemEditor
          initialData={initialData}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
