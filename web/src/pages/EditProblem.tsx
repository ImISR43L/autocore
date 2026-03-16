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

        const formattedData: any = { ...rawData };

        if (rawData.startDate)
          formattedData.startDate = new Date(rawData.startDate)
            .toISOString()
            .slice(0, 16);
        if (rawData.deadline)
          formattedData.deadline = new Date(rawData.deadline)
            .toISOString()
            .slice(0, 16);

        if (rawData.type === "EXAM") {
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
      const cleanPayload = JSON.parse(JSON.stringify(data));

      if (cleanPayload.type === "EXERCISE" && cleanPayload.testCases) {
        cleanPayload.testCases.forEach((tc: any) => delete tc.id);
      } else if (cleanPayload.type === "EXAM" && cleanPayload.questions) {
        cleanPayload.questions.forEach((q: any) => {
          delete q.id;
          if (q.testCases) {
            q.testCases.forEach((tc: any) => delete tc.id);
          }
        });
      }

      await api.patch(`/problems/${id}`, cleanPayload);
      navigate(-1);
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
      <div className="p-12 text-center text-lg text-muted">
        Carregando ambiente de edição...
      </div>
    );
  if (error)
    return (
      <div className="p-12 text-center text-lg text-destructive font-medium">
        Erro: {error}
      </div>
    );

  return (
    <div className="h-[calc(100vh-5rem)] w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
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
