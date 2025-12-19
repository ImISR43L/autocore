// web/src/pages/Dashboard.tsx
import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import "../App.css";

interface Classroom {
  id: number;
  name: string;
  code: string;
}

interface DashboardData {
  teaching: Classroom[];
  enrolled: Classroom[];
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const DashboardSkeleton = () => (
  <div className="dashboard-grid">
    {[1, 2, 3].map((i) => (
      <div key={i} className="class-card skeleton skeleton-card">
        <div className="skeleton skeleton-text" style={{ width: "60%" }}></div>
        <div
          className="skeleton skeleton-text"
          style={{ width: "30%", marginTop: "auto" }}
        ></div>
      </div>
    ))}
  </div>
);

export default function Dashboard() {
  const [data, setData] = useState<DashboardData>({
    teaching: [],
    enrolled: [],
  });
  const [loading, setLoading] = useState(true);

  // Estados dos Modais
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Estados dos Formulários
  const [newClassName, setNewClassName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const navigate = useNavigate();

  const fetchClasses = useCallback(async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get(`${API_URL}/classrooms/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data);
    } catch (error) {
      console.error("Erro ao buscar turmas", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    setActionLoading(true);
    const token = localStorage.getItem("token");
    try {
      await axios.post(
        `${API_URL}/classrooms`,
        { name: newClassName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Turma criada!");
      setNewClassName("");
      setShowCreateModal(false);
      fetchClasses();
    } catch (error) {
      toast.error("Erro ao criar turma.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    setActionLoading(true);
    const token = localStorage.getItem("token");
    try {
      await axios.post(
        `${API_URL}/classrooms/join`,
        { code: joinCode },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Você entrou na turma!");
      setJoinCode("");
      setShowJoinModal(false);
      fetchClasses();
    } catch (e) {
      toast.error("Código inválido ou já matriculado.");
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Código copiado!");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  const handleLeave = async (
    e: React.MouseEvent,
    classroomId: number,
    name: string
  ) => {
    e.stopPropagation(); // Impede que o clique abra a turma

    if (!confirm(`Tem certeza que deseja sair da turma "${name}"?`)) return;

    const token = localStorage.getItem("token");
    const toastId = toast.loading("Saindo da turma...");

    try {
      await axios.delete(`${API_URL}/classrooms/${classroomId}/leave`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Você saiu da turma.", { id: toastId });
      fetchClasses(); // Atualiza a lista
    } catch (error) {
      toast.error("Erro ao sair da turma.", { id: toastId });
    }
  };

  const handleDelete = async (
    e: React.MouseEvent,
    classroomId: number,
    name: string
  ) => {
    e.stopPropagation();

    // Confirmação dupla para segurança
    const confirm1 = confirm(
      `Tem certeza que deseja EXCLUIR a turma "${name}"?`
    );
    if (!confirm1) return;

    const confirm2 = confirm(
      "Esta ação apagará todos os exercícios e removerá todos os alunos. Continuar?"
    );
    if (!confirm2) return;

    const token = localStorage.getItem("token");
    const toastId = toast.loading("Excluindo turma...");

    try {
      await axios.delete(`${API_URL}/classrooms/${classroomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Turma excluída com sucesso.", { id: toastId });
      fetchClasses(); // Atualiza a lista
    } catch (error) {
      toast.error("Erro ao excluir turma.", { id: toastId });
    }
  };

  return (
    <div className="container">
      {/* MODAL: CRIAR TURMA */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "400px" }}>
            <h2 style={{ marginBottom: "1rem" }}>Nova Turma</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Nome da Disciplina</label>
                <input
                  className="form-input"
                  autoFocus
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="Ex: Algoritmos I"
                />
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "1rem" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  {actionLoading ? "..." : "Criar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ENTRAR EM TURMA */}
      {showJoinModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "400px" }}>
            <h2 style={{ marginBottom: "1rem" }}>Entrar em Turma</h2>
            <form onSubmit={handleJoin}>
              <div className="form-group">
                <label className="form-label">Código de Acesso</label>
                <input
                  className="form-input"
                  autoFocus
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Cole o código aqui"
                />
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "1rem" }}>
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  {actionLoading ? "..." : "Entrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="page-header">
        <h1 className="page-title">Meu Painel</h1>
        <button onClick={handleLogout} className="btn btn-secondary">
          Sair
        </button>
      </div>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem" }}>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          + Nova Turma
        </button>
        <button
          onClick={() => setShowJoinModal(true)}
          className="btn btn-secondary"
        >
          Entrar com Código
        </button>
      </div>

      {/* Seção Professor */}
      <section style={{ marginBottom: "3rem" }}>
        <h2
          style={{
            color: "var(--text-muted)",
            fontSize: "0.9rem",
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: "1rem",
          }}
        >
          Turmas que eu ensino
        </h2>

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <div className="dashboard-grid">
            {data.teaching.length === 0 && (
              <p style={{ color: "#555" }}>
                Você ainda não criou nenhuma turma.
              </p>
            )}
            {data.teaching.map((c) => (
              <div key={c.id} className="class-card">
                <div
                  onClick={() => navigate(`/class/${c.id}`)}
                  style={{ cursor: "pointer", marginBottom: "10px" }}
                >
                  <h3 className="class-title">{c.name}</h3>
                  <button
                    onClick={(e) => handleDelete(e, c.id, c.name)}
                    className="btn btn-ghost"
                    style={{ padding: "0 5px", color: "#ff4444" }}
                    title="Excluir Turma"
                  >
                    🗑️
                  </button>
                  <span className="class-role">Professor</span>
                </div>

                <div
                  className="code-box"
                  onClick={() => copyToClipboard(c.code)}
                  title="Clique para copiar"
                >
                  <span>Cód: {c.code}</span>
                  <span style={{ marginLeft: "auto", opacity: 0.5 }}>📋</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Seção Aluno */}
      <section>
        <h2
          style={{
            color: "var(--text-muted)",
            fontSize: "0.9rem",
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: "1rem",
          }}
        >
          Minhas matrículas
        </h2>

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <div className="dashboard-grid">
            {data.enrolled.length === 0 && (
              <p style={{ color: "#555" }}>Nenhuma matrícula ativa.</p>
            )}
            {data.enrolled.map((c) => (
              <div
                key={c.id}
                className="class-card"
                onClick={() => navigate(`/class/${c.id}`)}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <h3 className="class-title">{c.name}</h3>

                  {/* Botão de Sair */}
                  <button
                    onClick={(e) => handleLeave(e, c.id, c.name)}
                    className="btn btn-danger"
                    style={{
                      padding: "2px 8px",
                      fontSize: "0.7rem",
                      marginLeft: "10px",
                      opacity: 0.7,
                    }}
                    title="Sair da turma"
                  >
                    Sair ✕
                  </button>
                </div>
                <span className="class-role">Estudante</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
