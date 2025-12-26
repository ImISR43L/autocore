import { useState, useEffect } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import "../App.css";

interface Classroom {
  id: number;
  name: string;
  code: string;
  isOwner: boolean;
}

interface StatData {
  name: string;
  Accepted: number;
  Error: number;
}

export default function Dashboard() {
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const navigate = useNavigate();

  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [stats, setStats] = useState<StatData[]>([]); // Estado para o gráfico
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

      // 1. Busca Turmas
      const resClass = await axios.get(`${API_URL}/classrooms`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setClassrooms(resClass.data);

      // 2. Busca Estatísticas (Novo)
      const resStats = await axios.get(`${API_URL}/submissions/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(resStats.data);
    } catch (error) {
      toast.error("Sessão expirada ou erro ao carregar.");
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
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      toast.success("Turma criada!");
      setNewClassName("");
      fetchData();
    } catch (error) {
      toast.error("Erro ao criar turma.");
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
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      toast.success("Entrou na turma!");
      setShowJoinModal(false);
      setJoinCode("");
      fetchData();
    } catch (error) {
      toast.error("Código inválido ou já participa.");
    }
  };

  // Separa turmas
  const myClassrooms = classrooms.filter((c) => c.isOwner);
  const joinedClassrooms = classrooms.filter((c) => !c.isOwner);

  return (
    <div className="container" style={{ paddingBottom: "50px" }}>
      <header
        className="dashboard-header"
        style={{
          marginBottom: "30px",
          borderBottom: "1px solid #333",
          paddingBottom: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h1 style={{ margin: 0 }}>Dashboard</h1>
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

      {/* --- SEÇÃO DE GRÁFICOS (Apenas se houver dados e o usuário for professor de algo) --- */}
      {stats.length > 0 && (
        <div className="chart-section" style={{ marginBottom: "40px" }}>
          <h2
            style={{ fontSize: "1.5rem", marginBottom: "20px", color: "#ccc" }}
          >
            📊 Desempenho dos Alunos por Exercício
          </h2>
          <div
            style={{
              width: "100%",
              height: 350,
              background: "#1e1e1e",
              padding: "20px",
              borderRadius: "8px",
              border: "1px solid #333",
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#252526",
                    borderColor: "#444",
                    color: "#fff",
                  }}
                  itemStyle={{ color: "#fff" }}
                />
                <Legend />
                <Bar
                  dataKey="Accepted"
                  name="Acertos"
                  stackId="a"
                  fill="#4caf50"
                />
                <Bar
                  dataKey="Error"
                  name="Erros / Falhas"
                  stackId="a"
                  fill="#f44336"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* --- LISTA DE TURMAS --- */}
      <div className="dashboard-grid">
        {/* Coluna da Esquerda: Minhas Turmas */}
        <div className="section">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "15px",
            }}
          >
            <h2>Minhas Turmas</h2>
          </div>

          <div
            className="create-class-box"
            style={{
              marginBottom: "20px",
              background: "#252526",
              padding: "15px",
              borderRadius: "8px",
            }}
          >
            <form
              onSubmit={handleCreateClassroom}
              style={{ display: "flex", gap: "10px" }}
            >
              <input
                type="text"
                placeholder="Nome da nova turma..."
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
                {isCreating ? "+" : "Criar"}
              </button>
            </form>
          </div>

          <div className="class-list">
            {myClassrooms.map((c) => (
              <Link key={c.id} to={`/class/${c.id}`} className="class-card">
                <div
                  className="class-card-header"
                  style={{ background: "#4caf50" }}
                ></div>
                <div className="class-card-body">
                  <h3>{c.name}</h3>
                  <p style={{ color: "#888", fontSize: "0.8rem" }}>
                    Código: {c.code}
                  </p>
                  <span className="badge badge-owner">Professor</span>
                </div>
              </Link>
            ))}
            {myClassrooms.length === 0 && (
              <p style={{ color: "#666" }}>
                Você ainda não criou nenhuma turma.
              </p>
            )}
          </div>
        </div>

        {/* Coluna da Direita: Turmas que participo */}
        <div className="section">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "15px",
            }}
          >
            <h2>Estou Participando</h2>
            <button
              onClick={() => setShowJoinModal(true)}
              className="btn btn-secondary"
            >
              Entrar em Turma
            </button>
          </div>

          <div className="class-list">
            {joinedClassrooms.map((c) => (
              <Link key={c.id} to={`/class/${c.id}`} className="class-card">
                <div
                  className="class-card-header"
                  style={{ background: "#2196f3" }}
                ></div>
                <div className="class-card-body">
                  <h3>{c.name}</h3>
                  <span className="badge badge-student">Aluno</span>
                </div>
              </Link>
            ))}
            {joinedClassrooms.length === 0 && (
              <p style={{ color: "#666" }}>
                Você não está matriculado em nenhuma turma.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* MODAL DE ENTRAR EM TURMA */}
      {showJoinModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Entrar em uma Turma</h3>
            <input
              type="text"
              placeholder="Código da turma (ex: A1B2C3)"
              className="form-input"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              style={{ width: "100%", marginTop: "15px", marginBottom: "20px" }}
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
                Entrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
