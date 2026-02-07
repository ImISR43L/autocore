import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { ProblemWizard } from "../components/problem/ProblemWizard";
import { toast } from "sonner";

export default function CreateProblem() {
  const navigate = useNavigate();

  const handleCreate = async (rawData: any) => {
    // Sanitização
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
      const message = error.response?.data?.message;
      if (Array.isArray(message)) {
        message.forEach((msg) => toast.error(msg));
      } else {
        toast.error("Erro ao criar problema");
      }
    }
  };

  return (
    <div className="min-h-screen bg-background text-zinc-100 p-6 flex flex-col font-sans">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Novo Problema
        </h1>
        <p className="text-muted text-sm mt-1">
          Crie um exercício ou prova para sua turma.
        </p>
      </header>

      <div className="flex-1 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden">
        <ProblemWizard onSubmit={handleCreate} />
      </div>
    </div>
  );
}
