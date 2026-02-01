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
} from "lucide-react";
import { toast } from "sonner";
import "../App.css";

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
    // Esta rota já estava correta (/class/), mantivemos igual.
    navigate(`/class/${classId}`, { state: { problemId: problemId } });
  };

  const handleCreateClassroom = async () => {
    if (!newClassName.trim()) return toast.warning("Nome inválido");
    try {
      const token = localStorage.getItem("token");
      // A lógica de criação estava correta (POST /classrooms).
      // O problema era apenas na navegação pós-criação/listagem.
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
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#e0e0e0",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* NAVBAR */}
      <nav
        style={{
          borderBottom: "1px solid #333",
          padding: "15px 40px",
          background: "#161616",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              background: "#2e7d32",
              padding: "6px",
              borderRadius: "8px",
            }}
          >
            <GraduationCap size={24} color="#fff" />
          </div>
          <span
            style={{
              fontWeight: "bold",
              fontSize: "1.2rem",
              letterSpacing: "-0.5px",
            }}
          >
            AutoCore
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="btn-ghost"
          style={{
            color: "#f44336",
            display: "flex",
            gap: "8px",
            alignItems: "center",
          }}
        >
          <LogOut size={18} /> Sair
        </button>
      </nav>

      {/* CONTEÚDO PRINCIPAL */}
      <main
        style={{
          flex: 1,
          padding: "40px",
          maxWidth: "1200px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        {/* CABEÇALHO */}
        <header
          style={{
            marginBottom: "40px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: "20px",
          }}
        >
          <div>
            <h1 style={{ fontSize: "2.2rem", margin: "0 0 10px 0" }}>
              Olá, <span style={{ color: "#4caf50" }}>{userName}</span>!
            </h1>
            <p style={{ color: "#888", fontSize: "1rem", margin: 0 }}>
              Aqui está o resumo das suas atividades acadêmicas.
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => setShowJoinModal(true)}
              className="btn-secondary"
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
                padding: "10px 20px",
              }}
            >
              <Users size={18} /> Entrar em Turma
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary"
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
                padding: "10px 20px",
              }}
            >
              <Plus size={18} /> Criar Nova Turma
            </button>
          </div>
        </header>

        {/* BARRA DE FERRAMENTAS */}
        <div
          style={{
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "15px",
          }}
        >
          <div style={{ position: "relative", flex: 1, maxWidth: "400px" }}>
            <Search
              size={18}
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#666",
              }}
            />
            <input
              type="text"
              placeholder="Buscar turmas por nome ou código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                background: "#1e1e1e",
                border: "1px solid #333",
                borderRadius: "8px",
                padding: "12px 12px 12px 40px",
                color: "white",
                fontSize: "0.95rem",
                outline: "none",
              }}
            />
          </div>
          <div style={{ fontSize: "0.9rem", color: "#666" }}>
            Mostrando <strong>{filteredClassrooms.length}</strong> turmas
          </div>
        </div>

        {/* GRID DE TURMAS */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "50px", color: "#666" }}>
            Carregando turmas...
          </div>
        ) : filteredClassrooms.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
              gap: "20px",
            }}
          >
            {filteredClassrooms.map((c) => {
              const isOwner = c.owner.id === myUserId;
              const pendingWork = getPendingForClass(c);

              return (
                <div
                  key={c.id}
                  // CORREÇÃO AQUI: Mudado de '/classroom/' para '/class/' para bater com o Router
                  onClick={() => navigate(`/class/${c.id}`)}
                  className="classroom-card"
                  style={{
                    background: "#1e1e1e",
                    border: "1px solid #333",
                    borderRadius: "12px",
                    overflow: "hidden",
                    cursor: "pointer",
                    transition: "transform 0.2s, box-shadow 0.2s",
                    display: "flex",
                    flexDirection: "column",
                    minHeight: "220px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow =
                      "0 10px 20px rgba(0,0,0,0.3)";
                    e.currentTarget.style.borderColor = "#4caf50";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.borderColor = "#333";
                  }}
                >
                  {/* Banner do Card */}
                  <div
                    style={{
                      height: "60px",
                      background: isOwner
                        ? "linear-gradient(135deg, #1b5e20 0%, #0d3b10 100%)"
                        : "linear-gradient(135deg, #263238 0%, #101518 100%)",
                      padding: "15px 20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    {isOwner ? (
                      <span
                        className="badge-prof"
                        style={{
                          background: "rgba(0,0,0,0.3)",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          color: "#a5d6a7",
                        }}
                      >
                        <Crown size={14} /> Professor
                      </span>
                    ) : (
                      <span
                        className="badge-aluno"
                        style={{
                          background: "rgba(0,0,0,0.3)",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          color: "#b0bec5",
                        }}
                      >
                        <School size={14} /> Aluno
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: "0.8rem",
                        color: "rgba(255,255,255,0.6)",
                        fontFamily: "monospace",
                      }}
                    >
                      {c.code}
                    </span>
                  </div>

                  {/* Corpo do Card */}
                  <div
                    style={{
                      padding: "20px",
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <h3
                      style={{
                        margin: "0 0 15px 0",
                        fontSize: "1.2rem",
                        color: "#fff",
                        lineHeight: "1.4",
                      }}
                    >
                      {c.name}
                    </h3>

                    {/* SEÇÃO DE PENDÊNCIAS */}
                    {pendingWork.length > 0 ? (
                      <div style={{ marginBottom: "15px", flex: 1 }}>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "#888",
                            marginBottom: "8px",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          <Clock size={12} /> PRÓXIMAS ENTREGAS
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                          }}
                        >
                          {pendingWork.map((work) => (
                            <div
                              key={work.id}
                              onClick={(e) =>
                                navigateToAssignment(e, c.id, work.id)
                              }
                              className="pending-item"
                              style={{
                                fontSize: "0.85rem",
                                color: "#ccc",
                                padding: "6px 8px",
                                background: "#252526",
                                borderRadius: "4px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                transition: "background 0.2s",
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.background = "#333")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.background = "#252526")
                              }
                            >
                              <span
                                style={{
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  maxWidth: "160px",
                                }}
                              >
                                {work.title}
                              </span>
                              <span
                                style={{ fontSize: "0.7rem", color: "#f44336" }}
                              >
                                {formatDeadline(work.deadline)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          color: "#555",
                          fontSize: "0.9rem",
                          fontStyle: "italic",
                        }}
                      >
                        Nenhuma entrega pendente para esta semana.
                      </div>
                    )}

                    <div
                      style={{
                        marginTop: "15px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderTop: "1px solid #333",
                        paddingTop: "15px",
                      }}
                    >
                      <span style={{ fontSize: "0.85rem", color: "#666" }}>
                        {isOwner ? "Gerenciar Turma" : "Ver Todas Atividades"}
                      </span>
                      <ArrowRight size={18} color="#4caf50" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* EMPTY STATE */
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              background: "#161616",
              borderRadius: "12px",
              border: "1px dashed #444",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "15px",
            }}
          >
            <div
              style={{
                background: "#222",
                padding: "20px",
                borderRadius: "50%",
              }}
            >
              <BookOpen size={40} className="text-gray-500" />
            </div>
            <h3 style={{ margin: 0, color: "#e0e0e0" }}>
              Nenhuma turma encontrada
            </h3>
            <p style={{ color: "#888", maxWidth: "400px" }}>
              {search
                ? `Não encontramos nenhuma turma com o nome "${search}".`
                : "Você ainda não participa de nenhuma turma. Crie uma nova para ensinar ou entre em uma existente."}
            </p>
            {!search && (
              <button
                onClick={() => setShowJoinModal(true)}
                className="btn-primary"
                style={{ marginTop: "10px" }}
              >
                Começar Agora
              </button>
            )}
          </div>
        )}
      </main>

      {/* MODAL: CRIAR TURMA */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "400px" }}>
            <h3>Criar Nova Turma</h3>
            <p
              style={{
                color: "#888",
                fontSize: "0.9rem",
                marginBottom: "20px",
              }}
            >
              Defina um nome para sua turma. O código de acesso será gerado
              automaticamente.
            </p>
            <input
              className="modern-input"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="Ex: Introdução a Python 2026"
              autoFocus
            />
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "20px",
              }}
            >
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button onClick={handleCreateClassroom} className="btn-primary">
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ENTRAR EM TURMA */}
      {showJoinModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "400px" }}>
            <h3>Entrar em uma Turma</h3>
            <p
              style={{
                color: "#888",
                fontSize: "0.9rem",
                marginBottom: "20px",
              }}
            >
              Insira o código de 6 caracteres fornecido pelo seu professor.
            </p>
            <input
              className="modern-input"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Ex: X9J2K1"
              maxLength={6}
              autoFocus
              style={{
                textAlign: "center",
                letterSpacing: "5px",
                textTransform: "uppercase",
                fontSize: "1.2rem",
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "20px",
              }}
            >
              <button
                onClick={() => setShowJoinModal(false)}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button onClick={handleJoinClassroom} className="btn-primary">
                Entrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ESTILOS LOCAIS DE INPUT */}
      <style>{`
        .modern-input {
          width: 100%;
          padding: 12px;
          background: #0a0a0a;
          border: 1px solid #333;
          border-radius: 8px;
          color: white;
          outline: none;
          transition: border-color 0.2s;
        }
        .modern-input:focus {
          border-color: #4caf50;
        }
        .btn-ghost {
          background: transparent;
          border: none;
          color: #888;
          cursor: pointer;
          transition: color 0.2s;
        }
        .btn-ghost:hover {
          color: #fff;
        }
      `}</style>
    </div>
  );
}
