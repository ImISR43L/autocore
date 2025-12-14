import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [teaching, setTeaching] = useState<any[]>([]);
  const [enrolled, setEnrolled] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    const token = localStorage.getItem("token");
    const res = await axios.get("http://localhost:3000/classrooms/my", {
      headers: { Authorization: `Bearer ${token}` },
    });
    setTeaching(res.data.teaching);
    setEnrolled(res.data.enrolled);
  };

  const handleCreate = async () => {
    const name = prompt("Nome da Turma:");
    if (!name) return;
    const token = localStorage.getItem("token");
    await axios.post(
      "http://localhost:3000/classrooms",
      { name },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    fetchClasses();
  };

  const handleJoin = async () => {
    const code = prompt("Código da Turma:");
    if (!code) return;
    const token = localStorage.getItem("token");
    try {
      await axios.post(
        "http://localhost:3000/classrooms/join",
        { code },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      fetchClasses();
    } catch (e) {
      alert("Código inválido");
    }
  };

  return (
    <div
      style={{
        padding: "40px",
        backgroundColor: "#1e1e1e",
        color: "white",
        minHeight: "100vh",
      }}
    >
      <h1>Minhas Turmas</h1>

      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={handleCreate}
          style={{
            marginRight: "10px",
            padding: "10px",
            backgroundColor: "#28a745",
            color: "white",
            border: "none",
          }}
        >
          + Criar Turma
        </button>
        <button
          onClick={handleJoin}
          style={{
            padding: "10px",
            backgroundColor: "#0e639c",
            color: "white",
            border: "none",
          }}
        >
          Entrar em Turma
        </button>
      </div>

      <h3>Turmas que sou Professor</h3>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        {teaching.map((c) => (
          <div
            key={c.id}
            onClick={() => navigate(`/class/${c.id}`)}
            style={{
              border: "1px solid #555",
              padding: "20px",
              cursor: "pointer",
              width: "200px",
            }}
          >
            <h4>{c.name}</h4>
            <small>Código: {c.code}</small>
          </div>
        ))}
      </div>

      <h3>Turmas que sou Aluno</h3>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        {enrolled.map((c) => (
          <div
            key={c.id}
            onClick={() => navigate(`/class/${c.id}`)}
            style={{
              border: "1px solid #555",
              padding: "20px",
              cursor: "pointer",
              width: "200px",
            }}
          >
            <h4>{c.name}</h4>
          </div>
        ))}
      </div>
    </div>
  );
}
