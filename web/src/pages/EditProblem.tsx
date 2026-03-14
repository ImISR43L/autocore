import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ProblemEditor } from "../components/problem/ProblemEditor";
import type { ProblemFormValues } from "../schemas/problem.schema";
import { api } from "../lib/api";

function EditProblem() {
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
        setInitialData(response.data);
      } catch (err) {
        setError("Falha ao carregar o problema.");
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchProblem();
    } else {
      setError("ID do problema não fornecido ou incompatível na URL.");
      setIsLoading(false);
    }
  }, [id]);

  const handleSubmit = async (data: ProblemFormValues) => {
    setIsSubmitting(true);
    try {
      await api.put(`/problems/${id}`, data);
      navigate("/dashboard"); // Ajuste o redirecionamento conforme necessário
    } catch (err) {
      console.error("Erro ao salvar problema:", err);
      // Implementar notificação de erro visual (toast)
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div>Carregando editor...</div>;
  if (error) return <div>Erro: {error}</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Editar Problema</h1>
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

export default EditProblem;
