import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";

interface TestCase {
  input: string;
  expectedOutput: string;
}

export default function CreateProblem() {
  const navigate = useNavigate();
  const location = useLocation();
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

  // Recupera o ID da turma passado pelo navigate state
  const classroomId = location.state?.classroomId;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [testCases, setTestCases] = useState<TestCase[]>([
    { input: "", expectedOutput: "" },
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!classroomId) {
      alert("Erro: Turma não identificada. Volte para o Dashboard.");
      navigate("/dashboard");
    }
  }, [classroomId, navigate]);

  const addTestCase = () => {
    setTestCases([...testCases, { input: "", expectedOutput: "" }]);
  };

  const removeTestCase = (index: number) => {
    const newCases = testCases.filter((_, i) => i !== index);
    setTestCases(newCases);
  };

  const handleTestCaseChange = (
    index: number,
    field: keyof TestCase,
    value: string
  ) => {
    const newTestCases = [...testCases];
    newTestCases[index][field] = value;
    setTestCases(newTestCases);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_URL}/problems`,
        {
          title,
          description,
          slug,
          classroomId,
          testCases,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Problema criado com sucesso!");
      navigate(`/class/${classroomId}`);
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message || "Erro ao criar problema.";
      alert(`Erro: ${Array.isArray(msg) ? msg.join(", ") : msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: "40px",
        backgroundColor: "#1e1e1e",
        color: "#fff",
        minHeight: "100vh",
        fontFamily: "sans-serif",
      }}
    >
      <button
        onClick={() => navigate(-1)}
        style={{
          background: "none",
          border: "none",
          color: "#aaa",
          cursor: "pointer",
          marginBottom: "20px",
        }}
      >
        ← Voltar
      </button>
      <h2>Novo Exercício</h2>
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          maxWidth: "800px",
        }}
      >
        <input
          placeholder="Título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{
            padding: "10px",
            backgroundColor: "#333",
            border: "1px solid #555",
            color: "#fff",
          }}
          required
        />

        <input
          placeholder="Slug (URL amigável, ex: soma-simples)"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          style={{
            padding: "10px",
            backgroundColor: "#333",
            border: "1px solid #555",
            color: "#fff",
          }}
          required
        />

        <textarea
          placeholder="Enunciado"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          style={{
            padding: "10px",
            backgroundColor: "#333",
            border: "1px solid #555",
            color: "#fff",
          }}
          required
        />

        <h3>Casos de Teste</h3>
        {testCases.map((tc, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              gap: "10px",
              backgroundColor: "#2d2d2d",
              padding: "15px",
              borderRadius: "5px",
            }}
          >
            <div style={{ flex: 1 }}>
              <label
                style={{ display: "block", fontSize: "0.8em", color: "#aaa" }}
              >
                Entrada
              </label>
              <textarea
                value={tc.input}
                onChange={(e) =>
                  handleTestCaseChange(idx, "input", e.target.value)
                }
                style={{
                  width: "100%",
                  backgroundColor: "#444",
                  border: "none",
                  color: "#fff",
                  padding: "5px",
                  fontFamily: "monospace",
                }}
                required
              />
            </div>
            <div style={{ flex: 1 }}>
              <label
                style={{ display: "block", fontSize: "0.8em", color: "#aaa" }}
              >
                Saída Esperada
              </label>
              <textarea
                value={tc.expectedOutput}
                onChange={(e) =>
                  handleTestCaseChange(idx, "expectedOutput", e.target.value)
                }
                style={{
                  width: "100%",
                  backgroundColor: "#444",
                  border: "none",
                  color: "#fff",
                  padding: "5px",
                  fontFamily: "monospace",
                }}
                required
              />
            </div>
            {testCases.length > 1 && (
              <button
                type="button"
                onClick={() => removeTestCase(idx)}
                style={{
                  backgroundColor: "#d9534f",
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                  padding: "0 10px",
                }}
              >
                X
              </button>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={addTestCase}
          style={{
            padding: "10px",
            cursor: "pointer",
            backgroundColor: "#444",
            color: "#fff",
            border: "1px dashed #666",
          }}
        >
          + Adicionar Caso de Teste
        </button>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "15px",
            cursor: "pointer",
            backgroundColor: "#0e639c",
            color: "#fff",
            border: "none",
            fontWeight: "bold",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Criando..." : "Criar Problema"}
        </button>
      </form>
    </div>
  );
}
