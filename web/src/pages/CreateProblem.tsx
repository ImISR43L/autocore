import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import "../App.css";

interface TestCase {
  input: string;
  expectedOutput: string;
}

export default function CreateProblem() {
  const navigate = useNavigate();
  const location = useLocation();
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

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
        { title, description, slug, classroomId, testCases },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Problema criado com sucesso!");
      navigate(`/class/${classroomId}`);
    } catch (error: any) {
      const msg = error.response?.data?.message || "Erro ao criar problema.";
      alert(`Erro: ${Array.isArray(msg) ? msg.join(", ") : msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Novo Exercício</h1>
        <button onClick={() => navigate(-1)} className="btn btn-secondary">
          Voltar
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ maxWidth: "800px", margin: "0 auto" }}
      >
        {/* Dados Básicos */}
        <div className="form-group">
          <label className="form-label">Título</label>
          <input
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Ex: Soma Simples"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Slug (URL)</label>
          <input
            className="form-input"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
            placeholder="ex: soma-simples"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Enunciado</label>
          <textarea
            className="form-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            required
            placeholder="Descreva o problema..."
          />
        </div>

        <hr style={{ borderColor: "var(--border)", margin: "2rem 0" }} />

        {/* Casos de Teste */}
        <h3
          className="page-title"
          style={{ fontSize: "1.2rem", marginBottom: "1rem" }}
        >
          Casos de Teste
        </h3>

        {testCases.map((tc, idx) => (
          <div key={idx} className="test-case-card">
            <div className="test-case-header">
              <span>Caso #{idx + 1}</span>
              {testCases.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTestCase(idx)}
                  className="btn btn-danger"
                  style={{ padding: "0.2rem 0.5rem", fontSize: "0.8rem" }}
                >
                  Remover
                </button>
              )}
            </div>

            <div className="test-case-grid">
              <div>
                <label className="form-label">Entrada</label>
                <textarea
                  className="form-textarea"
                  value={tc.input}
                  onChange={(e) =>
                    handleTestCaseChange(idx, "input", e.target.value)
                  }
                  required
                  rows={2}
                  style={{ fontFamily: "monospace" }}
                />
              </div>
              <div>
                <label className="form-label">Saída Esperada</label>
                <textarea
                  className="form-textarea"
                  value={tc.expectedOutput}
                  onChange={(e) =>
                    handleTestCaseChange(idx, "expectedOutput", e.target.value)
                  }
                  required
                  rows={2}
                  style={{ fontFamily: "monospace" }}
                />
              </div>
            </div>
          </div>
        ))}

        <div style={{ display: "flex", gap: "1rem", marginBottom: "3rem" }}>
          <button
            type="button"
            onClick={addTestCase}
            className="btn btn-secondary"
            style={{ flex: 1 }}
          >
            + Adicionar Caso
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ flex: 2 }}
          >
            {loading ? "Salvando..." : "Salvar Exercício"}
          </button>
        </div>
      </form>
    </div>
  );
}
