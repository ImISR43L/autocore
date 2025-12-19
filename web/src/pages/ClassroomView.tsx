// web/src/pages/ClassroomView.tsx
import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import Editor from "@monaco-editor/react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/atom-one-dark.css";
import "../App.css";

// Interfaces
interface Announcement {
  id: string;
  content: string;
  createdAt: string;
  author: { email: string };
}

interface Problem {
  id: string;
  title: string;
  description: string;
  slug: string;
  testCases?: any[];
  type: "EXERCISE" | "EXAM";
  maxAttempts?: number;
  deadline?: string;
}

interface Classroom {
  id: number;
  name: string;
  code: string;
  owner: { id: number; email: string };
  students: { id: number; email: string }[];
  problems: Problem[];
  announcements: Announcement[];
}

interface Submission {
  id: string;
  status: string;
  code: string;
  stdout?: string;
  stderr?: string;
  createdAt: string;
  user: { id: number; email: string };
}

// Templates de Linguagem
const LANGUAGES = [
  {
    id: 71,
    name: "Python (3.8.1)",
    defaultCode: `import sys\n\n# Lê a entrada padrão\ninput_data = sys.stdin.read().split()\n\nif len(input_data) >= 2:\n    a = int(input_data[0])\n    b = int(input_data[1])\n    print(a + b)`,
  },
  {
    id: 63,
    name: "JavaScript (Node.js)",
    defaultCode: `const fs = require('fs');\nconst input = fs.readFileSync('/dev/stdin').toString().trim().split(/\\s+/);\n\nconst a = parseInt(input[0]);\nconst b = parseInt(input[1]);\nconsole.log(a + b);`,
  },
  {
    id: 62,
    name: "Java (OpenJDK 13.0.1)",
    defaultCode: `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        if (scanner.hasNextInt()) {\n            int a = scanner.nextInt();\n            int b = scanner.nextInt();\n            System.out.println(a + b);\n        }\n        scanner.close();\n    }\n}`,
  },
  {
    id: 50,
    name: "C (GCC 9.2.0)",
    defaultCode: `#include <stdio.h>\n\nint main() {\n    int a, b;\n    if (scanf("%d %d", &a, &b) == 2) {\n        printf("%d", a + b);\n    }\n    return 0;\n}`,
  },
  {
    id: 54,
    name: "C++ (GCC 9.2.0)",
    defaultCode: `#include <iostream>\n\nint main() {\n    int a, b;\n    if (std::cin >> a >> b) {\n        std::cout << (a + b);\n    }\n    return 0;\n}`,
  },
  {
    id: 60,
    name: "Go (1.13.5)",
    defaultCode: `package main\nimport "fmt"\n\nfunc main() {\n    var a, b int\n    if _, err := fmt.Scan(&a, &b); err == nil {\n        fmt.Println(a + b)\n    }\n}`,
  },
];

const LANGUAGE_MAP: Record<number, string> = {
  71: "python",
  63: "javascript",
  62: "java",
  50: "c",
  54: "cpp",
  60: "go",
};

export default function ClassroomView() {
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const { id } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"stream" | "classwork" | "people">(
    "stream"
  );
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(
    null
  );

  // Estado da Linguagem e Código
  const [languageId, setLanguageId] = useState<number>(71);
  const [code, setCode] = useState<string>("");

  // Estados de Execução e UI
  const [verdict, setVerdict] = useState<string | null>(null);
  const [executionOutput, setExecutionOutput] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [showSubmissions, setShowSubmissions] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [inspectingSubmission, setInspectingSubmission] =
    useState<Submission | null>(null);

  // Estados do Mural
  const [newAnnouncement, setNewAnnouncement] = useState("");
  const [posting, setPosting] = useState(false);

  // --- Helpers de Usuário ---
  const getMyUserId = () => {
    const token = localStorage.getItem("token");
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.sub || payload.userId;
    } catch {
      return null;
    }
  };

  const myUserId = getMyUserId();
  const isOwner = classroom?.owner?.id === myUserId;

  // --- LÓGICA DE SALVAMENTO AUTOMÁTICO (LOCAL STORAGE) ---
  const getStorageKey = (probId: string, langId: number) => {
    if (!myUserId) return null;
    return `autosave_${myUserId}_${probId}_${langId}`;
  };

  // Carrega código ao trocar problema ou linguagem
  useEffect(() => {
    const lang = LANGUAGES.find((l) => l.id === languageId);
    if (!selectedProblemId || !lang) return;

    const storageKey = getStorageKey(selectedProblemId, languageId);
    const savedCode = storageKey ? localStorage.getItem(storageKey) : null;

    if (savedCode) {
      setCode(savedCode);
    } else {
      setCode(lang.defaultCode);
    }
  }, [languageId, selectedProblemId, myUserId]);

  // Salva no LocalStorage a cada digitação
  const handleCodeChange = (value: string | undefined) => {
    const val = value || "";
    setCode(val);

    if (selectedProblemId) {
      const key = getStorageKey(selectedProblemId, languageId);
      if (key) localStorage.setItem(key, val);
    }
  };

  // Botão de Resetar Código
  const handleResetCode = () => {
    if (
      !confirm(
        "Isso apagará seu código atual e restaurará o modelo original. Continuar?"
      )
    )
      return;

    const lang = LANGUAGES.find((l) => l.id === languageId);
    if (lang) {
      setCode(lang.defaultCode);
      // Limpa o storage também
      if (selectedProblemId) {
        const key = getStorageKey(selectedProblemId, languageId);
        if (key) localStorage.removeItem(key);
      }
      toast.success("Código resetado.");
    }
  };
  // --------------------------------------------------------

  const fetchClassroomData = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_URL}/classrooms/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setClassroom(res.data);

      if (res.data.problems?.length > 0 && !selectedProblemId) {
        setSelectedProblemId(res.data.problems[0].id);
      }
    } catch (error) {
      toast.error("Erro ao carregar turma.");
      navigate("/dashboard");
    }
  };

  const fetchSubmissions = async () => {
    if (!selectedProblemId) return;
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(
        `${API_URL}/submissions/problem/${selectedProblemId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSubmissions(res.data);
    } catch (error) {
      console.error("Erro ao carregar submissões", error);
    }
  };

  useEffect(() => {
    fetchClassroomData();
  }, [id]);

  useEffect(() => {
    if (selectedProblemId && activeTab === "classwork") {
      fetchSubmissions();
    }
  }, [selectedProblemId, activeTab]);

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncement.trim()) return;
    setPosting(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_URL}/announcements`,
        {
          content: newAnnouncement,
          classroomId: classroom?.id,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Aviso postado!");
      setNewAnnouncement("");
      fetchClassroomData();
    } catch (error) {
      toast.error("Erro ao postar.");
    } finally {
      setPosting(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm("Apagar aviso?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_URL}/announcements/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Removido.");
      fetchClassroomData();
    } catch (error) {
      toast.error("Erro ao remover.");
    }
  };

  const handleDeleteProblem = async () => {
    if (!selectedProblemId || !confirm("Tem a certeza?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_URL}/problems/${selectedProblemId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Eliminado!");
      setSelectedProblemId(null);
      fetchClassroomData();
    } catch (error) {
      toast.error("Erro ao eliminar.");
    }
  };

  const handleEditProblem = () => {
    if (!selectedProblemId || !classroom) return;
    const problem = classroom.problems.find((p) => p.id === selectedProblemId);
    if (problem)
      navigate("/create-problem", {
        state: { classroomId: classroom.id, problemToEdit: problem },
      });
  };

  const submitSolution = async () => {
    if (!selectedProblemId) return toast.warning("Selecione um exercício!");
    setLoading(true);
    setVerdict(null);
    setExecutionOutput(null);
    setExecutionError(null);

    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_URL}/submissions`,
        { code, language_id: languageId, problem_id: selectedProblemId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = res.data;
      setVerdict(data.status);
      setExecutionOutput(data.stdout);
      setExecutionError(data.stderr);

      if (data.status === "Accepted") toast.success("Solução Aceite!");
      else toast.error("Resposta Incorreta ou Erro");

      fetchSubmissions();
    } catch (error: any) {
      if (error.response?.status === 403) {
        setVerdict("Bloqueado");
        setExecutionError(error.response.data.message);
        toast.error(error.response.data.message);
      } else {
        setVerdict("Erro de Comunicação");
        toast.error("Falha na submissão");
      }
    } finally {
      setLoading(false);
    }
  };

  // Cálculo de Tentativas (Hooks antes do retorno)
  const myAttemptsCount = useMemo(() => {
    if (!myUserId) return 0;
    return (submissions || []).filter((s) => s.user?.id === myUserId).length;
  }, [submissions, myUserId]);

  if (!classroom) return <div className="container">Carregando...</div>;

  const currentProblem = classroom.problems.find(
    (p) => p.id === selectedProblemId
  );
  const isExam = currentProblem?.type === "EXAM";
  const maxAttempts = currentProblem?.maxAttempts || 0;

  // Verifica prazo
  const isDeadlinePassed = currentProblem?.deadline
    ? new Date() > new Date(currentProblem.deadline)
    : false;

  const attemptsLeft = isExam
    ? Math.max(0, maxAttempts - myAttemptsCount)
    : Infinity;
  const isBlocked =
    (isExam && !isOwner && attemptsLeft === 0) ||
    (!isOwner && isDeadlinePassed);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* HEADER */}
      <header className="classroom-header">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "15px 0",
            borderBottom: "1px solid #333",
          }}
        >
          <button
            onClick={() => navigate("/dashboard")}
            className="btn btn-ghost"
            style={{ marginRight: "10px" }}
          >
            ←
          </button>
          <h2 style={{ margin: 0, fontSize: "1.2rem" }}>{classroom.name}</h2>
        </div>
        <nav className="classroom-tabs">
          <button
            onClick={() => setActiveTab("stream")}
            className={`tab-btn ${activeTab === "stream" ? "active" : ""}`}
          >
            Mural
          </button>
          <button
            onClick={() => setActiveTab("classwork")}
            className={`tab-btn ${activeTab === "classwork" ? "active" : ""}`}
          >
            Atividades
          </button>
          <button
            onClick={() => setActiveTab("people")}
            className={`tab-btn ${activeTab === "people" ? "active" : ""}`}
          >
            Alunos
          </button>
        </nav>
      </header>

      {/* MURAL */}
      {activeTab === "stream" && (
        <div className="stream-container">
          <div className="stream-banner">
            <h1 className="stream-title">{classroom.name}</h1>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <strong>Código da Turma:</strong>
              <span className="stream-code-box">{classroom.code}</span>
            </div>
          </div>

          {isOwner && (
            <div className="stream-input-card">
              <form onSubmit={handlePostAnnouncement}>
                <textarea
                  className="stream-textarea"
                  placeholder="Anuncie algo para a turma..."
                  value={newAnnouncement}
                  onChange={(e) => setNewAnnouncement(e.target.value)}
                />
                <div className="stream-actions">
                  <button
                    type="submit"
                    disabled={posting || !newAnnouncement.trim()}
                    className="btn btn-primary"
                  >
                    {posting ? "Postando..." : "Postar"}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="announcements-list">
            {(!classroom.announcements ||
              classroom.announcements.length === 0) && (
              <div
                style={{
                  textAlign: "center",
                  color: "#666",
                  padding: "40px",
                  border: "1px dashed #333",
                  borderRadius: "8px",
                }}
              >
                <p>Nenhum aviso publicado ainda.</p>
              </div>
            )}
            {classroom.announcements?.map((announcement) => (
              <div key={announcement.id} className="announcement-card">
                <div className="announcement-header">
                  <div className="announcement-avatar">
                    {announcement.author?.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="announcement-meta">
                    <span className="announcement-author">
                      {announcement.author?.email}
                    </span>
                    <span className="announcement-date">
                      {new Date(announcement.createdAt).toLocaleDateString()} •{" "}
                      {new Date(announcement.createdAt)
                        .toLocaleTimeString()
                        .slice(0, 5)}
                    </span>
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => handleDeleteAnnouncement(announcement.id)}
                      className="options-btn"
                      title="Apagar aviso"
                    >
                      ⋮
                    </button>
                  )}
                </div>
                <div className="announcement-body">{announcement.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ALUNOS */}
      {activeTab === "people" && (
        <div className="people-container">
          <div style={{ marginBottom: "40px" }}>
            <div className="section-header">
              <span>Professores</span>
            </div>
            <div className="person-item">
              <div className="person-avatar">
                {classroom.owner.email.charAt(0).toUpperCase()}
              </div>
              <span>{classroom.owner.email}</span>
            </div>
          </div>
          <div>
            <div className="section-header">
              <span>Estudantes</span>
              <span style={{ fontSize: "1rem", color: "#666" }}>
                {classroom.students?.length || 0} alunos
              </span>
            </div>
            {classroom.students?.map((student) => (
              <div key={student.id} className="person-item">
                <div className="person-avatar">
                  {student.email.charAt(0).toUpperCase()}
                </div>
                <span>{student.email}</span>
              </div>
            ))}
            {(!classroom.students || classroom.students.length === 0) && (
              <p style={{ color: "#666", fontStyle: "italic" }}>
                Nenhum aluno matriculado ainda.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ATIVIDADES */}
      {activeTab === "classwork" && (
        <div className="ide-container" style={{ flex: 1, borderTop: "none" }}>
          {/* TOOLBAR */}
          <div className="ide-toolbar">
            <select
              className="form-select"
              style={{ width: "auto", minWidth: "250px" }}
              value={selectedProblemId || ""}
              onChange={(e) => setSelectedProblemId(e.target.value)}
            >
              {classroom.problems.length === 0 && (
                <option value="">Sem exercícios</option>
              )}
              {classroom.problems.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>

            {isOwner && (
              <div style={{ display: "flex", gap: "5px", marginLeft: "10px" }}>
                {selectedProblemId && (
                  <>
                    <button
                      onClick={handleEditProblem}
                      className="btn btn-secondary"
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={handleDeleteProblem}
                      className="btn btn-danger"
                      title="Excluir"
                    >
                      🗑️
                    </button>
                    <button
                      onClick={() => setShowSubmissions(true)}
                      className="btn btn-primary"
                      style={{ backgroundColor: "#555" }}
                    >
                      📊 Ver Submissões
                    </button>
                  </>
                )}
                <button
                  onClick={() =>
                    navigate("/create-problem", {
                      state: { classroomId: classroom.id },
                    })
                  }
                  className="btn btn-primary"
                  style={{ marginLeft: selectedProblemId ? "10px" : "0" }}
                >
                  + Novo
                </button>
              </div>
            )}

            {/* Indicador de Prazo */}
            {currentProblem?.deadline && !isOwner && (
              <div
                style={{
                  padding: "5px 12px",
                  background: isDeadlinePassed
                    ? "rgba(244, 67, 54, 0.2)"
                    : "#2d2d30",
                  borderRadius: "4px",
                  border: `1px solid ${isDeadlinePassed ? "#f44336" : "#444"}`,
                  color: isDeadlinePassed ? "#f44336" : "#ccc",
                  fontSize: "0.85rem",
                  marginRight: "10px",
                  marginLeft: "auto",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <span>🕒</span>
                {isDeadlinePassed ? (
                  <strong>
                    Encerrado em{" "}
                    {new Date(currentProblem.deadline).toLocaleString()}
                  </strong>
                ) : (
                  <span>
                    Entrega até:{" "}
                    {new Date(currentProblem.deadline).toLocaleString()}
                  </span>
                )}
              </div>
            )}

            {isExam && !isOwner && (
              <div
                style={{
                  padding: "5px 12px",
                  background:
                    attemptsLeft === 0
                      ? "rgba(244, 67, 54, 0.2)"
                      : attemptsLeft <= 1
                      ? "rgba(255, 152, 0, 0.2)"
                      : "#2d2d30",
                  borderRadius: "4px",
                  border: `1px solid ${
                    attemptsLeft === 0
                      ? "#f44336"
                      : attemptsLeft <= 1
                      ? "#ff9800"
                      : "#444"
                  }`,
                  color:
                    attemptsLeft === 0
                      ? "#f44336"
                      : attemptsLeft <= 1
                      ? "#ff9800"
                      : "#ccc",
                  fontSize: "0.85rem",
                  fontWeight: "bold",
                  marginRight: "10px",
                  marginLeft: !currentProblem?.deadline ? "auto" : "0",
                }}
              >
                {attemptsLeft === 0
                  ? "🚫 Esgotadas"
                  : `⚠️ ${attemptsLeft}/${maxAttempts} tentativas`}
              </div>
            )}

            <div
              style={{
                marginLeft:
                  ((isExam || currentProblem?.deadline) && !isOwner) || isOwner
                    ? "0"
                    : "auto",
                display: "flex",
                gap: "10px",
              }}
            >
              {/* Botão Resetar Código */}
              <button
                onClick={handleResetCode}
                className="btn btn-secondary"
                title="Resetar para o template original"
                disabled={!selectedProblemId}
              >
                ↺ Reset
              </button>

              <select
                className="form-select"
                style={{ width: "auto" }}
                value={languageId}
                onChange={(e) => setLanguageId(Number(e.target.value))}
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.name}
                  </option>
                ))}
              </select>
              <button
                onClick={submitSolution}
                disabled={loading || !selectedProblemId || isBlocked}
                className="btn btn-primary"
                style={isBlocked ? { opacity: 0.5, cursor: "not-allowed" } : {}}
              >
                {loading
                  ? "..."
                  : isDeadlinePassed
                  ? "🔒 Encerrado"
                  : isBlocked
                  ? "🔒 Bloqueado"
                  : "▶ Enviar"}
              </button>
            </div>
          </div>

          {/* IDE MAIN */}
          <div className="ide-main">
            <div className="ide-editor-panel">
              <Editor
                height="100%"
                language={LANGUAGE_MAP[languageId] || "plaintext"}
                theme="vs-dark"
                value={code}
                // Alterado para salvar no onChange
                onChange={handleCodeChange}
                options={{ minimap: { enabled: false }, automaticLayout: true }}
              />
            </div>
            <div className="ide-info-panel">
              {currentProblem ? (
                <>
                  <h3 className="ide-info-title">{currentProblem.title}</h3>
                  <div className="ide-description markdown-body">
                    <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                      {currentProblem.description}
                    </ReactMarkdown>
                  </div>
                </>
              ) : (
                <p className="ide-description">
                  Selecione ou crie um exercício.
                </p>
              )}

              {verdict && (
                <div
                  className={`ide-feedback-box ${
                    verdict === "Accepted" ? "success" : "error"
                  }`}
                >
                  <div className="feedback-header">
                    <strong>Resultado:</strong> {verdict}
                  </div>
                  {executionError && (
                    <div className="feedback-section">
                      <span className="feedback-label">Erro:</span>
                      <pre className="feedback-code error">
                        {executionError}
                      </pre>
                    </div>
                  )}
                  {executionOutput && verdict !== "Accepted" && (
                    <div className="feedback-section">
                      <span className="feedback-label">Sua Saída:</span>
                      <pre className="feedback-code">{executionOutput}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* MODAIS (MANTIDOS) */}
          {showSubmissions && (
            <div className="modal-overlay">
              <div className="modal-content large">
                <div className="modal-header">
                  <h2>Submissões: {currentProblem?.title}</h2>
                  <button
                    onClick={() => setShowSubmissions(false)}
                    className="btn btn-secondary"
                  >
                    Fechar
                  </button>
                </div>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Aluno</th>
                      <th>Veredito</th>
                      <th>Data</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((sub) => (
                      <tr key={sub.id}>
                        <td>{sub.user?.email || "Desconhecido"}</td>
                        <td>
                          <span
                            className={`status-badge ${
                              sub.status === "Accepted" ? "success" : "error"
                            }`}
                          >
                            {sub.status}
                          </span>
                        </td>
                        <td>{new Date(sub.createdAt).toLocaleString()}</td>
                        <td>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => setInspectingSubmission(sub)}
                          >
                            🔍 Inspecionar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {inspectingSubmission && (
            <div className="modal-overlay" style={{ zIndex: 1100 }}>
              <div className="modal-content x-large">
                <div className="modal-header">
                  <h3>Inspecionando: {inspectingSubmission.user?.email}</h3>
                  <button
                    onClick={() => setInspectingSubmission(null)}
                    className="btn btn-secondary"
                  >
                    Voltar
                  </button>
                </div>
                <div className="inspection-grid">
                  <div className="inspection-code">
                    <Editor
                      height="50vh"
                      language={LANGUAGE_MAP[71]}
                      theme="vs-dark"
                      value={inspectingSubmission.code}
                      options={{ readOnly: true, minimap: { enabled: false } }}
                    />
                  </div>
                  <div className="inspection-output">
                    <div className="output-block">
                      <h4>Status</h4>
                      <div
                        className={`status-box ${
                          inspectingSubmission.status === "Accepted"
                            ? "success"
                            : "error"
                        }`}
                      >
                        {inspectingSubmission.status}
                      </div>
                    </div>
                    {inspectingSubmission.stderr && (
                      <div className="output-block">
                        <h4 className="label error">Erro</h4>
                        <pre className="code-block error">
                          {inspectingSubmission.stderr}
                        </pre>
                      </div>
                    )}
                    {inspectingSubmission.stdout && (
                      <div className="output-block">
                        <h4 className="label">Saída</h4>
                        <pre className="code-block">
                          {inspectingSubmission.stdout}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
