// web/src/pages/ClassroomView.tsx
import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import Editor from "@monaco-editor/react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

import "highlight.js/styles/atom-one-dark.css";
import "../App.css";

// --- INTERFACES ---
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
  grade?: number;
  teacherComment?: string;
}

interface StatData {
  name: string;
  Accepted: number;
  Error: number;
}

interface ProblemStat {
  name: string;
  value: number;
  fill: string;
}

// --- TEMPLATES DE LINGUAGEM ---
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

  // Estados
  const [activeTab, setActiveTab] = useState<
    "stream" | "classwork" | "people" | "analytics"
  >("stream");
  const [languageId, setLanguageId] = useState<number>(
    () => Number(localStorage.getItem(`languageId`)) || 71
  );
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(
    null
  );
  const [code, setCode] = useState<string>("");

  // UI & Execução
  const [verdict, setVerdict] = useState<string | null>(null);
  const [executionOutput, setExecutionOutput] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [showSubmissions, setShowSubmissions] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [inspectingSubmission, setInspectingSubmission] =
    useState<Submission | null>(null);
  const [gradingGrade, setGradingGrade] = useState<string | number>("");
  const [gradingComment, setGradingComment] = useState("");
  const [newAnnouncement, setNewAnnouncement] = useState("");
  const [posting, setPosting] = useState(false);

  // Estados dos Gráficos
  const [stats, setStats] = useState<StatData[]>([]);
  const [problemStats, setProblemStats] = useState<ProblemStat[]>([]);

  // Helpers
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

  const getStorageKey = (probId: string, langId: number) => {
    if (!myUserId) return null;
    return `autosave_${myUserId}_${probId}_${langId}`;
  };

  // Efeitos
  useEffect(() => {
    if (id) localStorage.setItem(`activeTab_${id}`, activeTab);
  }, [activeTab, id]);
  useEffect(() => {
    localStorage.setItem(`languageId`, String(languageId));
  }, [languageId]);
  useEffect(() => {
    fetchClassroomData();
  }, [id]);

  useEffect(() => {
    const lang = LANGUAGES.find((l) => l.id === languageId);
    if (!lang) return;
    if (!selectedProblemId) {
      setCode(lang.defaultCode);
      return;
    }
    const storageKey = getStorageKey(selectedProblemId, languageId);
    const savedCode = storageKey ? localStorage.getItem(storageKey) : null;
    const isPolluted = LANGUAGES.some(
      (l) => l.id !== languageId && l.defaultCode === savedCode
    );
    if (savedCode && !isPolluted) setCode(savedCode);
    else setCode(lang.defaultCode);
  }, [languageId, selectedProblemId, myUserId]);

  useEffect(() => {
    if (selectedProblemId && activeTab === "classwork") {
      fetchSubmissions();
      if (isOwner) fetchProblemStats(selectedProblemId);
    }
  }, [selectedProblemId, activeTab, isOwner]);

  useEffect(() => {
    if (activeTab === "analytics" && isOwner && id) {
      fetchStats();
    }
  }, [activeTab, isOwner, id]);

  // Actions
  const fetchStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(
        `${API_URL}/submissions/stats/classroom/${id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setStats(res.data);
    } catch (error) {
      console.error("Erro stats");
    }
  };

  const fetchProblemStats = async (probId: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(
        `${API_URL}/submissions/stats/problem/${probId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      // Usa os dados diretamente para ter colunas separadas (Acertos, Erros)
      setProblemStats(res.data);
    } catch (error) {
      console.error("Erro problem stats");
    }
  };

  const handleCodeChange = (value: string | undefined) => {
    const val = value || "";
    setCode(val);
    if (selectedProblemId) {
      const key = getStorageKey(selectedProblemId, languageId);
      if (key) localStorage.setItem(key, val);
    }
  };

  const handleResetCode = () => {
    if (!confirm("Restaurar código original?")) return;
    const lang = LANGUAGES.find((l) => l.id === languageId);
    if (lang) {
      setCode(lang.defaultCode);
      if (selectedProblemId) {
        const key = getStorageKey(selectedProblemId, languageId);
        if (key) localStorage.removeItem(key);
      }
      toast.success("Restaurado.");
    }
  };

  const handleInspect = (sub: Submission) => {
    setInspectingSubmission(sub);
    setGradingGrade(
      sub.grade !== null && sub.grade !== undefined ? sub.grade : ""
    );
    setGradingComment(sub.teacherComment || "");
  };

  const handleSaveGrade = async () => {
    if (!inspectingSubmission) return;
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `${API_URL}/submissions/${inspectingSubmission.id}/grade`,
        {
          grade: gradingGrade === "" ? null : Number(gradingGrade),
          teacherComment: gradingComment,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Nota salva!");
      fetchSubmissions();
      setInspectingSubmission((prev) =>
        prev
          ? {
              ...prev,
              grade: gradingGrade === "" ? undefined : Number(gradingGrade),
              teacherComment: gradingComment,
            }
          : null
      );
    } catch (error) {
      toast.error("Erro ao salvar nota.");
    }
  };

  const fetchClassroomData = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_URL}/classrooms/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setClassroom(res.data);
      if (res.data.problems?.length > 0) {
        const storedProbId = localStorage.getItem(`lastProblemId_${id}`);
        const problemExists = res.data.problems.find(
          (p: Problem) => p.id === storedProbId
        );
        if (storedProbId && problemExists) setSelectedProblemId(storedProbId);
        else setSelectedProblemId(res.data.problems[0].id);
      }
    } catch {
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
      console.error(error);
    }
  };

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncement.trim()) return;
    setPosting(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_URL}/announcements`,
        { content: newAnnouncement, classroomId: classroom?.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Aviso postado!");
      setNewAnnouncement("");
      fetchClassroomData();
    } catch {
      toast.error("Erro.");
    } finally {
      setPosting(false);
    }
  };
  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm("Apagar?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_URL}/announcements/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Removido.");
      fetchClassroomData();
    } catch {
      toast.error("Erro.");
    }
  };
  const handleDeleteProblem = async () => {
    if (!selectedProblemId || !confirm("Certeza?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_URL}/problems/${selectedProblemId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Eliminado!");
      setSelectedProblemId(null);
      fetchClassroomData();
    } catch {
      toast.error("Erro.");
    }
  };
  const handleEditProblem = () => {
    if (selectedProblemId && classroom) {
      const p = classroom.problems.find((p) => p.id === selectedProblemId);
      if (p)
        navigate("/create-problem", {
          state: { classroomId: classroom.id, problemToEdit: p },
        });
    }
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
      else toast.error("Erro/Incorreto");
      fetchSubmissions();
      if (isOwner && selectedProblemId) fetchProblemStats(selectedProblemId);
    } catch (error: any) {
      if (error.response?.status === 403) {
        setVerdict("Bloqueado");
        setExecutionError(error.response.data.message);
        toast.error(error.response.data.message);
      } else {
        setVerdict("Erro");
        toast.error("Falha na submissão");
      }
    } finally {
      setLoading(false);
    }
  };

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
          {isOwner && (
            <button
              onClick={() => setActiveTab("analytics")}
              className={`tab-btn ${activeTab === "analytics" ? "active" : ""}`}
            >
              📊 Estatísticas
            </button>
          )}
        </nav>
      </header>

      {/* MURAL */}
      {activeTab === "stream" && (
        <div className="stream-container">
          <div className="stream-banner">
            <h1 className="stream-title">{classroom.name}</h1>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <strong>Código:</strong>
              <span className="stream-code-box">{classroom.code}</span>
            </div>
          </div>
          {isOwner && (
            <div className="stream-input-card">
              <form onSubmit={handlePostAnnouncement}>
                <textarea
                  className="stream-textarea"
                  placeholder="Anuncie algo..."
                  value={newAnnouncement}
                  onChange={(e) => setNewAnnouncement(e.target.value)}
                />
                <div className="stream-actions">
                  <button
                    type="submit"
                    disabled={posting || !newAnnouncement.trim()}
                    className="btn btn-primary"
                  >
                    {posting ? "..." : "Postar"}
                  </button>
                </div>
              </form>
            </div>
          )}
          <div className="announcements-list">
            {(!classroom.announcements ||
              classroom.announcements.length === 0) && (
              <div
                style={{ textAlign: "center", color: "#666", padding: "40px" }}
              >
                Nenhum aviso.
              </div>
            )}
            {classroom.announcements?.map((a) => (
              <div key={a.id} className="announcement-card">
                <div className="announcement-header">
                  <div className="announcement-avatar">
                    {a.author?.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="announcement-meta">
                    <span className="announcement-author">
                      {a.author?.email}
                    </span>
                    <span className="announcement-date">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => handleDeleteAnnouncement(a.id)}
                      className="options-btn"
                    >
                      ⋮
                    </button>
                  )}
                </div>
                <div className="announcement-body">{a.content}</div>
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
              <span>Estudantes ({classroom.students?.length || 0})</span>
            </div>
            {classroom.students?.map((s) => (
              <div key={s.id} className="person-item">
                <div className="person-avatar">
                  {s.email.charAt(0).toUpperCase()}
                </div>
                <span>{s.email}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ATIVIDADES */}
      {activeTab === "classwork" && (
        <div className="ide-container" style={{ flex: 1, borderTop: "none" }}>
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

            {selectedProblemId && (
              <button
                onClick={() => setShowSubmissions(true)}
                className="btn btn-secondary"
                style={{ marginLeft: "10px", backgroundColor: "#444" }}
                title={
                  isOwner ? "Ver submissões da turma" : "Ver meu histórico"
                }
              >
                📊 {isOwner ? "Turma" : "Histórico"}
              </button>
            )}

            <div
              style={{
                marginLeft: "auto",
                marginRight: "10px",
                display: "flex",
                gap: "10px",
              }}
            >
              {currentProblem?.deadline && !isOwner && (
                <div
                  style={{
                    padding: "5px 12px",
                    background: isDeadlinePassed
                      ? "rgba(244,67,54,0.2)"
                      : "#2d2d30",
                    borderRadius: "4px",
                    border: `1px solid ${
                      isDeadlinePassed ? "#f44336" : "#444"
                    }`,
                    color: isDeadlinePassed ? "#f44336" : "#ccc",
                    fontSize: "0.85rem",
                  }}
                >
                  {isDeadlinePassed
                    ? "🔒 Encerrado"
                    : `🕒 Até ${new Date(
                        currentProblem.deadline
                      ).toLocaleDateString()}`}
                </div>
              )}
              {isExam && !isOwner && (
                <div
                  style={{
                    padding: "5px 12px",
                    background:
                      attemptsLeft === 0 ? "rgba(244,67,54,0.2)" : "#2d2d30",
                    borderRadius: "4px",
                    border: `1px solid ${
                      attemptsLeft === 0 ? "#f44336" : "#444"
                    }`,
                    color: attemptsLeft === 0 ? "#f44336" : "#ccc",
                    fontSize: "0.85rem",
                    fontWeight: "bold",
                  }}
                >
                  {attemptsLeft === 0
                    ? "🚫 Esgotadas"
                    : `⚠️ ${attemptsLeft} restam`}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={handleResetCode}
                className="btn btn-secondary"
                title="Resetar código"
              >
                ↺
              </button>
              <select
                className="form-select"
                style={{ width: "auto" }}
                value={languageId}
                onChange={(e) => setLanguageId(Number(e.target.value))}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <button
                onClick={submitSolution}
                disabled={loading || !selectedProblemId || isBlocked}
                className="btn btn-primary"
                style={isBlocked ? { opacity: 0.5, cursor: "not-allowed" } : {}}
              >
                {loading ? "..." : isBlocked ? "🔒" : "▶ Enviar"}
              </button>
            </div>
          </div>

          <div className="ide-main">
            <div className="ide-editor-panel">
              <Editor
                key={`${languageId}-${selectedProblemId || "empty"}`}
                height="100%"
                language={LANGUAGE_MAP[languageId] || "plaintext"}
                theme="vs-dark"
                value={code}
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

                  {/* GRÁFICO DO EXERCÍCIO (SÓ PROFESSOR) - COLUNAS LADO A LADO */}
                  {isOwner && problemStats.length > 0 && (
                    <div
                      style={{
                        marginTop: "30px",
                        padding: "15px",
                        background: "#252526",
                        borderRadius: "8px",
                        border: "1px solid #444",
                      }}
                    >
                      <h4
                        style={{
                          margin: "0 0 15px 0",
                          fontSize: "0.9rem",
                          color: "#ccc",
                        }}
                      >
                        📈 Estatísticas deste Exercício
                      </h4>
                      <div style={{ width: "100%", height: 250 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={problemStats}
                            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#333"
                              vertical={false}
                            />
                            <XAxis dataKey="name" stroke="#888" />
                            <YAxis stroke="#888" allowDecimals={false} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#1e1e1e",
                                borderColor: "#444",
                                color: "#fff",
                              }}
                              cursor={{ fill: "rgba(255,255,255,0.05)" }}
                            />
                            <Bar dataKey="value" barSize={40}>
                              {problemStats.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="ide-description">Selecione um exercício.</p>
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
                    <pre className="feedback-code error">{executionError}</pre>
                  )}
                  {executionOutput && verdict !== "Accepted" && (
                    <pre className="feedback-code">{executionOutput}</pre>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* MODAIS */}
          {showSubmissions && (
            <div className="modal-overlay">
              <div className="modal-content large">
                <div className="modal-header">
                  <h2>{isOwner ? "Submissões da Turma" : "Meu Histórico"}</h2>
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
                      <th>Status</th>
                      <th>Nota</th>
                      <th>Data</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions
                      .filter((sub) => isOwner || sub.user?.id === myUserId)
                      .map((sub) => (
                        <tr key={sub.id}>
                          <td>{sub.user?.email}</td>
                          <td>
                            <span
                              className={`status-badge ${
                                sub.status === "Accepted" ? "success" : "error"
                              }`}
                            >
                              {sub.status}
                            </span>
                          </td>
                          <td>
                            {sub.grade !== null && sub.grade !== undefined ? (
                              <span
                                style={{ fontWeight: "bold", color: "#4caf50" }}
                              >
                                {sub.grade}
                              </span>
                            ) : (
                              <span style={{ color: "#666" }}>-</span>
                            )}
                          </td>
                          <td>{new Date(sub.createdAt).toLocaleString()}</td>
                          <td>
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleInspect(sub)}
                            >
                              Inspecionar
                            </button>
                          </td>
                        </tr>
                      ))}
                    {submissions.filter(
                      (sub) => isOwner || sub.user?.id === myUserId
                    ).length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          style={{
                            textAlign: "center",
                            padding: "20px",
                            color: "#666",
                          }}
                        >
                          Nenhuma submissão.
                        </td>
                      </tr>
                    )}
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
                  <div
                    className="inspection-output"
                    style={{ overflowY: "auto", maxHeight: "50vh" }}
                  >
                    {(isOwner ||
                      inspectingSubmission.grade != null ||
                      inspectingSubmission.teacherComment) && (
                      <div
                        className="output-block"
                        style={{
                          border: "1px solid #4caf50",
                          padding: "15px",
                          borderRadius: "4px",
                          background: "rgba(76, 175, 80, 0.05)",
                          marginBottom: "20px",
                        }}
                      >
                        <h4
                          className="label"
                          style={{ color: "#4caf50", marginTop: 0 }}
                        >
                          📝 Feedback
                        </h4>
                        {isOwner ? (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "10px",
                            }}
                          >
                            <div>
                              <label
                                style={{ fontSize: "0.8rem", color: "#ccc" }}
                              >
                                Nota
                              </label>
                              <input
                                type="number"
                                className="form-input"
                                value={gradingGrade}
                                onChange={(e) =>
                                  setGradingGrade(e.target.value)
                                }
                              />
                            </div>
                            <div>
                              <label
                                style={{ fontSize: "0.8rem", color: "#ccc" }}
                              >
                                Comentário
                              </label>
                              <textarea
                                className="form-textarea"
                                rows={3}
                                value={gradingComment}
                                onChange={(e) =>
                                  setGradingComment(e.target.value)
                                }
                              />
                            </div>
                            <button
                              onClick={handleSaveGrade}
                              className="btn btn-primary"
                            >
                              Salvar
                            </button>
                          </div>
                        ) : (
                          <div>
                            {inspectingSubmission.grade != null && (
                              <div>
                                Nota:{" "}
                                <strong>{inspectingSubmission.grade}</strong>
                              </div>
                            )}
                            {inspectingSubmission.teacherComment && (
                              <div
                                style={{
                                  marginTop: "10px",
                                  fontStyle: "italic",
                                }}
                              >
                                "{inspectingSubmission.teacherComment}"
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="output-block">
                      <h4>Status</h4>
                      <div>{inspectingSubmission.status}</div>
                    </div>
                    {inspectingSubmission.stdout && (
                      <pre className="code-block">
                        {inspectingSubmission.stdout}
                      </pre>
                    )}
                    {inspectingSubmission.stderr && (
                      <pre className="code-block error">
                        {inspectingSubmission.stderr}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- DASHBOARD DA TURMA (LADO A LADO) --- */}
      {activeTab === "analytics" && isOwner && (
        <div className="container" style={{ padding: "40px" }}>
          <h2 style={{ marginBottom: "30px", color: "#ccc" }}>
            Desempenho da Turma: {classroom?.name}
          </h2>
          {stats.length > 0 ? (
            <div
              style={{
                width: "100%",
                height: 400,
                background: "#1e1e1e",
                padding: "20px",
                borderRadius: "8px",
                border: "1px solid #333",
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#333"
                    vertical={false}
                  />
                  <XAxis dataKey="name" stroke="#888" />
                  <YAxis stroke="#888" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#252526",
                      borderColor: "#444",
                      color: "#fff",
                    }}
                    itemStyle={{ color: "#fff" }}
                    cursor={{ fill: "rgba(255,255,255,0.05)" }}
                  />
                  <Legend />
                  {/* REMOVIDO stackId="a" PARA FICAR LADO A LADO */}
                  <Bar
                    dataKey="Accepted"
                    name="Acertos"
                    fill="#4caf50"
                    barSize={30}
                  />
                  <Bar
                    dataKey="Error"
                    name="Erros / Falhas"
                    fill="#f44336"
                    barSize={30}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div
              style={{ textAlign: "center", color: "#666", marginTop: "50px" }}
            >
              <p>Nenhum dado de submissão encontrado para esta turma ainda.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
