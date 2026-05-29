import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { toast } from "sonner";
import { ProgrammingWizard } from "../components/problem/ProgrammingWizard";
import { ChemistryWizard } from "../components/problem/ChemistryWizard";
import { HtmlWizard } from "../components/problem/HtmlWizard";

export default function CreateProblem() {
  const navigate = useNavigate();
  const params = useParams();
  const hasCheckedRef = useRef(false);

  const [classroomSubject, setClassroomSubject] = useState<
    "PROGRAMMING" | "CHEMISTRY" | "HTML"
  >("PROGRAMMING");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const classId = params.id || params.classroomId;

    if (classId && !hasCheckedRef.current) {
      hasCheckedRef.current = true;

      api
        .get(`/classrooms/${classId}`)
        .then((res) => {
          if (res.data.isArchived) {
            toast.warning("Turma arquivada. Não é possível criar atividades.");
            navigate(`/class/${classId}`, {
              state: { activeTab: "classwork" },
            });
          }
          if (res.data.subject) {
            setClassroomSubject(res.data.subject);
          }
        })
        .catch(() => {
          toast.error("Erro ao carregar os dados da turma.");
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else if (!classId) {
      // Se não houver turma na URL (criação global pelo Dashboard), assume o padrão e remove o loading
      setIsLoading(false);
    }
  }, [params, navigate]);

  const handleCreate = async (data: any) => {
    // Tratamento básico de números que o Backend exige
    if (data.timeLimit) data.timeLimit = Number(data.timeLimit);
    if (data.memoryLimit) data.memoryLimit = Number(data.memoryLimit);
    if (data.maxAttempts) data.maxAttempts = Number(data.maxAttempts);

    // 👇 NOVA LIMPEZA: Remove strings vazias para não quebrar a validação ISO8601 do NestJS
    if (!data.startDate) delete data.startDate;
    if (!data.deadline) delete data.deadline;

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
            {classroomSubject === "CHEMISTRY"
              ? "Crie um exercício visual focado em estruturas químicas."
              : classroomSubject === "HTML"
                ? "Crie um exercício de desenvolvimento web com validação de HTML."
                : "Crie um exercício prático de algoritmos ou uma prova avaliativa."}
          </p>
        </header>
      </div>

      <div className="flex-1 min-h-0 p-4 md:p-6 pt-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-full w-full">
            <span className="text-muted text-sm animate-pulse">
              Carregando o ambiente correto...
            </span>
          </div>
        ) : classroomSubject === "CHEMISTRY" ? (
          <ChemistryWizard onSubmit={handleCreate} />
        ) : classroomSubject === "HTML" ? (
          <HtmlWizard onSubmit={handleCreate} />
        ) : (
          <ProgrammingWizard onSubmit={handleCreate} />
        )}
      </div>
    </div>
  );
}
