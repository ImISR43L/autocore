import { useState, useCallback } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import type { Problem, Submission } from "../pages/ClassroomView";

/**
 * Concentra todo o estado + handlers da feature de "ver submissões"
 * (lista com filtros, inspeção de uma submissão específica, nota
 * manual) num lugar só — em vez de ~15 useState soltos e 3 funções
 * espalhadas pelo corpo de ClassroomView.tsx, como estava antes.
 *
 * Por que isto existe: a extração anterior (SubmissionsPanel.tsx) só
 * moveu o JSX pra outro arquivo, mas manteve TODO esse estado como
 * useState soltos em ClassroomView — resultando em ~30 props passadas
 * pro componente novo. Isso não reduziu acoplamento nenhum, só
 * mudou onde ele mora, e já rendeu dois bugs reais (setInspectFileIndex
 * escapando via handleStartInspection; tipo Problem|null vs
 * Problem|undefined) só porque estado e handler que deveriam estar
 * sempre juntos ficaram em arquivos diferentes.
 *
 * Com o hook, ClassroomView chama isto uma vez e passa o objeto
 * inteiro como UMA prop (`inspection`) pro SubmissionsPanel — e
 * qualquer botão em outro lugar de ClassroomView que precise abrir
 * esse painel (ex: "Ver Submissões") usa `inspection.setShowSubmissions`
 * a partir do mesmo objeto, então não tem como o estado e o handler que
 * o usa acabarem em arquivos diferentes de novo.
 *
 * Dependências genuinamente externas (não fazem sentido morar aqui,
 * são estado mais amplo de ClassroomView usado em várias outras
 * features, não só nesta): `currentProblem`/`displayProblem` (contexto
 * de qual exercício está aberto) e `fetchSubmissions` (recarrega a
 * lista bruta de submissões, usada em vários outros lugares de
 * ClassroomView além desta feature).
 */
export function useSubmissionsInspection(params: {
  isOwner: boolean;
  currentProblem?: Problem | null;
  displayProblem?: Problem | null;
  fetchSubmissions: (probId: string) => Promise<void>;
}) {
  const { isOwner, currentProblem, displayProblem, fetchSubmissions } = params;

  const [showSubmissions, setShowSubmissions] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedStudentFilter, setSelectedStudentFilter] = useState<
    string | null
  >(null);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<
    string | null
  >(null);

  const [inspectingUser, setInspectingUser] = useState<{
    id: string;
    email: string;
    name?: string;
  } | null>(null);
  const [studentSubmissions, setStudentSubmissions] = useState<
    Record<string, Submission>
  >({});
  const [activeInspectionIndex, setActiveInspectionIndex] = useState(0);
  const [inspectFileIndex, setInspectFileIndex] = useState(0);
  const [selectedSubmission, setSelectedSubmission] =
    useState<Submission | null>(null);

  const [gradingGrade, setGradingGrade] = useState<string | number>("");
  const [gradingComment, setGradingComment] = useState("");

  // Mesma derivação de antes: qual problema (raiz ou questão de prova)
  // está sendo inspecionado agora, e a submissão correspondente.
  const activeInspectionProblem =
    currentProblem?.children && currentProblem.children.length > 0
      ? currentProblem.children[activeInspectionIndex]
      : currentProblem;
  const activeSubmission = activeInspectionProblem
    ? studentSubmissions[activeInspectionProblem.id]
    : null;

  /**
   * Cobre os dois papéis: professor inspecionando a entrega de um
   * aluno (busca a submissão de cada questão da prova) OU o próprio
   * aluno revendo a própria submissão (só abre o modal de detalhe).
   * Sempre foi uma função só — não dois handlers separados.
   */
  const handleStartInspection = useCallback(
    async (targetSubmission: Submission) => {
      if (isOwner) {
        setInspectingUser(targetSubmission.user);
        setStudentSubmissions({});
        setInspectFileIndex(0);
        const targetProblemId = targetSubmission.problem?.id
          ? String(targetSubmission.problem.id)
          : targetSubmission.problemId
            ? String(targetSubmission.problemId)
            : null;

        if (currentProblem) {
          const problemsToFetch =
            currentProblem.children && currentProblem.children.length > 0
              ? currentProblem.children
              : [currentProblem];

          const loadedSubs: Record<string, Submission> = {};
          let foundIndex = 0;

          for (let i = 0; i < problemsToFetch.length; i++) {
            const p = problemsToFetch[i];
            try {
              const res = await api.get(`/submissions/problem/${p.id}`);
              const userSub = res.data.find(
                (s: Submission) => s.user.id === targetSubmission.user.id,
              );
              if (userSub) {
                loadedSubs[p.id] = userSub;
                if (targetProblemId === String(p.id)) foundIndex = i;
              }
            } catch (e) {
              console.error(e);
              // fallback: se o fetch falhar para o problema clicado, usa o que já temos
              if (targetProblemId === String(p.id)) {
                loadedSubs[p.id] = targetSubmission;
                foundIndex = i;
              }
            }
          }
          setStudentSubmissions(loadedSubs);
          setActiveInspectionIndex(foundIndex);

          const activeProbId = problemsToFetch[foundIndex].id;
          if (loadedSubs[activeProbId]) {
            setGradingGrade(loadedSubs[activeProbId].grade ?? "");
            setGradingComment(loadedSubs[activeProbId].teacherComment ?? "");
          } else {
            setGradingGrade("");
            setGradingComment("");
          }
        }
      } else {
        setSelectedSubmission(targetSubmission);
        setShowModal(true);
      }
    },
    [isOwner, currentProblem],
  );

  const handleSaveGrade = useCallback(async () => {
    if (!currentProblem || !inspectingUser) return;
    const targetProb =
      currentProblem.children && currentProblem.children.length > 0
        ? currentProblem.children[activeInspectionIndex]
        : currentProblem;
    const sub = studentSubmissions[targetProb.id];
    if (!sub) return toast.error("Nenhuma submissão para dar nota.");
    try {
      await api.patch(`/submissions/${sub.id}/grade`, {
        grade: gradingGrade === "" ? null : Number(gradingGrade),
        teacherComment: gradingComment,
      });
      toast.success("Nota salva!");
      setStudentSubmissions((prev) => ({
        ...prev,
        [targetProb.id]: {
          ...sub,
          grade: Number(gradingGrade),
          teacherComment: gradingComment,
        },
      }));
    } catch {
      toast.error("Erro ao salvar nota.");
    }
  }, [currentProblem, inspectingUser, activeInspectionIndex, studentSubmissions, gradingGrade, gradingComment]);

  const handleMarkAsDelivery = useCallback(
    async (subId: string) => {
      try {
        await api.patch(`/submissions/${subId}/deliver`);
        toast.success("Submissão definida como entrega oficial!");
        if (displayProblem) {
          fetchSubmissions(displayProblem.id);
        }
      } catch {
        toast.error("Erro ao definir entrega.");
      }
    },
    [displayProblem, fetchSubmissions],
  );

  return {
    showSubmissions,
    setShowSubmissions,
    showModal,
    setShowModal,
    selectedStudentFilter,
    setSelectedStudentFilter,
    selectedStatusFilter,
    setSelectedStatusFilter,
    inspectingUser,
    setInspectingUser,
    studentSubmissions,
    activeInspectionIndex,
    setActiveInspectionIndex,
    inspectFileIndex,
    setInspectFileIndex,
    selectedSubmission,
    setSelectedSubmission,
    gradingGrade,
    setGradingGrade,
    gradingComment,
    setGradingComment,
    activeSubmission,
    handleStartInspection,
    handleSaveGrade,
    handleMarkAsDelivery,
  };
}

export type SubmissionsInspection = ReturnType<typeof useSubmissionsInspection>;
