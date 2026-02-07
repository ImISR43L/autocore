import { useState, useEffect, useMemo } from "react";
import axios from "axios";
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
  owner: {
    id: number;
    email: string;
  };
  problems?: Problem[];
  _count?: {
    students: number;
    problems: number;
  };
}

export default function Dashboard() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modais
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

  const myUserId = useMemo(() => {
    const token = localStorage.getItem("token");
    if (!token) return null;
    try {
      return JSON.parse(atob(token.split(".")[1])).sub;
    } catch {
      return null;
    }
  }, []);

  const userName =
    localStorage.getItem("userName")?.split(" ")[0] || "Visitante";

  useEffect(() => {
    fetchClassrooms();
  }, []);

  const fetchClassrooms = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/");
        return;
      }
      const res = await axios.get(`${API_URL}/classrooms`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setClassrooms(res.data);
    } catch (error) {
      console.error(error);
      toast.error("Sessão expirada. Faça login novamente.");
      localStorage.clear();
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const getPendingForClass = (cls: Classroom): PendingWork[] => {
    if (!cls.problems) return [];
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);

    return cls.problems
      .filter((p) => p.deadline)
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
    if (!newClassName.trim()) return toast.warning("Nome inválido");
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_URL}/classrooms`,
        { name: newClassName },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success("Turma criada!");
      setShowCreateModal(false);
      setNewClassName("");
      fetchClassrooms();
    } catch (error) {
      toast.error("Erro ao criar turma");
    }
  };

  const handleJoinClassroom = async () => {
    if (!joinCode.trim()) return toast.warning("Código inválido");
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_URL}/classrooms/join`,
        { code: joinCode },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success("Você entrou na turma!");
      setShowJoinModal(false);
      setJoinCode("");
      fetchClassrooms();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao entrar");
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  const filteredClassrooms = classrooms.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-background text-zinc-100 flex flex-col font-sans selection:bg-primary/20">
      {/* NAVBAR */}
      <nav className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur-md px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center transition-all">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg border border-primary/20">
            <GraduationCap size={24} className="text-primary sm:w-7 sm:h-7" />
          </div>
          <span className="font-bold text-lg sm:text-xl tracking-tight text-white hidden sm:inline-block">
            AutoCore
          </span>
          <span className="font-bold text-lg tracking-tight text-white sm:hidden">
            AC
          </span>
        </div>
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-sm h-9 px-3"
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
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 sm:mb-3">
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
            <strong className="text-white">{filteredClassrooms.length}</strong>{" "}
            turmas
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
              const isOwner = c.owner.id === myUserId;
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
                      "h-16 sm:h-20 px-4 sm:px-6 flex items-center justify-between border-b border-white/5",
                      isOwner
                        ? "bg-gradient-to-r from-emerald-900/40 to-surface"
                        : "bg-gradient-to-r from-zinc-800/40 to-surface",
                    )}
                  >
                    {isOwner ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium text-emerald-400 border border-emerald-500/20">
                        <Crown size={14} />{" "}
                        <span className="hidden xs:inline">Professor</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-700/30 px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium text-zinc-400 border border-zinc-700/50">
                        <School size={14} />{" "}
                        <span className="hidden xs:inline">Aluno</span>
                      </span>
                    )}
                    <span className="font-mono text-xs sm:text-sm text-muted/80 tracking-wider">
                      {c.code}
                    </span>
                  </div>

                  {/* Corpo do Card */}
                  <div className="flex flex-1 flex-col p-4 sm:p-6">
                    <h3 className="text-xl sm:text-2xl font-semibold text-white mb-4 sm:mb-6 line-clamp-1 group-hover:text-primary transition-colors">
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
                                className="flex items-center justify-between rounded-md bg-background/50 p-2 sm:p-3 text-xs sm:text-sm text-zinc-300 border border-border/50 hover:border-primary/30 hover:bg-background transition-colors"
                              >
                                <span
                                  className="truncate max-w-[120px] sm:max-w-[160px]"
                                  title={work.title}
                                >
                                  {work.title}
                                </span>
                                <span className="text-red-400 whitespace-nowrap ml-2 text-[10px] sm:text-xs font-medium">
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

                    <div className="mt-auto flex items-center justify-between border-t border-border pt-4 sm:pt-5 text-xs sm:text-sm text-muted group-hover:text-zinc-200 transition-colors">
                      <span>
                        {isOwner ? "Gerenciar Turma" : "Ver Todas Atividades"}
                      </span>
                      <ArrowRight
                        size={16}
                        className="text-primary sm:opacity-0 sm:-translate-x-2 sm:group-hover:opacity-100 sm:group-hover:translate-x-0 transition-all"
                      />
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
            <h3 className="text-lg sm:text-xl font-medium text-white mb-2">
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
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl p-6 sm:p-8 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h3 className="text-xl sm:text-2xl font-bold text-white">
                Criar Nova Turma
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <p className="text-sm sm:text-base text-muted mb-6 sm:mb-8">
              Defina um nome para sua turma. O código de acesso será gerado
              automaticamente.
            </p>

            <div className="space-y-6 sm:space-y-8">
              <Input
                label="Nome da Turma"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="Ex: Introdução a Python 2026"
                autoFocus
                className="h-11 sm:h-12 text-base"
              />
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
        </div>
      )}

      {/* MODAL: ENTRAR EM TURMA */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl p-6 sm:p-8 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h3 className="text-xl sm:text-2xl font-bold text-white">
                Entrar em uma Turma
              </h3>
              <button
                onClick={() => setShowJoinModal(false)}
                className="text-muted hover:text-white transition-colors"
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
