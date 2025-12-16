// web/src/pages/Dashboard.tsx

import { useEffect, useState, useCallback } from "react"; // 1. Adicionado useCallback
import axios from "axios";
import { useNavigate } from "react-router-dom";

interface Classroom {
  id: number;
  name: string;
  code: string;
}

interface DashboardData {
  teaching: Classroom[];
  enrolled: Classroom[];
}

// 2. Movido para fora para evitar recriação
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function Dashboard() {
  const [data, setData] = useState<DashboardData>({
    teaching: [],
    enrolled: [],
  });
  const navigate = useNavigate();

  // 3. Envolvido em useCallback para memorizar a função
  const fetchClasses = useCallback(async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get(`${API_URL}/classrooms/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data);
    } catch (error) {
      console.error("Erro ao buscar turmas", error);
    }
  }, []); // Array de dependências vazio (API_URL é constante externa)

  // 4. Agora o useEffect depende da função memorizada
  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const handleCreate = async () => {
    const name = prompt("Nome da Turma:");
    if (!name) return;

    const token = localStorage.getItem("token");
    try {
      await axios.post(
        `${API_URL}/classrooms`,
        { name },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchClasses();
    } catch (error) {
      alert("Erro ao criar turma");
    }
  };

  const handleJoin = async () => {
    const code = prompt("Código da Turma:");
    if (!code) return;

    const token = localStorage.getItem("token");
    try {
      await axios.post(
        `${API_URL}/classrooms/join`,
        { code },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchClasses();
    } catch (e) {
      alert("Código inválido ou você já está na turma.");
    }
  };

  const goToClass = (id: number) => {
    navigate(`/class/${id}`);
  };

  return (
    <div
      style={{
        padding: "40px",
        backgroundColor: "#1e1e1e",
        color: "#e0e0e0",
        minHeight: "100vh",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "40px",
        }}
      >
        <h1 style={{ margin: 0 }}>Meu Painel</h1>
        <button
          onClick={() => {
            localStorage.removeItem("token");
            navigate("/");
          }}
          style={{
            padding: "8px 16px",
            backgroundColor: "#333",
            color: "#fff",
            border: "1px solid #555",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Sair
        </button>
      </div>

      <div style={{ marginBottom: "30px", display: "flex", gap: "15px" }}>
        <button
          onClick={handleCreate}
          style={{
            padding: "10px 20px",
            backgroundColor: "#28a745",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          + Criar Nova Turma
        </button>
        <button
          onClick={handleJoin}
          style={{
            padding: "10px 20px",
            backgroundColor: "#0e639c",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Entrar com Código
        </button>
      </div>

      <h2 style={{ borderBottom: "1px solid #444", paddingBottom: "10px" }}>
        Professor
      </h2>
      <div
        style={{
          display: "flex",
          gap: "20px",
          flexWrap: "wrap",
          marginBottom: "40px",
          marginTop: "20px",
        }}
      >
        {data.teaching.length === 0 && (
          <p style={{ color: "#777" }}>Você não criou nenhuma turma.</p>
        )}
        {data.teaching.map((c) => (
          <div
            key={c.id}
            onClick={() => goToClass(c.id)}
            style={{
              backgroundColor: "#2d2d2d",
              border: "1px solid #444",
              borderRadius: "8px",
              padding: "20px",
              cursor: "pointer",
              width: "250px",
              transition: "transform 0.2s, background-color 0.2s",
            }}
            onMouseOver={(e) =>
              (e.currentTarget.style.backgroundColor = "#383838")
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.backgroundColor = "#2d2d2d")
            }
          >
            <h3 style={{ margin: "0 0 10px 0", color: "#fff" }}>{c.name}</h3>
            <div style={{ fontSize: "0.9rem", color: "#aaa" }}>
              Código:{" "}
              <span style={{ color: "#4caf50", fontWeight: "bold" }}>
                {c.code}
              </span>
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ borderBottom: "1px solid #444", paddingBottom: "10px" }}>
        Aluno
      </h2>
      <div
        style={{
          display: "flex",
          gap: "20px",
          flexWrap: "wrap",
          marginTop: "20px",
        }}
      >
        {data.enrolled.length === 0 && (
          <p style={{ color: "#777" }}>
            Você não está matriculado em nenhuma turma.
          </p>
        )}
        {data.enrolled.map((c) => (
          <div
            key={c.id}
            onClick={() => goToClass(c.id)}
            style={{
              backgroundColor: "#2d2d2d",
              border: "1px solid #444",
              borderRadius: "8px",
              padding: "20px",
              cursor: "pointer",
              width: "250px",
              transition: "transform 0.2s",
            }}
            onMouseOver={(e) =>
              (e.currentTarget.style.backgroundColor = "#383838")
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.backgroundColor = "#2d2d2d")
            }
          >
            <h3 style={{ margin: "0 0 10px 0", color: "#fff" }}>{c.name}</h3>
            <div style={{ fontSize: "0.9rem", color: "#aaa" }}>Estudante</div>
          </div>
        ))}
      </div>
    </div>
  );
}
