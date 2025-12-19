import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import "../App.css";

interface TestCase {
  input: string;
  expectedOutput: string;
}

export default function CreateProblem() {
  const navigate = useNavigate();
  const location = useLocation();
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

  // Recupera dados passados pela navegação
  const { classroomId, problemToEdit } = location.state || {};
  const isEditing = !!problemToEdit; // Booleano: Estamos editando?

  // Estados do formulário
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [testCases, setTestCases] = useState<TestCase[]>([
    { input: "", expectedOutput: "" },
  ]);
  const [loading, setLoading] = useState(false);

  // Efeito para carregar dados se for edição
  useEffect(() => {
    // 1. Validação básica de turma
    if (!classroomId && !isEditing) {
      toast.error("Turma não identificada.");
      navigate("/dashboard");
      return;
    }

    // 2. Lógica de Carregamento para EDIÇÃO
    const loadProblemData = async () => {
      if (isEditing && problemToEdit?.id) {
        try {
          const token = localStorage.getItem("token");
          // Buscamos os dados frescos do backend (que agora inclui testCases graças ao Passo 2)
          const res = await axios.get(
            `${API_URL}/problems/${problemToEdit.id}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          const fullProblem = res.data;

          setTitle(fullProblem.title);
          setDescription(fullProblem.description);
          setSlug(fullProblem.slug || "");

          // Agora sim teremos os casos de teste
          if (fullProblem.testCases && fullProblem.testCases.length > 0) {
            setTestCases(fullProblem.testCases);
          }
        } catch (error) {
          console.error(error);
          toast.error("Erro ao carregar detalhes do exercício.");
        }
      }
    };

    loadProblemData();
  }, [classroomId, isEditing, problemToEdit, navigate]);

  const addTestCase = () => {
    setTestCases([...testCases, { input: "", expectedOutput: "" }]);
  };

  const removeTestCase = (index: number) => {
    setTestCases(testCases.filter((_, i) => i !== index));
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
    const toastId = toast.loading(isEditing ? "Atualizando..." : "Criando...");

    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const payload = { title, description, slug, classroomId, testCases };

      if (isEditing) {
        // MODO EDIÇÃO: PATCH
        await axios.patch(`${API_URL}/problems/${problemToEdit.id}`, payload, {
          headers,
        });
        toast.success("Exercício atualizado!", { id: toastId });
      } else {
        // MODO CRIAÇÃO: POST
        await axios.post(`${API_URL}/problems`, payload, { headers });
        toast.success("Exercício criado!", { id: toastId });
      }

      navigate(`/class/${classroomId}`);
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message || "Erro ao salvar.";
      toast.error(Array.isArray(msg) ? msg[0] : msg, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">
          {isEditing ? "Editar Exercício" : "Novo Exercício"}
        </h1>
        <button onClick={() => navigate(-1)} className="btn btn-secondary">
          Cancelar
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ maxWidth: "800px", margin: "0 auto" }}
      >
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
          <label className="form-label">Slug (URL Amigável)</label>
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
            rows={8}
            required
          />
        </div>

        <hr style={{ borderColor: "var(--border)", margin: "2rem 0" }} />

        <h3
          className="page-title"
          style={{ fontSize: "1.2rem", marginBottom: "1rem" }}
        >
          Casos de Teste (IO)
        </h3>

        {testCases.map((tc, idx) => (
          <div key={idx} className="test-case-card">
            <div className="test-case-header">
              <span>Caso de Teste #{idx + 1}</span>
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
                  rows={2}
                  style={{ fontFamily: "monospace" }}
                />
              </div>
            </div>
          </div>
        ))}

        <div
          style={{
            display: "flex",
            gap: "1rem",
            marginTop: "1rem",
            marginBottom: "3rem",
          }}
        >
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
            {loading
              ? "Salvando..."
              : isEditing
              ? "Atualizar Exercício"
              : "Criar Exercício"}
          </button>
        </div>
      </form>
    </div>
  );
}
