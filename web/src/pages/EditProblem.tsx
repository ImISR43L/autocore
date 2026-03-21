import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { ProblemEditor } from "../components/problem/ProblemEditor";
import { toast } from "sonner";
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "../components/ui/Button";

export default function EditProblem() {
  const params = useParams();
  const navigate = useNavigate();

  // Suporte a rotas aninhadas ou diretas
  const problemId = params.problemId || params.id;

  const [problem, setProblem] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isFormDirty, setIsFormDirty] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  useEffect(() => {
    if (!problemId) {
      toast.error("ID não encontrado.");
      navigate("/dashboard");
      return;
    }

    async function loadProblem() {
      try {
        const res = await api.get(`/problems/${problemId}`);

        if (res.data.classroom?.isArchived) {
          toast.warning(
            "Turma arquivada. O modo de leitura não permite edições.",
          );
          navigate(`/class/${res.data.classroom.id}`);
          return;
        }

        const formatted = {
          ...res.data,
          parameters: res.data.parameters || [],
          testCases: res.data.testCases || [],
          starterCode: res.data.starterCode?.length
            ? res.data.starterCode
            : [{ name: "main.py", content: "" }],
          solutionCode: res.data.solutionCode?.length
            ? res.data.solutionCode
            : [{ name: "main.py", content: "" }],
        };

        if (formatted.startDate) {
          formatted.startDate = new Date(formatted.startDate)
            .toISOString()
            .slice(0, 16);
        }
        if (formatted.deadline) {
          formatted.deadline = new Date(formatted.deadline)
            .toISOString()
            .slice(0, 16);
        }

        setProblem(formatted);
      } catch (error) {
        toast.error("Falha ao carregar os dados da atividade.");
      } finally {
        setIsLoading(false);
      }
    }

    loadProblem();
  }, [problemId, navigate]);

  const handleUpdate = async (data: any) => {
    try {
      const cleanPayload = JSON.parse(JSON.stringify(data));

      // Limpeza de IDs espúrios se for um exercício
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

      await api.patch(`/problems/${problemId}`, cleanPayload);
      toast.success("Problema atualizado com sucesso!");
      setIsFormDirty(false);
      navigate(-1);
    } catch (error) {
      toast.error("Ocorreu um erro ao guardar as alterações.");
      console.error(error);
    }
  };

  const handleBack = () => {
    if (isFormDirty) {
      setShowExitModal(true);
    } else {
      navigate(-1);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 h-[calc(100vh-4rem)]">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-background relative overflow-hidden">
      {showExitModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-xl shadow-2xl p-6 max-w-sm w-full animate-in zoom-in-95">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 text-amber-500">
                <AlertTriangle size={24} />
                <h3 className="text-lg font-bold text-foreground">
                  Sair sem salvar?
                </h3>
              </div>
              <p className="text-sm text-muted">
                Alterações não salvas serão perdidas.
              </p>
              <div className="flex gap-3 mt-2 justify-end">
                <Button variant="ghost" onClick={() => setShowExitModal(false)}>
                  Voltar
                </Button>
                <Button variant="danger" onClick={() => navigate(-1)}>
                  Sair sem Salvar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 md:p-6 pb-2 flex-none flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={handleBack}
          className="border-border hover:bg-surface text-muted hover:text-foreground"
        >
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Editar Atividade
          </h1>
          <p className="text-muted text-sm">
            {problem?.title || "Carregando..."}
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 p-4 md:p-6 pt-2">
        <div className="h-full bg-surface border border-border rounded-xl shadow-2xl overflow-hidden">
          <ProblemEditor
            initialValues={problem}
            onSubmit={handleUpdate}
            mode="EDIT"
            onDirtyChange={setIsFormDirty}
          />
        </div>
      </div>
    </div>
  );
}
