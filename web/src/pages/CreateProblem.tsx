import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";

interface TestCase {
  input: string;
  expected_output: string;
}

export default function CreateProblem() {
  const navigate = useNavigate();
  const location = useLocation();
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

  // Estados do Formulário
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [testCases, setTestCases] = useState<TestCase[]>([
    { input: "", expected_output: "" }, // Começa com um caso vazio
  ]);
  const [loading, setLoading] = useState(false);

  // Recupera o ID da turma passado pelo navigate state
  const classroomId = location.state?.classroomId;

  useEffect(() => {
    if (!classroomId) {
      alert("Erro: Turma não identificada.");
      navigate("/dashboard");
    }
  }, [classroomId, navigate]);

  // Manipulação dos Casos de Teste Dinâmicos
  const handleTestCaseChange = (
    index: number,
    field: keyof TestCase,
    value: string
  ) => {
    const newTestCases = [...testCases];
    newTestCases[index][field] = value;
    setTestCases(newTestCases);
  };

  const addTestCase = () => {
    setTestCases([...testCases, { input: "", expected_output: "" }]);
  };

  const removeTestCase = (index: number) => {
    const newTestCases = testCases.filter((_, i) => i !== index);
    setTestCases(newTestCases);
  };

  // Envio do Formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const token = localStorage.getItem("token");
    if (!token) {
      alert("Sessão expirada");
      navigate("/");
      return;
    }

    try {
      await axios.post(
        `${API_URL}/problems`,
        {
          title,
          description,
          slug, // Opcional: O backend poderia gerar isso, mas estamos enviando manual
          classroomId,
          testCases,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      alert("Exercício criado com sucesso!");
      navigate(`/class/${classroomId}`); // Volta para a turma
    } catch (error: any) {
      console.error(error);
      alert(
        "Erro ao criar exercício: " +
          (error.response?.data?.message || error.message)
      );
    } finally {
      setLoading(false);
    }
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
      <button
        onClick={() => navigate(-1)}
        style={{
          background: "none",
          border: "none",
          color: "#aaa",
          cursor: "pointer",
          fontSize: "1rem",
          marginBottom: "20px",
        }}
      >
        ← Voltar
      </button>

      <h1 style={{ marginBottom: "30px" }}>Criar Novo Exercício</h1>

      <form onSubmit={handleSubmit} style={{ maxWidth: "800px" }}>
        {/* Título */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "8px" }}>
            Título do Problema
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              backgroundColor: "#2d2d2d",
              border: "1px solid #444",
              color: "white",
              borderRadius: "4px",
            }}
          />
        </div>

        {/* Slug */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "8px" }}>
            Slug (URL amigável, ex: soma-simples)
          </label>
          <input
            type="text"
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              backgroundColor: "#2d2d2d",
              border: "1px solid #444",
              color: "white",
              borderRadius: "4px",
            }}
          />
        </div>

        {/* Descrição */}
        <div style={{ marginBottom: "30px" }}>
          <label style={{ display: "block", marginBottom: "8px" }}>
            Descrição (Markdown ou Texto)
          </label>
          <textarea
            required
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              backgroundColor: "#2d2d2d",
              border: "1px solid #444",
              color: "white",
              borderRadius: "4px",
              fontFamily: "monospace",
            }}
          />
        </div>

        <hr style={{ borderColor: "#333", marginBottom: "30px" }} />

        {/* Casos de Teste Dinâmicos */}
        <h3 style={{ marginBottom: "20px" }}>Casos de Teste (I/O)</h3>

        {testCases.map((tc, index) => (
          <div
            key={index}
            style={{
              backgroundColor: "#252526",
              padding: "20px",
              borderRadius: "8px",
              marginBottom: "20px",
              border: "1px solid #333",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "10px",
              }}
            >
              <strong>Caso #{index + 1}</strong>
              {testCases.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTestCase(index)}
                  style={{
                    backgroundColor: "#d9534f",
                    color: "white",
                    border: "none",
                    padding: "5px 10px",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Remover
                </button>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "20px",
              }}
            >
              <div>
                <label style={{ fontSize: "0.9rem", color: "#aaa" }}>
                  Entrada (Stdin)
                </label>
                <textarea
                  required
                  rows={3}
                  value={tc.input}
                  onChange={(e) =>
                    handleTestCaseChange(index, "input", e.target.value)
                  }
                  style={{
                    width: "100%",
                    marginTop: "5px",
                    backgroundColor: "#1e1e1e",
                    border: "1px solid #444",
                    color: "#eee",
                    fontFamily: "monospace",
                    padding: "8px",
                  }}
                  placeholder="Ex: 5 10"
                />
              </div>
              <div>
                <label style={{ fontSize: "0.9rem", color: "#aaa" }}>
                  Saída Esperada (Stdout)
                </label>
                <textarea
                  required
                  rows={3}
                  value={tc.expected_output}
                  onChange={(e) =>
                    handleTestCaseChange(
                      index,
                      "expected_output",
                      e.target.value
                    )
                  }
                  style={{
                    width: "100%",
                    marginTop: "5px",
                    backgroundColor: "#1e1e1e",
                    border: "1px solid #444",
                    color: "#eee",
                    fontFamily: "monospace",
                    padding: "8px",
                  }}
                  placeholder="Ex: 15"
                />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addTestCase}
          style={{
            backgroundColor: "#444",
            color: "white",
            border: "1px dashed #666",
            padding: "10px",
            width: "100%",
            cursor: "pointer",
            marginBottom: "30px",
          }}
        >
          + Adicionar Novo Caso de Teste
        </button>

        {/* Botão Salvar */}
        <button
          type="submit"
          disabled={loading}
          style={{
            backgroundColor: "#28a745",
            color: "white",
            border: "none",
            padding: "15px 30px",
            fontSize: "1.1rem",
            fontWeight: "bold",
            borderRadius: "4px",
            cursor: "pointer",
            width: "100%",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Criando Exercício..." : "Salvar Exercício"}
        </button>
      </form>
    </div>
  );
}
