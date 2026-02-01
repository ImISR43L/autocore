import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
} from "lucide-react";
import { io } from "socket.io-client";
import { DiffViewer } from "../components/DiffViewer";
import LogViewer from "../components/LogViewer";

import "highlight.js/styles/atom-one-dark.css";
import "../App.css";

// --- INTERFACES ---
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

  // UI & Execução
  const [verdict, setVerdict] = useState<string | null>(null);
  // REMOVIDO: executionOutput e executionError (não usados)

  const [loading, setLoading] = useState<boolean>(false);
  const loadingRef = useRef(false);
  const [showSubmissions, setShowSubmissions] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  // --- FILTRO DE SUBMISSÕES ---
  const [selectedStudentFilter, setSelectedStudentFilter] = useState<
    number | null
  >(null);
  const [studentSearch, setStudentSearch] = useState("");

  // INSPEÇÃO
  const [inspectingUser, setInspectingUser] = useState<{
    id: number;
    email: string;
  } | null>(null);
  const [studentSubmissions, setStudentSubmissions] = useState<
    Record<string, Submission>
  >({});
  const [activeInspectionIndex, setActiveInspectionIndex] = useState(0);
  const [inspectFileIndex, setInspectFileIndex] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterActivity, setFilterActivity] = useState<string[]>([]);
  const [showFilterMenu, setShowFilterMenu] = useState<
    "status" | "activity" | null
  >(null);

  // Modal de Detalhes
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
  }, [languageId]);

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
        // REMOVIDO: setters de executionOutput/Error
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
    // REMOVIDO: setters de executionOutput/Error
    setLoading(false);
    loadingRef.current = false;
  }, [displayProblem?.id]);

  const handleCodeChange = (value: string | undefined) => {
    const val = value || "";
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

  // Esta função agora é usada tanto para inspecionar quanto para abrir o modal de detalhes
  const handleStartInspection = async (targetSubmission: Submission) => {
    // Se for dono (professor), abre o fluxo de inspeção
    if (isOwner) {
      setInspectingUser(targetSubmission.user);
      setStudentSubmissions({});
      setInspectFileIndex(0);
      // ... lógica de inspeção existente ...
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
      // Se for aluno, abre o modal de detalhes simples
      setSelectedSubmission(targetSubmission);
      setShowModal(true);
    }
  };

  const handleInspectionTabChange = (index: number) => {
    setActiveInspectionIndex(index);
    setInspectFileIndex(0);
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

  const handleEditProblem = () => {
    if (selectedProblemId && classroom) {
      const p = classroom.problems.find((p) => p.id === selectedProblemId);
      if (p)
        navigate("/create-problem", {
          state: { classroomId: classroom.id, problemToEdit: p },
        });
    }
  };

  const submitSolution = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!displayProblem) return toast.warning("Selecione um exercício!");

    setLoading(true);
    loadingRef.current = true;

    setVerdict("Processando...");
    // REMOVIDO: setters de executionOutput/Error

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
    // Pega a última submissão (ordenada por data decrescente pelo backend geralmente, mas podemos garantir aqui)
    return (
      submissions
        .filter((s) => s.user?.id === myUserId)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )[0] || null
    );
  }, [submissions, myUserId]);

  if (!classroom) return <div className="container">Carregando...</div>;

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
            <ArrowLeft size={20} />
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

      {/* -- STREAMS, PEOPLE -- */}
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

      {/* -- CLASSWORK (IDE COM ABAS) -- */}
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
                  {examStatus === "WAITING" ? (
                    "⏳ Aguardando"
                  ) : examStatus === "FINISHED" ? (
                    "🛑 Encerrado"
                  ) : (
                    <>
                      <Clock size={16} /> Tempo Restante:
                    </>
                  )}
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
                onClick={() => {
                  setShowSubmissions(true);
                  setSelectedStudentFilter(null);
                }}
                className="btn btn-secondary"
                style={{ marginLeft: "10px", backgroundColor: "#444" }}
                title={
                  isOwner ? "Ver submissões da turma" : "Ver meu histórico"
                }
              >
                📊 {isOwner ? "Turma" : "Histórico"}
              </button>
            )}

            {isOwner && (
              <div
                style={{
                  position: "relative",
                  display: "inline-block",
                  marginLeft: "10px",
                }}
              >
                <button
                  onClick={() => setShowReportMenu(!showReportMenu)}
                  className="btn"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    backgroundColor: "#2e7d32",
                    color: "white",
                    padding: "8px 16px",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  <Download size={16} />
                  Gerar Relatório
                  <ChevronDown size={16} />
                </button>

                {showReportMenu && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      right: 0,
                      marginTop: "5px",
                      backgroundColor: "#1e1e1e",
                      border: "1px solid #444",
                      borderRadius: "6px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                      zIndex: 1000,
                      minWidth: "160px",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <button
                      onClick={() => handleExport("xlsx")}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "12px 16px",
                        background: "transparent",
                        border: "none",
                        color: "#e0e0e0",
                        cursor: "pointer",
                        textAlign: "left",
                        borderBottom: "1px solid #333",
                        fontSize: "0.9rem",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "#2d2d30")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <FileSpreadsheet size={16} className="text-green-500" />
                      Excel (.xlsx)
                    </button>

                    <button
                      onClick={() => handleExport("csv")}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "12px 16px",
                        background: "transparent",
                        border: "none",
                        color: "#e0e0e0",
                        cursor: "pointer",
                        textAlign: "left",
                        fontSize: "0.9rem",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "#2d2d30")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <FileText size={16} className="text-gray-400" />
                      CSV (.csv)
                    </button>
                  </div>
                )}
                {showReportMenu && (
                  <div
                    style={{
                      position: "fixed",
                      top: 0,
                      left: 0,
                      width: "100vw",
                      height: "100vh",
                      zIndex: 999,
                    }}
                    onClick={() => setShowReportMenu(false)}
                  />
                )}
              </div>
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
                        currentProblem.deadline,
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
                type="button"
                onClick={(e) => submitSolution(e)}
                disabled={loading || !selectedProblemId || isBlocked}
                className="btn btn-primary"
                style={
                  isBlocked
                    ? { opacity: 0.5, cursor: "not-allowed" }
                    : { display: "flex", alignItems: "center", gap: "8px" }
                }
              >
                {/* Ícone de Loading Animado */}
                {loading && <RefreshCw className="animate-spin" size={16} />}
                {loading ? "Processando..." : isBlocked ? "🔒" : "▶ Enviar"}
              </button>
            </div>
          </div>

          <div className="ide-main">
            <div
              className="ide-editor-panel"
              style={{ display: "flex", flexDirection: "column" }}
            >
              {/* --- ABAS DE ARQUIVOS (ATUALIZADO) --- */}
              <div
                style={{
                  display: "flex",
                  background: "#252526",
                  borderBottom: "1px solid #333",
                  overflowX: "auto",
                  alignItems: "center",
                }}
              >
                {files.map((file, idx) => (
                  <div
                    key={idx}
                    onClick={() => setActiveFileIndex(idx)}
                    style={{
                      padding: "8px 16px",
                      cursor: "pointer",
                      background:
                        activeFileIndex === idx ? "#1e1e1e" : "transparent",
                      color: activeFileIndex === idx ? "#fff" : "#888",
                      borderTop:
                        activeFileIndex === idx
                          ? "2px solid #4caf50"
                          : "2px solid transparent",
                      fontSize: "0.9rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      borderRight: "1px solid #333",
                    }}
                  >
                    <FileCode size={14} />
                    {file.name}
                    {/* Botão Remover (Trash) */}
                    {files.length > 1 && (
                      <Trash
                        size={12}
                        className="hover:text-red-500"
                        onClick={(e) => handleRemoveFile(idx, e)}
                      />
                    )}
                  </div>
                ))}

                {/* Área de Adicionar Novo Arquivo (Plus) */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "0 8px",
                    gap: "5px",
                  }}
                >
                  <input
                    style={{
                      background: "#333",
                      border: "none",
                      color: "white",
                      padding: "4px",
                      fontSize: "0.8rem",
                      width: "100px",
                      borderRadius: "4px",
                    }}
                    placeholder="Novo arquivo..."
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddFile()}
                  />
                  <Plus
                    size={16}
                    className="text-emerald-500 cursor-pointer hover:text-emerald-400"
                    onClick={handleAddFile}
                  />
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <Editor
                  key={`${languageId}-${displayProblem?.id || "empty"}-${activeFileIndex}`}
                  height="100%"
                  language={
                    files[activeFileIndex]?.name.endsWith(".js")
                      ? "javascript"
                      : files[activeFileIndex]?.name.endsWith(".java")
                        ? "java"
                        : files[activeFileIndex]?.name.endsWith(".c")
                          ? "c"
                          : files[activeFileIndex]?.name.endsWith(".cpp")
                            ? "cpp"
                            : files[activeFileIndex]?.name.endsWith(".go")
                              ? "go"
                              : LANGUAGE_MAP[languageId] || "plaintext"
                  }
                  theme="vs-dark"
                  value={files[activeFileIndex]?.content || ""}
                  onChange={handleCodeChange}
                  options={{
                    minimap: { enabled: false },
                    automaticLayout: true,
                  }}
                />
              </div>
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
                        {displayProblem.testCases.map((tc, index) => (
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
                        ))}
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
                    verdict === "Accepted"
                      ? "success"
                      : ["Queued", "Processing"].includes(verdict)
                        ? "warning"
                        : "error"
                  }`}
                >
                  <div className="feedback-header">
                    {lastSubmission && (
                      <div
                        className={`mt-4 p-4 rounded-lg border ${
                          lastSubmission.status === "Accepted"
                            ? "border-green-500 bg-green-900/20"
                            : lastSubmission.status === "Processing"
                              ? "border-yellow-500 bg-yellow-900/20"
                              : "border-red-500 bg-red-900/20"
                        }`}
                      >
                        <h3 className="font-bold mb-2 flex items-center gap-2">
                          Resultado:{" "}
                          <span
                            className={
                              lastSubmission.status === "Accepted"
                                ? "text-green-400"
                                : "text-red-400"
                            }
                          >
                            {lastSubmission.status}
                          </span>
                        </h3>

                        {lastSubmission.status === "Wrong Answer" &&
                        lastSubmission.stdout ? (
                          <DiffViewer
                            expected="Esperado..."
                            actual={lastSubmission.stdout}
                          /> // Simplificado
                        ) : null}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-[#161616] p-4 rounded-lg border border-[#333]">
                      <div className="text-gray-500 text-xs uppercase font-bold mb-1 flex items-center gap-2">
                        <Clock size={12} /> Tempo
                      </div>
                      <div className="text-2xl font-mono text-white flex items-baseline gap-1">
                        {lastSubmission?.executionTime ?? 0}{" "}
                        <span className="text-sm text-gray-600">ms</span>
                      </div>
                    </div>
                    <div className="bg-[#161616] p-4 rounded-lg border border-[#333]">
                      <div className="text-gray-500 text-xs uppercase font-bold mb-1 flex items-center gap-2">
                        <Cpu size={12} /> Memória
                      </div>
                      <div className="text-2xl font-mono text-white flex items-baseline gap-1">
                        {lastSubmission?.memoryUsage ?? 0}{" "}
                        <span className="text-sm text-gray-600">KB</span>
                      </div>
                    </div>
                  </div>

                  {/* Log Viewer Unificado com correções de tipo e verificação de nulo */}
                  <div>
                    <h4 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2">
                      <FileText size={16} /> LOGS DE EXECUÇÃO
                    </h4>

                    <LogViewer
                      logs={
                        lastSubmission?.output ||
                        lastSubmission?.stderr ||
                        lastSubmission?.stdout ||
                        ""
                      }
                      status={
                        !lastSubmission ||
                        lastSubmission.status === "Processing" ||
                        lastSubmission.status === "Internal Error"
                          ? "Pending"
                          : (lastSubmission.status as any)
                      }
                    />
                  </div>

                  {/* Código Fonte */}
                  <div>
                    <h4 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2">
                      <FileCode size={16} /> CÓDIGO FONTE
                    </h4>
                    <div className="border border-[#333] rounded-lg overflow-hidden">
                      <Editor
                        height="300px"
                        theme="vs-dark"
                        language="python"
                        value={
                          lastSubmission?.files?.[0]?.content ||
                          "// Código não disponível ou formato antigo."
                        }
                        options={{
                          readOnly: true,
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          fontFamily: "'Fira Code', monospace",
                          fontSize: 14,
                          padding: { top: 16 },
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* --- MODAIS DE INSPEÇÃO E LISTAGEM --- */}
          {showSubmissions && (
            <div className="modal-overlay">
              <div
                className="modal-content large"
                style={{
                  height: "80vh",
                  display: "flex",
                  flexDirection: "column",
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
                  <h2>
                    {isOwner ? "Correção e Acompanhamento" : "Meu Histórico"}
                  </h2>
                  <button
                    onClick={() => setShowSubmissions(false)}
                    className="btn btn-secondary"
                  >
                    Fechar
                  </button>
                </div>

                {isOwner ? (
                  /* --- VISÃO DO PROFESSOR: SPLIT VIEW (LISTA DE ALUNOS | DETALHES) --- */
                  <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                    {/* COLUNA DA ESQUERDA: LISTA DE ALUNOS */}
                    <div
                      style={{
                        width: "300px",
                        borderRight: "1px solid #333",
                        background: "#1e1e1e",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <div
                        style={{
                          padding: "10px",
                          borderBottom: "1px solid #333",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            background: "#333",
                            padding: "5px 10px",
                            borderRadius: "4px",
                          }}
                        >
                          <Search size={16} color="#888" />
                          <input
                            placeholder="Buscar aluno..."
                            value={studentSearch}
                            onChange={(e) => setStudentSearch(e.target.value)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "white",
                              width: "100%",
                              outline: "none",
                            }}
                          />
                        </div>
                      </div>
                      <div style={{ flex: 1, overflowY: "auto" }}>
                        {filteredStudents.map((student) => {
                          const studentSubs = submissions.filter(
                            (s) => s.user.id === student.id,
                          );
                          const hasAccepted = studentSubs.some(
                            (s) => s.status === "Accepted",
                          );
                          const hasError =
                            studentSubs.length > 0 && !hasAccepted;
                          const hasNone = studentSubs.length === 0;

                          return (
                            <div
                              key={student.id}
                              onClick={() =>
                                setSelectedStudentFilter(student.id)
                              }
                              style={{
                                padding: "12px 15px",
                                cursor: "pointer",
                                background:
                                  selectedStudentFilter === student.id
                                    ? "#2d2d30"
                                    : "transparent",
                                borderLeft:
                                  selectedStudentFilter === student.id
                                    ? "3px solid #4caf50"
                                    : "3px solid transparent",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                transition: "background 0.2s",
                              }}
                              className="hover:bg-white/5"
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "10px",
                                  overflow: "hidden",
                                }}
                              >
                                <div
                                  style={{
                                    width: "30px",
                                    height: "30px",
                                    borderRadius: "50%",
                                    background: "#444",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "0.8rem",
                                    flexShrink: 0,
                                  }}
                                >
                                  {student.email.charAt(0).toUpperCase()}
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    overflow: "hidden",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: "0.9rem",
                                      color: "#fff",
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                    }}
                                  >
                                    {student.email.split("@")[0]}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: "0.75rem",
                                      color: "#888",
                                    }}
                                  >
                                    {studentSubs.length} envios
                                  </span>
                                </div>
                              </div>

                              {hasAccepted ? (
                                <CheckCircle
                                  size={18}
                                  className="text-green-500"
                                />
                              ) : hasError ? (
                                <XCircle size={18} className="text-red-500" />
                              ) : hasNone ? (
                                <div
                                  style={{
                                    width: "8px",
                                    height: "8px",
                                    borderRadius: "50%",
                                    background: "#444",
                                  }}
                                  title="Nenhum envio"
                                />
                              ) : null}
                            </div>
                          );
                        })}
                        {filteredStudents.length === 0 && (
                          <div
                            style={{
                              padding: "20px",
                              textAlign: "center",
                              color: "#666",
                              fontSize: "0.9rem",
                            }}
                          >
                            Nenhum aluno encontrado.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* COLUNA DA DIREITA: DETALHES DAS SUBMISSÕES */}
                    <div
                      style={{
                        flex: 1,
                        overflowY: "auto",
                        background: "#111",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      {selectedStudentFilter ? (
                        (() => {
                          const studentRawSubmissions = submissions.filter(
                            (s) => s.user.id === selectedStudentFilter,
                          );

                          const uniqueStatuses = Array.from(
                            new Set(studentRawSubmissions.map((s) => s.status)),
                          );

                          const uniqueProblemIds = Array.from(
                            new Set(
                              studentRawSubmissions.map(
                                (s) => s.problem?.id || s.problemId || "",
                              ),
                            ),
                          );
                          const problemMap = new Map<string, string>();

                          if (currentProblem) {
                            problemMap.set(
                              currentProblem.id,
                              currentProblem.title,
                            );
                            currentProblem.children?.forEach((child) =>
                              problemMap.set(child.id, child.title),
                            );
                          }

                          const filteredList = studentRawSubmissions.filter(
                            (sub) => {
                              const pId =
                                sub.problem?.id || sub.problemId || "";

                              const matchesStatus =
                                filterStatus.length === 0 ||
                                filterStatus.includes(sub.status);
                              const matchesActivity =
                                filterActivity.length === 0 ||
                                filterActivity.includes(pId);

                              return matchesStatus && matchesActivity;
                            },
                          );

                          return (
                            <div
                              style={{
                                padding: "20px",
                                display: "flex",
                                flexDirection: "column",
                                height: "100%",
                              }}
                            >
                              <div style={{ marginBottom: "20px" }}>
                                <h3
                                  style={{
                                    marginTop: 0,
                                    marginBottom: "15px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "10px",
                                  }}
                                >
                                  <User size={20} />
                                  Submissões de{" "}
                                  {
                                    classroom.students.find(
                                      (s) => s.id === selectedStudentFilter,
                                    )?.email
                                  }
                                </h3>

                                <div
                                  style={{
                                    display: "flex",
                                    gap: "10px",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <div style={{ position: "relative" }}>
                                    <button
                                      className="btn btn-sm btn-secondary"
                                      onClick={() =>
                                        setShowFilterMenu(
                                          showFilterMenu === "status"
                                            ? null
                                            : "status",
                                        )
                                      }
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        background:
                                          filterStatus.length > 0
                                            ? "#2e7d32"
                                            : "#333",
                                        color: "white",
                                      }}
                                    >
                                      <Filter size={14} />
                                      Resultado{" "}
                                      {filterStatus.length > 0 &&
                                        `(${filterStatus.length})`}
                                      <ChevronDown size={14} />
                                    </button>

                                    {showFilterMenu === "status" && (
                                      <div
                                        style={{
                                          position: "absolute",
                                          top: "100%",
                                          left: 0,
                                          marginTop: "5px",
                                          background: "#252526",
                                          border: "1px solid #444",
                                          borderRadius: "6px",
                                          padding: "10px",
                                          zIndex: 10,
                                          minWidth: "200px",
                                          boxShadow:
                                            "0 4px 12px rgba(0,0,0,0.5)",
                                        }}
                                      >
                                        {uniqueStatuses.map((status) => (
                                          <label
                                            key={status}
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              gap: "8px",
                                              padding: "5px 0",
                                              cursor: "pointer",
                                              color: "#ccc",
                                            }}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={filterStatus.includes(
                                                status,
                                              )}
                                              onChange={(e) => {
                                                if (e.target.checked)
                                                  setFilterStatus([
                                                    ...filterStatus,
                                                    status,
                                                  ]);
                                                else
                                                  setFilterStatus(
                                                    filterStatus.filter(
                                                      (s) => s !== status,
                                                    ),
                                                  );
                                              }}
                                            />
                                            <span
                                              className={`status-badge ${status === "Accepted" ? "success" : "error"}`}
                                              style={{
                                                fontSize: "0.75rem",
                                                padding: "2px 6px",
                                              }}
                                            >
                                              {status}
                                            </span>
                                          </label>
                                        ))}
                                        {uniqueStatuses.length === 0 && (
                                          <span
                                            style={{
                                              color: "#666",
                                              fontSize: "0.8rem",
                                            }}
                                          >
                                            Sem dados
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {uniqueProblemIds.length > 1 && (
                                    <div style={{ position: "relative" }}>
                                      <button
                                        className="btn btn-sm btn-secondary"
                                        onClick={() =>
                                          setShowFilterMenu(
                                            showFilterMenu === "activity"
                                              ? null
                                              : "activity",
                                          )
                                        }
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "6px",
                                          background:
                                            filterActivity.length > 0
                                              ? "#2e7d32"
                                              : "#333",
                                          color: "white",
                                        }}
                                      >
                                        <FileCode size={14} />
                                        Atividade{" "}
                                        {filterActivity.length > 0 &&
                                          `(${filterActivity.length})`}
                                        <ChevronDown size={14} />
                                      </button>

                                      {showFilterMenu === "activity" && (
                                        <div
                                          style={{
                                            position: "absolute",
                                            top: "100%",
                                            left: 0,
                                            marginTop: "5px",
                                            background: "#252526",
                                            border: "1px solid #444",
                                            borderRadius: "6px",
                                            padding: "10px",
                                            zIndex: 10,
                                            minWidth: "250px",
                                            boxShadow:
                                              "0 4px 12px rgba(0,0,0,0.5)",
                                          }}
                                        >
                                          {uniqueProblemIds.map((pId) => (
                                            <label
                                              key={pId}
                                              style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "8px",
                                                padding: "5px 0",
                                                cursor: "pointer",
                                                color: "#ccc",
                                              }}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={filterActivity.includes(
                                                  pId,
                                                )}
                                                onChange={(e) => {
                                                  if (e.target.checked)
                                                    setFilterActivity([
                                                      ...filterActivity,
                                                      pId,
                                                    ]);
                                                  else
                                                    setFilterActivity(
                                                      filterActivity.filter(
                                                        (id) => id !== pId,
                                                      ),
                                                    );
                                                }}
                                              />
                                              <span
                                                style={{
                                                  fontSize: "0.85rem",
                                                  overflow: "hidden",
                                                  textOverflow: "ellipsis",
                                                  whiteSpace: "nowrap",
                                                }}
                                              >
                                                {problemMap.get(pId) ||
                                                  "Desconhecido"}
                                              </span>
                                            </label>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {(filterStatus.length > 0 ||
                                    filterActivity.length > 0) && (
                                    <button
                                      className="btn btn-sm btn-ghost"
                                      onClick={() => {
                                        setFilterStatus([]);
                                        setFilterActivity([]);
                                      }}
                                      style={{ color: "#f44336" }}
                                    >
                                      Limpar
                                    </button>
                                  )}
                                </div>

                                {showFilterMenu && (
                                  <div
                                    style={{
                                      position: "fixed",
                                      top: 0,
                                      left: 0,
                                      width: "100vw",
                                      height: "100vh",
                                      zIndex: 5,
                                    }}
                                    onClick={() => setShowFilterMenu(null)}
                                  />
                                )}
                              </div>

                              <div style={{ flex: 1, overflowY: "auto" }}>
                                <table className="custom-table">
                                  <thead>
                                    <tr>
                                      <th>Atividade</th>
                                      <th>Status</th>
                                      <th>Nota</th>
                                      <th>Data</th>
                                      <th>Ação</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {filteredList.map((sub) => {
                                      const pId =
                                        sub.problem?.id || sub.problemId || "";
                                      const pTitle =
                                        problemMap.get(pId) || "Principal";

                                      return (
                                        <tr key={sub.id}>
                                          <td
                                            style={{
                                              maxWidth: "150px",
                                              overflow: "hidden",
                                              textOverflow: "ellipsis",
                                              whiteSpace: "nowrap",
                                              color: "#aaa",
                                              fontSize: "0.85rem",
                                            }}
                                          >
                                            {pTitle}
                                          </td>
                                          <td>
                                            <span
                                              className={`status-badge ${sub.status === "Accepted" ? "success" : "error"}`}
                                            >
                                              {sub.status}
                                            </span>
                                          </td>
                                          <td>{sub.grade ?? "-"}</td>
                                          <td>
                                            {new Date(
                                              sub.createdAt,
                                            ).toLocaleString()}
                                          </td>
                                          <td>
                                            <button
                                              className="btn btn-sm btn-primary"
                                              onClick={() =>
                                                handleStartInspection(sub)
                                              }
                                            >
                                              Inspecionar
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                    {filteredList.length === 0 && (
                                      <tr>
                                        <td
                                          colSpan={5}
                                          style={{
                                            textAlign: "center",
                                            padding: "30px",
                                            color: "#666",
                                          }}
                                        >
                                          {studentRawSubmissions.length === 0
                                            ? "Este aluno ainda não realizou submissões."
                                            : "Nenhuma submissão corresponde aos filtros."}
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            height: "100%",
                            color: "#444",
                          }}
                        >
                          <User
                            size={48}
                            style={{ marginBottom: "15px", opacity: 0.5 }}
                          />
                          <p>
                            Selecione um aluno na lista ao lado para ver o
                            histórico.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "20px", overflowY: "auto" }}>
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Status</th>
                          <th>Nota</th>
                          <th>Data</th>
                          <th>Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {submissions
                          .filter((sub) => sub.user?.id === myUserId)
                          .map((sub) => (
                            <tr key={sub.id}>
                              <td>
                                <span
                                  className={`status-badge ${
                                    sub.status === "Accepted"
                                      ? "success"
                                      : "error"
                                  }`}
                                >
                                  {sub.status}
                                </span>
                              </td>
                              <td>{sub.grade ?? "-"}</td>
                              <td>
                                {new Date(sub.createdAt).toLocaleString()}
                              </td>
                              <td>
                                <button
                                  className="btn btn-sm btn-primary"
                                  onClick={() => handleStartInspection(sub)}
                                >
                                  Ver Código
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
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
                        {currentProblem.children.map((child, index) => (
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
                            }}
                          >
                            <div style={{ fontSize: "0.9rem", color: "#fff" }}>
                              Q{index + 1}: {child.title}
                            </div>
                          </div>
                        ))}
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
                          style={{
                            display: "flex",
                            background: "#252526",
                            borderBottom: "1px solid #333",
                          }}
                        >
                          {activeSubmission.files &&
                          activeSubmission.files.length > 0 ? (
                            activeSubmission.files.map((file, idx) => (
                              <div
                                key={idx}
                                onClick={() => setInspectFileIndex(idx)}
                                style={{
                                  padding: "8px 16px",
                                  cursor: "pointer",
                                  background:
                                    inspectFileIndex === idx
                                      ? "#1e1e1e"
                                      : "transparent",
                                  color:
                                    inspectFileIndex === idx ? "#fff" : "#888",
                                  borderTop:
                                    inspectFileIndex === idx
                                      ? "2px solid #4caf50"
                                      : "2px solid transparent",
                                  fontSize: "0.85rem",
                                }}
                              >
                                {file.name}
                              </div>
                            ))
                          ) : (
                            <div style={{ padding: "8px", color: "#666" }}>
                              Sem arquivos (Legacy)
                            </div>
                          )}
                        </div>

                        <div
                          style={{ flex: 1, borderBottom: "1px solid #333" }}
                        >
                          <Editor
                            height="100%"
                            theme="vs-dark"
                            value={
                              activeSubmission.files?.[inspectFileIndex]
                                ?.content || "// Código não disponível"
                            }
                            options={{
                              readOnly: true,
                              minimap: { enabled: false },
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
                              }}
                            >
                              Output
                            </h4>
                            {/* --- CORREÇÃO: Usando LogViewer aqui também --- */}
                            <LogViewer
                              logs={
                                activeSubmission.output ||
                                activeSubmission.stdout ||
                                ""
                              }
                              status={activeSubmission.status as any}
                            />
                          </div>
                          {(isOwner || activeSubmission.grade != null) && (
                            <div style={{ width: "300px" }}>
                              <h4 style={{ marginTop: 0, color: "#4caf50" }}>
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
                                  <input
                                    className="form-input"
                                    type="number"
                                    value={gradingGrade}
                                    onChange={(e) =>
                                      setGradingGrade(e.target.value)
                                    }
                                    placeholder="Nota"
                                  />
                                  <textarea
                                    className="form-textarea"
                                    rows={3}
                                    value={gradingComment}
                                    onChange={(e) =>
                                      setGradingComment(e.target.value)
                                    }
                                    placeholder="Comentário"
                                  />
                                  <button
                                    onClick={handleSaveGrade}
                                    className="btn btn-primary btn-sm"
                                  >
                                    Salvar Nota
                                  </button>
                                </div>
                              ) : (
                                <div>
                                  <strong>
                                    {activeSubmission.grade ?? "-"}
                                  </strong>{" "}
                                  / 100
                                  <p>{activeSubmission.teacherComment}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full text-zinc-500">
                        Selecione uma submissão
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal Simples de Detalhes (Aluno) */}
          {showModal && selectedSubmission && (
            <div className="modal-overlay" style={{ zIndex: 1200 }}>
              <div
                className="modal-content large"
                style={{
                  height: "80vh",
                  display: "flex",
                  flexDirection: "column",
                  padding: 0,
                  overflow: "hidden",
                }}
              >
                <div className="modal-header" style={{ padding: "15px 20px" }}>
                  <h3>Detalhes da Submissão</h3>
                  <button
                    onClick={() => setShowModal(false)}
                    className="btn btn-secondary"
                  >
                    Fechar
                  </button>
                </div>
                <div style={{ padding: "20px", overflowY: "auto", flex: 1 }}>
                  {/* Reuse metrics logic here if needed */}
                  <LogViewer
                    logs={
                      selectedSubmission.output ||
                      selectedSubmission.stdout ||
                      ""
                    }
                    status={selectedSubmission.status as any}
                  />
                  <div
                    style={{
                      marginTop: "20px",
                      height: "300px",
                      border: "1px solid #333",
                    }}
                  >
                    <Editor
                      height="100%"
                      theme="vs-dark"
                      value={selectedSubmission.files?.[0]?.content || ""}
                      options={{ readOnly: true, minimap: { enabled: false } }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* -- ANALYTICS -- */}
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
