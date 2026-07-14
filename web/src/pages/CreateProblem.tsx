import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Database, Network, ArrowLeft } from "lucide-react";
import { ProgrammingWizard } from "../components/problem/ProgrammingWizard";
import { ChemistryWizard } from "../components/problem/ChemistryWizard";
import { HtmlWizard } from "../components/problem/HtmlWizard";
import { SqlWizard } from "../components/problem/SqlWizard";
import { SqlModelingWizard } from "../components/problem/SqlModelingWizard";
import { Button } from "../components/ui/Button";
import { cn } from "../lib/utils";

type ClassroomSubject =
  | "PROGRAMMING"
  | "CHEMISTRY"
  | "HTML"
  | "SQL"
  | "SQL_MODELING";

// Matérias em que a turma cobre mais de um TIPO de atividade possível —
// o professor escolhe por atividade, não a turma inteira. Por enquanto
// só Banco de Dados (SQL): a turma fica "SQL", mas cada atividade pode
// ser subject: SQL (consulta) ou subject: SQL_MODELING (DER). Escopo
// deliberadamente restrito a este par por ora — as outras matérias
// (Química, HTML, Programação) continuam 1:1 com a turma.
const MULTI_ACTIVITY_SUBJECTS: Partial<
  Record<
    ClassroomSubject,
    {
      value: "SQL" | "SQL_MODELING";
      label: string;
      description: string;
      icon: React.ReactNode;
    }[]
  >
> = {
  SQL: [
    {
      value: "SQL",
      label: "Consulta SQL",
      description:
        "Aluno escreve uma query, corrigida contra um schema de referência em sandbox.",
      icon: <Database size={28} />,
    },
    {
      value: "SQL_MODELING",
      label: "Modelagem Conceitual",
      description:
        "Aluno desenha um diagrama Entidade-Relacionamento, corrigido manualmente pelo professor.",
      icon: <Network size={28} />,
    },
  ],
};

export default function CreateProblem() {
  const navigate = useNavigate();
  const params = useParams();
  const hasCheckedRef = useRef(false);

  const [classroomSubject, setClassroomSubject] =
    useState<ClassroomSubject>("PROGRAMMING");
  const [isLoading, setIsLoading] = useState(true);

  // Só relevante quando classroomSubject tem mais de um tipo de
  // atividade possível (ver MULTI_ACTIVITY_SUBJECTS). null = ainda não
  // escolhido, mostra o seletor em vez do wizard.
  const [activitySubject, setActivitySubject] = useState<
    "SQL" | "SQL_MODELING" | null
  >(null);

  const activityOptions = MULTI_ACTIVITY_SUBJECTS[classroomSubject];
  const needsActivityPicker = !!activityOptions && activitySubject === null;

  // Matéria efetiva que decide qual wizard renderizar: para turmas com
  // mais de um tipo de atividade, é a escolha feita no seletor; para as
  // demais, é a própria matéria da turma (comportamento de sempre).
  const effectiveSubject = activityOptions
    ? activitySubject
    : classroomSubject;

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

  const headerDescription = needsActivityPicker
    ? "Escolha o tipo de atividade de Banco de Dados que você quer criar."
    : effectiveSubject === "CHEMISTRY"
      ? "Crie um exercício visual focado em estruturas químicas."
      : effectiveSubject === "HTML"
        ? "Crie um exercício de desenvolvimento web com validação de HTML."
        : effectiveSubject === "SQL"
          ? "Crie um exercício de consulta SQL contra um schema de referência."
          : effectiveSubject === "SQL_MODELING"
            ? "Crie um exercício de modelagem conceitual (diagrama ER)."
            : "Crie um exercício prático de algoritmos ou uma prova avaliativa.";

  return (
    <div className="h-screen w-full bg-background text-foreground flex flex-col font-sans overflow-hidden">
      <div className="p-4 md:p-6 pb-2 flex-none">
        <header className="flex items-center gap-3">
          {activityOptions && activitySubject !== null && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => setActivitySubject(null)}
              className="border-border hover:bg-surface text-muted hover:text-foreground flex-none"
              title="Escolher outro tipo de atividade"
            >
              <ArrowLeft size={18} />
            </Button>
          )}
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Nova Atividade
            </h1>
            <p className="text-muted text-sm mt-1">{headerDescription}</p>
          </div>
        </header>
      </div>

      <div className="flex-1 min-h-0 p-4 md:p-6 pt-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-full w-full">
            <span className="text-muted text-sm animate-pulse">
              Carregando o ambiente correto...
            </span>
          </div>
        ) : needsActivityPicker ? (
          <div className="h-full flex items-center justify-center">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl w-full">
              {activityOptions!.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setActivitySubject(opt.value)}
                  className={cn(
                    "text-left p-6 rounded-xl border-2 border-border bg-surface hover:border-primary hover:bg-primary/5 transition-colors flex flex-col gap-3",
                  )}
                >
                  <div className="p-3 bg-primary/10 rounded-lg text-primary w-fit">
                    {opt.icon}
                  </div>
                  <span className="text-lg font-bold text-foreground">
                    {opt.label}
                  </span>
                  <span className="text-sm text-muted">{opt.description}</span>
                </button>
              ))}
            </div>
          </div>
        ) : effectiveSubject === "CHEMISTRY" ? (
          <ChemistryWizard onSubmit={handleCreate} />
        ) : effectiveSubject === "HTML" ? (
          <HtmlWizard onSubmit={handleCreate} />
        ) : effectiveSubject === "SQL" ? (
          <SqlWizard onSubmit={handleCreate} />
        ) : effectiveSubject === "SQL_MODELING" ? (
          <SqlModelingWizard onSubmit={handleCreate} />
        ) : (
          <ProgrammingWizard onSubmit={handleCreate} />
        )}
      </div>
    </div>
  );
}
