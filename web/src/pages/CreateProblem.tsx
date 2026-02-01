import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import Editor from "@monaco-editor/react";
import {
  Plus,
  Trash,
  FileText,
  ArrowLeft,
  Code2,
  ScrollText,
  Clock,
  X,
} from "lucide-react";
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

interface FileEntry {
  name: string;
  content: string;
}

interface Question {
  title: string;
  description: string;
  slug: string;
  parameters: Parameter[];
  returnType: string;
  testCases: TestCase[];
  starterCode: FileEntry[];
}

// Interface para o Payload (Tipos Atualizados para String)
interface ProblemPayload {
  title: string;
  description: string;
  slug: string;
  classroomId?: string; // Alterado para string (UUID) e opcional
  type: "EXERCISE" | "EXAM";
  maxAttempts?: number;
  timeLimit?: number;
  startDate?: string;
  deadline?: string;
  questions?: Question[];
  parameters?: Parameter[];
  returnType?: string;
  testCases?: TestCase[];
  starterCode?: FileEntry[];
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
  parameters?: Parameter[];
  returnType?: string;
  testCases?: TestCase[];
  children?: any[];
  starterCode?: FileEntry[];
}

const DATA_TYPES = [
  { value: "int", label: "Inteiro (int)" },
  { value: "float", label: "Decimal (float)" },
  { value: "string", label: "Texto (string)" },
  { value: "boolean", label: "Booleano (bool)" },
  { value: "int[]", label: "Array de Int" },
  { value: "string[]", label: "Array de String" },
];

// --- TEMPLATES PADRÃO ---
const STARTER_TEMPLATES = {
  python: {
    name: "main.py",
    content:
      "def solve():\n    # Escreva seu código aqui\n    pass\n\nif __name__ == '__main__':\n    solve()",
  },
  javascript: {
    name: "index.js",
    content:
      "function solve() {\n    // Escreva seu código aqui\n}\n\nsolve();",
  },
  cpp: {
    name: "main.cpp",
    content:
      "#include <iostream>\n\nusing namespace std;\n\nint main() {\n    // Escreva seu código aqui\n    return 0;\n}",
  },
};

export default function CreateProblem() {
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const navigate = useNavigate();
  const location = useLocation();

  // Estados Básicos
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [type, setType] = useState<"EXERCISE" | "EXAM">("EXERCISE");
  const [loading, setLoading] = useState(false);

  // Estados de Prova
  const [maxAttempts, setMaxAttempts] = useState<string>("");
  const [timeLimit, setTimeLimit] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [deadline, setDeadline] = useState("");

  // Estados do Exercício
  const [exParameters, setExParameters] = useState<Parameter[]>([]);
  const [exReturnType, setExReturnType] = useState("void");
  const [exTestCases, setExTestCases] = useState<TestCase[]>([]);

  // Inicializa com o template Python por padrão
  const [exFiles, setExFiles] = useState<FileEntry[]>([
    { ...STARTER_TEMPLATES.python },
  ]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [newFileName, setNewFileName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("python");

  // Inputs temporários
  const [paramName, setParamName] = useState("");
  const [paramType, setParamType] = useState("int");
  const [tcInput, setTcInput] = useState("");
  const [tcOutput, setTcOutput] = useState("");
  const [tcHidden, setTcHidden] = useState(false);

  // Estados da Lista de Questões (Prova)
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalDesc, setModalDesc] = useState("");
  const [modalSlug, setModalSlug] = useState("");

  // Modo de Edição
  const [classroomId, setClassroomId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [problemId, setProblemId] = useState<string | null>(null);

  useEffect(() => {
    if (location.state?.classroomId) {
      setClassroomId(location.state.classroomId);
    }
    if (location.state?.problemToEdit) {
      const p: ProblemToEdit = location.state.problemToEdit;
      setIsEditing(true);
      setProblemId(p.id);
      setTitle(p.title);
      setDescription(p.description);
      setSlug(p.slug);
      setType(p.type);

      if (p.type === "EXAM") {
        setMaxAttempts(p.maxAttempts ? String(p.maxAttempts) : "");
        setTimeLimit(p.timeLimit ? String(p.timeLimit) : "");
        setStartDate(p.startDate ? p.startDate.slice(0, 16) : "");
        setDeadline(p.deadline ? p.deadline.slice(0, 16) : "");

        // Carregar questões se existirem (p.children)
        // Nota: O backend pode retornar 'children' como array de Problems
        if (p.children && p.children.length > 0) {
          const loadedQuestions = p.children.map((child: any) => ({
            title: child.title,
            description: child.description,
            slug: child.slug,
            parameters: child.parameters || [],
            returnType: child.returnType || "void",
            testCases: child.testCases || [],
            starterCode: child.starterCode || [],
          }));
          setQuestions(loadedQuestions);
        }
      } else {
        setExParameters(p.parameters || []);
        setExReturnType(p.returnType || "void");
        setExTestCases(p.testCases || []);
        if (p.starterCode && p.starterCode.length > 0) {
          setExFiles(p.starterCode);
          const firstFile = p.starterCode[0].name;
          if (firstFile.endsWith(".js")) setSelectedTemplate("javascript");
          else if (firstFile.endsWith(".cpp")) setSelectedTemplate("cpp");
          else setSelectedTemplate("python");
        }
      }
    }
  }, [location.state]);

  const applyTemplate = (lang: string) => {
    setSelectedTemplate(lang);
    const template = STARTER_TEMPLATES[lang as keyof typeof STARTER_TEMPLATES];
    const newFiles = [...exFiles];
    if (newFiles.length > 0) {
      newFiles[0] = { name: template.name, content: template.content };
      setExFiles(newFiles);
      setActiveFileIndex(0);
    }
  };

  const handleAddFile = () => {
    if (!newFileName.trim()) return toast.warning("Nome vazio");
    if (exFiles.some((f) => f.name === newFileName))
      return toast.warning("Já existe");
    setExFiles([...exFiles, { name: newFileName, content: "" }]);
    setNewFileName("");
    setActiveFileIndex(exFiles.length);
  };

  const handleRemoveFile = (index: number) => {
    if (exFiles.length <= 1)
      return toast.warning("O arquivo principal é obrigatório.");
    const newFiles = exFiles.filter((_, i) => i !== index);
    setExFiles(newFiles);
    setActiveFileIndex(0);
  };

  const updateFileContent = (val: string | undefined) => {
    const newFiles = [...exFiles];
    if (newFiles[activeFileIndex]) {
      newFiles[activeFileIndex].content = val || "";
      setExFiles(newFiles);
    }
  };

  const addParameter = () => {
    if (!paramName) return;
    setExParameters([...exParameters, { name: paramName, type: paramType }]);
    setParamName("");
  };

  const addTestCase = () => {
    if (!tcInput && !tcOutput) return;
    setExTestCases([
      ...exTestCases,
      { input: tcInput, expectedOutput: tcOutput, isHidden: tcHidden },
    ]);
    setTcInput("");
    setTcOutput("");
    setTcHidden(false);
  };

  const openQuestionModal = () => {
    setModalTitle("");
    setModalDesc("");
    setModalSlug("");
    setExParameters([]);
    setExReturnType("void");
    setExTestCases([]);
    setExFiles([{ ...STARTER_TEMPLATES.python }]);
    setSelectedTemplate("python");
    setIsModalOpen(true);
  };

  const saveQuestionFromModal = () => {
    if (!modalTitle || !modalSlug || !modalDesc)
      return toast.warning("Preencha os dados da questão");

    const newQuestion: Question = {
      title: modalTitle,
      description: modalDesc,
      slug: modalSlug,
      parameters: exParameters,
      returnType: exReturnType,
      testCases: exTestCases,
      starterCode: exFiles,
    };

    setQuestions([...questions, newQuestion]);
    setIsModalOpen(false);
    toast.success("Questão adicionada!");
  };

  const removeQuestion = (idx: number) => {
    const nq = questions.filter((_, i) => i !== idx);
    setQuestions(nq);
  };

  // --- SALVAR TUDO ---
  const handleCreate = async () => {
    if (!title || !slug || !description)
      return toast.warning("Preencha os campos básicos");

    setLoading(true);
    try {
      const token = localStorage.getItem("token");

      const payload: ProblemPayload = {
        title,
        description,
        slug,
        type,
        ...(classroomId && { classroomId }),
        ...(maxAttempts && { maxAttempts: parseInt(maxAttempts) }),
        ...(timeLimit && { timeLimit: parseInt(timeLimit) }),
        ...(startDate && { startDate: new Date(startDate).toISOString() }),
        ...(deadline && { deadline: new Date(deadline).toISOString() }),
      };

      if (type === "EXERCISE") {
        // CORREÇÃO: Sanitização dos objetos para remover IDs residuais
        payload.starterCode = exFiles.map((f) => ({
          name: f.name,
          content: f.content,
        }));

        payload.parameters = exParameters; // Geralmente parâmetros não têm ID, pois são JSONB
        payload.returnType = exReturnType;

        // AQUI ESTAVA O PROBLEMA: Removendo 'id', 'createdAt', etc.
        payload.testCases = exTestCases.map((tc) => ({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isHidden: !!tc.isHidden,
        }));
      } else {
        // Sanitização das Questões da Prova
        payload.questions = questions.map((q) => ({
          ...q,
          testCases: q.testCases.map((tc) => ({
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isHidden: !!tc.isHidden,
          })),
          starterCode: q.starterCode.map((f) => ({
            name: f.name,
            content: f.content,
          })),
        }));
      }

      if (isEditing && problemId) {
        await axios.patch(`${API_URL}/problems/${problemId}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Atualizado!");
      } else {
        if (!classroomId) {
          toast.error("Erro: ID da turma não encontrado.");
          setLoading(false);
          return;
        }
        await axios.post(`${API_URL}/problems`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success("Criado!");
      }
      navigate(-1);
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message;
      // Mostra a mensagem de erro específica se for array (erros do class-validator)
      toast.error(Array.isArray(msg) ? msg[0] : msg || "Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  };

  const renderExerciseFields = () => (
    <>
      <div className="card">
        <h3>Assinatura da Função</h3>
        <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
          <input
            className="form-input"
            placeholder="Nome (ex: a)"
            value={paramName}
            onChange={(e) => setParamName(e.target.value)}
          />
          <select
            className="form-select"
            value={paramType}
            onChange={(e) => setParamType(e.target.value)}
          >
            {DATA_TYPES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <button onClick={addParameter} className="btn btn-secondary">
            + Add
          </button>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {exParameters.map((p, i) => (
            <span
              key={i}
              className="badge"
              style={{
                background: "#333",
                padding: "5px 10px",
                borderRadius: "4px",
                border: "1px solid #555",
              }}
            >
              {p.name}: {p.type}
              <button
                onClick={() =>
                  setExParameters(exParameters.filter((_, idx) => idx !== i))
                }
                style={{
                  marginLeft: "8px",
                  background: "none",
                  border: "none",
                  color: "#f44336",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div style={{ marginTop: "15px" }}>
          <label>Retorno</label>
          <select
            className="form-select"
            value={exReturnType}
            onChange={(e) => setExReturnType(e.target.value)}
          >
            {DATA_TYPES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
            <option value="void">Vazio (void)</option>
          </select>
        </div>
      </div>

      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "10px",
          }}
        >
          <h3
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              margin: 0,
            }}
          >
            <FileText size={20} color="#4caf50" />
            Template Inicial
          </h3>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "0.9rem", color: "#888" }}>
              Linguagem Base:
            </span>
            <select
              className="form-select"
              style={{ width: "auto", padding: "5px 10px", fontSize: "0.9rem" }}
              value={selectedTemplate}
              onChange={(e) => applyTemplate(e.target.value)}
            >
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
              <option value="cpp">C++</option>
            </select>
          </div>
        </div>

        <p style={{ color: "#888", fontSize: "0.9rem", marginBottom: "15px" }}>
          O primeiro arquivo (fixo) será o ponto de entrada.
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            borderBottom: "1px solid #444",
            marginBottom: "10px",
            overflowX: "auto",
          }}
        >
          {exFiles.map((file, idx) => (
            <div
              key={idx}
              onClick={() => setActiveFileIndex(idx)}
              style={{
                padding: "8px 15px",
                cursor: "pointer",
                background: activeFileIndex === idx ? "#333" : "transparent",
                color: activeFileIndex === idx ? "#4caf50" : "#aaa",
                borderTop:
                  activeFileIndex === idx
                    ? "2px solid #4caf50"
                    : "2px solid transparent",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.9rem",
                borderRight: "1px solid #333",
              }}
            >
              <span>{file.name}</span>
              {idx > 0 && (
                <Trash
                  size={14}
                  style={{ cursor: "pointer", color: "#f44336" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFile(idx);
                  }}
                />
              )}
            </div>
          ))}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginLeft: "10px",
              gap: "5px",
            }}
          >
            <input
              style={{
                background: "#222",
                border: "1px solid #444",
                color: "white",
                padding: "4px 8px",
                borderRadius: "4px",
                fontSize: "0.85rem",
                width: "120px",
              }}
              placeholder="Novo arquivo..."
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddFile()}
            />
            <button
              onClick={handleAddFile}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#4caf50",
              }}
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        <div
          style={{
            border: "1px solid #444",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          <Editor
            height="300px"
            language={
              exFiles[activeFileIndex]?.name.endsWith(".js")
                ? "javascript"
                : exFiles[activeFileIndex]?.name.endsWith(".java")
                  ? "java"
                  : exFiles[activeFileIndex]?.name.endsWith(".c")
                    ? "c"
                    : exFiles[activeFileIndex]?.name.endsWith(".cpp")
                      ? "cpp"
                      : exFiles[activeFileIndex]?.name.endsWith(".go")
                        ? "go"
                        : "python"
            }
            theme="vs-dark"
            value={exFiles[activeFileIndex]?.content || ""}
            onChange={updateFileContent}
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
            }}
          />
        </div>
      </div>

      <div className="card">
        <h3>Casos de Teste</h3>
        <div className="grid-2">
          <textarea
            className="form-textarea"
            placeholder="Entrada"
            value={tcInput}
            onChange={(e) => setTcInput(e.target.value)}
          />
          <textarea
            className="form-textarea"
            placeholder="Saída Esperada"
            value={tcOutput}
            onChange={(e) => setTcOutput(e.target.value)}
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginTop: "10px",
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <input
              type="checkbox"
              checked={tcHidden}
              onChange={(e) => setTcHidden(e.target.checked)}
            />
            Caso Oculto
          </label>
          <button onClick={addTestCase} className="btn btn-secondary">
            + Adicionar
          </button>
        </div>
        {exTestCases.length > 0 && (
          <table className="custom-table" style={{ marginTop: "20px" }}>
            <thead>
              <tr>
                <th>Entrada</th>
                <th>Saída</th>
                <th>Tipo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {exTestCases.map((tc, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: "monospace", fontSize: "0.9rem" }}>
                    {tc.input.slice(0, 30)}
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.9rem" }}>
                    {tc.expectedOutput.slice(0, 30)}
                  </td>
                  <td>{tc.isHidden ? "🔒" : "👁️"}</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      onClick={() =>
                        setExTestCases(exTestCases.filter((_, x) => x !== i))
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
    </>
  );

  return (
    <div className="container" style={{ maxWidth: "900px", padding: "40px" }}>
      <button
        onClick={() => navigate(-1)}
        className="btn btn-ghost"
        style={{
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          gap: "5px",
        }}
      >
        <ArrowLeft size={18} /> Voltar
      </button>

      <h1 style={{ marginBottom: "30px", color: "#4caf50" }}>
        {isEditing ? "Editar Atividade" : "Criar Nova Atividade"}
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          marginBottom: "30px",
        }}
      >
        <div
          onClick={() => !isEditing && setType("EXERCISE")}
          style={{
            background: type === "EXERCISE" ? "#1e1e1e" : "#111",
            border:
              type === "EXERCISE" ? "2px solid #4caf50" : "1px solid #333",
            borderRadius: "8px",
            padding: "20px",
            cursor: isEditing ? "default" : "pointer",
            textAlign: "center",
            opacity: isEditing && type !== "EXERCISE" ? 0.5 : 1,
          }}
        >
          <Code2
            size={40}
            color={type === "EXERCISE" ? "#4caf50" : "#666"}
            style={{ marginBottom: "10px" }}
          />
          <h3
            style={{
              margin: "0 0 10px 0",
              color: type === "EXERCISE" ? "#fff" : "#888",
            }}
          >
            Exercício Prático
          </h3>
        </div>
        <div
          onClick={() => !isEditing && setType("EXAM")}
          style={{
            background: type === "EXAM" ? "#1e1e1e" : "#111",
            border: type === "EXAM" ? "2px solid #4caf50" : "1px solid #333",
            borderRadius: "8px",
            padding: "20px",
            cursor: isEditing ? "default" : "pointer",
            textAlign: "center",
            opacity: isEditing && type !== "EXAM" ? 0.5 : 1,
          }}
        >
          <ScrollText
            size={40}
            color={type === "EXAM" ? "#4caf50" : "#666"}
            style={{ marginBottom: "10px" }}
          />
          <h3
            style={{
              margin: "0 0 10px 0",
              color: type === "EXAM" ? "#fff" : "#888",
            }}
          >
            Prova / Lista
          </h3>
        </div>
      </div>

      {/* DADOS BÁSICOS (TÍTULO E DESCRIÇÃO) */}
      <div className="card">
        <h3>Informações Básicas</h3>
        <div style={{ display: "grid", gap: "15px" }}>
          <div>
            <label>Título</label>
            <input
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Soma de Dois Números"
            />
          </div>
          <div>
            <label>Slug (URL)</label>
            <input
              className="form-input"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="Ex: soma-dois-numeros"
            />
          </div>
          <div>
            <label>Enunciado (Markdown)</label>
            <div
              style={{
                border: "1px solid #444",
                borderRadius: "4px",
                overflow: "hidden",
              }}
            >
              <Editor
                height="200px"
                defaultLanguage="markdown"
                theme="vs-dark"
                value={description}
                onChange={(val) => setDescription(val || "")}
                options={{ minimap: { enabled: false } }}
              />
            </div>
          </div>
        </div>
      </div>

      {type === "EXAM" && (
        <>
          <div className="card">
            <h3 style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Clock size={20} color="#f57f17" />
              Configurações da Prova
            </h3>
            <div className="grid-2">
              <div>
                <label>Tentativas</label>
                <input
                  type="number"
                  className="form-input"
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(e.target.value)}
                />
              </div>
              <div>
                <label>Tempo (min)</label>
                <input
                  type="number"
                  className="form-input"
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(e.target.value)}
                />
              </div>
              <div>
                <label>Início</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label>Fim</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "15px",
              }}
            >
              <h3>Questões da Prova</h3>
              <button onClick={openQuestionModal} className="btn btn-secondary">
                <Plus size={16} style={{ marginRight: "5px" }} /> Adicionar
                Questão
              </button>
            </div>

            {questions.length === 0 ? (
              <p style={{ color: "#888", fontStyle: "italic" }}>
                Nenhuma questão adicionada.
              </p>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Título</th>
                    <th>Slug</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{q.title}</td>
                      <td>{q.slug}</td>
                      <td>
                        <button
                          onClick={() => removeQuestion(i)}
                          className="btn btn-sm btn-danger"
                        >
                          <Trash size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* RENDERIZAÇÃO DIRETA DOS CAMPOS (EVITA PERDA DE FOCO) */}
      {type === "EXERCISE" && renderExerciseFields()}

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
          : isEditing
            ? "SALVAR ALTERAÇÕES"
            : type === "EXAM"
              ? "CRIAR PROVA"
              : "CRIAR EXERCÍCIO"}
      </button>

      {/* MODAL */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div
            className="modal-content large"
            style={{ maxHeight: "90vh", overflowY: "auto" }}
          >
            <div className="modal-header">
              <h2>Adicionar Questão</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="btn btn-ghost"
              >
                <X />
              </button>
            </div>
            <div style={{ padding: "20px" }}>
              <div
                style={{ display: "grid", gap: "10px", marginBottom: "20px" }}
              >
                <input
                  className="form-input"
                  placeholder="Título da Questão"
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                />
                <input
                  className="form-input"
                  placeholder="Slug (ex: questao-1)"
                  value={modalSlug}
                  onChange={(e) => setModalSlug(e.target.value)}
                />
                <div style={{ border: "1px solid #444", borderRadius: "4px" }}>
                  <Editor
                    height="150px"
                    defaultLanguage="markdown"
                    theme="vs-dark"
                    value={modalDesc}
                    onChange={(val) => setModalDesc(val || "")}
                    options={{ minimap: { enabled: false } }}
                  />
                </div>
              </div>

              {renderExerciseFields()}

              <div style={{ marginTop: "20px", textAlign: "right" }}>
                <button
                  onClick={saveQuestionFromModal}
                  className="btn btn-primary"
                >
                  Salvar Questão na Prova
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
