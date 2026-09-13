import { useState } from "react";
import Editor from "@monaco-editor/react";
import { ErDiagramCanvas } from "../erDiagram/ErDiagramCanvas";
import { EMPTY_ER_MODEL } from "../../types/erModel";
import { MoleculeWorkspace } from "../../features/molecule-env";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Card } from "../ui/Card";
import { cn } from "../../lib/utils";
import {
  Users,
  Clock,
  XCircle,
  Filter,
  CheckCircle,
  ClipboardPaste,
  Copy,
  FileCode,
  GraduationCap,
  MessageSquare,
  Settings,
  AlertTriangle,
  Beaker,
} from "lucide-react";
import type {
  Classroom,
  Problem,
  Submission,
  ActivityLog,
} from "../../pages/ClassroomView";
import type { SubmissionsInspection } from "../../hooks/useSubmissionsInspection";

/**
 * Extraído de ClassroomView.tsx (região antes controlada só pela flag
 * `showSubmissions`, daí o nome que ficou no time). Concentra os dois
 * modais do fluxo de submissões: a LISTA (com filtros por aluno/status)
 * e o DETALHE/inspeção de uma submissão específica (código, preview,
 * nota manual). Os dois ficam juntos porque um abre o outro
 * (`handleStartInspection`), não fazia sentido separar em dois arquivos.
 *
 * FIX (redução de props): a primeira versão desta extração recebia ~24
 * props soltas (um useState de ClassroomView virando uma prop cada) —
 * só moveu o JSX, não reduziu acoplamento nenhum, e já rendeu dois bugs
 * reais (um setter escapando via um handler que ficou no arquivo
 * errado; um tipo Problem|null vs Problem|undefined dessincronizado).
 * Tudo que é estado+handler da PRÓPRIA feature de inspeção agora vem
 * agrupado em `inspection` (ver useSubmissionsInspection) — só o que é
 * genuinamente contexto mais amplo de ClassroomView (qual problema está
 * aberto, se é o professor, tema do editor) continua como prop solta.
 *
 * `showReferenceInInspector` continua estado local deste componente —
 * nunca precisou sair daqui, só é lido/escrito neste arquivo.
 */
interface SubmissionsPanelProps {
  isOwner: boolean;
  classroom: Classroom;
  displayProblem?: Problem | null;
  currentProblem?: Problem | null;
  submissions: Submission[];
  hasTeacher: boolean;
  monacoTheme: string;
  screenReaderMode: boolean;
  inspection: SubmissionsInspection;
}

export function SubmissionsPanel({
  isOwner,
  classroom,
  displayProblem,
  currentProblem,
  submissions,
  hasTeacher,
  monacoTheme,
  screenReaderMode,
  inspection,
}: SubmissionsPanelProps) {
  // Desestruturado de `inspection` em vez de vir como props soltas —
  // ver comentário acima. Nomes idênticos aos de antes de propósito,
  // pra todo o JSX abaixo continuar funcionando sem precisar tocar em
  // mais nada além desta desestruturação.
  const {
    studentSubmissions,
    activeSubmission,
    selectedSubmission,
    setSelectedSubmission,
    selectedStudentFilter,
    setSelectedStudentFilter,
    selectedStatusFilter,
    setSelectedStatusFilter,
    showSubmissions,
    setShowSubmissions,
    showModal,
    setShowModal,
    inspectingUser,
    setInspectingUser,
    activeInspectionIndex,
    setActiveInspectionIndex,
    inspectFileIndex,
    setInspectFileIndex,
    gradingGrade,
    setGradingGrade,
    gradingComment,
    setGradingComment,
    handleMarkAsDelivery,
    handleSaveGrade,
    handleStartInspection,
  } = inspection;

  // Local deste componente — nunca precisou ser prop, só é lido/escrito
  // aqui dentro.
  const [showReferenceInInspector, setShowReferenceInInspector] =
    useState(false);

  // Mesmo fix que corrigiu o bug relatado: a submissão realmente sendo
  // inspecionada é `activeSubmission` (professor olhando a entrega de um
  // aluno) ou `selectedSubmission` (aluno revendo a própria entrega) —
  // nunca os dois ao mesmo tempo.
  const inspectedSubmission = isOwner ? activeSubmission : selectedSubmission;

  return (
    <>
      {showSubmissions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 md:p-6">
          <div className="bg-background w-full max-w-5xl max-h-[90vh] rounded-xl border border-border flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-border bg-surface">
              <h3 className="text-xl md:text-2xl font-semibold text-foreground flex items-center gap-3">
                {isOwner ? (
                  <Users size={24} className="text-primary" />
                ) : (
                  <Clock size={24} className="text-primary" />
                )}
                {isOwner ? "Entregas dos Alunos" : "Histórico de Envios"}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSubmissions(false)}
                className="h-10 w-10"
              >
                <XCircle size={24} />
              </Button>
            </div>

            {/* Filtros */}
            <div className="p-4 border-b border-border bg-surface/50 flex flex-col sm:flex-row items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-muted font-medium uppercase tracking-wider whitespace-nowrap">
                <Filter size={16} /> Filtros:
              </div>

              {/* Filtro de Aluno (Apenas Professor) */}
              {isOwner && (
                <Select
                  className="w-full sm:w-64 h-10 text-base"
                  value={selectedStudentFilter || ""}
                  onChange={(e) =>
                    setSelectedStudentFilter(e.target.value || null)
                  }
                >
                  <option value="">Todos os Alunos</option>
                  {classroom?.students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name ? `${s.name} (${s.email})` : s.email}
                    </option>
                  ))}
                </Select>
              )}

              {/* Filtro de Status (Novo) */}
              <Select
                className="w-full sm:w-48 h-10 text-base"
                value={selectedStatusFilter || ""}
                onChange={(e) =>
                  setSelectedStatusFilter(e.target.value || null)
                }
              >
                <option value="">Todos os Status</option>
                <option value="Accepted">Accepted</option>
                <option value="Wrong Answer">Wrong Answer</option>
                <option value="Runtime Error">Runtime Error</option>
                <option value="Time Limit Exceeded">Time Limit Exceeded</option>
                <option value="Compilation Error">Compilation Error</option>
              </Select>
            </div>

            {/* Lista com Scroll Horizontal no Mobile */}
            <div className="flex-1 overflow-auto p-0">
              <div className="min-w-[600px] md:min-w-full">
                <table className="w-full text-base text-left">
                  <thead className="text-sm text-muted uppercase bg-surface sticky top-0">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">Data</th>
                      <th className="px-6 py-4 font-semibold">Tempo</th>
                      <th className="px-6 py-4 font-semibold">Memória</th>
                      {isOwner ? (
                        <th className="px-6 py-4 font-semibold">Aluno</th>
                      ) : (
                        <th className="px-6 py-4 font-semibold">Entrega</th>
                      )}
                      <th className="px-6 py-4 text-right font-semibold">
                        Detalhes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {submissions
                      .filter(
                        (s) =>
                          (!selectedStudentFilter ||
                            s.user.id === selectedStudentFilter) &&
                          (!selectedStatusFilter ||
                            s.status === selectedStatusFilter),
                      )
                      .map((sub) => (
                        <tr
                          key={sub.id}
                          className="hover:bg-surface/50 transition-colors"
                        >
                          {/* ... tds de status, data, tempo, memória (mantém iguais) ... */}
                          <td className="px-6 py-4">{/* status */}</td>
                          <td className="px-6 py-4 text-foreground whitespace-nowrap">
                            {new Date(sub.createdAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-muted font-mono">
                            {sub.executionTime}ms
                          </td>
                          <td className="px-6 py-4 text-muted font-mono">
                            {sub.memoryUsage}KB
                          </td>

                          {isOwner ? (
                            <td className="px-6 py-4 text-foreground">
                              <div className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold">
                                  {sub.user?.email?.charAt(0)?.toUpperCase() ||
                                    "U"}
                                </div>
                                <span className="truncate max-w-[180px]">
                                  {sub.user?.name ||
                                    sub.user?.email ||
                                    "Conta Excluída"}
                                </span>
                              </div>
                            </td>
                          ) : (
                            <td className="px-6 py-4">
                              {sub.isDelivery ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-success/10 text-success text-xs font-bold uppercase tracking-wider border border-success/20">
                                  <CheckCircle size={14} /> Entregue
                                </span>
                              ) : hasTeacher ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleMarkAsDelivery(sub.id)}
                                  className="h-8 text-xs whitespace-nowrap"
                                >
                                  Marcar Entrega
                                </Button>
                              ) : (
                                <span
                                  className="text-xs text-muted"
                                  title="Turma sem professor"
                                >
                                  Bloqueado
                                </span>
                              )}
                            </td>
                          )}
                          <td className="px-6 py-4 text-right">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-8 text-sm"
                              onClick={() => handleStartInspection(sub)}
                            >
                              {isOwner ? "Avaliar" : "Detalhes"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: DETALHES/NOTAS (OVERLAY) --- */}
      {(inspectingUser || showModal) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/90 backdrop-blur-sm p-4 md:p-6">
          <div className="bg-background w-full max-w-7xl h-[90vh] rounded-xl border border-border flex flex-col shadow-2xl overflow-hidden">
            {/* Header Inspeção */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-border bg-surface">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-foreground mb-1">
                  {isOwner && inspectingUser
                    ? `Avaliando: ${inspectingUser.name || inspectingUser.email}`
                    : "Detalhes da Submissão"}
                </h2>
                <p className="text-sm text-muted">
                  {activeSubmission
                    ? `Enviado em ${new Date(activeSubmission.createdAt).toLocaleString()}`
                    : selectedSubmission
                      ? `Enviado em ${new Date(selectedSubmission.createdAt).toLocaleString()}`
                      : ""}
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                className="h-9 px-4 text-sm"
                onClick={() => {
                  setInspectingUser(null);
                  setShowModal(false);
                  setSelectedSubmission(null);
                }}
              >
                Fechar
              </Button>

              {isOwner && (
                <div className="mt-6 border-t border-border pt-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-foreground">
                    <AlertTriangle className="w-5 h-5 text-warning" />
                    Logs de Atividade Suspeita
                  </h3>

                  {!activeSubmission?.activityLogs?.length ? (
                    <p className="text-sm text-muted">
                      Nenhuma atividade anormal detectada.
                    </p>
                  ) : (
                    <ul className="space-y-3 max-h-60 overflow-y-auto pr-2">
                      {activeSubmission.activityLogs.map(
                        (log: ActivityLog, index: number) => (
                          <li
                            key={index}
                            className="flex items-start gap-3 bg-surface p-3 rounded-md border border-border"
                          >
                            {log.action === "PASTE" ? (
                              <ClipboardPaste className="w-4 h-4 text-destructive mt-1" />
                            ) : (
                              <Copy className="w-4 h-4 text-blue-500 mt-1" />
                            )}
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                Ação:{" "}
                                {log.action === "PASTE"
                                  ? "Colagem externa"
                                  : "Cópia de código"}
                              </p>
                              <p className="text-xs text-muted mt-0.5">
                                {log.details}
                              </p>
                              <p className="text-xs text-muted/70 mt-1">
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </p>
                            </div>
                          </li>
                        ),
                      )}
                    </ul>
                  )}
                </div>
              )}

              {isOwner &&
                currentProblem?.children &&
                currentProblem.children.length > 1 && (
                  <div className="flex items-center gap-2 px-4 md:px-6 py-3 border-b border-border bg-surface/50 overflow-x-auto no-scrollbar">
                    <span className="text-xs text-muted font-semibold uppercase tracking-wider whitespace-nowrap mr-2">
                      Questão:
                    </span>
                    {currentProblem.children.map((child, idx) => (
                      <button
                        key={child.id}
                        onClick={() => {
                          setActiveInspectionIndex(idx);
                          const sub = studentSubmissions[child.id];
                          if (sub) {
                            setGradingGrade(sub.grade ?? "");
                            setGradingComment(sub.teacherComment ?? "");
                          } else {
                            setGradingGrade("");
                            setGradingComment("");
                          }
                        }}
                        title={child.title}
                        className={cn(
                          "w-9 h-9 rounded-lg text-sm font-bold border-2 transition-all flex-none flex items-center justify-center",
                          activeInspectionIndex === idx
                            ? "bg-primary border-primary text-primary-foreground scale-110 shadow-lg"
                            : "bg-surface border-border text-muted hover:border-primary/50 hover:text-foreground",
                        )}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>
                )}
            </div>

            <div className="flex-1 flex flex-col lg:flex-row min-h-0">
              {/* Lado Esquerdo: Código */}
              <div className="flex-1 lg:border-r border-border flex flex-col min-h-[300px]">
                <div className="bg-surface p-3 border-b border-border text-sm text-muted flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {classroom?.subject === "CHEMISTRY" ? (
                      <Beaker size={18} />
                    ) : (
                      <FileCode size={18} />
                    )}
                    Visualizador de Resolução
                  </div>

                  {/* Navegação de arquivos na inspeção */}
                  {(inspectedSubmission?.files?.length || 0) > 1 && (
                    <div className="flex bg-background/20 rounded overflow-hidden">
                      {inspectedSubmission?.files.map((f, idx) => (
                        <button
                          key={idx}
                          onClick={() => setInspectFileIndex(idx)}
                          className={cn(
                            "px-3 py-1.5 text-xs font-medium hover:bg-white/5 transition-colors",
                            inspectFileIndex === idx
                              ? "text-primary bg-white/5"
                              : "text-muted",
                          )}
                        >
                          {f.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* SQL_MODELING não tem "arquivos" — em vez de abas de
                      arquivo, alterna entre a resposta do aluno e o
                      gabarito (se o professor desenhou um), já que ainda
                      não existe diff automático entre os dois. */}
                  {displayProblem?.subject === "SQL_MODELING" &&
                    (displayProblem?.referenceModel?.entities?.length || 0) >
                      0 && (
                      <div className="flex bg-background/20 rounded overflow-hidden">
                        <button
                          onClick={() => setShowReferenceInInspector(false)}
                          className={cn(
                            "px-3 py-1.5 text-xs font-medium hover:bg-white/5 transition-colors",
                            !showReferenceInInspector
                              ? "text-primary bg-white/5"
                              : "text-muted",
                          )}
                        >
                          Resposta do aluno
                        </button>
                        <button
                          onClick={() => setShowReferenceInInspector(true)}
                          className={cn(
                            "px-3 py-1.5 text-xs font-medium hover:bg-white/5 transition-colors",
                            showReferenceInInspector
                              ? "text-primary bg-white/5"
                              : "text-muted",
                          )}
                        >
                          Gabarito
                        </button>
                      </div>
                    )}
                </div>

                <div className="flex-1 relative bg-background">
                  {classroom?.subject === "CHEMISTRY" ? (
                    <MoleculeWorkspace
                      key={
                        activeSubmission?.id ||
                        selectedSubmission?.id ||
                        "viewer"
                      }
                      initialSmiles={
                        (isOwner &&
                          activeSubmission?.files[inspectFileIndex]?.content) ||
                        (!isOwner &&
                          selectedSubmission?.files[inspectFileIndex]
                            ?.content) ||
                        ""
                      }
                      initialMode={
                        displayProblem?.validationConfig?.expectedMode as any
                      }
                    />
                  ) : displayProblem?.subject === "SQL" ? (
                    <Editor
                      height="100%"
                      width="100%"
                      language="sql"
                      theme={monacoTheme}
                      value={
                        (isOwner &&
                          activeSubmission?.files[inspectFileIndex]?.content) ||
                        selectedSubmission?.files[inspectFileIndex]?.content ||
                        "-- Consulta não disponível"
                      }
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 16,
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        accessibilitySupport: screenReaderMode ? "on" : "auto",
                      }}
                    />
                  ) : displayProblem?.subject === "SQL_MODELING" ? (
                    <ErDiagramCanvas
                      key={`inspect-${
                        showReferenceInInspector ? "reference" : "student"
                      }-${activeSubmission?.id || selectedSubmission?.id || "viewer"}`}
                      initialValue={
                        showReferenceInInspector
                          ? (displayProblem?.referenceModel ?? EMPTY_ER_MODEL)
                          : ((isOwner
                              ? activeSubmission?.modelData
                              : selectedSubmission?.modelData) ??
                            EMPTY_ER_MODEL)
                      }
                      readOnly
                    />
                  ) : (
                    <Editor
                      height="100%"
                      width="100%"
                      language="python"
                      theme={monacoTheme}
                      value={
                        (isOwner &&
                          activeSubmission?.files[inspectFileIndex]?.content) ||
                        selectedSubmission?.files[inspectFileIndex]?.content ||
                        "// Código não disponível"
                      }
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 16,
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        accessibilitySupport: screenReaderMode ? "on" : "auto",
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Lado Direito: Feedback e Notas */}
              <div className="w-full lg:w-[450px] bg-surface flex flex-col p-6 overflow-y-auto border-t lg:border-t-0 lg:border-l border-border h-1/2 lg:h-full">
                <div className="space-y-8">
                  {/* Status Card */}
                  <Card className="bg-surface border-border p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-muted uppercase font-bold tracking-wider">
                        Veredito
                      </span>
                      {(activeSubmission?.status ||
                        selectedSubmission?.status) === "Accepted" ? (
                        <CheckCircle size={20} className="text-success" />
                      ) : (
                        <XCircle size={20} className="text-destructive" />
                      )}
                    </div>
                    <div
                      className={cn(
                        "text-2xl font-bold",
                        (activeSubmission?.status ||
                          selectedSubmission?.status) === "Accepted"
                          ? "text-success"
                          : "text-destructive",
                      )}
                    >
                      {activeSubmission?.status || selectedSubmission?.status}
                    </div>
                  </Card>

                  {/* Logs */}
                  <div>
                    <h4 className="text-base font-bold text-foreground mb-3">
                      Saída / Logs
                    </h4>
                    <div className="bg-background rounded-lg p-4 text-sm font-mono text-foreground max-h-60 overflow-y-auto border border-border">
                      <pre>
                        {activeSubmission?.output ||
                          selectedSubmission?.output ||
                          "Sem saída."}
                      </pre>
                    </div>
                  </div>

                  {/* Área de Nota (Apenas Professor) */}
                  {isOwner && (
                    <div className="pt-8 border-t border-border space-y-6">
                      <h4 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <Settings size={20} /> Avaliação Manual
                      </h4>

                      <div className="space-y-2.5">
                        <label className="text-sm text-muted font-medium">
                          Nota (0-10)
                        </label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={gradingGrade}
                          onChange={(e) => setGradingGrade(e.target.value)}
                          className="h-11 text-base disabled:opacity-50"
                          disabled={classroom.isArchived} // <-- Trava
                        />
                      </div>

                      <div className="space-y-2.5">
                        <label className="text-sm text-muted font-medium">
                          Comentários
                        </label>
                        <textarea
                          disabled={classroom.isArchived} // <-- Trava
                          className="w-full bg-background/20 border border-border rounded-lg p-3 text-base text-foreground resize-none h-32 focus:outline-none focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="Feedback para o aluno..."
                          value={gradingComment}
                          onChange={(e) => setGradingComment(e.target.value)}
                        />
                      </div>

                      <Button
                        className="w-full h-11 text-base"
                        disabled={classroom.isArchived} // <-- Trava
                        onClick={handleSaveGrade}
                      >
                        Salvar Avaliação
                      </Button>
                    </div>
                  )}

                  {/* Área de Visualização do Feedback (Apenas Aluno) */}
                  {!isOwner &&
                    (selectedSubmission?.grade != null ||
                      selectedSubmission?.teacherComment) && (
                      <div className="pt-8 border-t border-border space-y-6">
                        <h4 className="text-lg font-bold text-foreground flex items-center gap-2">
                          <GraduationCap size={20} className="text-primary" />{" "}
                          Feedback do Professor
                        </h4>

                        {selectedSubmission.grade != null && (
                          <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-between">
                            <span className="text-sm text-muted uppercase font-bold tracking-wider">
                              Nota Final
                            </span>
                            <span className="text-3xl font-bold text-primary">
                              {selectedSubmission.grade}
                            </span>
                          </div>
                        )}

                        {selectedSubmission.teacherComment && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-muted font-medium">
                              <MessageSquare size={16} /> Comentários:
                            </div>
                            <div className="p-4 bg-surface border border-border rounded-lg text-foreground text-sm leading-relaxed whitespace-pre-wrap">
                              {selectedSubmission.teacherComment}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
