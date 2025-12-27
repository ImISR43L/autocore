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

  // Estados de Modais e Menus
  const [showMenu, setShowMenu] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Inputs
  const [newClassName, setNewClassName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Ref para fechar o menu ao clicar fora
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Fecha o menu se clicar fora dele
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
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
    } catch (error) {
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
      setShowCreateModal(false); // Fecha o modal
      fetchData();
    } catch {
      toast.error("Erro ao criar turma.");
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
      toast.success("Entrou na turma!");
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
    if (!confirm("Tem certeza que deseja EXCLUIR esta turma permanentemente?"))
      return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_URL}/classrooms/${classId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Turma excluída.");
      fetchData();
    } catch {
      toast.error("Erro ao excluir.");
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

  const getBannerClass = (id: number) => `banner-color-${id % 5}`;

  return (
    <div className="dashboard-container">
      {/* --- HEADER COM BOTÃO + E DROPDOWN --- */}
      <header
        style={{
          marginBottom: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #333",
          paddingBottom: "15px",
        }}
      >
        <h1 style={{ margin: 0 }}>Autocore Classroom</h1>

        <div className="header-actions">
          {/* Wrapper relativo para o dropdown */}
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

      {/* GRID DE TURMAS */}
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
                        onClick={(e) => navigateToAssignment(e, c.id, work.id)}
                        title={`Entrega: ${work.deadline.toLocaleString()}`}
                      >
                        {work.title}{" "}
                        <span className="assignment-time">
                          ({work.deadline.getDate()}/
                          {work.deadline.getMonth() + 1})
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
            Nenhuma turma encontrada. Clique no "+" para começar.
          </div>
        )}
      </div>

      {/* --- MODAL PARTICIPAR --- */}
      {showJoinModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginTop: 0 }}>Participar da turma</h3>
            <p style={{ color: "#888", fontSize: "0.9rem" }}>
              Peça o código da turma ao seu professor.
            </p>
            <input
              type="text"
              placeholder="Código (ex: X7Y8Z9)"
              className="form-input"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              style={{
                width: "100%",
                marginTop: "15px",
                marginBottom: "20px",
                padding: "10px",
                fontSize: "1.1rem",
                letterSpacing: "2px",
              }}
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
                {isLoading ? "..." : "Participar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL CRIAR --- */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginTop: 0 }}>Criar turma</h3>
            <p style={{ color: "#888", fontSize: "0.9rem" }}>
              Defina o nome da disciplina.
            </p>
            <input
              type="text"
              placeholder="Nome da disciplina (ex: Algoritmos)"
              className="form-input"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              style={{
                width: "100%",
                marginTop: "15px",
                marginBottom: "20px",
                padding: "10px",
              }}
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
                {isLoading ? "..." : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
