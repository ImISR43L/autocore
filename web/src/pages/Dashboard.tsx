import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../App.css";
import { toast } from "sonner";

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
        {/* Simula título e subtítulo dentro do card */}
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
  const navigate = useNavigate();

  const fetchClasses = useCallback(async () => {
    // setLoading(true); // Opcional: ativar se quiser skeleton ao recarregar
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get(`${API_URL}/classrooms/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data);
    } catch (error) {
      console.error("Erro ao buscar turmas", error);
    } finally {
      setLoading(false); // <--- Desativa o skeleton
    }
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const handleCreate = async () => {
    const name = prompt("Nome da Turma:"); // Manteremos prompt por enquanto (Sprint 2 remove isso)
    if (!name) return;

    const token = localStorage.getItem("token");
    const toastId = toast.loading("Criando turma...");

    try {
      await axios.post(
        `${API_URL}/classrooms`,
        { name },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Turma criada com sucesso!", { id: toastId });
      fetchClasses();
    } catch (error) {
      toast.error("Erro ao criar turma", { id: toastId });
    }
  };

  const handleJoin = async () => {
    const code = prompt("Código da Turma:");
    if (!code) return;

    const token = localStorage.getItem("token");
    const toastId = toast.loading("Entrando na turma...");

    try {
      await axios.post(
        `${API_URL}/classrooms/join`,
        { code },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Você entrou na turma!", { id: toastId });
      fetchClasses();
    } catch (e) {
      toast.error("Código inválido ou você já está na turma.", { id: toastId });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Meu Painel</h1>
        <button onClick={handleLogout} className="btn btn-secondary">
          Sair
        </button>
      </div>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem" }}>
        <button onClick={handleCreate} className="btn btn-primary">
          + Nova Turma
        </button>
        <button onClick={handleJoin} className="btn btn-secondary">
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
          }}
        >
          Turmas que eu ensino
        </h2>

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <div className="dashboard-grid">
            {data.teaching.length === 0 && (
              <p style={{ color: "#555" }}>Nenhuma turma criada.</p>
            )}
            {data.teaching.map((c) => (
              <div
                key={c.id}
                className="class-card"
                onClick={() => navigate(`/class/${c.id}`)}
              >
                <h3 className="class-title">{c.name}</h3>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span className="class-role">Professor</span>
                  <span className="class-code">{c.code}</span>
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
                <h3 className="class-title">{c.name}</h3>
                <span className="class-role">Estudante</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
