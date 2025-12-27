import { useState, useEffect } from "react";
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
  const [newClassName, setNewClassName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    fetchData();
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

  const handleCreateClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    setIsCreating(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_URL}/classrooms`,
        { name: newClassName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Turma criada!");
      setNewClassName("");
      fetchData();
    } catch {
      toast.error("Erro.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinClassroom = async () => {
    if (!joinCode.trim()) return;
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
    }
  };

  // --- NAVEGAÇÃO VIA STATE (Para abrir direto na atividade) ---
  const navigateToAssignment = (
    e: React.MouseEvent,
    classId: number,
    problemId: string
  ) => {
    e.preventDefault(); // Evita abrir o card genérico
    e.stopPropagation();
    navigate(`/class/${classId}`, { state: { problemId: problemId } });
  };

  // --- FILTRA ATIVIDADES PENDENTES DA TURMA ---
  const getPendingForClass = (cls: Classroom): PendingWork[] => {
    if (!cls.problems) return [];
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7); // Próximos 7 dias

    return cls.problems
      .filter((p) => p.deadline) // Tem prazo
      .map((p) => ({ ...p, deadline: new Date(p.deadline!) }))
      .filter((p) => p.deadline > now && p.deadline <= nextWeek) // Está no futuro próximo
      .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
      .slice(0, 3); // Mostra no máximo 3 para não estourar o card
  };

  const getBannerClass = (id: number) => `banner-color-${id % 5}`;

  return (
    <div className="dashboard-container">
      {/* Header */}
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
        <h1 style={{ margin: 0 }}>Google Classroom Clone</h1>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => setShowJoinModal(true)}
            className="btn btn-secondary"
          >
            + Participar
          </button>
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

      {/* Input Criar */}
      <div
        style={{
          marginBottom: "20px",
          background: "#252526",
          padding: "15px",
          borderRadius: "8px",
          display: "flex",
          gap: "10px",
          alignItems: "center",
        }}
      >
        <span style={{ color: "#ccc", fontWeight: "bold" }}>Criar Turma:</span>
        <form
          onSubmit={handleCreateClassroom}
          style={{ display: "flex", gap: "10px", flex: 1 }}
        >
          <input
            type="text"
            placeholder="Nome da disciplina..."
            className="form-input"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            type="submit"
            disabled={isCreating || !newClassName}
            className="btn btn-primary"
          >
            {isCreating ? "..." : "Criar"}
          </button>
        </form>
      </div>

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

                {/* --- LISTA DE ATIVIDADES DENTRO DO CARD --- */}
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
            Nenhuma turma encontrada.
          </div>
        )}
      </div>

      {/* Modal Entrar */}
      {showJoinModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginTop: 0 }}>Participar da turma</h3>
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
                disabled={!joinCode}
                className="btn btn-primary"
              >
                Participar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
