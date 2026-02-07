import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import axios from "axios";
import Editor from "@monaco-editor/react";
import type { OnMount } from "@monaco-editor/react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
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
  Rectangle,
} from "recharts";
import {
  ArrowLeft,
  Plus,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  ChevronDown,
  Download,
  FileCode,
  Trash,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Search,
  Filter,
  Cpu,
  Settings,
  BarChart as BarChartIcon,
} from "lucide-react";
import {
  Panel,
  Group as PanelGroupOriginal,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
const PanelGroup = PanelGroupOriginal as any;

import { io } from "socket.io-client";
import LogViewer from "../components/LogViewer";

import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Card } from "../components/ui/Card";
import { cn } from "../lib/utils";

import "highlight.js/styles/atom-one-dark.css";
import "../App.css";

// --- INTERFACES (Mantidas) ---
interface Announcement {
  id: string;
  content: string;
  createdAt: string;
  author: { email: string };
}

interface Parameter {
  name: string;
  type: string;
}

interface TestCase {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

interface FileEntry {
  name: string;
  content: string;
}

interface Problem {
  id: string;
  title: string;
  description: string;
  slug: string;
  testCases?: TestCase[];
  type: "EXERCISE" | "EXAM";
  maxAttempts?: number;
  deadline?: string;
  startDate?: string;
  parameters?: Parameter[];
  returnType?: string;
  timeLimit?: number;
  startedAt?: string;
  children?: Problem[];
  parent?: { id: string };
  starterCode?: FileEntry[];
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
  status:
    | "Pending"
    | "Accepted"
    | "Processing"
    | "Wrong Answer"
    | "Time Limit Exceeded"
    | "Compilation Error"
    | "Runtime Error"
    | "Memory Limit Exceeded"
    | "Internal Error";
  files: FileEntry[];
  stdout?: string;
  stderr?: string;
  output: string;
  executionTime: number;
  memoryUsage: number;
  createdAt: string;
  user: { id: number; email: string };
  grade?: number;
  teacherComment?: string;
  problemId?: string;
  problem?: { id: string };
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
    fileName: "main.py",
    defaultCode: `def solve():\n    # Escreva sua lógica aqui\n    pass`,
  },
  {
    id: 63,
    name: "JavaScript (Node.js)",
    fileName: "index.js",
    defaultCode: `function solve() {\n    // Escreva sua lógica aqui\n}`,
  },
  {
    id: 62,
    name: "Java (OpenJDK 13.0.1)",
    fileName: "Main.java",
    defaultCode: `public class Main {\n    public static void main(String[] args) {\n        // Lógica\n    }\n}`,
  },
  {
    id: 50,
    name: "C (GCC 9.2.0)",
    fileName: "main.c",
    defaultCode: `#include <stdio.h>\n\nint main() {\n    // Lógica\n    return 0;\n}`,
  },
  {
    id: 54,
    name: "C++ (GCC 9.2.0)",
    fileName: "main.cpp",
    defaultCode: `#include <iostream>\n\nint main() {\n    // Lógica\n    return 0;\n}`,
  },
  {
    id: 60,
    name: "Go (1.13.5)",
    fileName: "main.go",
    defaultCode: `package main\n\nfunc main() {\n    // Lógica\n}`,
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
    () => Number(localStorage.getItem(`languageId`)) || 71,
  );
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(
    null,
  );
  const [currentProblem, setCurrentProblem] = useState<Problem | null>(null);

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [newFileName, setNewFileName] = useState("");

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  const [verdict, setVerdict] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const loadingRef = useRef(false);
  const [showSubmissions, setShowSubmissions] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  const [selectedStudentFilter, setSelectedStudentFilter] = useState<
    number | null
  >(null);
  const [studentSearch, setStudentSearch] = useState("");

  const [inspectingUser, setInspectingUser] = useState<{
    id: number;
    email: string;
  } | null>(null);
  const [studentSubmissions, setStudentSubmissions] = useState<
    Record<string, Submission>
  >({});
  const [activeInspectionIndex, setActiveInspectionIndex] = useState(0);
  const [inspectFileIndex, setInspectFileIndex] = useState(0);

  const [selectedSubmission, setSelectedSubmission] =
    useState<Submission | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [gradingGrade, setGradingGrade] = useState<string | number>("");
  const [gradingComment, setGradingComment] = useState("");

  const [newAnnouncement, setNewAnnouncement] = useState("");
  const [posting, setPosting] = useState(false);
  const [stats, setStats] = useState<StatData[]>([]);
  const [problemStats, setProblemStats] = useState<ProblemStat[]>([]);

  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [examStatus, setExamStatus] = useState<
    "WAITING" | "RUNNING" | "FINISHED"
  >("WAITING");
  const [activeChildIndex, setActiveChildIndex] = useState(0);

  const [showReportMenu, setShowReportMenu] = useState(false);

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

  const activeTabRef = useRef(activeTab);
  const displayProblemRef = useRef(displayProblem);
  const isOwnerRef = useRef(isOwner);

  useEffect(() => {
    activeTabRef.current = activeTab;
    displayProblemRef.current = displayProblem;
    isOwnerRef.current = isOwner;
  }, [activeTab, displayProblem, isOwner]);

  const getStorageKey = useCallback(
    (probId: string, langId: number) => {
      if (!myUserId) return null;
      return `autosave_files_${myUserId}_${probId}_${langId}`;
    },
    [myUserId],
  );

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
    if (files[activeFileIndex]?.content) {
      validateCode(files[activeFileIndex].content, languageId);
    }
  }, [languageId]);

  const validateCode = useCallback((code: string, langId: number) => {
    if (!monacoRef.current || !editorRef.current) return;

    const model = editorRef.current.getModel();
    if (!model) return;

    const markers: any[] = [];
    const lang = LANGUAGE_MAP[langId] || "plaintext";
    const lines = code.split("\n");

    lines.forEach((line, i) => {
      const lineNum = i + 1;
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#"))
        return;

      if (lang === "python") {
        const keywords = [
          "def ",
          "if ",
          "elif ",
          "else",
          "for ",
          "while ",
          "try",
          "except",
          "finally",
          "class ",
        ];
        const startsWithKeyword = keywords.some((k) => trimmed.startsWith(k));
        const isExactKeyword = ["else", "try", "finally"].includes(
          trimmed.replace(":", ""),
        );

        if ((startsWithKeyword || isExactKeyword) && !trimmed.endsWith(":")) {
          markers.push({
            severity: monacoRef.current.MarkerSeverity.Error,
            message: "Erro de Sintaxe: Esperado ':' no final da linha.",
            startLineNumber: lineNum,
            startColumn: line.lastIndexOf(trimmed) + 1,
            endLineNumber: lineNum,
            endColumn: line.length + 1,
          });
        }
      }

      if (["c", "cpp", "java"].includes(lang)) {
        const isStatement =
          (trimmed.includes("=") ||
            trimmed.startsWith("return") ||
            trimmed.startsWith("print") ||
            trimmed.startsWith("cout") ||
            trimmed.startsWith("int ") ||
            trimmed.startsWith("float ") ||
            trimmed.startsWith("double ") ||
            trimmed.startsWith("char ") ||
            trimmed.startsWith("String ") ||
            trimmed.startsWith("boolean ")) &&
          !trimmed.includes("for") &&
          !trimmed.includes("if") &&
          !trimmed.includes("while") &&
          !trimmed.endsWith("{") &&
          !trimmed.endsWith("}") &&
          !trimmed.startsWith("#");

        if (isStatement && !trimmed.endsWith(";")) {
          markers.push({
            severity: monacoRef.current.MarkerSeverity.Warning,
            message: "Possível falta de ';' no final da linha.",
            startLineNumber: lineNum,
            startColumn: line.lastIndexOf(trimmed) + 1,
            endLineNumber: lineNum,
            endColumn: line.length + 1,
          });
        }
      }
    });

    monacoRef.current.editor.setModelMarkers(model, "owner", markers);
  }, []);

  useEffect(() => {
    if (files.length > 0 && files[activeFileIndex]) {
      const timer = setTimeout(() => {
        validateCode(files[activeFileIndex].content, languageId);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [files, activeFileIndex, languageId, validateCode]);

  const submitSolutionRef = useRef<
    ((e?: React.MouseEvent) => Promise<void>) | null
  >(null);

  useEffect(() => {
    if (!classroom?.problems || selectedProblemId) return;

    const rootProblems = classroom.problems.filter((p) => !p.parent);
    const targetList =
      rootProblems.length > 0 ? rootProblems : classroom.problems;

    if (
      location.state?.problemId &&
      targetList.find((p) => p.id === location.state.problemId)
    ) {
      setSelectedProblemId(location.state.problemId);
      return;
    }

    const stored = localStorage.getItem(`lastProblemId_${id}`);
    if (stored && targetList.find((p) => p.id === stored)) {
      setSelectedProblemId(stored);
    } else if (targetList.length > 0) {
      setSelectedProblemId(targetList[0].id);
    }
  }, [classroom, location.state, id, selectedProblemId]);

  const fetchClassroomData = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_URL}/classrooms/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setClassroom(res.data);
    } catch {
      toast.error("Erro ao carregar turma.");
      navigate("/dashboard");
    }
  }, [id, API_URL, navigate]);

  const fetchSubmissions = useCallback(
    async (probId: string) => {
      if (!probId) return;
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(
          `${API_URL}/submissions/problem/${probId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        setSubmissions(res.data);
      } catch (error) {
        console.error(error);
      }
    },
    [API_URL],
  );

  const fetchProblemStats = useCallback(
    async (probId: string) => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(
          `${API_URL}/submissions/stats/problem/${probId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setProblemStats(res.data);
      } catch {
        console.error("Erro problem stats");
      }
    },
    [API_URL],
  );

  const fetchStats = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(
        `${API_URL}/submissions/stats/classroom/${id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setStats(res.data);
    } catch {
      console.error("Erro stats");
    }
  }, [id, API_URL]);

  useEffect(() => {
    fetchClassroomData();
    const interval = setInterval(fetchClassroomData, 10000);
    return () => clearInterval(interval);
  }, [fetchClassroomData]);

  useEffect(() => {
    if (!myUserId || !id) return;
    const newSocket = io(API_URL, {
      transports: ["websocket"],
    });

    newSocket.on("connect", () => {
      console.log("Conectado ao WebSocket!");
      newSocket.emit("join-user-room", { userId: myUserId });
      newSocket.emit("join-classroom-room", { classroomId: Number(id) });
    });

    newSocket.on("submission-finished", (submission: Submission) => {
      const currentProb = displayProblemRef.current;
      if (
        currentProb &&
        ((submission.problem?.id && submission.problem.id === currentProb.id) ||
          submission.problemId === currentProb.id)
      ) {
        setVerdict(submission.status);
        setLoading(false);
        loadingRef.current = false;

        if (submission.status === "Accepted")
          toast.success("Solução Aceita! 🚀");
        else if (submission.status === "Wrong Answer")
          toast.error("Resposta Incorreta.");
        else toast.error(`Erro: ${submission.status}`);

        fetchSubmissions(currentProb.id);
        if (isOwnerRef.current) fetchProblemStats(currentProb.id);
      }
      if (isOwnerRef.current) fetchStats();
    });

    newSocket.on(
      "classroom-update",
      (data: { type: string; problemId: string }) => {
        fetchClassroomData();
        const currentTab = activeTabRef.current;
        const currentProb = displayProblemRef.current;
        const owner = isOwnerRef.current;
        if (currentTab === "analytics" && owner) {
          fetchStats();
        }
        if (currentTab === "classwork" && currentProb?.id === data.problemId) {
          fetchSubmissions(data.problemId);
          if (owner) fetchProblemStats(data.problemId);
        }
      },
    );

    return () => {
      newSocket.disconnect();
    };
  }, [
    myUserId,
    id,
    API_URL,
    fetchSubmissions,
    fetchProblemStats,
    fetchStats,
    fetchClassroomData,
  ]);

  useEffect(() => {
    if (!selectedProblemId) return;
    const fetchProblemDetails = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(
          `${API_URL}/problems/${selectedProblemId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setCurrentProblem(res.data);
        setActiveChildIndex(0);
      } catch (e) {
        console.error("Erro ao carregar detalhes", e);
      }
    };
    fetchProblemDetails();
  }, [selectedProblemId, API_URL]);

  useEffect(() => {
    const lang = LANGUAGES.find((l) => l.id === languageId);
    if (!lang || !displayProblem) return;

    const storageKey = getStorageKey(displayProblem.id, languageId);
    const savedFilesJson = storageKey ? localStorage.getItem(storageKey) : null;

    if (savedFilesJson) {
      try {
        const savedFiles = JSON.parse(savedFilesJson);
        if (Array.isArray(savedFiles) && savedFiles.length > 0) {
          setFiles(savedFiles);
          setActiveFileIndex(0);
          return;
        }
      } catch (e) {
        console.error("Erro ao parsear autosave", e);
      }
    }

    if (displayProblem.starterCode && displayProblem.starterCode.length > 0) {
      setFiles(displayProblem.starterCode);
      setActiveFileIndex(0);
      return;
    }

    const defaultFile = {
      name: lang.fileName,
      content: lang.defaultCode,
    };
    setFiles([defaultFile]);
    setActiveFileIndex(0);
  }, [languageId, displayProblem, myUserId, getStorageKey]);

  useEffect(() => {
    if (displayProblem && activeTab === "classwork") {
      fetchSubmissions(displayProblem.id);
      if (isOwner) fetchProblemStats(displayProblem.id);
    }
  }, [displayProblem, activeTab, isOwner, fetchSubmissions, fetchProblemStats]);

  useEffect(() => {
    if (activeTab === "analytics" && isOwner && id) {
      fetchStats();
      const interval = setInterval(fetchStats, 10000);
      return () => clearInterval(interval);
    }
  }, [activeTab, isOwner, id, fetchStats]);

  useEffect(() => {
    if (
      !currentProblem ||
      currentProblem.type !== "EXAM" ||
      !currentProblem.timeLimit ||
      !currentProblem.startedAt
    ) {
      setTimeLeft(null);
      setExamStatus(
        currentProblem && !currentProblem.startedAt ? "WAITING" : "RUNNING",
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
            .padStart(2, "0")}`,
        );
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [currentProblem]);

  useEffect(() => {
    setVerdict(null);
    setLoading(false);
    loadingRef.current = false;
  }, [displayProblem?.id]);

  const handleCodeChange = (value: string | undefined) => {
    const val = value || "";
    validateCode(val, languageId);
    const newFiles = [...files];
    if (newFiles[activeFileIndex]) {
      newFiles[activeFileIndex] = {
        ...newFiles[activeFileIndex],
        content: val,
      };
      setFiles(newFiles);
      if (displayProblem) {
        const key = getStorageKey(displayProblem.id, languageId);
        if (key) localStorage.setItem(key, JSON.stringify(newFiles));
      }
    }
  };

  const handleAddFile = () => {
    if (!newFileName.trim()) return toast.warning("Nome vazio");
    if (files.some((f) => f.name === newFileName))
      return toast.warning("Já existe");
    const updated = [...files, { name: newFileName, content: "" }];
    setFiles(updated);
    setNewFileName("");
    setActiveFileIndex(updated.length - 1);
  };

  const handleRemoveFile = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (files.length <= 1) return toast.warning("Mínimo 1 arquivo");
    const updated = files.filter((_, i) => i !== idx);
    setFiles(updated);
    setActiveFileIndex(0);
  };

  const handleResetCode = () => {
    if (!confirm("Isso apagará todas as alterações. Continuar?")) return;
    if (displayProblem) {
      const key = getStorageKey(displayProblem.id, languageId);
      if (key) localStorage.removeItem(key);
      if (displayProblem.starterCode && displayProblem.starterCode.length > 0) {
        setFiles(displayProblem.starterCode);
      } else {
        const lang = LANGUAGES.find((l) => l.id === languageId);
        setFiles([
          {
            name: lang?.fileName || "main.txt",
            content: lang?.defaultCode || "",
          },
        ]);
      }
      setActiveFileIndex(0);
    }
    toast.success("Restaurado.");
  };

  const handleStartInspection = async (targetSubmission: Submission) => {
    if (isOwner) {
      setInspectingUser(targetSubmission.user);
      setStudentSubmissions({});
      setInspectFileIndex(0);
      const targetProblemId = targetSubmission.problem?.id
        ? String(targetSubmission.problem.id)
        : targetSubmission.problemId
          ? String(targetSubmission.problemId)
          : null;

      if (currentProblem) {
        const problemsToFetch =
          currentProblem.children && currentProblem.children.length > 0
            ? currentProblem.children
            : [currentProblem];

        const token = localStorage.getItem("token");
        const loadedSubs: Record<string, Submission> = {};
        let foundIndex = 0;

        for (let i = 0; i < problemsToFetch.length; i++) {
          const p = problemsToFetch[i];
          if (targetProblemId === String(p.id)) {
            loadedSubs[p.id] = targetSubmission;
            foundIndex = i;
            continue;
          }
          try {
            const res = await axios.get(
              `${API_URL}/submissions/problem/${p.id}`,
              { headers: { Authorization: `Bearer ${token}` } },
            );
            const userSub = res.data.find(
              (s: Submission) => s.user.id === targetSubmission.user.id,
            );
            if (userSub) loadedSubs[p.id] = userSub;
          } catch (e) {
            console.error(e);
          }
        }

        setStudentSubmissions(loadedSubs);
        setActiveInspectionIndex(foundIndex);

        const activeProbId = problemsToFetch[foundIndex].id;
        if (loadedSubs[activeProbId]) {
          setGradingGrade(loadedSubs[activeProbId].grade ?? "");
          setGradingComment(loadedSubs[activeProbId].teacherComment ?? "");
        } else {
          setGradingGrade("");
          setGradingComment("");
        }
      }
    } else {
      setSelectedSubmission(targetSubmission);
      setShowModal(true);
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
        { headers: { Authorization: `Bearer ${token}` } },
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

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncement.trim()) return;
    setPosting(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_URL}/announcements`,
        { content: newAnnouncement, classroomId: classroom?.id },
        { headers: { Authorization: `Bearer ${token}` } },
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

  const submitSolution = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();

    if (!displayProblem) {
      toast.warning("Selecione um exercício!");
      return;
    }
    if (loading) {
      return;
    }
    if (isBlocked) {
      toast.error("O envio está bloqueado para esta atividade.");
      return;
    }

    setLoading(true);
    loadingRef.current = true;
    setVerdict("Processando...");

    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      await axios.post(
        `${API_URL}/submissions`,
        {
          files,
          language_id: languageId,
          problem_id: displayProblem.id,
        },
        { headers },
      );

      setTimeout(() => {
        if (loadingRef.current && displayProblemRef.current) {
          console.log("WebSocket demorou. Forçando atualização...");
          fetchSubmissions(displayProblemRef.current.id);
        }
      }, 10000);
    } catch (error: any) {
      setLoading(false);
      loadingRef.current = false;
      console.error(error);
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        setVerdict("Muitas Tentativas");
        toast.warning("Aguarde um momento antes de enviar novamente.");
      } else {
        setVerdict("Erro");
        toast.error("Erro ao enviar submissão.");
      }
    }
  };

  useEffect(() => {
    submitSolutionRef.current = submitSolution;
  }, [submitSolution]);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    editor.addAction({
      id: "submit-code-action",
      label: "Enviar Solução",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => {
        console.log("Atalho Monaco acionado!");
        if (submitSolutionRef.current) {
          submitSolutionRef.current();
        }
      },
    });

    if (files.length > 0) {
      validateCode(files[activeFileIndex].content, languageId);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab === "classwork" && selectedProblemId) {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          console.log("Atalho Global acionado!");
          e.preventDefault();
          submitSolution();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, selectedProblemId, submitSolution]);

  const handleStartExam = async () => {
    if (!confirm("Iniciar?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `${API_URL}/problems/${selectedProblemId}/start`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
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

  const handleExport = async (format: "csv" | "xlsx") => {
    if (!classroom) return;
    setShowReportMenu(false);
    const toastId = toast.loading("Gerando relatório...");
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API_URL}/reports/classroom/${classroom.id}/${format}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob",
        },
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const extension = format === "csv" ? "csv" : "xlsx";
      link.setAttribute(
        "download",
        `Relatorio_Turma_${classroom.code}.${extension}`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Relatório ${format.toUpperCase()} gerado!`, {
        id: toastId,
      });
    } catch (error) {
      console.error(error);
      toast.error("Erro ao gerar relatório.", { id: toastId });
    }
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
          new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime(),
      )
      .slice(0, 3);
  }, [classroom]);

  const lastSubmission = useMemo(() => {
    if (!submissions || submissions.length === 0) return null;
    return (
      submissions
        .filter((s) => s.user?.id === myUserId)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )[0] || null
    );
  }, [submissions, myUserId]);

  if (!classroom)
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background text-muted">
        <RefreshCw className="animate-spin mr-2" /> Carregando turma...
      </div>
    );

  const isExam = currentProblem?.type === "EXAM";
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

  const dropdownOptions = classroom.problems.filter((p) => !p.parent);
  const activeInspectionProblem =
    currentProblem?.children && currentProblem.children.length > 0
      ? currentProblem.children[activeInspectionIndex]
      : currentProblem;
  const activeSubmission = activeInspectionProblem
    ? studentSubmissions[activeInspectionProblem.id]
    : null;

  const filteredStudents = (classroom.students || []).filter((student) =>
    student.email.toLowerCase().includes(studentSearch.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-screen bg-background text-zinc-100 overflow-hidden font-sans selection:bg-primary/20">
      <header className="flex-none border-b border-border bg-surface px-6 py-4">
        <div className="flex items-center gap-4 mb-4">
          <Link
            to="/dashboard"
            className="p-2 hover:bg-white/10 rounded-full text-muted hover:text-white transition-colors"
          >
            <ArrowLeft size={24} />
          </Link>
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            {classroom.name}
          </h2>
        </div>

        <nav className="flex gap-8 text-base font-medium">
          {[
            { id: "stream", label: "Mural" },
            { id: "classwork", label: "Atividades" },
            { id: "people", label: "Pessoas" },
            isOwner ? { id: "analytics", label: "Estatísticas" } : null,
          ]
            .filter(Boolean)
            .map((tab: any) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "pb-2 border-b-2 transition-colors px-1",
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted hover:text-zinc-100",
                )}
              >
                {tab.label}
              </button>
            ))}
        </nav>
      </header>

      <main className="flex-1 overflow-hidden relative">
        {/* -- STREAMS -- */}
        {activeTab === "stream" && (
          <div className="h-full overflow-y-auto p-8">
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
              {/* Sidebar do Stream */}
              <aside className="lg:col-span-1 space-y-4">
                <Card className="p-5 bg-surface border-border">
                  <h3 className="font-semibold mb-4 text-sm uppercase tracking-wide text-muted">
                    Próximas Entregas
                  </h3>
                  {upcomingWork.length > 0 ? (
                    <div className="space-y-3">
                      {upcomingWork.map((work) => (
                        <div
                          key={work.id}
                          onClick={() => handleGoToProblem(work.id)}
                          className="text-base cursor-pointer hover:underline truncate text-zinc-300 hover:text-primary transition-colors"
                        >
                          {work.title}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted">
                      Nenhuma atividade pendente.
                    </p>
                  )}
                </Card>
              </aside>

              {/* Main Feed */}
              <div className="lg:col-span-3 space-y-8">
                <div className="bg-gradient-to-r from-emerald-900/50 to-zinc-900 p-8 rounded-xl border border-primary/20 shadow-lg">
                  <h1 className="text-4xl font-bold mb-3 text-white">
                    {classroom.name}
                  </h1>
                  <div className="text-base text-emerald-200/80 font-mono">
                    Código: {classroom.code}
                  </div>
                </div>

                {isOwner && (
                  <Card className="p-6 bg-surface border-border">
                    <form
                      onSubmit={handlePostAnnouncement}
                      className="space-y-4"
                    >
                      <textarea
                        className="w-full bg-background border border-border rounded-lg p-4 text-base focus:outline-none focus:border-primary transition-colors resize-none"
                        placeholder="Anuncie algo para a turma..."
                        rows={3}
                        value={newAnnouncement}
                        onChange={(e) => setNewAnnouncement(e.target.value)}
                      />
                      <div className="flex justify-end">
                        <Button
                          type="submit"
                          disabled={posting || !newAnnouncement.trim()}
                          isLoading={posting}
                          className="px-6"
                        >
                          Postar
                        </Button>
                      </div>
                    </form>
                  </Card>
                )}

                <div className="space-y-6">
                  {classroom.announcements?.map((a) => (
                    <Card key={a.id} className="bg-surface border-border p-6">
                      <div className="flex items-start justify-between mb-4 border-b border-border pb-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                            {a.author?.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-base font-medium text-white">
                              {a.author?.email}
                            </div>
                            <div className="text-sm text-muted">
                              {new Date(a.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        {isOwner && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteAnnouncement(a.id)}
                          >
                            <Trash
                              size={18}
                              className="text-muted hover:text-destructive"
                            />
                          </Button>
                        )}
                      </div>
                      <div className="text-base whitespace-pre-wrap text-zinc-300 leading-relaxed">
                        {a.content}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* -- PEOPLE -- */}
        {activeTab === "people" && (
          <div className="h-full overflow-y-auto p-8">
            <div className="max-w-4xl mx-auto space-y-10">
              {/* Seção Professores */}
              <section>
                <h3 className="text-emerald-500 font-semibold text-xl mb-6 px-2 border-b border-border pb-3 flex items-center justify-between">
                  Professores
                  <User size={20} />
                </h3>
                <Card className="bg-surface border-border">
                  <div className="flex items-center gap-5 p-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-900/50 text-emerald-400 flex items-center justify-center font-bold border border-emerald-500/20 text-lg">
                      {classroom.owner.email.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-zinc-200 font-medium text-lg">
                      {classroom.owner.email}
                    </span>
                  </div>
                </Card>
              </section>

              {/* Seção Estudantes */}
              <section>
                <div className="flex items-center justify-between mb-6 px-2 border-b border-border pb-3">
                  <h3 className="text-emerald-500 font-semibold text-xl flex items-center gap-3">
                    Estudantes
                    <span className="text-sm bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full">
                      {classroom.students.length}
                    </span>
                  </h3>
                </div>

                {/* Barra de Busca de Alunos */}
                <div className="mb-6 relative">
                  <Search
                    className="absolute left-4 top-3 text-muted"
                    size={20}
                  />
                  <Input
                    placeholder="Buscar estudante por email..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="bg-surface pl-12 h-12 text-base"
                  />
                </div>

                <Card className="bg-surface border-border divide-y divide-border">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-5 p-4 hover:bg-surface-hover transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center font-bold text-base">
                          {s.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 text-base text-zinc-200">
                          {s.email}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-10 text-center text-muted text-base">
                      Nenhum estudante encontrado.
                    </div>
                  )}
                </Card>
              </section>
            </div>
          </div>
        )}

        {/* -- CLASSWORK (IDE COM ABAS) -- */}
        {activeTab === "classwork" && (
          <div className="flex flex-col h-full">
            {/* Toolbar da IDE */}
            <div className="flex-none flex items-center justify-between p-4 border-b border-border bg-surface">
              <div className="flex items-center gap-4">
                <Select
                  value={selectedProblemId || ""}
                  onChange={(e) => setSelectedProblemId(e.target.value)}
                  className="w-72 h-11 text-base" // Aumentado para h-11
                >
                  <option value="">Selecione um exercício...</option>
                  {dropdownOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </Select>

                {/* Status do Exame */}
                {isExam && currentProblem?.timeLimit && (
                  <div
                    className={cn(
                      "px-4 py-2 rounded text-sm font-bold flex items-center gap-2 h-11", // Fixada altura
                      examStatus === "RUNNING"
                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        : examStatus === "FINISHED"
                          ? "bg-red-500/10 text-red-500 border border-red-500/20"
                          : "bg-orange-500/10 text-orange-500 border border-orange-500/20",
                    )}
                  >
                    <Clock size={18} />
                    {examStatus === "WAITING"
                      ? "Aguardando Início"
                      : examStatus === "FINISHED"
                        ? "Encerrado"
                        : timeLeft}
                    {isOwner && examStatus === "WAITING" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 ml-3 text-xs"
                        onClick={handleStartExam}
                      >
                        Iniciar
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                {isOwner && selectedProblemId && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-11 px-5 text-base"
                      onClick={() =>
                        navigate(
                          `/class/${id}/problem/${selectedProblemId}/edit`,
                        )
                      }
                    >
                      <Settings size={18} className="mr-2" /> Editar
                    </Button>
                    <Button
                      variant="danger"
                      size="icon"
                      className="h-11 w-11" // Aumentado para h-11
                      onClick={handleDeleteProblem}
                    >
                      <Trash size={20} />
                    </Button>
                  </>
                )}

                {isOwner && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="h-11 px-5 text-base"
                    onClick={() => navigate(`/class/${id}/create-problem`)}
                  >
                    <Plus size={20} className="mr-2" /> Novo
                  </Button>
                )}

                {selectedProblemId && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-11 px-5 text-base whitespace-nowrap"
                    onClick={() => {
                      setShowSubmissions(true);
                      setSelectedStudentFilter(null);
                    }}
                  >
                    {isOwner ? "Ver Turma" : "Meu Histórico"}
                  </Button>
                )}

                <div className="w-px h-8 bg-border mx-2" />

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11" // Aumentado
                  onClick={handleResetCode}
                  title="Resetar Código"
                >
                  <RefreshCw size={20} />
                </Button>

                <Select
                  value={languageId}
                  onChange={(e) => setLanguageId(Number(e.target.value))}
                  className="w-48 h-11 text-base" // Aumentado
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>

                <Button
                  onClick={submitSolution}
                  disabled={loading || !selectedProblemId || isBlocked}
                  isLoading={loading}
                  // CORREÇÃO: whitespace-nowrap impede quebra de linha, h-11 aumenta altura
                  className="h-11 px-8 text-base font-semibold whitespace-nowrap min-w-[140px]"
                >
                  {!loading && (isBlocked ? "Bloqueado" : "Enviar Solução")}
                </Button>
              </div>
            </div>

            {/* Painéis Redimensionáveis */}
            <div className="flex-1 min-h-0">
              <PanelGroup direction="horizontal">
                {/* Editor */}
                <Panel defaultSize={60} minSize={30}>
                  <div className="flex flex-col h-full">
                    {/* Tabs de Arquivos */}
                    <div className="flex-none flex bg-surface border-b border-border overflow-x-auto">
                      {files.map((file, idx) => (
                        <div
                          key={idx}
                          onClick={() => setActiveFileIndex(idx)}
                          className={cn(
                            "px-5 py-3 text-sm cursor-pointer flex items-center gap-3 border-r border-border border-t-2",
                            activeFileIndex === idx
                              ? "bg-background text-zinc-100 border-t-primary"
                              : "bg-surface text-muted border-t-transparent hover:bg-surface-hover",
                          )}
                        >
                          <FileCode size={16} />
                          {file.name}
                          {files.length > 1 && (
                            <Trash
                              size={14}
                              className="hover:text-destructive ml-2"
                              onClick={(e) => handleRemoveFile(idx, e)}
                            />
                          )}
                        </div>
                      ))}
                      <div className="flex items-center px-3">
                        <input
                          className="bg-transparent border-none text-sm text-zinc-100 w-24 focus:outline-none placeholder:text-muted/50"
                          placeholder="+ Novo..."
                          value={newFileName}
                          onChange={(e) => setNewFileName(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && handleAddFile()
                          }
                        />
                      </div>
                    </div>

                    <div className="flex-1 relative">
                      <Editor
                        key={`${languageId}-${displayProblem?.id}-${activeFileIndex}`}
                        height="100%"
                        theme="vs-dark"
                        language={LANGUAGE_MAP[languageId] || "plaintext"}
                        value={files[activeFileIndex]?.content || ""}
                        onChange={handleCodeChange}
                        onMount={handleEditorDidMount}
                        options={{
                          minimap: { enabled: false },
                          automaticLayout: true,
                          fontSize: 16, // Aumento da fonte do editor
                        }}
                      />
                    </div>
                  </div>
                </Panel>

                <PanelResizeHandle className="w-1.5 bg-border hover:bg-primary/50 transition-colors cursor-col-resize" />

                {/* Painel Direito (Info + Output) */}
                <Panel defaultSize={40} minSize={20}>
                  <div className="h-full overflow-y-auto bg-background p-8">
                    {displayProblem ? (
                      <>
                        <h1 className="text-3xl font-bold mb-6">
                          {displayProblem.title}
                        </h1>
                        <div className="prose prose-invert prose-base max-w-none mb-10">
                          <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                            {displayProblem.description}
                          </ReactMarkdown>
                        </div>

                        {/* Test Cases */}
                        <div className="space-y-4 mb-10">
                          <h4 className="text-base font-bold uppercase tracking-wider text-muted">
                            Exemplos
                          </h4>
                          {displayProblem.testCases?.map((tc, idx) => (
                            <div
                              key={idx}
                              className="grid grid-cols-2 gap-6 bg-surface p-4 rounded-lg border border-border"
                            >
                              <div>
                                <div className="text-sm text-muted mb-2 font-semibold">
                                  Entrada
                                </div>
                                <code className="text-base font-mono block bg-black/20 p-2 rounded">
                                  {tc.input}
                                </code>
                              </div>
                              <div>
                                <div className="text-sm text-muted mb-2 font-semibold">
                                  Saída
                                </div>
                                <code className="text-base font-mono block text-emerald-400 bg-black/20 p-2 rounded">
                                  {tc.expectedOutput}
                                </code>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Estatísticas do Exercício (Visível apenas para o Professor) */}
                        {isOwner &&
                          displayProblem &&
                          problemStats.length > 0 && (
                            <div className="mt-10 pt-8 border-t border-border">
                              <h4 className="text-base font-bold uppercase tracking-wider text-muted mb-6 flex items-center gap-2">
                                <BarChartIcon size={20} /> Estatísticas deste
                                Exercício
                              </h4>
                              <div className="h-64 w-full bg-surface border border-border rounded-lg p-4">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart
                                    data={problemStats}
                                    layout="vertical"
                                    margin={{ left: 10, right: 10 }}
                                  >
                                    <XAxis type="number" hide />
                                    <YAxis
                                      dataKey="name"
                                      type="category"
                                      width={100}
                                      tick={{ fontSize: 14, fill: "#a1a1aa" }}
                                      axisLine={false}
                                      tickLine={false}
                                    />
                                    <Tooltip
                                      cursor={{ fill: "transparent" }}
                                      contentStyle={{
                                        backgroundColor: "#18181b",
                                        borderColor: "#27272a",
                                        borderRadius: "6px",
                                        color: "#fff",
                                        fontSize: "14px",
                                      }}
                                      itemStyle={{
                                        color: "#fff",
                                        fontSize: "14px",
                                      }}
                                    />
                                    <Bar
                                      dataKey="value"
                                      barSize={20}
                                      radius={[0, 4, 4, 0]}
                                      shape={(props: any) => {
                                        const { fill, ...rest } = props;
                                        const color =
                                          props.payload.name === "Acertos"
                                            ? "#10b981"
                                            : "#ef4444";
                                        return (
                                          <Rectangle
                                            {...rest}
                                            fill={color}
                                            radius={[0, 4, 4, 0]}
                                          />
                                        );
                                      }}
                                    />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          )}

                        {/* Feedback Area */}
                        {verdict && (
                          <div
                            className={cn(
                              "rounded-xl border p-6 mb-8 mt-8 shadow-sm",
                              verdict === "Accepted"
                                ? "bg-emerald-900/10 border-emerald-500/30"
                                : "bg-red-900/10 border-red-500/30",
                            )}
                          >
                            <div className="flex items-center gap-3 font-bold mb-4 text-xl">
                              {verdict === "Accepted" ? (
                                <CheckCircle
                                  className="text-emerald-500"
                                  size={24}
                                />
                              ) : (
                                <XCircle className="text-red-500" size={24} />
                              )}
                              <span
                                className={
                                  verdict === "Accepted"
                                    ? "text-emerald-500"
                                    : "text-red-500"
                                }
                              >
                                {verdict}
                              </span>
                            </div>

                            {lastSubmission && (
                              <div className="grid grid-cols-2 gap-6 mt-6">
                                <div className="bg-background p-4 rounded-lg border border-border">
                                  <div className="text-sm text-muted mb-2 flex items-center gap-2 font-medium">
                                    <Clock size={16} /> Tempo
                                  </div>
                                  <div className="font-mono text-xl text-white">
                                    {lastSubmission.executionTime}ms
                                  </div>
                                </div>
                                <div className="bg-background p-4 rounded-lg border border-border">
                                  <div className="text-sm text-muted mb-2 flex items-center gap-2 font-medium">
                                    <Cpu size={16} /> Memória
                                  </div>
                                  <div className="font-mono text-xl text-white">
                                    {lastSubmission.memoryUsage}KB
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="mt-6">
                              <div className="text-sm font-bold text-muted mb-3 uppercase tracking-wider">
                                LOGS DO SISTEMA
                              </div>
                              <LogViewer
                                logs={
                                  lastSubmission?.output ||
                                  lastSubmission?.stderr ||
                                  ""
                                }
                                status={
                                  (lastSubmission?.status as any) || "Pending"
                                }
                              />
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted space-y-4">
                        <FileCode size={48} className="opacity-20" />
                        <p className="text-lg">
                          Selecione um exercício no menu superior para começar.
                        </p>
                      </div>
                    )}
                  </div>
                </Panel>
              </PanelGroup>
            </div>
          </div>
        )}

        {/* -- ANALYTICS -- */}
        {activeTab === "analytics" && isOwner && (
          <div className="h-full overflow-y-auto p-8">
            <div className="max-w-7xl mx-auto space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-zinc-100">
                  Desempenho da Turma
                </h2>

                {/* Botão de Exportar */}
                <div className="relative">
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => setShowReportMenu(!showReportMenu)}
                    className="flex items-center h-10 px-4 text-sm"
                  >
                    <Download size={18} className="mr-2" />
                    Exportar Relatório
                    <ChevronDown size={16} className="ml-2 text-muted" />
                  </Button>

                  {showReportMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-surface border border-border rounded-lg shadow-xl z-50 py-1">
                      <button
                        onClick={() => handleExport("csv")}
                        className="w-full text-left px-5 py-3 text-base text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-3 transition-colors"
                      >
                        <FileText size={18} /> Formato CSV
                      </button>
                      <button
                        onClick={() => handleExport("xlsx")}
                        className="w-full text-left px-5 py-3 text-base text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-3 transition-colors"
                      >
                        <FileSpreadsheet size={18} /> Formato Excel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-8">
                <Card className="p-8 bg-surface border-border h-[600px] flex flex-col shadow-md">
                  <h3 className="text-base font-medium text-muted uppercase tracking-wider mb-8">
                    Submissões por Exercício
                  </h3>

                  {stats.length > 0 ? (
                    <div className="flex-1 min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={stats}
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#27272a"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="name"
                            stroke="#a1a1aa"
                            tick={{ fontSize: 14 }}
                            tickLine={false}
                            axisLine={false}
                            dy={10}
                          />
                          <YAxis
                            stroke="#a1a1aa"
                            allowDecimals={false}
                            tick={{ fontSize: 14 }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#18181b",
                              borderColor: "#27272a",
                              color: "#fff",
                              borderRadius: "8px",
                              boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                              fontSize: "14px",
                            }}
                            itemStyle={{ color: "#fff", fontSize: "14px" }}
                            cursor={{ fill: "rgba(255,255,255,0.05)" }}
                          />
                          <Legend wrapperStyle={{ paddingTop: "30px" }} />
                          <Bar
                            dataKey="Accepted"
                            name="Sucesso"
                            fill="#10b981"
                            radius={[6, 6, 0, 0]}
                            barSize={50}
                          />
                          <Bar
                            dataKey="Error"
                            name="Erros / Falhas"
                            fill="#ef4444"
                            radius={[6, 6, 0, 0]}
                            barSize={50}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted space-y-4">
                      <BarChartIcon size={64} className="opacity-20" />
                      <p className="text-lg">
                        Ainda não há dados suficientes para gerar gráficos.
                      </p>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- OVERLAYS --- */}
      {showSubmissions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <div className="bg-[#09090b] w-full max-w-5xl max-h-[90vh] rounded-xl border border-zinc-800 flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-surface">
              <h3 className="text-2xl font-semibold text-white flex items-center gap-3">
                <Clock size={24} className="text-primary" />
                Histórico de Envios
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSubmissions(false)}
                className="h-10 w-10"
              >
                <XCircle size={24} />
              </Button>
            </div>

            {/* Filtros */}
            {isOwner && (
              <div className="p-4 border-b border-zinc-800 bg-surface/50 flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-muted font-medium uppercase tracking-wider">
                  <Filter size={16} /> Filtros:
                </div>
                <Select
                  className="w-72 h-10 text-base"
                  value={selectedStudentFilter || ""}
                  onChange={(e) =>
                    setSelectedStudentFilter(Number(e.target.value) || null)
                  }
                >
                  <option value="">Todos os Alunos</option>
                  {classroom?.students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.email}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {/* Lista */}
            <div className="flex-1 overflow-y-auto p-0">
              <table className="w-full text-base text-left">
                <thead className="text-sm text-muted uppercase bg-surface sticky top-0">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Data</th>
                    <th className="px-6 py-4 font-semibold">Tempo</th>
                    <th className="px-6 py-4 font-semibold">Memória</th>
                    {isOwner && (
                      <th className="px-6 py-4 font-semibold">Aluno</th>
                    )}
                    <th className="px-6 py-4 text-right font-semibold">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {submissions
                    .filter(
                      (s) =>
                        !selectedStudentFilter ||
                        s.user.id === selectedStudentFilter,
                    )
                    .map((sub) => (
                      <tr
                        key={sub.id}
                        className="hover:bg-zinc-900/50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              "px-3 py-1.5 rounded-full text-xs font-bold border",
                              sub.status === "Accepted"
                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                : sub.status.includes("Error")
                                  ? "bg-red-500/10 text-red-500 border-red-500/20"
                                  : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
                            )}
                          >
                            {sub.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-zinc-300">
                          {new Date(sub.createdAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-zinc-400 font-mono">
                          {sub.executionTime}ms
                        </td>
                        <td className="px-6 py-4 text-zinc-400 font-mono">
                          {sub.memoryUsage}KB
                        </td>
                        {isOwner && (
                          <td className="px-6 py-4 text-zinc-300">
                            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold">
                                {sub.user.email.charAt(0).toUpperCase()}
                              </div>
                              <span className="truncate max-w-[180px]">
                                {sub.user.email}
                              </span>
                            </div>
                          </td>
                        )}
                        <td className="px-6 py-4 text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 text-sm"
                            onClick={() => handleStartInspection(sub)}
                          >
                            {isOwner ? "Avaliar" : "Detalhes"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  {submissions.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-12 text-center text-muted text-base"
                      >
                        Nenhuma submissão encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: DETALHES/NOTAS (OVERLAY) --- */}
      {(inspectingUser || showModal) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-6">
          <div className="bg-[#09090b] w-full max-w-7xl h-[90vh] rounded-xl border border-zinc-800 flex flex-col shadow-2xl overflow-hidden">
            {/* Header Inspeção */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-surface">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">
                  {isOwner && inspectingUser
                    ? `Avaliando: ${inspectingUser.email}`
                    : "Detalhes da Submissão"}
                </h2>
                <p className="text-sm text-muted">
                  {activeSubmission
                    ? `Enviado em ${new Date(activeSubmission.createdAt).toLocaleString()}`
                    : selectedSubmission
                      ? `Enviado em ${new Date(selectedSubmission.createdAt).toLocaleString()}`
                      : ""}
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                className="h-9 px-4 text-sm"
                onClick={() => {
                  setInspectingUser(null);
                  setShowModal(false);
                  setSelectedSubmission(null);
                }}
              >
                Fechar
              </Button>
            </div>

            <div className="flex-1 flex min-h-0">
              {/* Lado Esquerdo: Código */}
              <div className="flex-1 border-r border-zinc-800 flex flex-col">
                <div className="bg-zinc-900 p-3 border-b border-zinc-800 text-sm text-muted flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode size={18} />
                    Visualizador de Código
                  </div>

                  {/* Navegação de arquivos na inspeção */}
                  {(activeSubmission?.files?.length || 0) > 1 && (
                    <div className="flex bg-black/20 rounded overflow-hidden">
                      {activeSubmission?.files.map((f, idx) => (
                        <button
                          key={idx}
                          onClick={() => setInspectFileIndex(idx)}
                          className={cn(
                            "px-3 py-1.5 text-xs font-medium hover:bg-white/5 transition-colors",
                            inspectFileIndex === idx
                              ? "text-primary bg-white/5"
                              : "text-muted",
                          )}
                        >
                          {f.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex-1 relative">
                  <Editor
                    height="100%"
                    width="100%"
                    theme="vs-dark"
                    language="python"
                    value={
                      (isOwner &&
                        activeSubmission?.files[inspectFileIndex]?.content) ||
                      selectedSubmission?.files[inspectFileIndex]?.content ||
                      "// Código não disponível"
                    }
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      fontSize: 16, // Fonte aumentada
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                    }}
                  />
                </div>
              </div>

              {/* Lado Direito: Feedback e Notas */}
              <div className="w-[450px] bg-surface flex flex-col p-6 overflow-y-auto border-l border-zinc-800">
                <div className="space-y-8">
                  {/* Status Card */}
                  <Card className="bg-zinc-900 border-zinc-800 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-muted uppercase font-bold tracking-wider">
                        Veredito
                      </span>
                      {(activeSubmission?.status ||
                        selectedSubmission?.status) === "Accepted" ? (
                        <CheckCircle size={20} className="text-emerald-500" />
                      ) : (
                        <XCircle size={20} className="text-red-500" />
                      )}
                    </div>
                    <div
                      className={cn(
                        "text-2xl font-bold",
                        (activeSubmission?.status ||
                          selectedSubmission?.status) === "Accepted"
                          ? "text-emerald-500"
                          : "text-red-500",
                      )}
                    >
                      {activeSubmission?.status || selectedSubmission?.status}
                    </div>
                  </Card>

                  {/* Logs */}
                  <div>
                    <h4 className="text-base font-bold text-white mb-3">
                      Saída / Logs
                    </h4>
                    <div className="bg-black rounded-lg p-4 text-sm font-mono text-zinc-300 max-h-60 overflow-y-auto border border-zinc-800">
                      <pre>
                        {activeSubmission?.output ||
                          selectedSubmission?.output ||
                          "Sem saída."}
                      </pre>
                    </div>
                  </div>

                  {/* Área de Nota (Apenas Professor) */}
                  {isOwner && (
                    <div className="pt-8 border-t border-zinc-800 space-y-6">
                      <h4 className="text-lg font-bold text-white flex items-center gap-2">
                        <Settings size={20} /> Avaliação Manual
                      </h4>

                      <div className="space-y-2.5">
                        <label className="text-sm text-muted font-medium">
                          Nota (0-10)
                        </label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={gradingGrade}
                          onChange={(e) => setGradingGrade(e.target.value)}
                          className="h-11 text-base"
                        />
                      </div>

                      <div className="space-y-2.5">
                        <label className="text-sm text-muted font-medium">
                          Comentários
                        </label>
                        <textarea
                          className="w-full bg-black/20 border border-zinc-800 rounded-lg p-3 text-base text-white resize-none h-32 focus:outline-none focus:border-primary transition-colors"
                          placeholder="Feedback para o aluno..."
                          value={gradingComment}
                          onChange={(e) => setGradingComment(e.target.value)}
                        />
                      </div>

                      <Button
                        className="w-full h-11 text-base"
                        onClick={handleSaveGrade}
                      >
                        Salvar Avaliação
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
