import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { ProblemWizard } from "../components/problem/ProblemWizard";
import { toast } from "sonner";

export default function CreateProblem() {
  const navigate = useNavigate();

  const handleCreate = async (rawData: any) => {
    // CLONAGEM E SANITIZAÇÃO
    // Remove strings vazias de datas para evitar erro de validação ISO8601
    const data = {
      ...rawData,
      startDate: rawData.startDate === "" ? null : rawData.startDate,
      deadline: rawData.deadline === "" ? null : rawData.deadline,
    };

    try {
      await api.post("/problems", data);
      toast.success("Problema criado com sucesso!");

      if (data.classroomId) {
        navigate(`/class/${data.classroomId}`);
      } else {
        navigate("/dashboard");
      }
    } catch (error: any) {
      console.error(error);
      // Exibe erros de validação retornados pelo backend se houver
      const message = error.response?.data?.message;
      if (Array.isArray(message)) {
        message.forEach((msg) => toast.error(msg));
      } else {
        toast.error("Erro ao criar problema");
      }
    }
  };

  return (
    <div className="page-container h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">Novo Problema</h1>
      <div className="bg-gray-900 border border-gray-800 rounded-lg h-[calc(100%-3rem)]">
        <ProblemWizard onSubmit={handleCreate} />
      </div>
    </div>
  );
}
