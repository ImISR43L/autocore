import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import Editor from "@monaco-editor/react";
import "../App.css";

// --- INTERFACES ---
interface TestCase {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

interface Parameter {
  name: string;
  type: string;
}

interface Question {
  title: string;
  description: string;
  slug: string;
  parameters: Parameter[];
  returnType: string;
  testCases: TestCase[];
}

// Interface para o Payload de Criação/Edição
interface ProblemPayload {
  title: string;
  description: string;
  slug: string;
  classroomId: number | null;
  type: "EXERCISE" | "EXAM";
  maxAttempts: number | null;
  timeLimit: number | null;
  startDate?: string;
  deadline?: string;
  questions?: Question[];
  parameters?: Parameter[];
  returnType?: string;
  testCases?: TestCase[];
}

interface ProblemToEdit {
  id: string;
  type: "EXERCISE" | "EXAM";
  title: string;
  slug: string;
  description: string;
  maxAttempts?: number;
  timeLimit?: number;
  deadline?: string;
  startDate?: string;
}

const DATA_TYPES = [
  { value: "int", label: "Inteiro (int)" },
  { value: "float", label: "Decimal (float)" },
  { value: "string", label: "Texto (string)" },
  { value: "boolean", label: "Booleano (bool)" },
  { value: "int[]", label: "Array de Inteiros (int[])" },
  { value: "string[]", label: "Array de Texto (string[])" },
];

export default function CreateProblem() {
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState<1 | 2>(1);

  const [mainTitle, setMainTitle] = useState("");
  const [mainDescription, setMainDescription] = useState("");
  const [mainSlug, setMainSlug] = useState("");
  const [classroomId, setClassroomId] = useState<number | null>(null);
  const [type, setType] = useState<"EXERCISE" | "EXAM">("EXERCISE");

  // Alterado para permitir string vazia no input visualmente
  const [maxAttempts, setMaxAttempts] = useState<number | "">("");
  const [deadline, setDeadline] = useState("");
  const [timeLimit, setTimeLimit] = useState<number | "">("");

  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0);

  const [qTitle, setQTitle] = useState("");
  const [qDesc, setQDesc] = useState("");
  const [qSlug, setQSlug] = useState("");
  const [parameters, setParameters] = useState<Parameter[]>([
    { name: "arg1", type: "int" },
  ]);
  const [returnType, setReturnType] = useState("int");
  const [testCases, setTestCases] = useState<TestCase[]>([]);

  const [currentInputs, setCurrentInputs] = useState<string[]>([""]);
  const [currentOutput, setCurrentOutput] = useState("");
  const [currentIsHidden, setCurrentIsHidden] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (location.state?.classroomId) setClassroomId(location.state.classroomId);

    if (location.state?.problemToEdit) {
      const p = location.state.problemToEdit as ProblemToEdit;
      setType(p.type);
      setMainTitle(p.title);
      setMainSlug(p.slug);
      setMainDescription(p.description);
      // Ao carregar, se maxAttempts for null/undefined, setamos como "" (vazio)
      setMaxAttempts(p.maxAttempts ?? "");
      setTimeLimit(p.timeLimit ?? "");
      if (p.deadline)
        setDeadline(new Date(p.deadline).toISOString().slice(0, 16));
      else if (p.startDate)
        setDeadline(new Date(p.startDate).toISOString().slice(0, 16));

      setStep(2);
    }
  }, [location.state]);

  useEffect(() => {
    setCurrentInputs(new Array(parameters.length).fill(""));
  }, [parameters.length]);

  const handleSelectType = (selectedType: "EXERCISE" | "EXAM") => {
    setType(selectedType);
    setStep(2);
  };

  const saveCurrentQuestionState = () => {
    if (type !== "EXAM") return;
    const updatedQuestions = [...questions];
    const currentData: Question = {
      title: qTitle,
      description: qDesc,
      slug: qSlug,
      parameters,
      returnType,
      testCases,
    };

    if (activeQuestionIndex < questions.length) {
      updatedQuestions[activeQuestionIndex] = currentData;
    } else {
      updatedQuestions.push(currentData);
    }
    setQuestions(updatedQuestions);
  };

  const loadQuestionState = (index: number) => {
    const q = questions[index];
    if (q) {
      setQTitle(q.title);
      setQDesc(q.description);
      setQSlug(q.slug);
      setParameters(q.parameters);
      setReturnType(q.returnType);
      setTestCases(q.testCases);
    }
    setActiveQuestionIndex(index);
  };

  const handleAddNewQuestion = () => {
    saveCurrentQuestionState();
    setQTitle("");
    setQDesc("");
    setQSlug("");
    setParameters([{ name: "arg1", type: "int" }]);
    setTestCases([]);
    setActiveQuestionIndex(questions.length + 1);
  };

  const handleRemoveQuestion = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const newQ = questions.filter((_, i) => i !== index);
    setQuestions(newQ);
    if (index === activeQuestionIndex) {
      setActiveQuestionIndex(0);
      if (newQ.length > 0) loadQuestionState(0);
    }
  };

  const addParameter = () =>
    setParameters([
      ...parameters,
      { name: `arg${parameters.length + 1}`, type: "int" },
    ]);
  const removeParam = (i: number) => {
    const n = [...parameters];
    n.splice(i, 1);
    setParameters(n);
  };
  const updateParam = (i: number, f: keyof Parameter, v: string) => {
    const n = [...parameters];
    n[i] = { ...n[i], [f]: v };
    setParameters(n);
  };

  const handleAddTestCase = () => {
    if (!currentOutput) return toast.warning("Defina saída.");
    const formatted = [];
    for (let i = 0; i < currentInputs.length; i++) {
      let val = currentInputs[i];
      if (parameters[i].type === "string" && !val.startsWith('"'))
        val = `"${val}"`;
      try {
        JSON.parse(val);
        formatted.push(val);
      } catch {
        return toast.error(`Erro param ${i + 1}`);
      }
    }
    setTestCases([
      ...testCases,
      {
        input: formatted.join("\n"),
        expectedOutput: currentOutput,
        isHidden: currentIsHidden,
      },
    ]);
    setCurrentInputs(new Array(parameters.length).fill(""));
    setCurrentOutput("");
    setCurrentIsHidden(false);
  };

  const handleCreate = async () => {
    if (!mainTitle || !mainSlug)
      return toast.warning("Preencha o título e slug da atividade.");
    setLoading(true);

    let finalQuestions = questions;
    if (type === "EXAM") {
      const currentQ: Question = {
        title: qTitle,
        description: qDesc,
        slug: qSlug,
        parameters,
        returnType,
        testCases,
      };
      if (activeQuestionIndex < questions.length) {
        finalQuestions[activeQuestionIndex] = currentQ;
      } else {
        finalQuestions = [...questions, currentQ];
      }
      if (finalQuestions.length === 0) {
        setLoading(false);
        return toast.warning("Adicione ao menos uma questão à prova.");
      }
    }

    try {
      const token = localStorage.getItem("token");

      // --- CORREÇÃO DE LÓGICA DO PAYLOAD e TIPAGEM ---
      const payload: ProblemPayload = {
        title: mainTitle,
        description: mainDescription || "...",
        slug: mainSlug,
        classroomId,
        type,
        maxAttempts: maxAttempts ? Number(maxAttempts) : null,
        timeLimit: type === "EXAM" && timeLimit ? Number(timeLimit) : null,
        startDate:
          type === "EXAM" && deadline
            ? new Date(deadline).toISOString()
            : undefined,
        deadline:
          type === "EXERCISE" && deadline
            ? new Date(deadline).toISOString()
            : undefined,
      };

      if (type === "EXAM") {
        payload.questions = finalQuestions;
      } else {
        payload.title = qTitle || mainTitle;
        payload.description = qDesc || mainDescription;
        payload.slug = qSlug || mainSlug;
        payload.parameters = parameters;
        payload.returnType = returnType;
        payload.testCases = testCases;
      }

      if (location.state?.problemToEdit) {
        await axios.patch(
          `${API_URL}/problems/${location.state.problemToEdit.id}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        toast.success("Atualizado com sucesso!");
      } else {
        await axios.post(`${API_URL}/problems`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Criado com sucesso!");
      }

      navigate(`/class/${classroomId}`);
    } catch (e: unknown) {
      console.error(e);
      if (axios.isAxiosError(e)) {
        toast.error(e.response?.data?.message || "Erro ao salvar.");
      } else {
        toast.error("Erro desconhecido ao salvar.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (step === 1) {
    return (
      <div
        className="container"
        style={{ maxWidth: "800px", padding: "40px 20px" }}
      >
        <button
          onClick={() => navigate(-1)}
          className="btn btn-ghost"
          style={{ marginBottom: "20px" }}
        >
          ← Cancelar
        </button>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <h1 style={{ fontSize: "2rem", marginBottom: "10px" }}>
            O que você deseja criar?
          </h1>
          <p style={{ color: "#888" }}>
            Escolha o tipo de atividade para adicionar à turma.
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "30px",
          }}
        >
          <div
            onClick={() => handleSelectType("EXERCISE")}
            className="selection-card"
            style={{
              background: "#1e1e1e",
              border: "1px solid #333",
              borderRadius: "12px",
              padding: "30px",
              cursor: "pointer",
              transition: "all 0.2s",
              textAlign: "center",
            }}
            onMouseOver={(e) => (e.currentTarget.style.borderColor = "#4caf50")}
            onMouseOut={(e) => (e.currentTarget.style.borderColor = "#333")}
          >
            <div style={{ fontSize: "3rem", marginBottom: "20px" }}>💻</div>
            <h2 style={{ color: "#fff", marginBottom: "10px" }}>
              Exercício Prático
            </h2>
            <p style={{ color: "#888", fontSize: "0.9rem", lineHeight: "1.5" }}>
              Uma atividade única de programação com casos de teste
              automatizados.
            </p>
          </div>
          <div
            onClick={() => handleSelectType("EXAM")}
            className="selection-card"
            style={{
              background: "#1e1e1e",
              border: "1px solid #333",
              borderRadius: "12px",
              padding: "30px",
              cursor: "pointer",
              transition: "all 0.2s",
              textAlign: "center",
            }}
            onMouseOver={(e) => (e.currentTarget.style.borderColor = "#2196f3")}
            onMouseOut={(e) => (e.currentTarget.style.borderColor = "#333")}
          >
            <div style={{ fontSize: "3rem", marginBottom: "20px" }}>📝</div>
            <h2 style={{ color: "#fff", marginBottom: "10px" }}>
              Prova / Exame
            </h2>
            <p style={{ color: "#888", fontSize: "0.9rem", lineHeight: "1.5" }}>
              Um conjunto de questões com controle de tempo, tentativas
              limitadas e agendamento.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="container"
      style={{ maxWidth: "900px", paddingBottom: "100px" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #333",
          paddingBottom: "15px",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <button
            onClick={() => setStep(1)}
            className="btn btn-ghost"
            title="Mudar Tipo"
          >
            ← Voltar
          </button>
          <h1 style={{ margin: 0 }}>
            {type === "EXAM" ? "Nova Prova" : "Novo Exercício"}
          </h1>
        </div>
        <div
          style={{
            fontSize: "0.8rem",
            color: "#888",
            background: "#252526",
            padding: "5px 10px",
            borderRadius: "20px",
          }}
        >
          {type === "EXAM" ? "MODO MÚLTIPLAS QUESTÕES" : "MODO EXERCÍCIO ÚNICO"}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          marginBottom: "20px",
          background: "#252526",
          padding: "20px",
          borderRadius: "8px",
        }}
      >
        <div>
          <label className="form-label">
            {type === "EXAM" ? "Título da Prova" : "Título do Exercício"}
          </label>
          <input
            className="form-input"
            value={mainTitle}
            onChange={(e) => setMainTitle(e.target.value)}
            placeholder={
              type === "EXAM" ? "Ex: Prova Semestral" : "Ex: Soma de Inteiros"
            }
            autoFocus
          />
        </div>
        <div>
          <label className="form-label">Slug Principal (URL)</label>
          <input
            className="form-input"
            value={mainSlug}
            onChange={(e) => setMainSlug(e.target.value)}
            placeholder="ex: prova-1"
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="form-label">Instruções / Descrição</label>
          <input
            className="form-input"
            value={mainDescription}
            onChange={(e) => setMainDescription(e.target.value)}
            placeholder="Descrição geral visível na lista..."
          />
        </div>

        {type === "EXAM" ? (
          <>
            <div>
              <label className="form-label">Duração (minutos)</label>
              <input
                type="number"
                className="form-input"
                placeholder="Ex: 90 (Deixe vazio para ilimitado)"
                value={timeLimit}
                onChange={(e) =>
                  setTimeLimit(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
              />
            </div>
            <div>
              <label className="form-label">Agendar Aparição (Início)</label>
              <input
                type="datetime-local"
                className="form-input"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
            {/* AQUI: Input de MaxAttempts tratado corretamente para aceitar vazio */}
            <div>
              <label className="form-label">Limite de Tentativas</label>
              <input
                type="number"
                className="form-input"
                placeholder="Ilimitado (Deixe em branco)"
                value={maxAttempts}
                onChange={(e) =>
                  setMaxAttempts(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
              />
            </div>
          </>
        ) : (
          <div>
            <label className="form-label">Prazo de Entrega</label>
            <input
              type="datetime-local"
              className="form-input"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        )}
      </div>

      {type === "EXAM" && (
        <div style={{ marginBottom: "20px" }}>
          <h4
            style={{
              marginTop: 0,
              marginBottom: "10px",
              color: "#888",
              fontSize: "0.8rem",
              textTransform: "uppercase",
            }}
          >
            Questões da Prova
          </h4>
          <div
            style={{
              display: "flex",
              gap: "10px",
              overflowX: "auto",
              paddingBottom: "10px",
              borderBottom: "1px solid #333",
            }}
          >
            {questions.map((_, i) => (
              <div
                key={i}
                onClick={() => {
                  saveCurrentQuestionState();
                  loadQuestionState(i);
                }}
                style={{
                  padding: "8px 15px",
                  background: activeQuestionIndex === i ? "#4caf50" : "#333",
                  color: "#fff",
                  borderRadius: "4px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  border:
                    activeQuestionIndex === i
                      ? "1px solid #66bb6a"
                      : "1px solid transparent",
                  transition: "all 0.2s",
                }}
              >
                <strong>Q{i + 1}</strong>
                <span
                  onClick={(e) => handleRemoveQuestion(e, i)}
                  style={{
                    fontSize: "0.8rem",
                    opacity: 0.7,
                    cursor: "pointer",
                    paddingLeft: "5px",
                  }}
                >
                  ✕
                </span>
              </div>
            ))}
            <button
              onClick={handleAddNewQuestion}
              className="btn btn-sm btn-secondary"
              style={{ border: "1px dashed #666", opacity: 0.8 }}
            >
              + Nova Questão
            </button>
          </div>
        </div>
      )}

      <div
        className="card-box"
        style={{
          background: "#1e1e1e",
          padding: "20px",
          borderRadius: "8px",
          border: "1px solid #444",
          position: "relative",
        }}
      >
        {type === "EXAM" && (
          <div
            style={{
              position: "absolute",
              top: "-10px",
              left: "20px",
              background: "#2196f3",
              padding: "2px 10px",
              borderRadius: "4px",
              fontSize: "0.75rem",
              fontWeight: "bold",
              color: "white",
            }}
          >
            EDITANDO QUESTÃO {activeQuestionIndex + 1}
          </div>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "20px",
            marginBottom: "20px",
            marginTop: type === "EXAM" ? "10px" : "0",
          }}
        >
          <div>
            <label className="form-label">Título da Questão</label>
            <input
              className="form-input"
              value={qTitle}
              onChange={(e) => setQTitle(e.target.value)}
              placeholder="Título interno"
            />
          </div>
          <div>
            <label className="form-label">Slug da Questão</label>
            <input
              className="form-input"
              value={qSlug}
              onChange={(e) => setQSlug(e.target.value)}
              placeholder="slug-interno"
            />
          </div>
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label className="form-label">Enunciado (Markdown)</label>
          <div
            style={{
              height: "250px",
              border: "1px solid #333",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <Editor
              height="100%"
              defaultLanguage="markdown"
              theme="vs-dark"
              value={qDesc}
              onChange={(v) => setQDesc(v || "")}
              options={{ minimap: { enabled: false } }}
            />
          </div>
        </div>
        <div style={{ borderTop: "1px solid #333", paddingTop: "20px" }}>
          <h4 style={{ marginTop: 0, color: "#4caf50", fontSize: "1rem" }}>
            ⚙️ Assinatura & Código
          </h4>
          {parameters.map((p, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: "10px",
                marginBottom: "10px",
                alignItems: "center",
              }}
            >
              <span
                style={{ color: "#666", fontSize: "0.9rem", minWidth: "60px" }}
              >
                Param {i + 1}:
              </span>
              <input
                className="form-input"
                value={p.name}
                onChange={(e) => updateParam(i, "name", e.target.value)}
                placeholder="Nome"
                style={{ flex: 1 }}
              />
              <select
                className="form-select"
                value={p.type}
                onChange={(e) => updateParam(i, "type", e.target.value)}
                style={{ flex: 1 }}
              >
                {DATA_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => removeParam(i)}
                className="btn btn-danger"
                style={{ padding: "5px 12px" }}
              >
                ✕
              </button>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "10px",
            }}
          >
            <button onClick={addParameter} className="btn btn-sm btn-secondary">
              + Adicionar Parâmetro
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <label>Retorno:</label>
              <select
                className="form-select"
                value={returnType}
                onChange={(e) => setReturnType(e.target.value)}
                style={{ width: "150px" }}
              >
                {DATA_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: "30px",
            borderTop: "1px solid #333",
            paddingTop: "20px",
          }}
        >
          <h4 style={{ marginTop: 0, color: "#2196f3", fontSize: "1rem" }}>
            🧪 Casos de Teste
          </h4>
          <div
            style={{
              background: "#252526",
              padding: "15px",
              borderRadius: "6px",
              marginBottom: "15px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${parameters.length}, 1fr)`,
                gap: "10px",
                marginBottom: "10px",
              }}
            >
              {parameters.map((p, i) => (
                <div key={i}>
                  <label style={{ fontSize: "0.75rem", color: "#888" }}>
                    {p.name} ({p.type})
                  </label>
                  <input
                    className="form-input"
                    value={currentInputs[i]}
                    onChange={(e) => {
                      const n = [...currentInputs];
                      n[i] = e.target.value;
                      setCurrentInputs(n);
                    }}
                    placeholder="Valor"
                  />
                </div>
              ))}
            </div>
            <div
              style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}
            >
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "0.75rem", color: "#888" }}>
                  Saída Esperada (JSON)
                </label>
                <input
                  className="form-input"
                  value={currentOutput}
                  onChange={(e) => setCurrentOutput(e.target.value)}
                  placeholder="Ex: 10 ou true"
                />
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: "10px",
                  background: "#333",
                  padding: "5px 10px",
                  borderRadius: "4px",
                }}
              >
                <input
                  type="checkbox"
                  id="isHidden"
                  checked={currentIsHidden}
                  onChange={(e) => setCurrentIsHidden(e.target.checked)}
                  style={{ marginRight: "5px" }}
                />
                <label
                  htmlFor="isHidden"
                  style={{ fontSize: "0.8rem", cursor: "pointer" }}
                >
                  Oculto
                </label>
              </div>
              <button
                onClick={handleAddTestCase}
                className="btn btn-primary"
                style={{ height: "42px" }}
              >
                Adicionar
              </button>
            </div>
          </div>
          {testCases.length > 0 && (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Input</th>
                  <th>Output</th>
                  <th>Tipo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {testCases.map((tc, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: "monospace", fontSize: "0.9rem" }}>
                      {tc.input.replace(/\n/g, ", ")}
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.9rem" }}>
                      {tc.expectedOutput}
                    </td>
                    <td style={{ fontSize: "0.8rem" }}>
                      {tc.isHidden ? "🔒 Oculto" : "👁️ Visível"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        onClick={() =>
                          setTestCases(testCases.filter((_, x) => x !== i))
                        }
                        className="btn btn-sm btn-danger"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <button
        onClick={handleCreate}
        disabled={loading}
        className="btn btn-primary"
        style={{
          width: "100%",
          marginTop: "30px",
          padding: "15px",
          fontSize: "1.2rem",
        }}
      >
        {loading
          ? "Processando..."
          : type === "EXAM"
            ? "FINALIZAR CRIAÇÃO DA PROVA"
            : "CRIAR EXERCÍCIO"}
      </button>
    </div>
  );
}
