import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  LogOut,
  Users,
  Search,
  BookOpen,
  GraduationCap,
  Crown,
  School,
  ArrowRight,
  Clock,
  X,
  Copy,
  Archive,
  RefreshCcw,
  Trash2,
  Code,
  Beaker,
  Globe,
} from "lucide-react";
import { toast } from "sonner";

// UI Components
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { cn } from "../lib/utils";

// Interfaces
interface Problem {
  id: string;
  title: string;
  deadline?: string;
  startDate?: string;
}

interface PendingWork {
  id: string;
  title: string;
  deadline: Date;
}

interface Classroom {
  id: string;
  name: string;
  code: string;
  subject?: "PROGRAMMING" | "CHEMISTRY" | "HTML";
  owner: {
    id: string;
    email: string;
  };
  problems?: Problem[];
  _count?: {
    students: number;
    problems: number;
  };
  isArchived?: boolean;
}

export default function Dashboard() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [viewMode, setViewMode] = useState<"active" | "archived">("active");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modais
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassroomSubject, setNewClassroomSubject] = useState<
    "PROGRAMMING" | "CHEMISTRY" | "HTML"
  >("PROGRAMMING");
  const [joinCode, setJoinCode] = useState("");

  const navigate = useNavigate();

  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("Visitante");

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setMyUserId(user.id);

        try {
          const res = await api.get("/users/me"); // Ajustar para o endpoint real que retorna o User
          if (res.data?.name) {
            setUserName(res.data.name.split(" ")[0]);
            return;
          }
        } catch (e) {}

        const metaName =
          user.user_metadata?.full_name || user.user_metadata?.name;
        if (metaName && metaName.trim() !== "") {
          setUserName(metaName.split(" ")[0]);
        } else if (user.email) {
          setUserName(user.email.split("@")[0]);
        } else {
          setUserName("Visitante");
        }
      }
    };
    getUser();
  }, []);

  useEffect(() => {
    fetchClassrooms();
  }, [viewMode]);

  const fetchClassrooms = async () => {
    try {
      // Validação delegada ao estado assíncrono do Supabase
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/");
        return;
      }
      const endpoint =
        viewMode === "active" ? "/classrooms" : "/classrooms/archived";
      const res = await api.get(endpoint);
      setClassrooms(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error(error);
      toast.error("Sessão expirada. Faça login novamente.");
      await supabase.auth.signOut();
    } finally {
      setLoading(false);
    }
  };

  const getPendingForClass = (cls: Classroom): PendingWork[] => {
    if (!cls.problems) return [];
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);

    const isOwner = cls.owner?.id === myUserId;

    return cls.problems
      .filter((p) => {
        if (!p.deadline) return false;
        if (!isOwner && p.startDate && new Date(p.startDate) > now) {
          return false;
        }
        return true;
      })
      .map((p) => ({ ...p, deadline: new Date(p.deadline!) }))
      .filter((p) => p.deadline > now && p.deadline <= nextWeek)
      .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
      .slice(0, 3);
  };

  const formatDeadline = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    return `${day}/${month} às ${hours}:${minutes}`;
  };

  const navigateToAssignment = (
    e: React.MouseEvent,
    classId: string,
    problemId: string,
  ) => {
    e.stopPropagation();
    navigate(`/class/${classId}`, { state: { problemId: problemId } });
  };

  const handleCreateClassroom = async () => {
    if (!newClassName.trim()) {
      toast.error("O nome da turma é obrigatório.");
      return;
    }

    try {
      const response = await api.post("/classrooms", {
        name: newClassName,
        subject: newClassroomSubject,
      });

      setClassrooms([response.data, ...classrooms]);
      setShowCreateModal(false);
      setNewClassName("");
      setNewClassroomSubject("PROGRAMMING");
      toast.success("Turma criada com sucesso!");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao criar turma");
    }
  };

  const handleJoinClassroom = async () => {
    if (!joinCode.trim()) return toast.warning("Código inválido");
    try {
      await api.post("/classrooms/join", { code: joinCode });
      toast.success("Você entrou na turma!");
      setShowJoinModal(false);
      setJoinCode("");
      fetchClassrooms();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao entrar");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const filteredClassrooms = classrooms.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase()),
  );

  const handleArchive = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.patch(`/classrooms/${id}/archive`);
      toast.success("Turma arquivada com sucesso!");
      fetchClassrooms();
    } catch (error) {
      toast.error("Erro ao arquivar turma");
    }
  };

  const handleRestore = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.patch(`/classrooms/${id}/restore`);
      toast.success("Turma restaurada!");
      fetchClassrooms();
    } catch (error) {
      toast.error("Erro ao restaurar turma");
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (
      !window.confirm(
        "Atenção: A exclusão física apagará permanentemente a turma, problemas e submissões dos alunos. Deseja continuar?",
      )
    )
      return;
    try {
      await api.delete(`/classrooms/${id}`);
      toast.success("Turma excluída permanentemente.");
      fetchClassrooms();
    } catch (error) {
      toast.error("Erro ao excluir turma.");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/20">
      {/* NAVBAR */}
      <nav className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur-md px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center transition-all">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg border border-primary/20 dark:border-primary/10">
            <GraduationCap size={24} className="text-primary sm:w-7 sm:h-7" />
          </div>
          <span className="font-bold text-lg sm:text-xl tracking-tight text-foreground hidden sm:inline-block">
            AutoCore
          </span>
          <span className="font-bold text-lg tracking-tight text-foreground sm:hidden">
            AC
          </span>
        </div>
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="text-destructive hover:opacity-80 hover:bg-destructive/10 text-sm h-9 px-3"
        >
          <LogOut size={18} className="mr-2" />
          <span className="hidden sm:inline">Sair</span>
        </Button>
      </nav>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-10">
        {/* CABEÇALHO (Responsivo: Stack no mobile, Row no desktop) */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8 sm:mb-10">
          <div className="w-full md:w-auto">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2 sm:mb-3">
              Olá, <span className="text-primary">{userName}</span>!
            </h1>
            <p className="text-muted text-sm sm:text-lg">
              Aqui está o resumo das suas atividades acadêmicas.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <Button
              variant="secondary"
              onClick={() => setShowJoinModal(true)}
              className="shadow-sm h-11 sm:h-12 px-6 text-sm sm:text-base w-full sm:w-auto justify-center"
            >
              <Users size={20} className="mr-2" /> Entrar em Turma
            </Button>
            <Button
              variant="primary"
              onClick={() => setShowCreateModal(true)}
              className="shadow-md shadow-primary/20 h-11 sm:h-12 px-6 text-sm sm:text-base w-full sm:w-auto justify-center"
            >
              <Plus size={20} className="mr-2" /> Criar Nova Turma
            </Button>
          </div>
        </header>

        {/* BARRA DE FERRAMENTAS */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
          <div className="relative w-full max-w-full sm:max-w-md">
            <Search
              size={20}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
            <Input
              type="text"
              placeholder="Buscar turmas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-surface border-border focus:border-primary/50 h-11 sm:h-12 text-sm sm:text-base w-full"
            />
          </div>
          <div className="text-sm sm:text-base text-muted w-full sm:w-auto text-left">
            Mostrando{" "}
            <strong className="text-foreground">
              {filteredClassrooms.length}
            </strong>{" "}
            turmas
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 border-b border-border pb-4">
            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
              <Button
                variant={viewMode === "active" ? "secondary" : "ghost"}
                onClick={() => {
                  if (viewMode !== "active") {
                    setLoading(true);
                    setClassrooms([]); // Destrói o estado anterior instantaneamente
                    setViewMode("active");
                  }
                }}
                className="h-10 text-sm whitespace-nowrap"
              >
                <BookOpen size={16} className="mr-2" /> Turmas Ativas
              </Button>
              <Button
                variant={viewMode === "archived" ? "secondary" : "ghost"}
                onClick={() => {
                  if (viewMode !== "archived") {
                    setLoading(true);
                    setClassrooms([]); // Destrói o estado anterior instantaneamente
                    setViewMode("archived");
                  }
                }}
                className="h-10 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground"
              >
                <Archive size={16} className="mr-2" /> Turmas Arquivadas
              </Button>
            </div>

            <div className="relative w-full sm:w-64 flex-shrink-0">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              />
              <Input
                type="text"
                placeholder="Buscar turmas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 text-sm w-full bg-surface border-border"
              />
            </div>
          </div>
        </div>

        {/* GRID DE TURMAS (Responsivo: 1 col mobile -> 2 sm -> 3 lg) */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary mb-4"></div>
            <span className="text-lg">Carregando turmas...</span>
          </div>
        ) : filteredClassrooms.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredClassrooms.map((c) => {
              const isOwner = c.owner?.id === myUserId;
              const pendingWork = getPendingForClass(c);

              return (
                <div
                  key={c.id}
                  onClick={() => navigate(`/class/${c.id}`)}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-all active:scale-[0.98] sm:hover:scale-[1.01] hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 cursor-pointer"
                >
                  {/* Banner do Card */}
                  <div
                    className={cn(
                      "h-16 sm:h-20 px-4 sm:px-6 flex items-center justify-between border-b border-border bg-surface",
                      isOwner
                        ? "bg-gradient-to-r from-primary/15 dark:from-primary/10 to-transparent"
                        : "bg-gradient-to-r from-muted/20 dark:from-white/5 to-transparent",
                    )}
                  >
                    <div className="p-3 bg-primary/10 text-primary rounded-lg">
                      {c.subject === "CHEMISTRY" ? (
                        <Beaker size={24} />
                      ) : c.subject === "HTML" ? (
                        <Globe size={24} />
                      ) : (
                        <Code size={24} />
                      )}
                    </div>
                    {isOwner ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium text-primary-dark dark:text-primary border border-primary/20 dark:border-primary/10">
                        <Crown size={14} />{" "}
                        <span className="hidden xs:inline">
                          {c.owner?.id ? `Professor` : "Professor Excluído"}
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-background/50 dark:bg-muted/10 px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium text-foreground border border-border/80 dark:border-border/50">
                        <School size={14} />{" "}
                        <span className="hidden xs:inline">Aluno</span>
                      </span>
                    )}
                    <span
                      className="font-mono text-xs sm:text-sm text-muted/80 tracking-wider flex items-center gap-1.5 cursor-pointer hover:text-foreground transition-colors group z-10"
                      onClick={(e) => {
                        e.stopPropagation(); // Impede que o clique acesse o redirecionamento do card
                        navigator.clipboard.writeText(c.code);
                        toast.success("Código copiado!");
                      }}
                      title="Clique para copiar"
                    >
                      {c.code}
                      <Copy
                        size={14}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </span>
                  </div>

                  {/* Corpo do Card */}
                  <div className="flex flex-1 flex-col p-4 sm:p-6">
                    <h3 className="text-xl sm:text-2xl font-semibold text-foreground mb-4 sm:mb-6 line-clamp-1 group-hover:text-primary transition-colors">
                      {c.name}
                    </h3>

                    {/* SEÇÃO DE PENDÊNCIAS */}
                    <div className="flex-1 mb-4 sm:mb-6">
                      {pendingWork.length > 0 ? (
                        <>
                          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-muted uppercase tracking-wider mb-2 sm:mb-3">
                            <Clock size={12} /> Próximas Entregas
                          </div>
                          <div className="space-y-2 sm:space-y-3">
                            {pendingWork.map((work) => (
                              <div
                                key={work.id}
                                onClick={(e) =>
                                  navigateToAssignment(e, c.id, work.id)
                                }
                                className="flex items-center justify-between rounded-md bg-background/50 p-2 sm:p-3 text-xs sm:text-sm text-foreground border border-border/50 hover:border-primary/30 hover:bg-background transition-colors"
                              >
                                <span
                                  className="truncate max-w-[120px] sm:max-w-[160px]"
                                  title={work.title}
                                >
                                  {work.title}
                                </span>
                                <span className="text-destructive whitespace-nowrap ml-2 text-[10px] sm:text-xs font-medium">
                                  {formatDeadline(work.deadline)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="h-full flex items-center text-sm sm:text-base text-muted italic">
                          Nenhuma entrega pendente.
                        </div>
                      )}
                    </div>

                    <div className="mt-auto pt-4 sm:pt-5">
                      {viewMode === "active" ? (
                        <div className="flex items-center justify-between border-t border-border pt-3 text-xs sm:text-sm text-muted">
                          <span className="group-hover:text-foreground transition-colors">
                            {isOwner
                              ? "Gerenciar Turma"
                              : "Ver Todas Atividades"}
                          </span>
                          <div className="flex gap-2">
                            {isOwner && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-muted hover:text-orange-500 hover:bg-orange-500/10"
                                onClick={(e) => handleArchive(e, c.id)}
                                title="Arquivar Turma"
                              >
                                <Archive size={16} />
                              </Button>
                            )}
                            <ArrowRight
                              size={16}
                              className="text-primary opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all self-center ml-2"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 border-t border-border pt-3">
                          <span className="text-xs text-orange-500 font-medium text-center mb-1">
                            Turma em modo Somente Leitura
                          </span>
                          <div className="flex gap-2 justify-between">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="flex-1 h-9 bg-surface-hover hover:bg-surface-active text-xs"
                              onClick={(e) => handleRestore(e, c.id)}
                            >
                              <RefreshCcw size={14} className="mr-1.5" />{" "}
                              Restaurar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex-1 h-9 text-destructive hover:bg-destructive/10 text-xs"
                              onClick={(e) => handleDelete(e, c.id)}
                            >
                              <Trash2 size={14} className="mr-1.5" /> Excluir
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* EMPTY STATE */
          <div className="flex flex-col items-center justify-center py-16 sm:py-24 bg-surface/30 border border-dashed border-border rounded-xl px-4 text-center">
            <div className="bg-surface p-4 sm:p-6 rounded-full mb-4 sm:mb-6 border border-border">
              <BookOpen size={40} className="text-muted sm:w-12 sm:h-12" />
            </div>
            <h3 className="text-lg sm:text-xl font-medium text-foreground mb-2">
              Nenhuma turma encontrada
            </h3>
            <p className="text-muted text-sm sm:text-base max-w-md mb-6 sm:mb-8">
              {search
                ? `Não encontramos nenhuma turma com o nome "${search}".`
                : "Você ainda não participa de nenhuma turma."}
            </p>
            {!search && (
              <Button
                onClick={() => setShowJoinModal(true)}
                size="md"
                className="h-11 sm:h-12 px-6 sm:px-8 text-sm sm:text-base"
              >
                Começar Agora
              </Button>
            )}
          </div>
        )}
      </main>

      {/* MODAL: CRIAR TURMA */}
      {/* Modal Criar Turma */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl sm:rounded-3xl p-6 sm:p-8 w-full max-w-md sm:max-w-lg shadow-2xl relative">
            <div className="flex justify-between items-center mb-6 sm:mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                Nova Turma
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted hover:text-foreground transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-5 mb-8">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Nome da Turma
                </label>
                <Input
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="Ex: Algoritmos ou Química Orgânica"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Disciplina do Ambiente
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {/* Botão de Programação */}
                  <button
                    onClick={() => setNewClassroomSubject("PROGRAMMING")}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                      newClassroomSubject === "PROGRAMMING"
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border bg-surface text-muted hover:border-muted hover:text-foreground"
                    }`}
                  >
                    <Code size={28} className="mb-2" />
                    <span className="font-semibold text-sm">Programação</span>
                  </button>

                  {/* Botão de Química */}
                  <button
                    onClick={() => setNewClassroomSubject("CHEMISTRY")}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                      newClassroomSubject === "CHEMISTRY"
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border bg-surface text-muted hover:border-muted hover:text-foreground"
                    }`}
                  >
                    <Beaker size={28} className="mb-2" />
                    <span className="font-semibold text-sm">Química</span>
                  </button>

                  {/* Botão de HTML */}
                  <button
                    onClick={() => setNewClassroomSubject("HTML")}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                      newClassroomSubject === "HTML"
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border bg-surface text-muted hover:border-muted hover:text-foreground"
                    }`}
                  >
                    <Globe size={28} className="mb-2" />
                    <span className="font-semibold text-sm">HTML / Web</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 👇 BOTÕES DE AÇÃO RESTAURADOS AQUI 👇 */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4">
              <Button
                variant="ghost"
                onClick={() => setShowCreateModal(false)}
                className="h-11 sm:h-12 text-sm sm:text-base w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateClassroom}
                className="h-11 sm:h-12 text-sm sm:text-base w-full sm:w-auto"
              >
                Criar Turma
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ENTRAR EM TURMA */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl p-6 sm:p-8 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h3 className="text-xl sm:text-2xl font-bold text-foreground">
                Entrar em uma Turma
              </h3>
              <button
                onClick={() => setShowJoinModal(false)}
                className="text-muted hover:text-foreground transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <p className="text-sm sm:text-base text-muted mb-6 sm:mb-8">
              Insira o código de 6 caracteres fornecido pelo seu professor.
            </p>

            <div className="space-y-6 sm:space-y-8">
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Ex: X9J2K1"
                maxLength={6}
                autoFocus
                className="text-center text-2xl sm:text-3xl tracking-[0.5em] uppercase h-14 sm:h-16 font-mono font-bold placeholder:tracking-normal placeholder:text-base placeholder:font-sans"
              />
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4">
                <Button
                  variant="ghost"
                  onClick={() => setShowJoinModal(false)}
                  className="h-11 sm:h-12 text-sm sm:text-base w-full sm:w-auto"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleJoinClassroom}
                  className="h-11 sm:h-12 text-sm sm:text-base w-full sm:w-auto"
                >
                  Entrar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
