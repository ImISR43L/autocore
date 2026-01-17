import { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import Editor from "@monaco-editor/react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
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
  startDate?: string;
  parameters?: any[];
  returnType?: string;
  timeLimit?: number;
  startedAt?: string;
  children?: Problem[];
  parent?: { id: string };
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
  problemId?: string;
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

const LANGUAGES = [
  {
    id: 71,
    name: "Python (3.8.1)",
    defaultCode: `def solve(a, b):\n    # Escreva sua lógica aqui\n    return a + b`,
  },
  {
    id: 63,
    name: "JavaScript (Node.js)",
    defaultCode: `function solve(a, b) {\n    // Escreva sua lógica aqui\n    return a + b;\n}`,
  },
  {
    id: 62,
    name: "Java (OpenJDK 13.0.1)",
    defaultCode: `class Solution {\n    public int solve(int a, int b) {\n        // Escreva sua lógica aqui\n        return a + b;\n    }\n}`,
  },
  {
    id: 50,
    name: "C (GCC 9.2.0)",
    defaultCode: `int solve(int a, int b) {\n    // Escreva sua lógica aqui\n    return a + b;\n}`,
  },
  {
    id: 54,
    name: "C++ (GCC 9.2.0)",
    defaultCode: `int solve(int a, int b) {\n    // Escreva sua lógica aqui\n    return a + b;\n}`,
  },
  {
    id: 60,
    name: "Go (1.13.5)",
    defaultCode: `func solve(a, b int) int {\n    // Escreva sua lógica aqui\n    return a + b\n}`,
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
  const location = useLocation();

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
  const [currentProblem, setCurrentProblem] = useState<Problem | null>(null);
  const [code, setCode] = useState<string>("");

  // UI & Execução
  const [verdict, setVerdict] = useState<string | null>(null);
  const [executionOutput, setExecutionOutput] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [showSubmissions, setShowSubmissions] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  // INSPEÇÃO
  const [inspectingUser, setInspectingUser] = useState<{
    id: number;
    email: string;
  } | null>(null);
  const [studentSubmissions, setStudentSubmissions] = useState<
    Record<string, Submission>
  >({});
  const [activeInspectionIndex, setActiveInspectionIndex] = useState(0);

  const [gradingGrade, setGradingGrade] = useState<string | number>("");
  const [gradingComment, setGradingComment] = useState("");

  const [newAnnouncement, setNewAnnouncement] = useState("");
  const [posting, setPosting] = useState(false);
  const [stats, setStats] = useState<StatData[]>([]);
  const [problemStats, setProblemStats] = useState<ProblemStat[]>([]);

  // Timer & Navegação
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [examStatus, setExamStatus] = useState<
    "WAITING" | "RUNNING" | "FINISHED"
  >("WAITING");
  const [activeChildIndex, setActiveChildIndex] = useState(0);

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

  const displayProblem =
    currentProblem?.children && currentProblem.children.length > 0
      ? currentProblem.children[activeChildIndex]
      : currentProblem;

  const getStorageKey = (probId: string, langId: number) => {
    if (!myUserId) return null;
    return `autosave_${myUserId}_${probId}_${langId}`;
  };

  const generateFunctionSignature = (langId: number, problem: any) => {
    if (!problem || !problem.parameters) return "";
    const params = problem.parameters;
    const retType = problem.returnType || "void";
    switch (langId) {
      case 71:
        const pyArgs = params.map((p: any) => p.name).join(", ");
        return `def solve(${pyArgs}):\n    # Escreva sua lógica aqui\n    pass`;
      case 63:
        const jsArgs = params.map((p: any) => p.name).join(", ");
        return `function solve(${jsArgs}) {\n    // Escreva sua lógica aqui\n}`;
      case 62:
        const javaTypeMap: any = {
          int: "int",
          string: "String",
          "int[]": "int[]",
          boolean: "boolean",
          float: "float",
          "string[]": "String[]",
        };
        const javaArgs = params
          .map((p: any) => `${javaTypeMap[p.type] || "Object"} ${p.name}`)
          .join(", ");
        const javaRet = javaTypeMap[retType] || "void";
        return `class Solution {\n    public ${javaRet} solve(${javaArgs}) {\n        // Escreva sua lógica aqui\n        return ${
          retType === "boolean"
            ? "false"
            : retType.includes("[]")
            ? "new " + javaRet + "{}"
            : "0"
        };\n    }\n}`;
      case 54:
        const cppTypeMap: any = {
          int: "int",
          string: "std::string",
          "int[]": "std::vector<int>",
          boolean: "bool",
          float: "float",
          "string[]": "std::vector<std::string>",
        };
        const cppArgs = params
          .map((p: any) => `${cppTypeMap[p.type] || "auto"} ${p.name}`)
          .join(", ");
        const cppRet = cppTypeMap[retType] || "void";
        const includes =
          retType.includes("[]") ||
          params.some((p: any) => p.type.includes("[]"))
            ? "#include <vector>\n"
            : "";
        return `${includes}#include <string>\n\n${cppRet} solve(${cppArgs}) {\n    // Escreva sua lógica aqui\n}`;
      default:
        return "";
    }
  };

  const initialRedirectChecked = useRef(false);

  useEffect(() => {
    if (
      location.state &&
      location.state.problemId &&
      !initialRedirectChecked.current
    ) {
      setActiveTab("classwork");
      initialRedirectChecked.current = true;
    } else if (id) {
      localStorage.setItem(`activeTab_${id}`, activeTab);
    }
  }, [location.state, id, activeTab]);

  useEffect(() => {
    localStorage.setItem(`languageId`, String(languageId));
  }, [languageId]);
  useEffect(() => {
    fetchClassroomData();
  }, [id]);

  useEffect(() => {
    if (!selectedProblemId) return;
    const fetchProblemDetails = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(
          `${API_URL}/problems/${selectedProblemId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setCurrentProblem(res.data);
        setActiveChildIndex(0);
      } catch (e) {
        console.error("Erro ao carregar detalhes", e);
      }
    };
    fetchProblemDetails();
  }, [selectedProblemId]);

  useEffect(() => {
    const lang = LANGUAGES.find((l) => l.id === languageId);
    if (!lang || !displayProblem) return;
    const storageKey = getStorageKey(displayProblem.id, languageId);
    const savedCode = storageKey ? localStorage.getItem(storageKey) : null;
    const isPolluted = LANGUAGES.some(
      (l) => l.id !== languageId && l.defaultCode === savedCode
    );
    if (savedCode && !isPolluted) {
      setCode(savedCode);
    } else {
      const dynamicSig = generateFunctionSignature(languageId, displayProblem);
      setCode(dynamicSig || lang.defaultCode);
    }
  }, [languageId, displayProblem, myUserId]);

  useEffect(() => {
    if (displayProblem && activeTab === "classwork") {
      fetchSubmissions(displayProblem.id);
      if (isOwner) fetchProblemStats(displayProblem.id);
    }
  }, [displayProblem, activeTab, isOwner]);

  useEffect(() => {
    if (activeTab === "analytics" && isOwner && id) {
      fetchStats();
    }
  }, [activeTab, isOwner, id]);

  useEffect(() => {
    if (
      !currentProblem ||
      currentProblem.type !== "EXAM" ||
      !currentProblem.timeLimit ||
      !currentProblem.startedAt
    ) {
      setTimeLeft(null);
      setExamStatus(
        currentProblem && !currentProblem.startedAt ? "WAITING" : "RUNNING"
      );
      return;
    }
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const start = new Date(currentProblem.startedAt!).getTime();
      const diff = start + currentProblem.timeLimit! * 60 * 1000 - now;
      if (diff <= 0) {
        setExamStatus("FINISHED");
        setTimeLeft("00:00:00");
        clearInterval(interval);
      } else {
        setExamStatus("RUNNING");
        setTimeLeft(
          `${Math.floor((diff % 864e5) / 36e5)
            .toString()
            .padStart(2, "0")}:${Math.floor((diff % 36e5) / 6e4)
            .toString()
            .padStart(2, "0")}:${Math.floor((diff % 6e4) / 1e3)
            .toString()
            .padStart(2, "0")}`
        );
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [currentProblem]);

  const fetchSubmissions = async (probId: string) => {
    if (!probId) return;
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_URL}/submissions/problem/${probId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSubmissions(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(
        `${API_URL}/submissions/stats/classroom/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStats(res.data);
    } catch {
      console.error("Erro stats");
    }
  };
  const fetchProblemStats = async (probId: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(
        `${API_URL}/submissions/stats/problem/${probId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProblemStats(res.data);
    } catch {
      console.error("Erro problem stats");
    }
  };

  const handleCodeChange = (value: string | undefined) => {
    const val = value || "";
    setCode(val);
    if (displayProblem) {
      const key = getStorageKey(displayProblem.id, languageId);
      if (key) localStorage.setItem(key, val);
    }
  };
  const handleResetCode = () => {
    if (!confirm("Restaurar código?")) return;
    const dynamicSig = generateFunctionSignature(languageId, displayProblem);
    setCode(
      dynamicSig ||
        LANGUAGES.find((l) => l.id === languageId)?.defaultCode ||
        ""
    );
    if (displayProblem)
      localStorage.removeItem(getStorageKey(displayProblem.id, languageId)!);
    toast.success("Restaurado.");
  };

  const handleStartInspection = async (user: { id: number; email: string }) => {
    setInspectingUser(user);
    setActiveInspectionIndex(0);
    setStudentSubmissions({});
    if (currentProblem) {
      const problemsToFetch =
        currentProblem.children && currentProblem.children.length > 0
          ? currentProblem.children
          : [currentProblem];
      const token = localStorage.getItem("token");
      const loadedSubs: Record<string, Submission> = {};
      for (const p of problemsToFetch) {
        try {
          const res = await axios.get(
            `${API_URL}/submissions/problem/${p.id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const userSub = res.data.find(
            (s: Submission) => s.user.id === user.id
          );
          if (userSub) loadedSubs[p.id] = userSub;
        } catch (e) {
          console.error(e);
        }
      }
      setStudentSubmissions(loadedSubs);
      const firstProbId = problemsToFetch[0].id;
      if (loadedSubs[firstProbId]) {
        setGradingGrade(loadedSubs[firstProbId].grade ?? "");
        setGradingComment(loadedSubs[firstProbId].teacherComment ?? "");
      } else {
        setGradingGrade("");
        setGradingComment("");
      }
    }
  };

  const handleInspectionTabChange = (index: number) => {
    setActiveInspectionIndex(index);
    if (!currentProblem || !inspectingUser) return;
    const targetProb =
      currentProblem.children && currentProblem.children.length > 0
        ? currentProblem.children[index]
        : currentProblem;
    const sub = studentSubmissions[targetProb.id];
    if (sub) {
      setGradingGrade(sub.grade ?? "");
      setGradingComment(sub.teacherComment ?? "");
    } else {
      setGradingGrade("");
      setGradingComment("");
    }
  };

  const handleSaveGrade = async () => {
    if (!currentProblem || !inspectingUser) return;
    const targetProb =
      currentProblem.children && currentProblem.children.length > 0
        ? currentProblem.children[activeInspectionIndex]
        : currentProblem;
    const sub = studentSubmissions[targetProb.id];
    if (!sub) return toast.error("Nenhuma submissão para dar nota.");
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `${API_URL}/submissions/${sub.id}/grade`,
        {
          grade: gradingGrade === "" ? null : Number(gradingGrade),
          teacherComment: gradingComment,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Nota salva!");
      setStudentSubmissions((prev) => ({
        ...prev,
        [targetProb.id]: {
          ...sub,
          grade: Number(gradingGrade),
          teacherComment: gradingComment,
        },
      }));
    } catch {
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
        const rootProblems = res.data.problems.filter(
          (p: Problem) => !p.parent
        );
        const targetList =
          rootProblems.length > 0 ? rootProblems : res.data.problems;
        if (
          location.state?.problemId &&
          targetList.find((p: Problem) => p.id === location.state.problemId)
        ) {
          setSelectedProblemId(location.state.problemId);
          return;
        }
        const stored = localStorage.getItem(`lastProblemId_${id}`);
        if (stored && targetList.find((p: Problem) => p.id === stored))
          setSelectedProblemId(stored);
        else if (targetList.length > 0) setSelectedProblemId(targetList[0].id);
      }
    } catch {
      toast.error("Erro ao carregar turma.");
      navigate("/dashboard");
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
    if (!displayProblem) return toast.warning("Selecione um exercício!");
    setLoading(true);
    setVerdict(null);
    setExecutionOutput(null);
    setExecutionError(null);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_URL}/submissions`,
        { code, language_id: languageId, problem_id: displayProblem.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = res.data;
      setVerdict(data.status);
      setExecutionOutput(data.stdout);
      setExecutionError(data.stderr);
      if (data.status === "Accepted") toast.success("Solução Aceite!");
      else toast.error("Erro/Incorreto");
      fetchSubmissions(displayProblem.id);
      if (isOwner) fetchProblemStats(displayProblem.id);
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
  const handleStartExam = async () => {
    if (!confirm("Iniciar?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `${API_URL}/problems/${selectedProblemId}/start`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Iniciada!");
      const res = await axios.get(`${API_URL}/problems/${selectedProblemId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCurrentProblem(res.data);
    } catch {
      toast.error("Erro.");
    }
  };
  const handleGoToProblem = (probId: string) => {
    setSelectedProblemId(probId);
    setActiveTab("classwork");
  };

  const myAttemptsCount = useMemo(() => {
    if (!myUserId) return 0;
    return (submissions || []).filter((s) => s.user?.id === myUserId).length;
  }, [submissions, myUserId]);
  const upcomingWork = useMemo(() => {
    if (!classroom?.problems) return [];
    const rootProblems = classroom.problems.filter((p) => !p.parent);
    const now = new Date();
    return rootProblems
      .filter((p) => p.deadline && new Date(p.deadline) > now)
      .sort(
        (a, b) =>
          new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime()
      )
      .slice(0, 3);
  }, [classroom]);

  if (!classroom) return <div className="container">Carregando...</div>;

  const isExam = currentProblem?.type === "EXAM";

  // --- CORREÇÃO AQUI: Se maxAttempts for null ou undefined, é Infinito ---
  const hasLimit = currentProblem?.maxAttempts != null;
  const maxAttempts = hasLimit ? currentProblem!.maxAttempts! : Infinity;

  const isDeadlinePassed = currentProblem?.deadline
    ? new Date() > new Date(currentProblem.deadline)
    : false;

  const attemptsLeft =
    isExam && hasLimit ? Math.max(0, maxAttempts - myAttemptsCount) : Infinity;

  const isBlocked =
    (isExam && !isOwner && hasLimit && attemptsLeft === 0) ||
    (!isOwner && isDeadlinePassed) ||
    (isExam && examStatus === "WAITING" && !isOwner) ||
    (isExam && examStatus === "FINISHED" && !isOwner);
  // -----------------------------------------------------------------------

  const dropdownOptions = classroom.problems.filter((p) => !p.parent);
  const activeInspectionProblem =
    currentProblem?.children && currentProblem.children.length > 0
      ? currentProblem.children[activeInspectionIndex]
      : currentProblem;
  const activeSubmission = activeInspectionProblem
    ? studentSubmissions[activeInspectionProblem.id]
    : null;

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

      {activeTab === "stream" && (
        <div className="stream-container">
          <div className="stream-wrapper">
            <aside className="stream-sidebar">
              <div className="upcoming-card">
                <div className="upcoming-title">Próximas atividades</div>
                {upcomingWork.length > 0 ? (
                  <>
                    {upcomingWork.map((work) => (
                      <div
                        key={work.id}
                        className="upcoming-link"
                        onClick={() => handleGoToProblem(work.id)}
                        title={work.title}
                      >
                        {work.title}
                      </div>
                    ))}
                    <div
                      className="view-all-link"
                      onClick={() => setActiveTab("classwork")}
                    >
                      Ver tudo
                    </div>
                  </>
                ) : (
                  <div className="upcoming-empty">
                    Nenhuma atividade para a próxima semana!
                  </div>
                )}
              </div>
            </aside>
            <main className="stream-main">
              <div className="stream-banner">
                <h1 className="stream-title">{classroom.name}</h1>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <strong>Código:</strong>
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
                        {posting ? "..." : "Postar"}
                      </button>
                    </div>
                  </form>
                </div>
              )}
              <div className="announcements-list">
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
            </main>
          </div>
        </div>
      )}
      {activeTab === "people" && (
        <div className="people-container">
          <div className="section-header">
            <span>Professores</span>
          </div>
          <div className="person-item">
            <div className="person-avatar">
              {classroom.owner.email.charAt(0).toUpperCase()}
            </div>
            <span>{classroom.owner.email}</span>
          </div>
          <div className="section-header">
            <span>Estudantes</span>
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
      )}

      {activeTab === "classwork" && (
        <div className="ide-container" style={{ flex: 1, borderTop: "none" }}>
          <div className="ide-toolbar">
            <select
              className="form-select"
              style={{ width: "auto", minWidth: "250px" }}
              value={selectedProblemId || ""}
              onChange={(e) => setSelectedProblemId(e.target.value)}
            >
              {dropdownOptions.length === 0 && (
                <option value="">Sem exercícios</option>
              )}
              {dropdownOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>

            {currentProblem?.type === "EXAM" && currentProblem.timeLimit && (
              <div
                style={{
                  margin: "0 15px",
                  padding: "5px 15px",
                  borderRadius: "4px",
                  background:
                    examStatus === "RUNNING"
                      ? "#2e7d32"
                      : examStatus === "FINISHED"
                      ? "#c62828"
                      : "#f57f17",
                  color: "#fff",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span>
                  {examStatus === "WAITING"
                    ? "⏳ Aguardando"
                    : examStatus === "FINISHED"
                    ? "🛑 Encerrado"
                    : "⏱️ Tempo Restante:"}
                </span>
                {examStatus !== "WAITING" && (
                  <span style={{ fontFamily: "monospace", fontSize: "1.1rem" }}>
                    {timeLeft}
                  </span>
                )}
                {isOwner && examStatus === "WAITING" && (
                  <button
                    onClick={handleStartExam}
                    className="btn btn-sm"
                    style={{
                      background: "#fff",
                      color: "#000",
                      border: "none",
                      marginLeft: "10px",
                      cursor: "pointer",
                    }}
                  >
                    ▶ Iniciar Agora
                  </button>
                )}
              </div>
            )}

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

            {/* MOSTRA TENTATIVAS APENAS SE HOUVER LIMITE */}
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
              {isExam && !isOwner && hasLimit && (
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
                key={`${languageId}-${displayProblem?.id || "empty"}`}
                height="100%"
                language={LANGUAGE_MAP[languageId] || "plaintext"}
                theme="vs-dark"
                value={code}
                onChange={handleCodeChange}
                options={{ minimap: { enabled: false }, automaticLayout: true }}
              />
            </div>

            <div className="ide-info-panel">
              {currentProblem?.children &&
                currentProblem.children.length > 0 && (
                  <div
                    className="question-nav"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "20px",
                      paddingBottom: "15px",
                      borderBottom: "1px solid #444",
                    }}
                  >
                    <button
                      className="btn btn-sm btn-secondary"
                      disabled={activeChildIndex <= 0}
                      onClick={() => setActiveChildIndex((prev) => prev - 1)}
                      style={{
                        visibility:
                          activeChildIndex <= 0 ? "hidden" : "visible",
                      }}
                    >
                      ← Anterior
                    </button>
                    <span
                      style={{
                        fontWeight: "bold",
                        color: "#fff",
                        fontSize: "1rem",
                      }}
                    >
                      Questão {activeChildIndex + 1}{" "}
                      <span style={{ color: "#666", fontSize: "0.9rem" }}>
                        / {currentProblem.children.length}
                      </span>
                    </span>
                    <button
                      className="btn btn-sm btn-secondary"
                      disabled={
                        activeChildIndex >= currentProblem.children.length - 1
                      }
                      onClick={() => setActiveChildIndex((prev) => prev + 1)}
                      style={{
                        visibility:
                          activeChildIndex >= currentProblem.children.length - 1
                            ? "hidden"
                            : "visible",
                      }}
                    >
                      Próxima →
                    </button>
                  </div>
                )}

              {displayProblem ? (
                <>
                  <h3 className="ide-info-title">{displayProblem.title}</h3>
                  <div className="ide-description markdown-body">
                    <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                      {displayProblem.description}
                    </ReactMarkdown>
                  </div>
                  {displayProblem.testCases &&
                    displayProblem.testCases.length > 0 && (
                      <div style={{ marginTop: "20px" }}>
                        <h4
                          style={{
                            color: "#ccc",
                            fontSize: "0.9rem",
                            marginBottom: "10px",
                            textTransform: "uppercase",
                          }}
                        >
                          Exemplos de Teste
                        </h4>
                        {displayProblem.testCases.map(
                          (tc: any, index: number) => (
                            <div
                              key={index}
                              style={{
                                background: "#252526",
                                padding: "10px",
                                borderRadius: "6px",
                                marginBottom: "10px",
                                borderLeft: "3px solid #4caf50",
                              }}
                            >
                              <div style={{ marginBottom: "5px" }}>
                                <span
                                  style={{
                                    color: "#888",
                                    fontSize: "0.8rem",
                                    fontWeight: "bold",
                                  }}
                                >
                                  Entrada:
                                </span>
                                <pre
                                  style={{
                                    margin: "5px 0",
                                    fontFamily: "monospace",
                                    background: "#1e1e1e",
                                    padding: "8px",
                                    borderRadius: "4px",
                                    overflowX: "auto",
                                    fontSize: "0.9rem",
                                    color: "#e0e0e0",
                                  }}
                                >
                                  {tc.input}
                                </pre>
                              </div>
                              <div>
                                <span
                                  style={{
                                    color: "#888",
                                    fontSize: "0.8rem",
                                    fontWeight: "bold",
                                  }}
                                >
                                  Saída Esperada:
                                </span>
                                <pre
                                  style={{
                                    margin: "5px 0",
                                    fontFamily: "monospace",
                                    background: "#1e1e1e",
                                    padding: "8px",
                                    borderRadius: "4px",
                                    overflowX: "auto",
                                    fontSize: "0.9rem",
                                    color: "#e0e0e0",
                                  }}
                                >
                                  {tc.expectedOutput}
                                </pre>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    )}
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
                    <pre
                      className="feedback-code error"
                      style={{ whiteSpace: "pre-wrap" }}
                    >
                      {executionError}
                    </pre>
                  )}
                  {executionOutput && verdict !== "Accepted" && (
                    <pre
                      className="feedback-code"
                      style={{ whiteSpace: "pre-wrap" }}
                    >
                      {executionOutput}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* ... Modais ... */}
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
                          <td>{sub.grade ?? "-"}</td>
                          <td>{new Date(sub.createdAt).toLocaleString()}</td>
                          <td>
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleStartInspection(sub.user)}
                            >
                              Inspecionar
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {inspectingUser && (
            <div className="modal-overlay" style={{ zIndex: 1100 }}>
              <div
                className="modal-content x-large"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  height: "90vh",
                  padding: 0,
                  overflow: "hidden",
                }}
              >
                <div
                  className="modal-header"
                  style={{
                    padding: "15px 20px",
                    borderBottom: "1px solid #333",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <h3 style={{ margin: 0 }}>
                      Inspecionando: {inspectingUser.email}
                    </h3>
                    <span style={{ fontSize: "0.8rem", color: "#888" }}>
                      {currentProblem?.title}
                    </span>
                  </div>
                  <button
                    onClick={() => setInspectingUser(null)}
                    className="btn btn-secondary"
                  >
                    Fechar
                  </button>
                </div>
                <div
                  className="inspection-layout"
                  style={{ display: "flex", flex: 1, overflow: "hidden" }}
                >
                  {currentProblem?.children &&
                    currentProblem.children.length > 0 && (
                      <div
                        className="inspection-sidebar"
                        style={{
                          width: "220px",
                          borderRight: "1px solid #333",
                          background: "#1e1e1e",
                          overflowY: "auto",
                        }}
                      >
                        <div
                          style={{
                            padding: "10px 15px",
                            fontSize: "0.8rem",
                            fontWeight: "bold",
                            color: "#666",
                            textTransform: "uppercase",
                          }}
                        >
                          Questões
                        </div>
                        {currentProblem.children.map((child, index) => {
                          const sub = studentSubmissions[child.id];
                          return (
                            <div
                              key={child.id}
                              onClick={() => handleInspectionTabChange(index)}
                              style={{
                                padding: "12px 15px",
                                cursor: "pointer",
                                background:
                                  activeInspectionIndex === index
                                    ? "#2d2d30"
                                    : "transparent",
                                borderLeft:
                                  activeInspectionIndex === index
                                    ? "3px solid #4caf50"
                                    : "3px solid transparent",
                                display: "flex",
                                flexDirection: "column",
                                gap: "4px",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "0.9rem",
                                  fontWeight:
                                    activeInspectionIndex === index
                                      ? "bold"
                                      : "normal",
                                  color: "#fff",
                                }}
                              >
                                Q{index + 1}: {child.title}
                              </div>
                              <div style={{ fontSize: "0.75rem" }}>
                                {sub ? (
                                  <span
                                    style={{
                                      color:
                                        sub.status === "Accepted"
                                          ? "#4caf50"
                                          : "#f44336",
                                    }}
                                  >
                                    {sub.status === "Accepted"
                                      ? "✔ Aceito"
                                      : "✖ Erro"}
                                  </span>
                                ) : (
                                  <span style={{ color: "#666" }}>
                                    - Pendente
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  <div
                    className="inspection-content"
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      overflow: "hidden",
                    }}
                  >
                    {activeSubmission ? (
                      <>
                        <div
                          style={{ flex: 1, borderBottom: "1px solid #333" }}
                        >
                          <Editor
                            height="100%"
                            language={LANGUAGE_MAP[71]}
                            theme="vs-dark"
                            value={activeSubmission.code}
                            options={{
                              readOnly: true,
                              minimap: { enabled: false },
                              scrollBeyondLastLine: false,
                            }}
                          />
                        </div>
                        <div
                          style={{
                            height: "250px",
                            background: "#1e1e1e",
                            padding: "15px",
                            overflowY: "auto",
                            display: "flex",
                            gap: "20px",
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <h4
                              style={{
                                marginTop: 0,
                                fontSize: "0.85rem",
                                color: "#ccc",
                                textTransform: "uppercase",
                              }}
                            >
                              Output do Aluno
                            </h4>
                            <div
                              style={{
                                fontFamily: "monospace",
                                fontSize: "0.9rem",
                                background: "#000",
                                padding: "10px",
                                borderRadius: "4px",
                                minHeight: "100px",
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                              }}
                            >
                              {activeSubmission.stdout || (
                                <span
                                  style={{ color: "#666", fontStyle: "italic" }}
                                >
                                  Sem output (vazio)
                                </span>
                              )}
                            </div>
                            {activeSubmission.stderr && (
                              <div
                                style={{
                                  marginTop: "10px",
                                  fontFamily: "monospace",
                                  fontSize: "0.9rem",
                                  background: "#3e1e1e",
                                  color: "#ff8a80",
                                  padding: "10px",
                                  borderRadius: "4px",
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word",
                                }}
                              >
                                {activeSubmission.stderr}
                              </div>
                            )}
                          </div>
                          {(isOwner || activeSubmission.grade != null) && (
                            <div
                              style={{
                                width: "300px",
                                borderLeft: "1px solid #333",
                                paddingLeft: "20px",
                              }}
                            >
                              <h4
                                style={{
                                  marginTop: 0,
                                  fontSize: "0.85rem",
                                  color: "#4caf50",
                                  textTransform: "uppercase",
                                }}
                              >
                                Feedback
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
                                    <label style={{ fontSize: "0.8rem" }}>
                                      Nota
                                    </label>
                                    <input
                                      className="form-input"
                                      type="number"
                                      value={gradingGrade}
                                      onChange={(e) =>
                                        setGradingGrade(e.target.value)
                                      }
                                    />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: "0.8rem" }}>
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
                                    className="btn btn-primary btn-sm"
                                  >
                                    Salvar Nota
                                  </button>
                                </div>
                              ) : (
                                <div>
                                  <div
                                    style={{
                                      fontSize: "1.2rem",
                                      fontWeight: "bold",
                                      marginBottom: "5px",
                                    }}
                                  >
                                    {activeSubmission.grade ?? "-"}{" "}
                                    <span
                                      style={{
                                        fontSize: "0.8rem",
                                        fontWeight: "normal",
                                      }}
                                    >
                                      / 100
                                    </span>
                                  </div>
                                  <div
                                    style={{
                                      color: "#ccc",
                                      fontStyle: "italic",
                                    }}
                                  >
                                    "
                                    {activeSubmission.teacherComment ||
                                      "Sem comentários"}
                                    "
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          height: "100%",
                          color: "#666",
                          flexDirection: "column",
                        }}
                      >
                        <div style={{ fontSize: "2rem", marginBottom: "10px" }}>
                          ∅
                        </div>
                        <div>
                          O aluno não enviou uma solução para esta questão.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
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
                      backgroundColor: "#1e1e1e",
                      borderColor: "#444",
                      color: "#fff",
                    }}
                    itemStyle={{ color: "#fff" }}
                    cursor={{ fill: "rgba(255,255,255,0.05)" }}
                  />
                  <Legend />
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
