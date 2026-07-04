import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { toast } from "sonner";
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "../components/ui/Button";

// Importa os nossos novos Editores Especializados
import { ProgrammingEditor } from "../components/problem/ProgrammingEditor";
import { ChemistryEditor } from "../components/problem/ChemistryEditor";
import { HtmlEditor } from "../components/problem/HtmlEditor";

export default function EditProblem() {
  const params = useParams();
  const navigate = useNavigate();

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

        const formatToLocalDatetime = (isoString: string) => {
          const date = new Date(isoString);
          const offset = date.getTimezoneOffset() * 60000;
          return new Date(date.getTime() - offset).toISOString().slice(0, 16);
        };

        let parsedValidationConfig = res.data.validationConfig;
        if (typeof parsedValidationConfig === "string") {
          try {
            parsedValidationConfig = JSON.parse(parsedValidationConfig);
          } catch (e) {
            console.error("Erro ao fazer parse do validationConfig", e);
          }
        }

        // O backend retorna as questões de uma prova na relação `children`,
        // mas o formulário (e o DTO) trabalham com o campo `questions`.
        // Sem esse mapeamento, o formulário carrega `questions` vazio e,
        // ao salvar, o backend apaga todas as questões existentes da prova
        // (um array vazio ainda é "truthy" e aciona a substituição).
        const parentSlug = res.data.slug || "";
        const mapChildToQuestion = (child: any) => {
          let childValidationConfig = child.validationConfig;
          if (typeof childValidationConfig === "string") {
            try {
              childValidationConfig = JSON.parse(childValidationConfig);
            } catch (e) {
              console.error(
                "Erro ao fazer parse do validationConfig da questão",
                e,
              );
            }
          }
          // O backend salva o slug da questão já prefixado com o slug do
          // problema pai (`${parentSlug}--${questionSlug}`). Se devolvermos
          // esse valor combinado para o formulário sem remover o prefixo,
          // cada novo salvamento adicionaria o prefixo de novo
          // (prova-1--prova-1--q1, prova-1--prova-1--prova-1--q1...).
          const rawSlug: string = child.slug || "";
          const prefix = `${parentSlug}--`;
          const childSlug = rawSlug.startsWith(prefix)
            ? rawSlug.slice(prefix.length)
            : rawSlug;

          // Mapeamento explícito (whitelist) em vez de spread: `child` é uma
          // entidade Problem completa (id, classroom, parent, timestamps,
          // etc.), mas CreateQuestionDto só aceita estes campos. Enviar os
          // demais causaria erro de validação ("property X should not
          // exist") por conta do forbidNonWhitelisted.
          return {
            title: child.title || "",
            description: child.description || "",
            slug: childSlug,
            parameters: child.parameters || [],
            returnType: child.returnType || "void",
            timeLimit: child.timeLimit ?? undefined,
            memoryLimit: child.memoryLimit ?? undefined,
            testCases: child.testCases || [],
            starterCode: child.starterCode || [],
            solutionCode: child.solutionCode || [],
            allowedLanguages: child.allowedLanguages || [],
            validationConfig: childValidationConfig,
          };
        };

        const formatted = {
          ...res.data,
          validationConfig: parsedValidationConfig,
          classroomId: res.data.classroomId || res.data.classroom?.id || "",
          parameters: res.data.parameters || [],
          testCases: res.data.testCases || [],
          starterCode: res.data.starterCode || [],
          solutionCode: res.data.solutionCode || [],
          questions: Array.isArray(res.data.children)
            ? res.data.children.map(mapChildToQuestion)
            : [],
          startDate: res.data.startDate
            ? formatToLocalDatetime(res.data.startDate)
            : undefined,
          deadline: res.data.deadline
            ? formatToLocalDatetime(res.data.deadline)
            : undefined,
        };

        // Remove a relação bruta do backend para não vazar campos que o
        // DTO de update não conhece (ex: ids, parent, timestamps aninhados).
        delete (formatted as any).children;

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

    const payload = { ...rawData };

    if (payload.type === "EXERCISE") {
      delete payload.questions;
    }

    if (Array.isArray(payload.testCases)) {
      payload.testCases = payload.testCases.map(({ id, ...rest }: any) => rest);
    }

    if (Array.isArray(payload.questions)) {
      payload.questions = payload.questions.map((question: any) => {
        // maxAttempts/startDate/deadline pertencem só ao problema pai (a
        // prova como um todo). timeLimit/memoryLimit, por outro lado, SÃO
        // aceitos por questão no backend (CreateQuestionDto) — não devem
        // ser removidos.
        const { id, maxAttempts, startDate, deadline, ...cleanQuestion } =
          question;

        return {
          ...cleanQuestion,
          testCases: Array.isArray(question.testCases)
            ? question.testCases.map(({ id: tcId, ...rest }: any) => rest)
            : question.testCases,
        };
      });
    }

    // Tratamento estrito de datas para evitar erro 400 no NestJS
    if (!payload.startDate) delete payload.startDate;
    else {
      try {
        payload.startDate = new Date(payload.startDate).toISOString();
      } catch (e) {}
    }

    if (!payload.deadline) delete payload.deadline;
    else {
      try {
        payload.deadline = new Date(payload.deadline).toISOString();
      } catch (e) {}
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
          {problem?.subject === "CHEMISTRY" ? (
            <ChemistryEditor
              initialValues={problem}
              onSubmit={handleUpdate}
              mode="EDIT"
              onDirtyChange={setIsFormDirty}
            />
          ) : problem?.subject === "HTML" ? (
            <HtmlEditor
              initialValues={problem}
              onSubmit={handleUpdate}
              mode="EDIT"
              onDirtyChange={setIsFormDirty}
            />
          ) : (
            <ProgrammingEditor
              initialValues={problem}
              onSubmit={handleUpdate}
              mode="EDIT"
              onDirtyChange={setIsFormDirty}
            />
          )}
        </div>
      </div>
    </div>
  );
}
