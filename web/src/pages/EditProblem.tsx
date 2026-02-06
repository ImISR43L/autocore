import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { ProblemEditor } from "../components/problem/ProblemEditor";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";

export default function EditProblem() {
  const { classroomId, problemId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [problemData, setProblemData] = useState<any>(null);

  // 1. Carregar dados do Problema
  useEffect(() => {
    async function fetchProblem() {
      try {
        const response = await api.get(`/problems/${problemId}`);
        const data = response.data;

        // Sanitização de dados para o formulário
        const formattedData = {
          ...data,
          // Garante que datas sejam strings ou vazias para os inputs
          startDate: data.startDate ? data.startDate.split("T")[0] : "",
          deadline: data.deadline ? data.deadline.split("T")[0] : "",
          // Garante arrays vazios se nulos
          starterCode: data.starterCode || [],
          solutionCode: data.solutionCode || [],
          testCases: data.testCases || [],
          parameters: data.parameters || [],
        };

        setProblemData(formattedData);
      } catch (error) {
        console.error(error);
        toast.error("Erro ao carregar dados da atividade.");
        navigate(`/class/${classroomId}`);
      } finally {
        setLoading(false);
      }
    }

    if (problemId) {
      fetchProblem();
    }
  }, [problemId, classroomId, navigate]);

  // 2. Salvar alterações (PATCH)
  const handleUpdate = async (data: any) => {
    try {
      // Pequena limpeza antes de enviar
      const payload = {
        ...data,
        classroomId: undefined, // Não mudamos a turma na edição
        id: undefined,
        // Converter datas vazias para null
        startDate: data.startDate === "" ? null : data.startDate,
        deadline: data.deadline === "" ? null : data.deadline,
      };

      await api.patch(`/problems/${problemId}`, payload);
      toast.success("Atividade atualizada com sucesso!");
      navigate(`/class/${classroomId}`); // Volta para a turma
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar alterações.");
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#09090b] text-white">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="animate-spin text-blue-500" size={32} />
          <span className="text-sm text-gray-400">Carregando atividade...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col">
      {/* Header Simples */}
      <header className="border-b border-gray-800 bg-black/20 p-4 flex items-center gap-4">
        <button
          onClick={() => navigate(`/class/${classroomId}`)}
          className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-white"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            Editando:{" "}
            <span className="text-blue-400">{problemData?.title}</span>
          </h1>
          <p className="text-xs text-gray-500">
            Todas as alterações são salvas ao clicar em "Salvar Alterações".
          </p>
        </div>
      </header>

      {/* Área Principal - O Editor Unificado */}
      <div className="flex-1 overflow-hidden">
        <ProblemEditor
          initialValues={problemData}
          onSubmit={handleUpdate}
          mode="EDIT"
        />
      </div>
    </div>
  );
}
