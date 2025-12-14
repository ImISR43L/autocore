import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function CreateProblem() {
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [testCases, setTestCases] = useState([
    { input: "", expected_output: "" },
  ]);

  const addTestCase = () => {
    setTestCases([...testCases, { input: "", expected_output: "" }]);
  };

  const handleTestCaseChange = (
    index: number,
    field: string,
    value: string
  ) => {
    const newTestCases = [...testCases];
    (newTestCases[index] as any)[field] = value;
    setTestCases(newTestCases);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_URL}/problems`,
        { title, description, testCases },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Problema criado com sucesso!");
      navigate("/");
    } catch (error) {
      alert("Erro ao criar problema. Verifique se você é professor.");
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
      <h2>Novo Exercício</h2>
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          maxWidth: "600px",
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

        <textarea
          placeholder="Enunciado (Markdown suportado futuramente)"
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
              padding: "10px",
            }}
          >
            <textarea
              placeholder="Entrada (Ex: 5 5)"
              value={tc.input}
              onChange={(e) =>
                handleTestCaseChange(idx, "input", e.target.value)
              }
              style={{
                flex: 1,
                backgroundColor: "#444",
                border: "none",
                color: "#fff",
                padding: "5px",
              }}
            />
            <textarea
              placeholder="Saída Esperada (Ex: 10)"
              value={tc.expected_output}
              onChange={(e) =>
                handleTestCaseChange(idx, "expected_output", e.target.value)
              }
              style={{
                flex: 1,
                backgroundColor: "#444",
                border: "none",
                color: "#fff",
                padding: "5px",
              }}
            />
          </div>
        ))}

        <button
          type="button"
          onClick={addTestCase}
          style={{
            padding: "5px",
            cursor: "pointer",
            backgroundColor: "#555",
            color: "#fff",
            border: "none",
          }}
        >
          + Adicionar Caso de Teste
        </button>

        <button
          type="submit"
          style={{
            padding: "15px",
            cursor: "pointer",
            backgroundColor: "#0e639c",
            color: "#fff",
            border: "none",
            fontWeight: "bold",
          }}
        >
          Criar Problema
        </button>
      </form>
    </div>
  );
}
