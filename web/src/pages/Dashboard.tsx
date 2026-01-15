import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import "../App.css";

// Interfaces
interface Problem {
  id: string;
  title: string;
  deadline?: string;
}
interface Classroom {
  id: number;
  name: string;
  code: string;
  isOwner: boolean;
  owner: { email: string };
  problems?: Problem[];
}
interface PendingWork {
  id: string;
  title: string;
  deadline: Date;
}

export default function Dashboard() {
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const navigate = useNavigate();

  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [newClassName, setNewClassName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, []);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node))
        setShowMenu(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchData = async () => {
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
    } catch {
      toast.error("Sessão expirada.");
      navigate("/");
    }
  };

  const handleCreateClassroom = async () => {
    if (!newClassName.trim()) return;
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_URL}/classrooms`,
        { name: newClassName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Turma criada!");
      setNewClassName("");
      setShowCreateModal(false);
      fetchData();
    } catch {
      toast.error("Erro.");
    } finally {
      setIsLoading(false);
    }
  };
  const handleJoinClassroom = async () => {
    if (!joinCode.trim()) return;
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_URL}/classrooms/join`,
        { code: joinCode },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Entrou!");
      setShowJoinModal(false);
      setJoinCode("");
      fetchData();
    } catch {
      toast.error("Código inválido.");
    } finally {
      setIsLoading(false);
    }
  };
  const handleDeleteClassroom = async (
    e: React.MouseEvent,
    classId: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Excluir turma?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_URL}/classrooms/${classId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Excluída.");
      fetchData();
    } catch {
      toast.error("Erro.");
    }
  };
  const navigateToAssignment = (
    e: React.MouseEvent,
    classId: number,
    problemId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/class/${classId}`, { state: { problemId: problemId } });
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

  // Função auxiliar para formatar Hora e Data (HH:mm · DD/MM)
  const formatDeadline = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    return `${hours}:${minutes} · ${day}/${month}`;
  };

  const getBannerClass = (id: number) => `banner-color-${id % 5}`;

  const teachingClasses = classrooms.filter((c) => c.isOwner);
  const enrolledClasses = classrooms.filter((c) => !c.isOwner);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <button
          className="sidebar-toggle"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          title="Menu"
        >
          ☰
        </button>
        <h1 style={{ margin: 0, flex: 1 }}>Autocore Classroom</h1>
        <div className="header-actions">
          <div style={{ position: "relative" }} ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="plus-btn"
              title="Criar ou Participar"
            >
              +
            </button>
            {showMenu && (
              <div className="dropdown-menu">
                <div
                  className="dropdown-item"
                  onClick={() => {
                    setShowJoinModal(true);
                    setShowMenu(false);
                  }}
                >
                  Participar da turma
                </div>
                <div
                  className="dropdown-item"
                  onClick={() => {
                    setShowCreateModal(true);
                    setShowMenu(false);
                  }}
                >
                  Criar turma
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => {
              localStorage.removeItem("token");
              navigate("/");
            }}
            className="btn btn-ghost"
            style={{ color: "#f44336" }}
          >
            Sair
          </button>
        </div>
      </header>

      <aside className={`app-sidebar ${isSidebarOpen ? "open" : ""}`}>
        <div className="sidebar-content">
          <Link
            to="/dashboard"
            className="sidebar-item"
            onClick={() => setIsSidebarOpen(false)}
          >
            <span className="sidebar-class-avatar">🏠</span> Início
          </Link>
          {teachingClasses.length > 0 && (
            <>
              <div className="sidebar-section-title">Turmas que leciono</div>
              {teachingClasses.map((c) => (
                <Link
                  key={c.id}
                  to={`/class/${c.id}`}
                  className="sidebar-item"
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <div
                    className="sidebar-class-avatar"
                    style={{ background: "#3e3e42" }}
                  >
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {c.name}
                  </div>
                </Link>
              ))}
            </>
          )}
          {enrolledClasses.length > 0 && (
            <>
              <div className="sidebar-section-title">Inscrito</div>
              {enrolledClasses.map((c) => (
                <Link
                  key={c.id}
                  to={`/class/${c.id}`}
                  className="sidebar-item"
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <div
                    className="sidebar-class-avatar"
                    style={{ background: "#3e3e42" }}
                  >
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {c.name}
                  </div>
                </Link>
              ))}
            </>
          )}
        </div>
      </aside>

      <div
        className={`dashboard-main-content ${isSidebarOpen ? "shifted" : ""}`}
      >
        <div className="class-grid">
          {classrooms.map((c) => {
            const pendingWork = getPendingForClass(c);
            return (
              <Link key={c.id} to={`/class/${c.id}`} className="google-card">
                <div className={`card-banner ${getBannerClass(c.id)}`}>
                  <h2 className="card-title">{c.name}</h2>
                  <div className="card-section">{c.code}</div>
                  {!c.isOwner && (
                    <div className="card-teacher-name">
                      {c.owner.email.split("@")[0]}
                    </div>
                  )}
                  {c.isOwner && (
                    <button
                      className="delete-class-btn"
                      onClick={(e) => handleDeleteClassroom(e, c.id)}
                      title="Excluir Turma"
                    >
                      🗑️
                    </button>
                  )}
                </div>
                <div className="card-avatar">
                  {c.owner.email.charAt(0).toUpperCase()}
                </div>
                <div className="card-body">
                  <span
                    className={`card-role-badge ${
                      c.isOwner ? "role-prof" : "role-student"
                    }`}
                  >
                    {c.isOwner ? "Professor" : "Aluno"}
                  </span>
                  {pendingWork.length > 0 ? (
                    <div className="card-assignments">
                      <span className="assignment-header">
                        Próximas entregas:
                      </span>
                      {pendingWork.map((work) => (
                        <div
                          key={work.id}
                          className="assignment-link"
                          onClick={(e) =>
                            navigateToAssignment(e, c.id, work.id)
                          }
                          title={`Entrega: ${work.deadline.toLocaleString()}`}
                        >
                          {/* --- MUDANÇA AQUI: Exibindo Hora e Data --- */}
                          {work.title}{" "}
                          <span className="assignment-time">
                            ({formatDeadline(work.deadline)})
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        marginTop: "auto",
                        paddingTop: "10px",
                        color: "#666",
                        fontSize: "0.8rem",
                        fontStyle: "italic",
                      }}
                    >
                      Nenhuma entrega pendente.
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
          {classrooms.length === 0 && (
            <div
              style={{
                color: "#666",
                textAlign: "center",
                padding: "40px",
                gridColumn: "1 / -1",
              }}
            >
              Nenhuma turma encontrada.
            </div>
          )}
        </div>
      </div>

      {/* MODAIS (MANTIDOS) */}
      {showJoinModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginTop: 0 }}>Participar da turma</h3>
            <input
              type="text"
              placeholder="Código"
              className="form-input"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              style={{ width: "100%", margin: "15px 0" }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
              }}
            >
              <button
                onClick={() => setShowJoinModal(false)}
                className="btn btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={handleJoinClassroom}
                disabled={!joinCode || isLoading}
                className="btn btn-primary"
              >
                Participar
              </button>
            </div>
          </div>
        </div>
      )}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginTop: 0 }}>Criar turma</h3>
            <input
              type="text"
              placeholder="Nome da disciplina"
              className="form-input"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              style={{ width: "100%", margin: "15px 0" }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
              }}
            >
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateClassroom}
                disabled={!newClassName || isLoading}
                className="btn btn-primary"
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
