import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { ProblemWizard } from "../components/problem/ProblemWizard";
import { toast } from "sonner";

export default function CreateProblem() {
  const navigate = useNavigate();
  const params = useParams();
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    const classId = params.id || params.classroomId;

    if (classId && !hasCheckedRef.current) {
      hasCheckedRef.current = true; // Marca como executado imediatamente

      api
        .get(`/classrooms/${classId}`)
        .then((res) => {
          if (res.data.isArchived) {
            toast.warning("Turma arquivada. Não é possível criar atividades.");
            navigate(`/class/${classId}`, {
              state: { activeTab: "classwork" },
            });
          }
        })
        .catch(() => {});
    }
  }, [params, navigate]);

  const handleCreate = async (rawData: any) => {
    // 1. Clona o objeto para evitar mutações indesejadas
    const data = { ...rawData };

    // 2. Sanitização baseada no Tipo
    if (data.type === "EXERCISE") {
      // Se for exercício, removemos 'questions' para evitar o erro 400
      delete data.questions;
    } else if (data.type === "EXAM") {
      // Se for prova, garantimos que 'questions' seja enviado corretamente
      // e removemos campos exclusivos de exercício se necessário (opcional)
    }

    // 3. Formatação Robusta de Datas
    // Input datetime-local retorna string vazia se não preenchido.
    // Convertemos para ISOString apenas se houver valor válido.
    try {
      data.startDate = data.startDate
        ? new Date(data.startDate).toISOString()
        : null;
      data.deadline = data.deadline
        ? new Date(data.deadline).toISOString()
        : null;
    } catch (e) {
      toast.error("Data inválida selecionada.");
      return;
    }

    // 4. Tratamento de números (garantia extra)
    if (data.timeLimit) data.timeLimit = Number(data.timeLimit);
    if (data.memoryLimit) data.memoryLimit = Number(data.memoryLimit);
    if (data.maxAttempts) data.maxAttempts = Number(data.maxAttempts);

    try {
      await api.post("/problems", data);
      toast.success("Atividade criada com sucesso!");

      if (data.classroomId) {
        navigate(`/class/${data.classroomId}`, {
          state: { activeTab: "classwork" },
        });
      } else {
        navigate("/dashboard");
      }
    } catch (error: any) {
      console.error(error);
      const message = error.response?.data?.message;
      if (Array.isArray(message)) {
        // Exibe o primeiro erro mais relevante ou junta todos
        toast.error(message[0]);
      } else {
        toast.error("Erro ao criar atividade. Verifique os campos.");
      }
    }
  };

  return (
    <div className="h-screen w-full bg-background text-foreground flex flex-col font-sans overflow-hidden">
      <div className="p-4 md:p-6 pb-2 flex-none">
        <header>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Nova Atividade
          </h1>
          <p className="text-muted text-sm mt-1">
            Crie um exercício prático ou uma prova avaliativa.
          </p>
        </header>
      </div>

      <div className="flex-1 min-h-0 p-4 md:p-6 pt-2">
        <ProblemWizard onSubmit={handleCreate} />
      </div>
    </div>
  );
}
