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
        const formatted = {
          ...res.data,
          parameters: res.data.parameters || [],
          testCases: res.data.testCases || [],
          starterCode: res.data.starterCode || [],
          solutionCode: res.data.solutionCode || [],
          // Formata datas vindas do banco (ISO) para o formato do input (YYYY-MM-DDThh:mm)
          startDate: res.data.startDate
            ? new Date(res.data.startDate).toISOString().slice(0, 16)
            : "",
          deadline: res.data.deadline
            ? new Date(res.data.deadline).toISOString().slice(0, 16)
            : "",
        };
        setProblem(formatted);
      } catch (error) {
        console.error(error);
        toast.error("Erro ao carregar dados.");
        navigate("/dashboard");
      } finally {
        setIsLoading(false);
      }
    }
    loadProblem();
  }, [problemId, navigate]);

  const handleUpdate = async (rawData: any) => {
    if (!problemId) return;

    // 1. Sanitização e Limpeza
    const payload = { ...rawData };

    // Remove questions se for EXERCISE para evitar erro de validação no backend
    if (payload.type === "EXERCISE") {
      delete payload.questions;
    }

    // 2. Conversão de Datas para ISO 8601
    try {
      payload.startDate = payload.startDate
        ? new Date(payload.startDate).toISOString()
        : null;
      payload.deadline = payload.deadline
        ? new Date(payload.deadline).toISOString()
        : null;
    } catch (e) {
      toast.error("Data inválida.");
      return;
    }

    try {
      await api.patch(`/problems/${problemId}`, payload);
      toast.success("Atualizado com sucesso!");

      setIsFormDirty(false);

      if (payload.classroomId) {
        navigate(`/class/${payload.classroomId}`, {
          state: { activeTab: "classwork" },
        });
      } else {
        navigate("/dashboard");
      }
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : "Erro ao atualizar.");
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
      <div className="min-h-screen bg-background flex items-center justify-center text-muted">
        <Loader2 className="animate-spin mr-2" /> Carregando...
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-background text-foreground flex flex-col font-sans overflow-hidden">
      {showExitModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-xl shadow-2xl p-6 max-w-sm w-full animate-in zoom-in-95">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 text-amber-500">
                <AlertTriangle size={24} />
                <h3 className="text-lg font-bold text-foreground">
                  Sair da edição?
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
