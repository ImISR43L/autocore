import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
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
  Menu,
  Terminal,
  BookOpen,
  Code2,
  History,
  GraduationCap,
  MessageSquare,
  Paperclip,
  X,
  Link2,
  Accessibility,
  Maximize,
  Minimize,
  Copy,
  Users,
  Archive,
  EyeOff,
  Beaker,
  ClipboardPaste,
  AlertTriangle,
} from "lucide-react";
import {
  Panel,
  Group as PanelGroupOriginal,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
const PanelGroup = PanelGroupOriginal as any;

import { io } from "socket.io-client";
import LogViewer from "../components/LogViewer";
import { usePreferences } from "../contexts/PreferencesContext";
import { useMonacoTheme } from "../hooks/useMonacoTheme";

import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Card } from "../components/ui/Card";
import { cn } from "../lib/utils";

import { MoleculeWorkspace } from "../features/molecule-env";
import { useMoleculeStore } from "../features/molecule-env/store/useMoleculeStore";

import "highlight.js/styles/atom-one-dark.css";
import "../App.css";

interface AnnouncementLink {
  url: string;
  title: string;
  description: string;
  imageUrl: string;
}

interface Announcement {
  id: string;
  content: string;
  createdAt: string;
  author: { id?: string; email: string; name?: string };
  links?: AnnouncementLink[];
  attachments?: any[];
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
  allowedLanguages?: string[];
  validationConfig?: {
    expectedMode?: string;
    expectedSmiles?: string;
    rawState?: any;
  };
}

interface Classroom {
  id: number;
  name: string;
  code: string;
  subject?: "PROGRAMMING" | "CHEMISTRY" | "HTML";
  owner: { id: string; email: string; name?: string } | null;
  students: { id: string; email: string; name?: string }[];
  problems: Problem[];
  announcements: Announcement[];
  isArchived?: boolean;
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
  user: { id: string; email: string; name?: string };
  grade?: number;
  teacherComment?: string;
  problemId?: string;
  problem?: { id: string };
  isDelivery?: boolean;
  activityLogs?: ActivityLog[];
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

export interface ActivityLog {
  action: "COPY" | "PASTE" | "BLUR" | "FOCUS";
  timestamp: string;
  details?: string;
}

const LANGUAGES = [
  {
    id: 71,
    name: "Python (3.8.1)",
    fileName: "main.py",
    ext: ".py",
    defaultCode: `def solve():\n    # Escreva sua lógica aqui\n    pass`,
  },
  {
    id: 63,
    name: "JavaScript (Node.js)",
    fileName: "index.js",
    ext: ".js",
    defaultCode: `function solve() {\n    // Escreva sua lógica aqui\n}`,
  },
  {
    id: 54,
    name: "C++ (GCC 9.2.0)",
    fileName: "main.cpp",
    ext: ".cpp",
    defaultCode: `#include <iostream>\n\nint main() {\n    // Lógica\n    return 0;\n}`,
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

const getLanguageFromExt = (filename: string) => {
  if (!filename) return "plaintext";
  if (filename.endsWith(".js")) return "javascript";
  if (filename.endsWith(".ts")) return "typescript";
  if (filename.endsWith(".py")) return "python";
  if (filename.endsWith(".java")) return "java";
  if (filename.endsWith(".cpp") || filename.endsWith(".c")) return "cpp";
  return "plaintext";
};

export default function ClassroomView() {
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const { colorblindMode } = usePreferences();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const monacoTheme = useMonacoTheme();

  const [activeTab, setActiveTab] = useState<
    "stream" | "classwork" | "people" | "analytics"
  >("stream");
  const [mobileIdeTab, setMobileIdeTab] = useState<
    "problem" | "editor" | "console"
  >("problem");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const loadingRef = useRef(false);
  const [showSubmissions, setShowSubmissions] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  // Filtros de Submissão
  const [selectedStudentFilter, setSelectedStudentFilter] = useState<
    string | null
  >(null);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<
    string | null
  >(null);

  const [studentSearch, setStudentSearch] = useState("");

  const [inspectingUser, setInspectingUser] = useState<{
    id: string;
    email: string;
    name?: string;
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
  const [manualLinks, setManualLinks] = useState<string[]>([]);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [currentLink, setCurrentLink] = useState("");
  const [posting, setPosting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stats, setStats] = useState<StatData[]>([]);
  const [problemStats, setProblemStats] = useState<ProblemStat[]>([]);

  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [examStatus, setExamStatus] = useState<
    "WAITING" | "RUNNING" | "FINISHED"
  >("WAITING");
  const [activeChildIndex, setActiveChildIndex] = useState(0);

  const [showReportMenu, setShowReportMenu] = useState(false);

  // --- ESTADOS DE ACESSIBILIDADE ---
  const [highContrast, setHighContrast] = useState(
    () => localStorage.getItem("a11y_highContrast") === "true",
  );
  const [screenReaderMode, setScreenReaderMode] = useState(
    () => localStorage.getItem("a11y_screenReaderMode") === "true",
  );
  const [zenMode, setZenMode] = useState(
    () => localStorage.getItem("a11y_zenMode") === "true",
  );
  const [showA11yMenu, setShowA11yMenu] = useState(false);

  const [isLightMode, setIsLightMode] = useState(
    !document.documentElement.classList.contains("dark"),
  );

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  // --- CONTROLE DE TELA CHEIA / BLOQUEIO ANTI-COLA (PROVAS) ---
  const EXAM_LOCK_DURATION_SECONDS = 60; // 1 minuto de bloqueio
  const [isExamLocked, setIsExamLocked] = useState(false);
  const [lockCountdown, setLockCountdown] = useState(0);

  // Sub-aba dentro de "Atividades": exercícios vs provas
  const [problemTypeTab, setProblemTypeTab] = useState<"exercises" | "exams">(
    "exercises",
  );

  // Splash da prova: aluno confirmou que leu as regras?
  // Resetar sempre que trocar de problema
  const [examAcknowledged, setExamAcknowledged] = useState(false);

  // O aluno já finalizou a prova (entregou todas as questões e clicou em
  // "Finalizar")? Usado para desligar o travamento de Alt+Tab/tela cheia
  // depois que não há mais nada a proteger.
  const [examFinalized, setExamFinalized] = useState(false);
  // Espelha `examFinalized` em uma ref para leitura síncrona dentro de
  // triggerExamLock. Precisamos disso porque handleFinalizeExam chama
  // exitExamFullscreen() logo após finalizar — o que dispara nosso próprio
  // listener de "fullscreenchange" — e o estado do React só reflete a
  // finalização depois de um re-render, que pode não terminar a tempo de
  // remover o listener antes do evento do navegador chegar. Atualizamos
  // esta ref de forma síncrona dentro de handleFinalizeExam (e também aqui,
  // para o caso de examFinalized vir true via hidratação/backend).
  const examFinalizedRef = useRef(false);
  useEffect(() => {
    examFinalizedRef.current = examFinalized;
  }, [examFinalized]);
  useEffect(() => {
    setExamAcknowledged(false);
  }, [selectedProblemId]);

  // Dicionário de arquivos por questão (chave = child problem ID)
  // Substitui o estado `files` para provas com múltiplas questões
  const [examFilesMap, setExamFilesMap] = useState<Record<string, FileEntry[]>>(
    {},
  );

  // Dicionário de HTML por questão (chave = child problem ID)
  // Substitui o estado `htmlCode` para provas de HTML com múltiplas questões,
  // evitando que o código do aluno seja perdido ao trocar de questão.
  const [examHtmlMap, setExamHtmlMap] = useState<Record<string, string>>({});

  // Questões já entregues (travadas) — Set de child problem IDs
  const [deliveredQuestions, setDeliveredQuestions] = useState<Set<string>>(
    new Set(),
  );
  // Resetar ao trocar de prova
  useEffect(() => {
    setDeliveredQuestions(new Set());
    setExamFilesMap({});
    setExamHtmlMap({});
    setExamFinalized(false);
  }, [selectedProblemId]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsLightMode(!document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    localStorage.setItem("a11y_highContrast", String(highContrast));
  }, [highContrast]);
  useEffect(() => {
    localStorage.setItem("a11y_screenReaderMode", String(screenReaderMode));
  }, [screenReaderMode]);
  useEffect(() => {
    localStorage.setItem("a11y_zenMode", String(zenMode));
  }, [zenMode]);

  useEffect(() => {
    if (!monacoRef.current) return;

    // Define temas customizados baseados no modo de daltonismo
    const monaco = monacoRef.current;

    // Deuteranopia (Ênfase em Azul/Amarelo)
    monaco.editor.defineTheme("deuteranopia-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "60a5fa" }, // Azul claro
        { token: "string", foreground: "fb923c" }, // Laranja
        { token: "number", foreground: "e879f9" }, // Roxo/Rosa
        { token: "comment", foreground: "9ca3af" },
      ],
      colors: {
        "editor.background": "#111827",
      },
    });

    // Tritanopia (Ênfase em Ciano/Rosa)
    monaco.editor.defineTheme("tritanopia-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "22d3ee" }, // Ciano
        { token: "string", foreground: "fb7185" }, // Rosa
        { token: "number", foreground: "ffffff" },
      ],
      colors: {
        "editor.background": "#111827",
      },
    });

    // Achromatopsia (Alto Contraste P/B)
    monaco.editor.defineTheme("achromatopsia-dark", {
      base: "hc-black", // Usa base High Contrast do próprio Monaco
      inherit: true,
      rules: [
        // Reforça contraste se necessário
      ],
      colors: {
        "editor.selectionBackground": "#ffffff40",
      },
    });

    // Seleciona o tema correto
    let themeToSet = highContrast ? "hc-black" : isLightMode ? "vs" : "vs-dark";

    if (!isLightMode) {
      // Apenas personaliza no modo escuro por enquanto
      if (colorblindMode === "deuteranopia") themeToSet = "deuteranopia-dark";
      if (colorblindMode === "tritanopia") themeToSet = "tritanopia-dark";
      if (colorblindMode === "achromatopsia") themeToSet = "achromatopsia-dark";
    }

    monaco.editor.setTheme(themeToSet);
  }, [colorblindMode, isLightMode, highContrast]);

  const [myUserId, setMyUserId] = useState<string | null>(null);

  // Salva a aba ativa no cache sempre que ela mudar
  useEffect(() => {
    if (id) {
      localStorage.setItem(`activeTab_${id}`, activeTab);
    }
  }, [activeTab, id]);

  // Salva o último exercício selecionado no cache sempre que mudar
  useEffect(() => {
    if (id && selectedProblemId) {
      localStorage.setItem(`lastProblemId_${id}`, selectedProblemId);
    }
  }, [selectedProblemId, id]);

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setMyUserId(session.user.id);
      }
    };
    fetchUser();
  }, []);

  const isOwner = classroom?.owner?.id === myUserId;
  const hasTeacher = !!classroom?.owner;

  const displayProblem =
    currentProblem?.children && currentProblem.children.length > 0
      ? currentProblem.children[activeChildIndex]
      : currentProblem;

  const allowedLanguageOptions = useMemo(() => {
    if (
      !displayProblem ||
      !displayProblem.allowedLanguages ||
      displayProblem.allowedLanguages.length === 0
    ) {
      return LANGUAGES; // Fallback para atividades antigas
    }
    return LANGUAGES.filter((l) =>
      displayProblem.allowedLanguages!.includes(LANGUAGE_MAP[l.id]),
    );
  }, [displayProblem]);

  // Força a seleção de uma linguagem permitida ao trocar de atividade
  useEffect(() => {
    if (
      !displayProblem ||
      !displayProblem.allowedLanguages ||
      displayProblem.allowedLanguages.length === 0
    )
      return;

    const currentLangStr = LANGUAGE_MAP[languageId];
    if (!displayProblem.allowedLanguages.includes(currentLangStr)) {
      const firstAllowed = LANGUAGES.find((l) =>
        displayProblem.allowedLanguages!.includes(LANGUAGE_MAP[l.id]),
      );
      if (firstAllowed) setLanguageId(firstAllowed.id);
    }
  }, [displayProblem, languageId]);

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
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
      // Forma correta de limpar o state no React Router sem quebrar o histórico:
      navigate(location.pathname, { replace: true, state: {} });
    } else if (
      location.state &&
      location.state.problemId &&
      !initialRedirectChecked.current
    ) {
      setActiveTab("classwork");
      initialRedirectChecked.current = true;
    } else if (id) {
      const savedTab = localStorage.getItem(`activeTab_${id}`);
      if (savedTab) setActiveTab(savedTab as any);
    }
  }, [location.state, id, location.pathname, navigate]);

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

  // 1. Deriva os arquivos base dependendo se é Exercício ou Prova
  // Derivação Dinâmica baseada nos arquivos base (starterCode)
  const availableLanguages = useMemo(() => {
    // 1. Extrai o starterCode com base no tipo de atividade
    const files =
      currentProblem?.type === "EXAM"
        ? currentProblem.children?.find((c: any) => c.id === activeTab)
            ?.starterCode
        : currentProblem?.starterCode;

    // 2. Se não houver, fallback vazio
    if (!files || !Array.isArray(files)) return [];

    // 3. Mapeia a extensão do ficheiro para a Linguagem correspondente
    const langs = new Map();
    files.forEach((file: any) => {
      const extension = file.name?.slice(file.name.lastIndexOf("."));
      const lang = LANGUAGES.find((l) => l.ext === extension);
      if (lang) langs.set(lang.id, lang);
    });

    return Array.from(langs.values());
  }, [currentProblem, activeTab]);

  // Sincronização do estado selecionado (garante que não seleciona linguagem fantasma)
  // Sincronização do estado selecionado (garante que não seleciona linguagem fantasma)
  useEffect(() => {
    if (
      availableLanguages.length > 0 &&
      !availableLanguages.find((l) => l.id === languageId)
    ) {
      // Define a primeira linguagem disponível, passando apenas o ID
      setLanguageId(availableLanguages[0].id);
    }
  }, [availableLanguages, languageId]);

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
      const res = await api.get(`/classrooms/${id}`);
      setClassroom(res.data);
    } catch {
      toast.error("Erro ao carregar turma.");
      navigate("/dashboard");
    }
  }, [id, navigate]);

  const fetchSubmissions = useCallback(async (probId: string) => {
    if (!probId) return;
    try {
      const res = await api.get(`/submissions/problem/${probId}`);
      setSubmissions(res.data);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const fetchProblemStats = useCallback(async (probId: string) => {
    try {
      const res = await api.get(`/submissions/stats/problem/${probId}`);
      setProblemStats(res.data);
    } catch {
      console.error("Erro problem stats");
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get(`/submissions/stats/classroom/${id}`);
      setStats(res.data);
    } catch {
      console.error("Erro stats");
    }
  }, [id]);

  const aggregatedStats = useMemo(() => {
    const totalAccepted = stats.reduce(
      (acc, curr) => acc + (curr.Accepted || 0),
      0,
    );
    const totalError = stats.reduce((acc, curr) => acc + (curr.Error || 0), 0);

    return [
      { name: "Acertos", value: totalAccepted, fill: "#10b981" },
      { name: "Erros", value: totalError, fill: "#ef4444" },
    ];
  }, [stats]);

  useEffect(() => {
    fetchClassroomData();
    const interval = setInterval(fetchClassroomData, 10000);
    return () => clearInterval(interval);
  }, [fetchClassroomData]);

  useEffect(() => {
    if (!myUserId || !id) return;

    let newSocket: any;

    const connectSocket = async () => {
      // 1. Recupera a sessão atual para capturar o JWT Token
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // 2. Injeta o token na propriedade 'auth' no handshake do WebSocket
      newSocket = io(API_URL, {
        transports: ["websocket"],
        auth: {
          token: session?.access_token,
        },
      });

      newSocket.on("connect", () => {
        console.log("Conectado ao WebSocket!");
        // O servidor agora valida a identidade via token e ignora as requisições puras do cliente
        // para mitigação do IDOR, mas os eventos permanecem como inicializadores da conexão.
        newSocket.emit("join-user-room", { userId: myUserId });
        newSocket.emit("join-classroom-room", { classroomId: Number(id) });
      });

      newSocket.on("submission-finished", (submission: Submission) => {
        const currentProb = displayProblemRef.current;
        if (
          currentProb &&
          ((submission.problem?.id &&
            submission.problem.id === currentProb.id) ||
            submission.problemId === currentProb.id)
        ) {
          setVerdict(submission.status);
          setLoading(false);
          loadingRef.current = false;

          if (window.innerWidth < 1024 && !isOwnerRef.current) {
            setMobileIdeTab("console");
          }

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
          if (
            currentTab === "classwork" &&
            currentProb?.id === data.problemId
          ) {
            fetchSubmissions(data.problemId);
            if (owner) fetchProblemStats(data.problemId);
          }
        },
      );
    };

    connectSocket();

    return () => {
      if (newSocket) newSocket.disconnect();
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
        const res = await api.get(`/problems/${selectedProblemId}`);
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

    const currentLangStr = LANGUAGE_MAP[languageId];
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

    // Filtra o starterCode baseando-se na linguagem selecionada
    if (displayProblem.starterCode && displayProblem.starterCode.length > 0) {
      const langFiles = displayProblem.starterCode.filter((f) => {
        const extLang = getLanguageFromExt(f.name);
        return extLang === currentLangStr || extLang === "plaintext";
      });

      if (langFiles.length > 0) {
        setFiles(langFiles);
        setActiveFileIndex(0);
        return;
      }
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
    // Se não for prova, limpa os estados e sai
    if (!currentProblem || currentProblem.type !== "EXAM") {
      setTimeLeft(null);
      setExamStatus("WAITING");
      return;
    }

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const start = currentProblem.startDate
        ? new Date(currentProblem.startDate).getTime()
        : 0;
      const end = currentProblem.deadline
        ? new Date(currentProblem.deadline).getTime()
        : Infinity;

      // A prova inicia se a data atual passou da startDate OU se o professor clicou em Iniciar manualmente (startedAt)
      const hasStartDate = !!currentProblem.startDate;
      const isStarted =
        currentProblem.startedAt != null || // professor clicou em Iniciar
        (hasStartDate && now >= start); // data automática chegou

      // Sem deadline = nunca termina
      const hasDeadline = !!currentProblem.deadline;
      const isFinished = hasDeadline && now > end;

      if (!isStarted && !isFinished) {
        setExamStatus("WAITING");
        setTimeLeft("Aguardando");
      } else if (isStarted && !isFinished) {
        setExamStatus("RUNNING");
        if (end !== Infinity) {
          // O tempo restante é a diferença entre o PRAZO FINAL e o MOMENTO ATUAL
          const diff = end - now;
          const h = Math.floor(diff / 36e5)
            .toString()
            .padStart(2, "0");
          const m = Math.floor((diff % 36e5) / 6e4)
            .toString()
            .padStart(2, "0");
          const s = Math.floor((diff % 6e4) / 1e3)
            .toString()
            .padStart(2, "0");
          setTimeLeft(`${h}:${m}:${s}`);
        } else {
          setTimeLeft(null);
        }
      } else {
        setExamStatus("FINISHED");
        setTimeLeft("00:00:00");
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentProblem]);

  useEffect(() => {
    setVerdict(null);
    setSubmissionError(null);
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
      const currentLangStr = LANGUAGE_MAP[languageId];
      const key = getStorageKey(displayProblem.id, languageId);
      if (key) localStorage.removeItem(key);

      if (displayProblem.starterCode && displayProblem.starterCode.length > 0) {
        const langFiles = displayProblem.starterCode.filter((f) => {
          const extLang = getLanguageFromExt(f.name);
          return extLang === currentLangStr || extLang === "plaintext";
        });

        if (langFiles.length > 0) {
          setFiles(langFiles);
        } else {
          const lang = LANGUAGES.find((l) => l.id === languageId);
          setFiles([
            {
              name: lang?.fileName || "main.txt",
              content: lang?.defaultCode || "",
            },
          ]);
        }
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

        const loadedSubs: Record<string, Submission> = {};
        let foundIndex = 0;

        for (let i = 0; i < problemsToFetch.length; i++) {
          const p = problemsToFetch[i];
          try {
            const res = await api.get(`/submissions/problem/${p.id}`);
            const userSub = res.data.find(
              (s: Submission) => s.user.id === targetSubmission.user.id,
            );
            if (userSub) {
              loadedSubs[p.id] = userSub;
              if (targetProblemId === String(p.id)) foundIndex = i;
            }
          } catch (e) {
            console.error(e);
            // fallback: se o fetch falhar para o problema clicado, usa o que já temos
            if (targetProblemId === String(p.id)) {
              loadedSubs[p.id] = targetSubmission;
              foundIndex = i;
            }
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
      await api.patch(`/submissions/${sub.id}/grade`, {
        grade: gradingGrade === "" ? null : Number(gradingGrade),
        teacherComment: gradingComment,
      });
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

    if (
      !newAnnouncement.trim() &&
      selectedFiles.length === 0 &&
      manualLinks.length === 0
    )
      return;
    setPosting(true);

    try {
      const formData = new FormData();
      formData.append("classroomId", id as string);

      formData.append("content", newAnnouncement);

      formData.append("manualLinks", JSON.stringify(manualLinks));

      if (selectedFiles.length > 0) {
        selectedFiles.forEach((file) => {
          formData.append("files", file);
        });
      }

      await api.post("/announcements", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success("Aviso publicado!");
      setNewAnnouncement("");
      setSelectedFiles([]);
      setManualLinks([]);
      setShowLinkInput(false);
      setCurrentLink("");
      fetchClassroomData();
    } catch (error) {
      toast.error("Erro ao publicar aviso.");
      console.error(error);
    } finally {
      setPosting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const validFiles = files.filter((f) => f.size <= 20 * 1024 * 1024); // Máx 20MB
      if (validFiles.length < files.length)
        toast.warning("Alguns arquivos excedem o limite de 20MB.");
      setSelectedFiles((prev) => [...prev, ...validFiles]);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm("Apagar?")) return;
    try {
      await api.delete(`/announcements/${id}`);
      toast.success("Removido.");
      fetchClassroomData();
    } catch {
      toast.error("Erro.");
    }
  };

  const handleAddLink = () => {
    if (!currentLink.trim()) return;
    let urlToTest = currentLink.trim();
    if (!urlToTest.startsWith("http://") && !urlToTest.startsWith("https://")) {
      urlToTest = "https://" + urlToTest;
    }

    try {
      new URL(urlToTest);
      setManualLinks((prev) => [...prev, urlToTest]);
      setCurrentLink("");
      setShowLinkInput(false);
    } catch {
      toast.error("URL inválida.");
    }
  };

  const handleDeleteProblem = async () => {
    if (!selectedProblemId || !confirm("Certeza?")) return;
    try {
      await api.delete(`/problems/${selectedProblemId}`);
      toast.success("Eliminado!");
      setSelectedProblemId(null);
      fetchClassroomData();
    } catch {
      toast.error("Erro.");
    }
  };

  const submitSolution = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();

    if (isOwner) {
      toast.error("Professor não pode enviar soluções.");
      return;
    }

    if (!classroom?.owner) {
      toast.error("O professor desta turma não existe mais. Envio bloqueado.");
      return;
    }

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

    // 1. Inicia o bloqueio contra múltiplos cliques acidentais simultâneos
    setLoading(true);
    loadingRef.current = true;
    setVerdict("Processando...");
    setSubmissionError(null);

    if (window.innerWidth < 1024) {
      setMobileIdeTab("console");
    }

    try {
      let payloadFiles = isExam ? activeQuestionFiles : files;
      // CORREÇÃO: Garantimos que o ID nunca seja nulo usando 71 como padrão
      let payloadLanguageId: number | undefined = languageId || 71;

      if (classroom?.subject === "CHEMISTRY") {
        const studentSmiles = useMoleculeStore
          .getState()
          .exportCurrentMolecule("smiles");

        if (!studentSmiles) {
          toast.error("A tela está vazia! Desenhe a molécula antes de enviar.");
          setLoading(false);
          loadingRef.current = false;
          setVerdict(null);
          return;
        }

        payloadFiles = [{ name: "submission.smi", content: studentSmiles }];
      }

      if (classroom?.subject === "HTML") {
        if (!activeQuestionHtml.trim()) {
          toast.error("O editor está vazio! Escreva seu HTML antes de enviar.");
          setLoading(false);
          loadingRef.current = false;
          setVerdict(null);
          return;
        }
        payloadFiles = [{ name: "index.html", content: activeQuestionHtml }];
        payloadLanguageId = undefined; // HTML não usa language_id
      }

      // Monta o payload dinâmico
      const payload: any = {
        files: payloadFiles,
        problem_id: displayProblem.id,
        activityLogs: activityLogs,
      };

      // Só anexa o language_id se ele existir (ou seja, se for programação)
      if (payloadLanguageId !== undefined) {
        payload.language_id = payloadLanguageId;
      }

      await api.post(`/submissions`, payload);
      setActivityLogs([]);

      setLoading(false);
      loadingRef.current = false;
      setVerdict("Na Fila...");
      toast.info("Gabarito enviado! Aguardando o motor químico...");

      setTimeout(() => {
        if (displayProblemRef.current) {
          fetchSubmissions(displayProblemRef.current.id);
        }
      }, 10000);
    } catch (error: any) {
      setLoading(false);
      loadingRef.current = false;
      console.error(error);

      const errorMessage =
        error?.response?.data?.message || "Erro ao enviar submissão.";
      const displayMessage = Array.isArray(errorMessage)
        ? errorMessage[0]
        : errorMessage;

      if (error?.response?.status === 429) {
        setVerdict("Muitas Tentativas");
        setSubmissionError("Aguarde um momento antes de enviar novamente.");
        toast.warning("Aguarde um momento antes de enviar novamente.");
      } else if (error?.response?.status === 403) {
        setVerdict("Bloqueado");
        setSubmissionError(displayMessage);
        toast.error(displayMessage);
      } else {
        setVerdict("Erro");
        setSubmissionError(displayMessage);
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

    // ✅ CORREÇÃO 1: Detecta PASTE via API nativa do Monaco
    // editor.onDidPaste dispara após o conteúdo ser inserido, com o range exato do texto colado
    editor.onDidPaste((e) => {
      const pastedText = editor.getModel()?.getValueInRange(e.range) ?? "";
      if (pastedText.length < 15) return; // ignora colagens muito pequenas
      setActivityLogs((prev) => [
        ...prev,
        {
          action: "PASTE" as const,
          timestamp: new Date().toISOString(),
          details: `Colou ${pastedText.length} caracteres.`,
        },
      ]);
    });

    // ✅ CORREÇÃO 2: Detecta COPY via listener DOM no nó interno do Monaco
    // getDomNode() retorna o elemento raiz do editor, onde os eventos do teclado/clipboard realmente vivem
    const domNode = editor.getDomNode();
    if (domNode) {
      domNode.addEventListener("copy", () => {
        const selection = editor.getSelection();
        if (!selection || selection.isEmpty()) return;
        const selectedText =
          editor.getModel()?.getValueInRange(selection) ?? "";
        if (selectedText.length === 0) return;
        setActivityLogs((prev) => [
          ...prev,
          {
            action: "COPY" as const,
            timestamp: new Date().toISOString(),
            details: `Copiou ${selectedText.length} caracteres.`,
          },
        ]);
      });
    }

    // Código existente que já estava aqui
    editor.addAction({
      id: "submit-code-action",
      label: "Enviar Solução",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => {
        if (isOwnerRef.current) {
          toast.error("Ação não permitida para professores.");
          return;
        }
        if (submitSolutionRef.current) submitSolutionRef.current();
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
          if (isOwner) return;
          submitSolution();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, selectedProblemId, submitSolution, isOwner]);

  const handleStartExam = async () => {
    if (!confirm("Iniciar?")) return;
    try {
      await api.patch(`/problems/${selectedProblemId}/start`, {});
      toast.success("Iniciada!");
      const res = await api.get(`/problems/${selectedProblemId}`);
      setCurrentProblem(res.data);
    } catch {
      toast.error("Erro.");
    }
  };

  // Encerra manualmente uma prova em andamento. Necessário especialmente
  // quando a prova não tem `deadline` definido: sem isso, o status nunca
  // sai de "RUNNING" sozinho, e o professor ficava sem nenhuma forma de
  // finalizar a prova para a turma.
  const handleEndExam = async () => {
    if (
      !confirm(
        "Encerrar a prova agora? Os alunos perderão o acesso imediatamente e não será possível reabri-la.",
      )
    )
      return;
    try {
      await api.patch(`/problems/${selectedProblemId}/end`, {});
      toast.success("Prova encerrada!");
      const res = await api.get(`/problems/${selectedProblemId}`);
      setCurrentProblem(res.data);
    } catch {
      toast.error("Erro ao encerrar a prova.");
    }
  };

  const handleMarkAsDelivery = async (subId: string) => {
    try {
      await api.patch(`/submissions/${subId}/deliver`);
      toast.success("Submissão definida como entrega oficial!");
      if (displayProblem) {
        fetchSubmissions(displayProblem.id);
      }
    } catch (error) {
      toast.error("Erro ao definir entrega.");
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
      const response = await api.get(
        `/reports/classroom/${classroom.id}/${format}`,
        {
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

  const saveCurrentQuestionFiles = useCallback(() => {
    if (!displayProblem) return;
    setExamFilesMap((prev) => ({ ...prev, [displayProblem.id]: files }));
  }, [displayProblem, files]);

  const handleQuestionChange = useCallback(
    (index: number) => {
      saveCurrentQuestionFiles();
      setActiveChildIndex(index);
      setActiveFileIndex(0);
      setVerdict(null);
      setSubmissionError(null);
    },
    [saveCurrentQuestionFiles],
  );

  const [htmlCode, setHtmlCode] = useState<string>("");

  // Estado do editor HTML ao vivo
  const isExam = currentProblem?.type === "EXAM";

  // Hidrata deliveredQuestions/examFinalized a partir do backend ao carregar
  // uma prova. Sem isso, esses estados viviam só na sessão do navegador: um
  // F5 (ou simplesmente navegar para outro exercício e voltar) fazia o
  // aluno "perder" o progresso de entrega no client — mesmo com o servidor
  // já tendo tudo registrado — reativando a splash de reconhecimento e o
  // travamento de Alt+Tab numa prova que ele já tinha terminado, o que
  // também o impedia de ir fazer outros exercícios da disciplina sem medo
  // de ser travado novamente.
  useEffect(() => {
    if (
      !isExam ||
      isOwner ||
      !myUserId ||
      !currentProblem?.children ||
      currentProblem.children.length === 0
    ) {
      return;
    }

    let cancelled = false;
    const children = currentProblem.children;

    const hydrateDeliveredQuestions = async () => {
      try {
        const results = await Promise.all(
          children.map((child) =>
            api
              .get(`/submissions/problem/${child.id}`)
              .then((res) => ({
                childId: child.id,
                data: (res.data || []) as Submission[],
              }))
              .catch(() => ({ childId: child.id, data: [] as Submission[] })),
          ),
        );

        if (cancelled) return;

        const delivered = new Set<string>();
        results.forEach(({ childId, data }) => {
          const wasDelivered = data.some(
            (s) => s.user?.id === myUserId && s.isDelivery,
          );
          if (wasDelivered) delivered.add(childId);
        });

        setDeliveredQuestions(delivered);
        if (delivered.size === children.length) {
          setExamFinalized(true);
        }
      } catch (error) {
        console.error("Erro ao restaurar status de entrega da prova.", error);
      }
    };

    hydrateDeliveredQuestions();

    return () => {
      cancelled = true;
    };
  }, [isExam, isOwner, myUserId, currentProblem]);

  // --- FUNÇÕES DE TELA CHEIA (PROVAS) ---
  const requestExamFullscreen = useCallback(() => {
    const el = document.documentElement as any;
    const request =
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.mozRequestFullScreen ||
      el.msRequestFullscreen;
    if (request) {
      try {
        const result = request.call(el);
        if (result?.catch) result.catch(() => {});
      } catch {
        // Navegador pode recusar se não houver gesto do usuário; ignoramos.
      }
    }
  }, []);

  const exitExamFullscreen = useCallback(() => {
    const doc = document as any;
    const fsElement =
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement;
    if (!fsElement) return;
    const exit =
      doc.exitFullscreen ||
      doc.webkitExitFullscreen ||
      doc.mozCancelFullScreen ||
      doc.msExitFullscreen;
    if (exit) {
      try {
        const result = exit.call(doc);
        if (result?.catch) result.catch(() => {});
      } catch {
        // Ignora falha ao sair do modo tela cheia
      }
    }
  }, []);

  // Dispara o bloqueio de 1 minuto e registra a ocorrência no log de atividades
  const triggerExamLock = useCallback((reason: string) => {
    // Checagem síncrona: se a prova já foi finalizada (mesmo que o efeito
    // de detecção ainda não tenha sido desmontado por causa do timing do
    // re-render), não trava a tela. Ver comentário na declaração de
    // examFinalizedRef para o porquê disso ser necessário.
    if (examFinalizedRef.current) return;
    setActivityLogs((prev) => [
      ...prev,
      {
        action: "BLUR" as const,
        timestamp: new Date().toISOString(),
        details: reason,
      },
    ]);
    setIsExamLocked(true);
    setLockCountdown(EXAM_LOCK_DURATION_SECONDS);
  }, []);

  // Contagem regressiva do bloqueio de 1 minuto.
  // IMPORTANTE: não saímos do bloqueio automaticamente aqui, pois
  // requestFullscreen() só funciona dentro de um gesto direto do usuário
  // (clique). Se chamado sozinho num useEffect, o navegador rejeita a
  // promise silenciosamente e a prova fica fora da tela cheia sem que
  // nenhum novo evento de "fullscreenchange" seja disparado para
  // detectar isso. Por isso, ao chegar a 0, apenas paramos o timer e
  // exibimos um botão para o aluno retomar manualmente (ver handleResumeExam).
  // Reforço de segurança: além do overlay visual, remove o foco de qualquer
  // campo/editor e trava a edição enquanto a tela estiver bloqueada — caso
  // contrário, o teclado ainda poderia enviar eventos (ex: colar) para o
  // Monaco mesmo com o overlay cobrindo a tela visualmente.
  useEffect(() => {
    if (isExamLocked) {
      (document.activeElement as HTMLElement | null)?.blur?.();
      try {
        editorRef.current?.updateOptions?.({ readOnly: true });
      } catch {
        // Editor pode não estar montado ainda; ignora.
      }
    } else if (!isOwner) {
      try {
        editorRef.current?.updateOptions?.({ readOnly: false });
      } catch {
        // Ignora
      }
    }
  }, [isExamLocked, isOwner]);

  useEffect(() => {
    if (!isExamLocked) return;
    if (lockCountdown <= 0) return;
    const timer = setTimeout(() => setLockCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [isExamLocked, lockCountdown]);

  // Chamado pelo clique do aluno no botão "Voltar à prova".
  // Como está dentro de um handler de clique, é um gesto de usuário válido
  // e o navegador permite requestFullscreen() de forma confiável aqui.
  const handleResumeExam = useCallback(() => {
    requestExamFullscreen();
    setIsExamLocked(false);
    setLockCountdown(0);
    setActivityLogs((prev) => [
      ...prev,
      {
        action: "FOCUS" as const,
        timestamp: new Date().toISOString(),
        details: "Aluno retomou a prova manualmente após o bloqueio.",
      },
    ]);
  }, [requestExamFullscreen]);

  // Detecta tentativas de Alt+Tab, troca de aba ou saída da tela cheia durante a prova
  useEffect(() => {
    const examIsActive =
      isExam &&
      !isOwner &&
      examStatus === "RUNNING" &&
      examAcknowledged &&
      !examFinalized;
    if (!examIsActive) return;

    const handleWindowBlur = () => {
      if (document.hidden) return; // evita log duplicado (visibilitychange já cobre)
      triggerExamLock("Tentativa de sair da janela (Alt+Tab) detectada.");
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerExamLock("Aluno saiu da aba/janela durante a prova.");
      }
    };

    const handleFullscreenChange = () => {
      const doc = document as any;
      const fsElement =
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement;
      if (!fsElement) {
        triggerExamLock("Modo de tela cheia foi encerrado durante a prova.");
      }
    };

    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange,
      );
    };
  }, [
    isExam,
    isOwner,
    examStatus,
    examAcknowledged,
    examFinalized,
    triggerExamLock,
  ]);
  const isHtml = classroom?.subject === "HTML";
  const hasLimit =
    currentProblem?.maxAttempts != null && currentProblem.maxAttempts > 0;
  const maxAttempts = hasLimit ? currentProblem!.maxAttempts! : Infinity;
  const isDeadlinePassed = currentProblem?.deadline
    ? new Date() > new Date(currentProblem.deadline)
    : false;
  const attemptsLeft = hasLimit
    ? Math.max(0, maxAttempts - myAttemptsCount)
    : Infinity;

  if (!classroom)
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background text-muted">
        <RefreshCw className="animate-spin mr-2" /> Carregando turma...
      </div>
    );

  const isBlocked =
    (!isOwner && hasLimit && attemptsLeft <= 0) ||
    (!isOwner && isDeadlinePassed) ||
    (isExam && examStatus === "WAITING" && !isOwner) ||
    (isExam && examStatus === "FINISHED" && !isOwner);

  // Separamos os dois motivos que compunham "isBlocked" porque eles têm
  // efeitos diferentes: tentativas esgotadas só deveriam impedir um novo
  // TESTE (que consome tentativa) — não a ENTREGA de uma questão já
  // testada, que apenas finaliza o que já foi enviado. Sem essa separação,
  // com maxAttempts = 1, o aluno testava uma vez, "isBlocked" virava true,
  // e o botão "Entregar Questão" ficava travado junto — impedindo-o de
  // finalizar a própria questão que acabou de testar.
  const attemptsExhausted = !isOwner && hasLimit && attemptsLeft <= 0;
  const examWindowBlocked =
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

  const filteredStudents = (classroom.students || []).filter((student) => {
    const term = studentSearch.toLowerCase();
    const name = student.name?.toLowerCase() || "";
    const email = student.email?.toLowerCase() || "";
    return name.includes(term) || email.includes(term);
  });

  let safeValidationConfig = displayProblem?.validationConfig as any;
  if (typeof safeValidationConfig === "string") {
    try {
      safeValidationConfig = JSON.parse(safeValidationConfig);
    } catch (e) {}
  }

  let parsedRawState = safeValidationConfig?.rawState;
  if (typeof parsedRawState === "string") {
    try {
      parsedRawState = JSON.parse(parsedRawState);
    } catch (e) {}
  }

  // Separação dos problemas por tipo (logo após dropdownOptions)
  const exerciseOptions = dropdownOptions.filter((p) => p.type !== "EXAM");
  const examOptions = dropdownOptions.filter((p) => {
    if (p.type !== "EXAM") return false;
    if (isOwner) return true;
    // Aluno só vê a prova se ela já foi iniciada (startedAt existe)
    return !!p.startedAt;
  });

  // Arquivos da questão ativa no modo prova
  // Em exercícios, continua usando `files`; em provas, usa o mapa
  const activeQuestionFiles: FileEntry[] =
    isExam && displayProblem
      ? (examFilesMap[displayProblem.id] ??
        displayProblem.starterCode ?? [
          { name: "main.py", content: "def solve():\n    pass" },
        ])
      : files;

  // HTML da questão ativa no modo prova (mesma lógica do `activeQuestionFiles`)
  // Em exercícios, continua usando `htmlCode`; em provas, usa o mapa por questão
  const activeQuestionHtml: string =
    isExam && displayProblem
      ? (examHtmlMap[displayProblem.id] ?? "")
      : htmlCode;

  // Atualiza o HTML respeitando se estamos numa prova (mapa) ou exercício avulso
  const setActiveQuestionHtml = (value: string) => {
    if (isExam && displayProblem) {
      setExamHtmlMap((prev) => ({ ...prev, [displayProblem.id]: value }));
    } else {
      setHtmlCode(value);
    }
  };

  // A questão atual está travada?
  const isCurrentQuestionDelivered =
    isExam && displayProblem
      ? deliveredQuestions.has(displayProblem.id)
      : false;

  // Todas as questões foram entregues?
  const allQuestionsDelivered =
    isExam && currentProblem?.children?.length
      ? currentProblem.children.every((c) => deliveredQuestions.has(c.id))
      : false;

  // Entrega individual de uma questão
  const handleDeliverQuestion = async (childId: string) => {
    // Busca a última submissão desta questão pelo aluno
    const sub = submissions.find(
      (s) => s.user?.id === myUserId && s.problem?.id === childId,
    );
    if (!sub) {
      toast.error(
        "Envie pelo menos uma solução antes de entregar esta questão.",
      );
      return;
    }
    try {
      await api.patch(`/submissions/${sub.id}/deliver`);
      setDeliveredQuestions((prev) => new Set(prev).add(childId));
      toast.success("Questão entregue e travada!");
    } catch {
      toast.error("Erro ao entregar questão.");
    }
  };

  // Entrega final da prova (empacota tudo)
  const handleFinalizeExam = async () => {
    if (!currentProblem?.children) return;
    const undelivered = currentProblem.children.filter(
      (c) => !deliveredQuestions.has(c.id),
    );
    if (undelivered.length > 0) {
      toast.error(
        `Entregue todas as questões antes de finalizar. Faltam: ${undelivered.map((c) => c.title).join(", ")}`,
      );
      return;
    }
    toast.success("Prova finalizada! Todas as questões foram entregues.");
    // Marca a ref de forma SÍNCRONA (não depende de re-render) antes de
    // sair da tela cheia logo abaixo — exitExamFullscreen() dispara nosso
    // próprio listener de "fullscreenchange", e sem essa checagem síncrona
    // ele poderia disparar o travamento de 1 minuto antes do React
    // terminar de re-renderizar com examFinalized = true.
    examFinalizedRef.current = true;
    setExamFinalized(true);
    // Se por acaso o aluno estava sob travamento no momento de finalizar,
    // libera imediatamente — não há mais nada a proteger depois de
    // finalizada, então não faz sentido manter a contagem regressiva.
    setIsExamLocked(false);
    setLockCountdown(0);
    exitExamFullscreen();
  };

  const editorContent =
    classroom?.subject === "CHEMISTRY" ? (
      <div className="w-full h-full relative overflow-hidden bg-background">
        <MoleculeWorkspace
          key={`student-ide-${displayProblem?.id || "empty"}`}
          initialSmiles={isOwner ? safeValidationConfig?.expectedSmiles : ""}
          initialMode={safeValidationConfig?.expectedMode}
          initialRawState={isOwner ? parsedRawState : undefined}
        />
      </div>
    ) : classroom?.subject === "HTML" ? (
      <div className="flex flex-col h-full bg-background">
        {/* Barra de abas do editor HTML */}
        <div className="flex-none flex items-center gap-1 px-3 py-2 bg-surface border-b border-border">
          <span className="text-xs font-mono text-muted px-2 py-1 bg-background rounded border border-border">
            index.html
          </span>
          {isOwner && (
            <span className="ml-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded">
              Gabarito do professor
            </span>
          )}
        </div>

        {/* Editor Monaco em modo HTML */}
        <div className="flex-1 relative">
          <Editor
            key={`html-${displayProblem?.id}`}
            height="100%"
            theme={monacoTheme}
            language="html"
            value={
              isOwner
                ? (safeValidationConfig?.referenceHtml ?? "")
                : activeQuestionHtml
            }
            onChange={(value) => {
              if (!isOwner) setActiveQuestionHtml(value ?? "");
            }}
            options={{
              minimap: { enabled: false },
              automaticLayout: true,
              fontSize: 16,
              scrollBeyondLastLine: false,
              padding: { top: 16 },
              readOnly: isOwner,
            }}
          />
        </div>
      </div>
    ) : (
      <div className="flex flex-col h-full bg-surface">
        <div className="flex-none flex bg-surface border-b border-border overflow-x-auto no-scrollbar">
          {files.map((file, idx) => (
            <div
              key={idx}
              onClick={() => setActiveFileIndex(idx)}
              className={cn(
                "px-5 py-3 text-sm cursor-pointer flex items-center gap-3 border-r border-border border-t-2 select-none min-w-fit",
                activeFileIndex === idx
                  ? "bg-background text-foreground border-t-primary"
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
          <div className="flex items-center px-3 min-w-[100px]">
            <input
              className="bg-transparent border-none text-sm text-foreground w-full focus:outline-none placeholder:text-muted/50"
              placeholder="+ Novo..."
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddFile()}
            />
          </div>
        </div>

        <div className="flex-1 relative">
          <Editor
            key={`${languageId}-${displayProblem?.id}-${activeFileIndex}`}
            height="100%"
            theme={monacoTheme}
            language={LANGUAGE_MAP[languageId] || "plaintext"}
            value={activeQuestionFiles[activeFileIndex]?.content || ""}
            onChange={(value) => {
              const val = value || "";
              validateCode(val, languageId);
              if (isExam && displayProblem) {
                // Atualiza o mapa de arquivos do exame
                setExamFilesMap((prev) => {
                  const current =
                    prev[displayProblem.id] ?? activeQuestionFiles;
                  const updated = [...current];
                  updated[activeFileIndex] = {
                    ...updated[activeFileIndex],
                    content: val,
                  };
                  return { ...prev, [displayProblem.id]: updated };
                });
              } else {
                handleCodeChange(value);
              }
            }}
            onMount={handleEditorDidMount}
            options={{
              minimap: { enabled: false },
              automaticLayout: true,
              fontSize: 16,
              scrollBeyondLastLine: false,
              padding: { top: 16 },
              accessibilitySupport: screenReaderMode ? "on" : "auto",
            }}
          />
          {isCurrentQuestionDelivered && (
            <div className="absolute inset-0 bg-background/70 backdrop-blur-sm z-10 flex items-center justify-center">
              <div className="text-center space-y-3">
                <CheckCircle size={40} className="mx-auto text-emerald-500" />
                <p className="text-lg font-bold text-foreground">
                  Questão Entregue
                </p>
                <p className="text-sm text-muted">
                  Esta questão foi travada e não pode mais ser editada.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );

  const problemDetailsContent = (
    <div className="h-full overflow-y-auto bg-background p-6 md:p-8">
      {displayProblem ? (
        <>
          <h1 className="text-2xl md:text-3xl font-bold mb-6">
            {displayProblem.title}
          </h1>

          {displayProblem.deadline && (
            <div className="flex items-center gap-2 text-sm mb-8 bg-surface p-3 rounded-lg border border-border w-fit">
              <Clock
                size={16}
                className={isDeadlinePassed ? "text-red-500" : "text-amber-500"}
              />
              <span className="font-semibold text-muted">Prazo:</span>
              <span
                className={
                  isDeadlinePassed
                    ? "text-red-500 font-medium"
                    : "text-foreground font-medium"
                }
              >
                {new Date(displayProblem.deadline).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {isDeadlinePassed && (
                <span className="text-red-500 ml-1 font-bold">(Encerrado)</span>
              )}
            </div>
          )}

          <div className="prose prose-base max-w-none mb-10 dark:prose-invert">
            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
              {displayProblem.description}
            </ReactMarkdown>
          </div>

          <div className="space-y-4 mb-10">
            <h4 className="text-base font-bold uppercase tracking-wider text-muted">
              Exemplos
            </h4>
            {displayProblem.testCases?.map((tc, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface p-4 rounded-lg border border-border"
              >
                <div>
                  <div className="text-sm text-muted mb-2 font-semibold flex items-center justify-between gap-2">
                    <span>Entrada</span>
                    {isOwner && tc.isHidden && (
                      <span
                        className="flex items-center gap-1 text-xs bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded border border-amber-500/20"
                        title="Este caso de teste está oculto para os alunos"
                      >
                        <EyeOff size={14} /> Oculto
                      </span>
                    )}
                  </div>
                  <code className="text-base font-mono block bg-background/20 p-2 rounded break-all whitespace-pre-wrap">
                    {tc.input}
                  </code>
                </div>
                <div>
                  <div className="text-sm text-muted mb-2 font-semibold">
                    Saída
                  </div>
                  <code className="text-base font-mono block text-emerald-400 bg-background/20 p-2 rounded break-all whitespace-pre-wrap">
                    {tc.expectedOutput}
                  </code>
                </div>
              </div>
            ))}
          </div>

          {isOwner && displayProblem && problemStats.length > 0 && (
            <div className="mt-10 pt-8 border-t border-border">
              <h4 className="text-base font-bold uppercase tracking-wider text-muted mb-6 flex items-center gap-2">
                <BarChartIcon size={20} /> Estatísticas
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
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-muted space-y-4">
          <FileCode size={48} className="opacity-20" />
          <p className="text-lg text-center">
            Selecione um exercício no menu superior para começar.
          </p>
        </div>
      )}
    </div>
  );

  // --- TRATAMENTO SEMÂNTICO DE ERROS (Acessibilidade Cognitiva) ---
  const getSemanticHint = () => {
    if (!verdict || verdict === "Accepted" || verdict === "Processando...")
      return null;
    switch (verdict) {
      case "Compilation Error":
        return "Há um erro gramatical no código (Syntax Error). Verifique pontos e vírgulas, chaves não fechadas ou nomes de comandos digitados incorretamente.";
      case "Runtime Error":
        return "O código rodou, mas falhou no meio do processo. Procure por divisões por zero, acesso a listas fora do limite ou variáveis nulas.";
      case "Time Limit Exceeded":
        return "O programa demorou muito para responder. É provável que haja um 'loop infinito' (ex: um laço while que nunca atinge a condição de parada).";
      case "Wrong Answer":
        return "A saída do seu código não é exatamente igual ao esperado no exemplo. Cuidado com espaços extras, letras maiúsculas/minúsculas e quebras de linha.";
      default:
        return "Ocorreu um erro técnico inesperado no servidor de avaliação.";
    }
  };

  const consoleContent = isHtml ? (
    // Para HTML: painel direito é um preview ao vivo
    <div className="h-full flex flex-col bg-background">
      <div className="flex-none flex items-center justify-between px-4 py-2 border-b border-border bg-surface">
        <span className="text-xs font-semibold text-muted uppercase tracking-wider">
          Preview ao vivo
        </span>
        {verdict && (
          <span
            className={cn(
              "text-xs font-bold px-2 py-0.5 rounded-full border",
              verdict === "Accepted"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border-red-500/20",
            )}
          >
            {verdict}
          </span>
        )}
      </div>
      <iframe
        srcDoc={
          isOwner
            ? (safeValidationConfig?.referenceHtml ?? "")
            : activeQuestionHtml ||
              "<p style='color:#888;font-family:sans-serif;padding:2rem;text-align:center'>Escreva seu HTML no editor ao lado para ver o preview aqui.</p>"
        }
        className="flex-1 w-full bg-white"
        sandbox="allow-same-origin"
        title="Preview HTML do aluno"
      />
      {/* Feedback de validação após submissão (checklist de regras do gabarito) */}
      {verdict && verdict !== "Processando..." && (
        <div className="flex-none border-t border-border max-h-60 overflow-y-auto">
          {submissionError ? (
            <div className="bg-surface p-3">
              <pre className="text-xs font-mono text-red-400 whitespace-pre-wrap">
                {submissionError}
              </pre>
            </div>
          ) : (
            <LogViewer
              logs={lastSubmission?.output || lastSubmission?.stderr || ""}
              status={(lastSubmission?.status as any) || "Pending"}
            />
          )}
        </div>
      )}
    </div>
  ) : (
    <div className="h-full overflow-y-auto bg-background p-4 sm:p-6 flex flex-col">
      {verdict ? (
        <div
          className={cn(
            "rounded-xl border p-5 sm:p-6 mb-4 shadow-sm flex flex-col transition-colors motion-reduce:transition-none shrink-0",
            verdict === "Accepted"
              ? "bg-emerald-500/10 border-emerald-500/30"
              : "bg-red-500/10 border-red-500/30",
          )}
        >
          <div className="flex items-center gap-3 font-bold mb-4 text-lg sm:text-xl shrink-0">
            {verdict === "Accepted" ? (
              <CheckCircle
                className="text-emerald-600 dark:text-emerald-500"
                size={24}
              />
            ) : (
              <XCircle className="text-red-600 dark:text-red-500" size={24} />
            )}
            <span
              className={
                verdict === "Accepted"
                  ? "text-emerald-600 dark:text-emerald-500"
                  : "text-red-600 dark:text-red-500"
              }
            >
              {verdict}
            </span>
          </div>

          {lastSubmission && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4 mt-2 shrink-0">
              <div className="bg-background p-3 sm:p-4 rounded-lg border border-border">
                <div className="text-xs sm:text-sm text-muted mb-1 sm:mb-2 flex items-center gap-2 font-medium">
                  <Clock size={16} /> Tempo
                </div>
                <div className="font-mono text-lg sm:text-xl text-foreground">
                  {lastSubmission.executionTime}ms
                </div>
              </div>
              <div className="bg-background p-3 sm:p-4 rounded-lg border border-border">
                <div className="text-xs sm:text-sm text-muted mb-1 sm:mb-2 flex items-center gap-2 font-medium">
                  <Cpu size={16} /> Memória
                </div>
                <div className="font-mono text-lg sm:text-xl text-foreground">
                  {lastSubmission.memoryUsage}KB
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col shrink-0">
            {/* Dica Semântica Exclusiva para Erros */}
            {getSemanticHint() && (
              <div className="mb-5 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-start gap-3 shrink-0">
                <BookOpen
                  className="shrink-0 text-blue-600 dark:text-blue-400 mt-0.5"
                  size={20}
                />
                <div>
                  <h4 className="font-semibold text-blue-700 dark:text-blue-100 mb-1 text-xs sm:text-sm uppercase tracking-wide">
                    Dica de Resolução
                  </h4>
                  <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-100 leading-relaxed">
                    {getSemanticHint()}
                  </p>
                </div>
              </div>
            )}

            <div className="text-xs sm:text-sm font-bold text-muted mb-3 uppercase tracking-wider shrink-0">
              {verdict === "Accepted"
                ? "Saída do Programa"
                : "Logs Técnicos / Detalhes"}
            </div>
            <div className="shrink-0 overflow-hidden rounded-lg border border-border/50">
              {submissionError ? (
                <div className="bg-background p-4 text-red-500 font-mono text-sm whitespace-pre-wrap">
                  {submissionError}
                </div>
              ) : (
                <LogViewer
                  logs={lastSubmission?.output || lastSubmission?.stderr || ""}
                  status={(lastSubmission?.status as any) || "Pending"}
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-muted space-y-4 min-h-[200px] shrink-0">
          <Terminal size={48} className="opacity-20" />
          <p className="text-sm sm:text-base text-center px-4">
            Execute seu código para ver os resultados aqui.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden font-sans selection:bg-primary/20">
      {/* ===== OVERLAY DE BLOQUEIO ANTI-COLA (PROVAS) ===== */}
      {isExamLocked && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-sm select-none">
          <div className="max-w-md w-full mx-4 bg-surface border-2 border-destructive/50 rounded-2xl p-8 text-center space-y-5 shadow-2xl">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle size={32} className="text-destructive" />
            </div>
            <h2 className="text-xl font-bold text-foreground">
              Tela bloqueada
            </h2>
            <p className="text-sm text-muted leading-relaxed">
              Detectamos que você saiu da tela cheia ou trocou de janela durante
              a prova. Essa ocorrência foi registrada e a tela ficará bloqueada
              temporariamente.
            </p>
            {lockCountdown > 0 ? (
              <>
                <div className="text-5xl font-mono font-bold text-destructive tabular-nums">
                  {String(Math.floor(lockCountdown / 60)).padStart(2, "0")}:
                  {String(lockCountdown % 60).padStart(2, "0")}
                </div>
                <p className="text-xs text-muted">
                  Aguarde o tempo terminar para poder retomar a prova.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-emerald-400 font-medium">
                  Tempo de bloqueio encerrado.
                </p>
                <Button
                  onClick={handleResumeExam}
                  className="w-full h-12 text-base font-bold bg-emerald-500 hover:bg-emerald-400 text-white"
                >
                  Voltar à prova (tela cheia)
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {(!zenMode || activeTab !== "classwork") && (
        <header className="flex-none border-b border-border bg-surface px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center gap-4 mb-4">
            <Link
              to="/dashboard"
              className="p-2 hover:bg-white/10 rounded-full text-muted hover:text-foreground transition-colors"
            >
              <ArrowLeft size={24} />
            </Link>
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground truncate">
              {classroom.name}
            </h2>
          </div>

          <nav className="flex gap-6 text-base font-medium overflow-x-auto no-scrollbar">
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
                    "pb-2 border-b-2 transition-colors px-1 whitespace-nowrap",
                    activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              ))}
          </nav>
        </header>
      )}

      {classroom.isArchived && (
        <div className="bg-orange-500/10 border-b border-orange-500/20 px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium text-orange-500 shadow-inner shrink-0 z-10">
          <Archive size={18} />
          Esta turma está arquivada. O modo somente leitura está ativado e
          alterações estão bloqueadas.
        </div>
      )}
      <main className="flex-1 overflow-hidden relative">
        {/* -- STREAMS -- */}
        {activeTab === "stream" && (
          <div className="h-full overflow-y-auto p-4 md:p-8">
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-8">
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
                          className="group cursor-pointer p-3 rounded-lg border border-border bg-background hover:border-primary/50 transition-colors"
                        >
                          <div className="text-base font-medium truncate text-foreground group-hover:text-primary transition-colors">
                            {work.title}
                          </div>
                          {/* NOVO BLOCO: Renderização explícita do prazo */}
                          {work.deadline && (
                            <div className="text-xs text-muted flex items-center gap-1.5 mt-2">
                              <Clock size={14} className="text-amber-500" />
                              Entrega:{" "}
                              {new Date(work.deadline).toLocaleString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          )}
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
              <div className="lg:col-span-3 space-y-6 md:space-y-8">
                <div className="bg-gradient-to-r from-primary/15 dark:from-primary/10 to-transparent bg-surface p-6 md:p-8 rounded-xl border border-primary/20 dark:border-primary/10 shadow-sm">
                  <h1 className="text-2xl md:text-4xl font-bold mb-3 text-foreground">
                    {classroom.name}
                  </h1>
                  <div
                    className="text-sm md:text-base text-primary-dark dark:text-primary/80 font-mono flex items-center gap-2 cursor-pointer hover:underline w-fit group"
                    onClick={() => {
                      navigator.clipboard.writeText(classroom.code);
                      toast.success("Código da turma copiado!");
                    }}
                    title="Clique para copiar"
                  >
                    Código: {classroom.code}
                    <Copy
                      size={16}
                      className="opacity-70 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                </div>

                {isOwner && (
                  <Card className="p-6 bg-surface border-border">
                    <form
                      onSubmit={handlePostAnnouncement}
                      className="space-y-3"
                    >
                      <textarea
                        disabled={classroom.isArchived}
                        className="w-full bg-background border border-border rounded-lg p-4 text-base focus:outline-none focus:border-primary transition-colors resize-none"
                        placeholder="Anuncie algo para a turma ou anexe materiais..."
                        rows={3}
                        value={newAnnouncement}
                        onChange={(e) => setNewAnnouncement(e.target.value)}
                      />

                      {/* Fila de arquivos selecionados */}
                      {(selectedFiles.length > 0 || manualLinks.length > 0) && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {manualLinks.map((link, idx) => (
                            <div
                              key={`link-${idx}`}
                              className="flex items-center gap-2 bg-surface-hover border border-border px-3 py-1.5 rounded-full text-sm"
                            >
                              <Link2
                                size={14}
                                className="text-primary shrink-0"
                              />
                              <span className="truncate max-w-[150px] text-foreground">
                                {new URL(link).hostname}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setManualLinks((prev) =>
                                    prev.filter((_, i) => i !== idx),
                                  )
                                }
                                className="text-muted hover:text-destructive transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                          {selectedFiles.map((file, idx) => (
                            <div
                              key={`file-${idx}`}
                              className="flex items-center gap-2 bg-surface-hover border border-border px-3 py-1.5 rounded-full text-sm"
                            >
                              <Paperclip
                                size={14}
                                className="text-primary shrink-0"
                              />
                              <span className="truncate max-w-[150px] text-foreground">
                                {file.name}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedFiles((prev) =>
                                    prev.filter((_, i) => i !== idx),
                                  )
                                }
                                className="text-muted hover:text-destructive transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Input Condicional para Links */}
                      {showLinkInput && (
                        <div className="flex gap-2 pt-2 animate-in fade-in slide-in-from-top-2">
                          <input
                            type="url"
                            placeholder="https://exemplo.com"
                            value={currentLink}
                            onChange={(e) => setCurrentLink(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddLink();
                              }
                            }}
                            className="flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary transition-colors"
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleAddLink}
                            variant="secondary"
                          >
                            Adicionar
                          </Button>
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-2">
                        <div className="flex gap-2">
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-muted hover:text-primary px-3"
                            disabled={classroom.isArchived}
                          >
                            <Paperclip size={18} className="sm:mr-2" />{" "}
                            <span className="hidden sm:inline">Arquivo</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowLinkInput(!showLinkInput)}
                            disabled={classroom.isArchived}
                            className="..."
                          >
                            <Link2 size={18} className="sm:mr-2" />{" "}
                            <span className="hidden sm:inline">Link</span>
                          </Button>
                        </div>
                        <Button
                          type="submit"
                          disabled={
                            classroom.isArchived ||
                            posting ||
                            (!newAnnouncement.trim() &&
                              selectedFiles.length === 0 &&
                              manualLinks.length === 0)
                          }
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
                            {(a.author?.name || a.author?.email)
                              ?.charAt(0)
                              ?.toUpperCase() || "U"}
                          </div>
                          <div>
                            <div className="text-base font-medium text-foreground">
                              {a.author?.name || a.author?.email
                                ? a.author.name || a.author.email
                                : "Professor Excluído"}
                            </div>
                            <div className="text-sm text-muted">
                              {new Date(a.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        {isOwner &&
                          !classroom.isArchived && ( // <-- Adicionado !classroom.isArchived
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
                      <div className="text-base whitespace-pre-wrap text-foreground leading-relaxed">
                        {a.content}
                      </div>

                      {/* Renderização de Links (Preview) */}
                      {((a.links && a.links.length > 0) ||
                        (a.attachments && a.attachments.length > 0)) && (
                        <div className="flex flex-col gap-3 mt-5 border-t border-border/50 pt-4">
                          {a.links &&
                            a.links.length > 0 &&
                            a.links.map((link, idx) => (
                              <a
                                key={idx}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-col sm:flex-row bg-background border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-colors group"
                              >
                                {link.imageUrl && (
                                  <div className="w-full sm:w-48 h-32 sm:h-auto shrink-0 bg-surface border-b sm:border-b-0 sm:border-r border-border">
                                    <img
                                      src={link.imageUrl}
                                      alt="Preview"
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                )}
                                <div className="p-3 sm:p-4 flex flex-col justify-center min-w-0 flex-1">
                                  <h4 className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                    {link.title}
                                  </h4>
                                  {link.description && (
                                    <p className="text-xs text-muted line-clamp-2 mt-1">
                                      {link.description}
                                    </p>
                                  )}
                                  <span className="text-xs text-muted/50 mt-2 truncate">
                                    {link.url}
                                  </span>
                                </div>
                              </a>
                            ))}

                          {a.attachments && a.attachments.length > 0 && (
                            <div className="flex flex-col gap-4 mt-4">
                              {/* 1. LINHA DE LINKS (Tamanho maior, ocupando mais largura) */}
                              {a.attachments?.some(
                                (att) => att.type === "link",
                              ) && (
                                <div className="flex flex-col gap-3">
                                  {a.attachments
                                    ?.filter((att) => att.type === "link")
                                    ?.map((attachment, index) => {
                                      // Link com Imagem (Rich Preview)
                                      if (attachment.imageUrl) {
                                        return (
                                          <a
                                            key={`link-${index}`}
                                            href={attachment.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex flex-col sm:flex-row bg-background border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-all max-w-2xl group"
                                          >
                                            <div className="w-full sm:w-48 h-40 sm:h-auto shrink-0 bg-muted/10 relative">
                                              <img
                                                src={attachment.imageUrl}
                                                alt={
                                                  attachment.title ||
                                                  "Preview do link"
                                                }
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                onError={(e) => {
                                                  (
                                                    e.target as HTMLImageElement
                                                  ).src =
                                                    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNlNWU3ZWIiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZW0gSW5kaXNwb27DrXZlbDwvdGV4dD48L3N2Zz4=";
                                                }}
                                              />
                                              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm p-1.5 rounded-md text-white">
                                                <Link2 size={16} />
                                              </div>
                                            </div>
                                            <div className="flex flex-col p-4 min-w-0 justify-center">
                                              <span className="text-base font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                                {attachment.title ||
                                                  attachment.url}
                                              </span>
                                              {attachment.description && (
                                                <span
                                                  className="text-sm text-muted line-clamp-3 mt-1"
                                                  title={attachment.description}
                                                >
                                                  {attachment.description}
                                                </span>
                                              )}
                                            </div>
                                          </a>
                                        );
                                      }

                                      // Link sem imagem (Fallback mais largo)
                                      return (
                                        <a
                                          key={`link-${index}`}
                                          href={attachment.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-3 bg-background border border-border rounded-lg p-3 hover:border-primary/50 transition-all max-w-2xl group"
                                        >
                                          <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                                            <Link2 size={20} />
                                          </div>
                                          <div className="flex flex-col min-w-0">
                                            <span className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                              {attachment.title ||
                                                attachment.url}
                                            </span>
                                            {attachment.description && (
                                              <span className="text-xs text-muted truncate">
                                                {attachment.description}
                                              </span>
                                            )}
                                          </div>
                                        </a>
                                      );
                                    })}
                                </div>
                              )}

                              {/* 2. LINHA DE ARQUIVOS (Lado a lado, menores) */}
                              {a.attachments?.some(
                                (att) => att.type === "file",
                              ) && (
                                <div className="flex flex-wrap gap-3">
                                  {a.attachments
                                    ?.filter((att) => att.type === "file")
                                    ?.map((attachment, index) => (
                                      <a
                                        key={`file-${index}`}
                                        href={attachment.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 bg-background border border-border rounded-lg p-3 hover:border-primary/50 transition-all min-w-[200px] max-w-[320px] group"
                                      >
                                        <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                                          <FileText size={20} />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                          <span className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                            {attachment.name}
                                          </span>
                                          <span className="text-xs text-muted">
                                            {attachment.size
                                              ? `${(attachment.size / 1024 / 1024).toFixed(2)} MB • `
                                              : ""}
                                            {(
                                              attachment.mimeType ||
                                              attachment.mimetype
                                            )
                                              ?.split("/")[1]
                                              ?.toUpperCase() || "ARQUIVO"}
                                          </span>
                                        </div>
                                      </a>
                                    ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* -- PEOPLE -- */}
        {activeTab === "people" && (
          <div className="h-full overflow-y-auto p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-10">
              {/* Seção Professores */}
              <section>
                <h3 className="text-primary-dark dark:text-primary font-semibold text-xl mb-6 px-2 border-b border-border pb-3 flex items-center justify-between">
                  Professores
                  <User size={20} />
                </h3>
                <Card className="bg-surface border-border">
                  <div className="flex items-center gap-5 p-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 dark:bg-primary/20 text-primary-dark dark:text-primary flex items-center justify-center font-bold border border-primary/20 dark:border-primary/10 text-lg">
                      {(classroom?.owner?.name || classroom?.owner?.email)
                        ?.charAt(0)
                        ?.toUpperCase() || "P"}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-foreground font-medium text-lg truncate">
                        {classroom?.owner?.name ||
                          classroom?.owner?.email ||
                          "Professor (Conta Excluída)"}
                      </span>
                      {classroom?.owner?.name && (
                        <span className="text-xs text-muted truncate">
                          {classroom?.owner?.email}
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              </section>

              {/* Seção Estudantes */}
              <section>
                <div className="flex items-center justify-between mb-6 px-2 border-b border-border pb-3">
                  <h3 className="text-primary-dark dark:text-primary font-semibold text-xl flex items-center gap-3">
                    Estudantes
                    <span className="text-sm bg-primary/10 text-primary-dark dark:text-primary border border-primary/20 dark:border-primary/10 px-3 py-1 rounded-full">
                      {classroom.students.length}
                    </span>
                  </h3>
                </div>

                <div className="mb-6 relative">
                  <Search
                    className="absolute left-4 top-3 text-muted"
                    size={20}
                  />
                  <Input
                    placeholder="Buscar estudante por nome ou email..."
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
                        <div className="w-10 h-10 rounded-full hover:bg-surface-hover text-muted flex items-center justify-center font-bold text-base">
                          {(s.name || s.email || "?").charAt(0)?.toUpperCase()}
                        </div>
                        <div className="flex-1 flex flex-col justify-center">
                          <div className="text-base text-foreground font-medium truncate">
                            {s.name || s.email || "Estudante"}
                          </div>
                          {s.name && s.email && (
                            <div className="text-xs text-muted truncate">
                              {s.email}
                            </div>
                          )}
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
            <div className="flex-none flex items-center justify-between p-4 border-b border-border bg-surface gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {/* Pills para alternar tipo */}
                  <div className="flex bg-background rounded-lg border border-border p-0.5 gap-0.5">
                    <button
                      onClick={() => setProblemTypeTab("exercises")}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-all",
                        problemTypeTab === "exercises"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted hover:text-foreground",
                      )}
                    >
                      <BookOpen size={14} /> Exercícios
                    </button>
                    <button
                      onClick={() => setProblemTypeTab("exams")}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-all",
                        problemTypeTab === "exams"
                          ? "bg-amber-500 text-white shadow-sm"
                          : "text-muted hover:text-foreground",
                      )}
                    >
                      <GraduationCap size={14} /> Provas
                      {examOptions.length > 0 && (
                        <span className="ml-1 bg-white/20 text-xs px-1.5 py-0.5 rounded-full">
                          {examOptions.length}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Dropdown filtrado */}
                  <Select
                    value={selectedProblemId || ""}
                    onChange={(e) => setSelectedProblemId(e.target.value)}
                    className="w-60 h-11 text-base"
                  >
                    <option value="">
                      {problemTypeTab === "exercises"
                        ? "Selecione um exercício..."
                        : "Selecione uma prova..."}
                    </option>
                    {(problemTypeTab === "exercises"
                      ? exerciseOptions
                      : examOptions
                    ).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Status do Exame */}
                {isExam && (
                  <div
                    className={cn(
                      "px-4 py-2 rounded text-sm font-bold flex items-center gap-2 h-11 whitespace-nowrap",
                      examStatus === "RUNNING"
                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        : examStatus === "FINISHED"
                          ? "bg-red-500/10 text-red-500 border border-red-500/20"
                          : "bg-orange-500/10 text-orange-500 border border-orange-500/20",
                    )}
                  >
                    <Clock size={18} />
                    <span className="hidden sm:inline">
                      {examStatus === "WAITING"
                        ? "Aguardando"
                        : examStatus === "FINISHED"
                          ? "Encerrado"
                          : (timeLeft ?? "Sem prazo")}
                    </span>
                    {isOwner && examStatus === "WAITING" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 ml-2 text-xs"
                        onClick={handleStartExam}
                      >
                        Iniciar
                      </Button>
                    )}
                    {isOwner && examStatus === "RUNNING" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 ml-2 text-xs border-red-500/40 text-red-500 hover:bg-red-500/10"
                        onClick={handleEndExam}
                      >
                        Encerrar Prova
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Toolbar Desktop (lg+) */}
              <div className="hidden lg:flex items-center gap-3">
                {isOwner && selectedProblemId && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-11 px-3"
                      onClick={() =>
                        navigate(
                          `/class/${id}/problem/${selectedProblemId}/edit`,
                        )
                      }
                      title="Configurações"
                    >
                      <Settings size={18} />
                    </Button>

                    {/* BOTÃO DE EXCLUIR AUMENTADO */}
                    <Button
                      variant="danger"
                      className="h-11 px-4 flex items-center gap-2 flex-none"
                      onClick={handleDeleteProblem}
                      title="Excluir este exercício"
                    >
                      <Trash size={18} />
                      <span className="hidden xl:inline">Excluir</span>
                    </Button>
                  </>
                )}

                {isOwner && (
                  <Button
                    disabled={classroom.isArchived}
                    variant="primary"
                    size="sm"
                    className="h-11 px-5 text-base"
                    onClick={() => navigate(`/class/${id}/create-problem`)}
                  >
                    <Plus size={20} className="mr-2" />
                    {classroom?.subject === "CHEMISTRY"
                      ? "Novo Exercício de Química"
                      : classroom?.subject === "HTML"
                        ? "Novo Exercício de HTML"
                        : "Novo Exercício de Programação"}
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
                  className="h-11 w-11"
                  onClick={handleResetCode}
                  title="Resetar Código"
                >
                  <RefreshCw size={20} />
                </Button>

                {zenMode && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 mr-2 motion-reduce:transition-none"
                    onClick={() => setZenMode(false)}
                    title="Sair do Modo Foco"
                    aria-label="Sair do Modo Foco"
                  >
                    <Minimize size={20} />
                  </Button>
                )}

                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11"
                    onClick={() => setShowA11yMenu(!showA11yMenu)}
                    title="Acessibilidade"
                    aria-label="Menu de Acessibilidade"
                  >
                    <Accessibility size={20} />
                  </Button>
                  {showA11yMenu && (
                    <div className="absolute right-0 mt-2 w-72 bg-surface border border-border rounded-lg shadow-xl z-50 py-2 animate-in fade-in zoom-in-95">
                      <button
                        onClick={() => {
                          setZenMode(!zenMode);
                          setShowA11yMenu(false);
                        }}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-surface-hover flex items-center justify-between transition-colors text-foreground"
                        aria-pressed={zenMode}
                      >
                        Modo Foco (Oculta distrações){" "}
                        {zenMode && (
                          <CheckCircle size={16} className="text-primary" />
                        )}
                      </button>
                      <div className="h-px bg-border my-1" />
                      <button
                        onClick={() => {
                          setHighContrast(!highContrast);
                          setShowA11yMenu(false);
                        }}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-surface-hover flex items-center justify-between transition-colors text-foreground"
                        aria-pressed={highContrast}
                      >
                        Alto Contraste{" "}
                        {highContrast && (
                          <CheckCircle size={16} className="text-primary" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setScreenReaderMode(!screenReaderMode);
                          setShowA11yMenu(false);
                        }}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-surface-hover flex items-center justify-between transition-colors text-foreground"
                        aria-pressed={screenReaderMode}
                      >
                        Modo Leitor de Tela{" "}
                        {screenReaderMode && (
                          <CheckCircle size={16} className="text-primary" />
                        )}
                      </button>
                      <div className="px-4 py-3 text-xs text-muted border-t border-border mt-1 leading-relaxed">
                        Dica: Pressione{" "}
                        <b className="text-foreground">Ctrl + M</b> no editor de
                        código para liberar o foco da tecla Tab (Escape Trap).
                      </div>
                    </div>
                  )}
                </div>

                <Select
                  value={languageId}
                  onChange={(e) => setLanguageId(parseInt(e.target.value))}
                  className="bg-transparent border-none text-muted-foreground text-sm focus:ring-0 cursor-pointer outline-none font-medium hover:text-foreground transition-colors"
                >
                  {availableLanguages.length === 0 && (
                    <option value="" disabled>
                      Aguardando Arquivos
                    </option>
                  )}
                  {availableLanguages.map((lang) => (
                    <option
                      key={lang.id}
                      value={lang.id}
                      className="bg-background text-foreground"
                    >
                      {lang.name}
                    </option>
                  ))}
                </Select>

                {/* BOTÃO DE ENVIAR E ESTADO DE ENTREGA: Apenas para Alunos */}
                {!isOwner &&
                  hasTeacher &&
                  (isExam ? (
                    <div className="flex items-center gap-3">
                      {/* Indicador de tentativas restantes: mostrado antes do
                          aluno gastar tudo "às cegas". Só faz sentido
                          quando há um limite configurado. */}
                      {hasLimit && (
                        <span
                          className={cn(
                            "text-xs font-mono px-2 py-1 rounded border whitespace-nowrap",
                            attemptsLeft <= 0
                              ? "text-destructive border-destructive/30 bg-destructive/10"
                              : attemptsLeft === 1
                                ? "text-amber-500 border-amber-500/30 bg-amber-500/10"
                                : "text-muted border-border bg-background",
                          )}
                          title="Tentativas de teste restantes para esta questão"
                        >
                          {attemptsLeft}{" "}
                          {attemptsLeft === 1
                            ? "tentativa restante"
                            : "tentativas restantes"}
                        </span>
                      )}

                      {/* Testar: consome tentativa, não trava a questão */}
                      <Button
                        onClick={submitSolution}
                        disabled={
                          loading ||
                          isCurrentQuestionDelivered ||
                          attemptsExhausted ||
                          examWindowBlocked
                        }
                        isLoading={loading}
                        variant="secondary"
                        className="h-11 px-5 text-base whitespace-nowrap"
                      >
                        {loading ? "Testando..." : "Testar Código"}
                      </Button>

                      {/* Entregar Questão: apenas finaliza/trava esta questão.
                          Não depende de tentativas — mesmo com 0 tentativas
                          restantes, o aluno precisa poder entregar o que já
                          testou. */}
                      <Button
                        onClick={() =>
                          displayProblem &&
                          handleDeliverQuestion(displayProblem.id)
                        }
                        disabled={
                          isCurrentQuestionDelivered ||
                          examWindowBlocked ||
                          loading
                        }
                        className={cn(
                          "h-11 px-5 text-base font-semibold whitespace-nowrap",
                          isCurrentQuestionDelivered
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 cursor-default"
                            : "bg-amber-500 hover:bg-amber-400 text-white",
                        )}
                      >
                        {isCurrentQuestionDelivered ? (
                          <>
                            <CheckCircle size={16} className="mr-2" /> Entregue
                          </>
                        ) : (
                          "Entregar Questão"
                        )}
                      </Button>
                    </div>
                  ) : (
                    /* Botão original de exercícios */
                    <Button
                      onClick={submitSolution}
                      disabled={loading || !selectedProblemId || isBlocked}
                      isLoading={loading}
                      className="h-11 px-8 text-base font-semibold whitespace-nowrap min-w-[140px]"
                    >
                      {!loading &&
                        (isBlocked ? "Bloqueado" : "Enviar Rascunho")}
                    </Button>
                  ))}
              </div>

              {/* Toolbar Mobile (Hamburguer + Submit Conditional) */}
              <div className="lg:hidden flex items-center gap-2">
                {/* Botão de Enviar (Apenas na aba Editor e para Alunos) */}
                {mobileIdeTab === "editor" && !isOwner && hasTeacher && (
                  <Button
                    onClick={submitSolution}
                    disabled={loading || !selectedProblemId || isBlocked}
                    isLoading={loading}
                    size="icon"
                    className="h-11 w-11 bg-primary text-foreground"
                  >
                    <div className="flex items-center justify-center">
                      <Plus className="rotate-45" size={24} />
                    </div>
                  </Button>
                )}

                {/* Menu Hambúrguer */}
                <div className="relative">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-11 w-11"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  >
                    <Menu size={20} />
                  </Button>

                  {isMobileMenuOpen && (
                    <div className="absolute right-0 top-14 w-56 bg-surface border border-border rounded-lg shadow-xl z-50 py-2 animate-in fade-in zoom-in-95">
                      {isOwner && (
                        <>
                          <button
                            disabled={classroom.isArchived}
                            onClick={() =>
                              !classroom.isArchived &&
                              navigate(`/class/${id}/create-problem`)
                            }
                            className={cn(
                              "w-full text-left px-4 py-3 text-sm hover:bg-surface-hover flex items-center gap-2",
                              classroom.isArchived &&
                                "opacity-50 cursor-not-allowed",
                            )}
                          >
                            <Plus size={16} />{" "}
                            {classroom?.subject === "CHEMISTRY"
                              ? "Novo Exerc. de Química"
                              : "Novo Problema"}
                          </button>
                          {selectedProblemId && (
                            <>
                              <button
                                disabled={classroom.isArchived} // <-- Trava
                                onClick={() =>
                                  !classroom.isArchived &&
                                  navigate(
                                    `/class/${id}/problem/${selectedProblemId}/edit`,
                                  )
                                }
                                className={cn(
                                  "w-full text-left px-4 py-3 text-sm hover:bg-surface-hover flex items-center gap-2",
                                  classroom.isArchived &&
                                    "opacity-50 cursor-not-allowed",
                                )}
                              >
                                <Settings size={16} /> Editar
                              </button>
                              <button
                                disabled={classroom.isArchived} // <-- Trava
                                onClick={() =>
                                  !classroom.isArchived && handleDeleteProblem()
                                }
                                className={cn(
                                  "w-full text-left px-4 py-3 text-sm hover:bg-surface-hover text-red-400 hover:text-red-300 flex items-center gap-3 transition-colors font-medium",
                                  classroom.isArchived &&
                                    "opacity-50 cursor-not-allowed",
                                )}
                              >
                                <Trash size={18} /> Excluir Exercício
                              </button>
                            </>
                          )}
                          <div className="h-px bg-border my-1" />
                        </>
                      )}

                      {selectedProblemId && (
                        <button
                          onClick={() => {
                            setShowSubmissions(true);
                            setIsMobileMenuOpen(false);
                          }}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-surface-hover flex items-center gap-2"
                        >
                          <History size={16} />{" "}
                          {isOwner ? "Ver Turma" : "Meu Histórico"}
                        </button>
                      )}

                      <button
                        onClick={handleResetCode}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-surface-hover flex items-center gap-2"
                      >
                        <RefreshCw size={16} /> Resetar Código
                      </button>

                      <div className="h-px bg-border my-1" />

                      <button
                        onClick={() => setZenMode(!zenMode)}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-surface-hover flex items-center justify-between"
                        aria-pressed={zenMode}
                      >
                        <span className="flex items-center gap-2 text-foreground">
                          {zenMode ? (
                            <Minimize size={16} />
                          ) : (
                            <Maximize size={16} />
                          )}{" "}
                          Modo Foco
                        </span>
                        {zenMode && (
                          <CheckCircle size={16} className="text-primary" />
                        )}
                      </button>
                      <button
                        onClick={() => setHighContrast(!highContrast)}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-surface-hover flex items-center justify-between"
                        aria-pressed={highContrast}
                      >
                        <span className="flex items-center gap-2 text-foreground">
                          <Accessibility size={16} /> Alto Contraste
                        </span>
                        {highContrast && (
                          <CheckCircle size={16} className="text-primary" />
                        )}
                      </button>
                      <button
                        onClick={() => setScreenReaderMode(!screenReaderMode)}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-surface-hover flex items-center justify-between"
                      >
                        <span className="flex items-center gap-2 text-foreground">
                          <Accessibility size={16} /> Leitor de Tela
                        </span>
                        {screenReaderMode && (
                          <CheckCircle size={16} className="text-primary" />
                        )}
                      </button>
                      <div className="px-4 py-2 text-xs text-muted">
                        Dica: Use <b className="text-foreground">Ctrl + M</b> no
                        editor para liberar o Tab.
                      </div>
                      <div className="h-px bg-border my-1" />

                      <div className="px-4 py-2 border-t border-border mt-1">
                        <label className="text-xs text-muted block mb-1">
                          Linguagem
                        </label>
                        <select
                          value={languageId}
                          onChange={(e) =>
                            setLanguageId(Number(e.target.value))
                          }
                          className="w-full bg-background border border-border rounded p-2 text-sm"
                        >
                          {allowedLanguageOptions.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {isExam &&
              (isOwner || examAcknowledged || examFinalized) &&
              currentProblem?.children &&
              currentProblem.children.length > 1 && (
                <div className="flex-none flex items-center gap-2 px-4 py-2 bg-surface border-b border-border overflow-x-auto no-scrollbar">
                  <span className="text-xs text-muted font-semibold uppercase tracking-wider whitespace-nowrap mr-2">
                    Questões:
                  </span>
                  {currentProblem.children.map((child, idx) => {
                    const isDelivered = deliveredQuestions.has(child.id);
                    const isActive = activeChildIndex === idx;
                    return (
                      <button
                        key={child.id}
                        onClick={() =>
                          !isDelivered && handleQuestionChange(idx)
                        }
                        title={child.title}
                        className={cn(
                          "w-9 h-9 rounded-lg text-sm font-bold border-2 transition-all flex-none flex items-center justify-center",
                          isDelivered
                            ? "bg-emerald-500/10 border-emerald-500 text-emerald-500 cursor-default"
                            : isActive
                              ? "bg-primary border-primary text-primary-foreground scale-110 shadow-lg"
                              : "bg-surface border-border text-muted hover:border-primary/50 hover:text-foreground",
                        )}
                      >
                        {isDelivered ? <CheckCircle size={16} /> : idx + 1}
                      </button>
                    );
                  })}

                  {/* Botão Finalizar Prova */}
                  {!isOwner && (
                    <button
                      onClick={handleFinalizeExam}
                      disabled={!allQuestionsDelivered}
                      className={cn(
                        "ml-auto flex items-center gap-2 px-4 h-9 rounded-lg text-sm font-bold border-2 transition-all whitespace-nowrap",
                        allQuestionsDelivered
                          ? "bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-400"
                          : "border-border text-muted cursor-not-allowed opacity-50",
                      )}
                    >
                      <CheckCircle size={16} />
                      Finalizar Prova
                    </button>
                  )}
                </div>
              )}

            {/* ===== ÁREA PRINCIPAL — splash OU IDE ===== */}
            {isExam &&
            !isOwner &&
            !examAcknowledged &&
            !examFinalized &&
            examStatus === "RUNNING" ? (
              /* ---------- SPLASH DA PROVA ---------- */
              <div className="flex-1 flex items-center justify-center p-8 bg-background">
                <div className="max-w-lg w-full bg-surface border border-amber-500/30 rounded-2xl p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-500/10 rounded-xl">
                      <GraduationCap size={28} className="text-amber-500" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">
                        {currentProblem?.title}
                      </h2>
                      <p className="text-sm text-amber-500 font-medium">
                        Avaliação Formal
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-background border border-border rounded-lg p-3 space-y-1">
                      <span className="text-muted uppercase text-xs font-bold tracking-wider flex items-center gap-1.5">
                        <Clock size={12} /> Prazo
                      </span>
                      <p className="text-foreground font-medium">
                        {currentProblem?.deadline
                          ? new Date(currentProblem.deadline).toLocaleString(
                              "pt-BR",
                            )
                          : "Sem prazo"}
                      </p>
                    </div>
                    <div className="bg-background border border-border rounded-lg p-3 space-y-1">
                      <span className="text-muted uppercase text-xs font-bold tracking-wider flex items-center gap-1.5">
                        <FileCode size={12} /> Questões
                      </span>
                      <p className="text-foreground font-medium">
                        {currentProblem?.children?.length ?? 1} questão(ões)
                      </p>
                    </div>
                    {currentProblem?.maxAttempts &&
                      currentProblem.maxAttempts > 0 && (
                        <div className="bg-background border border-border rounded-lg p-3 space-y-1">
                          <span className="text-muted uppercase text-xs font-bold tracking-wider">
                            Tentativas
                          </span>
                          <p className="text-foreground font-medium">
                            {currentProblem.maxAttempts} por questão
                          </p>
                        </div>
                      )}
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-sm space-y-2">
                    <p className="font-semibold text-amber-400 flex items-center gap-2">
                      <AlertTriangle size={14} /> Atenção
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-amber-300/80">
                      <li>Suas ações (copiar/colar) serão registradas.</li>
                      <li>
                        Ao entregar uma questão, ela fica travada para edição.
                      </li>
                      <li>Você pode testar o código antes de entregar.</li>
                      <li>
                        A prova será exibida em tela cheia. Sair da tela cheia
                        ou trocar de janela (Alt+Tab) bloqueará sua tela por 1
                        minuto.
                      </li>
                    </ul>
                  </div>

                  <Button
                    onClick={() => {
                      setExamAcknowledged(true);
                      requestExamFullscreen();
                    }}
                    className="w-full h-12 text-base font-bold bg-amber-500 hover:bg-amber-400 text-white"
                  >
                    Estou ciente e quero iniciar a prova
                  </Button>
                </div>
              </div>
            ) : (
              /* ---------- IDE NORMAL (PanelGroup existente) ---------- */
              <div className="flex-1 min-h-0 relative">
                {/* DESKTOP LAYOUT */}
                <div className="hidden lg:block h-full w-full">
                  <PanelGroup direction="horizontal">
                    <Panel defaultSize={60} minSize={30}>
                      {editorContent}
                    </Panel>
                    <PanelResizeHandle className="w-1.5 bg-border hover:bg-primary/50 focus-visible:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface transition-colors cursor-col-resize" />
                    <Panel defaultSize={40} minSize={20}>
                      {isOwner ? (
                        <div className="h-full flex flex-col">
                          {problemDetailsContent}
                        </div>
                      ) : (
                        <>
                          <div className="h-[60%] flex flex-col border-b border-border">
                            {problemDetailsContent}
                          </div>
                          <div className="h-[40%] flex flex-col">
                            {consoleContent}
                          </div>
                        </>
                      )}
                    </Panel>
                  </PanelGroup>
                </div>

                {/* MOBILE LAYOUT */}
                <div className="lg:hidden h-full flex flex-col">
                  <div className="flex-1 min-h-0">
                    {mobileIdeTab === "problem" && problemDetailsContent}
                    {mobileIdeTab === "editor" && editorContent}
                    {mobileIdeTab === "console" && !isOwner && consoleContent}
                  </div>

                  <div className="flex-none h-14 bg-surface border-t border-border flex items-center justify-around px-2">
                    <button
                      onClick={() => setMobileIdeTab("problem")}
                      className={cn(
                        "flex flex-col items-center justify-center w-full h-full text-xs font-medium transition-colors",
                        mobileIdeTab === "problem"
                          ? "text-primary"
                          : "text-muted hover:text-foreground",
                      )}
                    >
                      <BookOpen size={20} className="mb-1" />
                      Problema
                    </button>
                    <button
                      onClick={() => setMobileIdeTab("editor")}
                      className={cn(
                        "flex flex-col items-center justify-center w-full h-full text-xs font-medium transition-colors",
                        mobileIdeTab === "editor"
                          ? "text-primary"
                          : "text-muted hover:text-foreground",
                      )}
                    >
                      <Code2 size={20} className="mb-1" />
                      Editor
                    </button>

                    {!isOwner && (
                      <button
                        onClick={() => setMobileIdeTab("console")}
                        className={cn(
                          "flex flex-col items-center justify-center w-full h-full text-xs font-medium transition-colors",
                          mobileIdeTab === "console"
                            ? "text-primary"
                            : "text-muted hover:text-foreground",
                        )}
                      >
                        <div className="relative">
                          <Terminal size={20} className="mb-1" />
                          {verdict && (
                            <span
                              className={cn(
                                "absolute -top-1 -right-1 w-2 h-2 rounded-full",
                                verdict === "Accepted"
                                  ? "bg-emerald-500"
                                  : "bg-red-500",
                              )}
                            />
                          )}
                        </div>
                        Console
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* -- ANALYTICS -- */}
        {activeTab === "analytics" && isOwner && (
          <div className="h-full overflow-y-auto p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                  Desempenho da Turma
                </h2>

                {/* Botão de Exportar */}
                <div className="relative w-full md:w-auto">
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => setShowReportMenu(!showReportMenu)}
                    className="flex items-center justify-center h-10 px-4 text-sm w-full"
                  >
                    <Download size={18} className="mr-2" />
                    Exportar Relatório
                    <ChevronDown size={16} className="ml-2 text-muted" />
                  </Button>

                  {showReportMenu && (
                    <div className="absolute right-0 mt-2 w-full md:w-56 bg-surface border border-border rounded-lg shadow-xl z-50 py-1">
                      <button
                        onClick={() => handleExport("csv")}
                        className="w-full text-left px-5 py-3 text-base text-foreground hover:hover:bg-surface-hover hover:text-foreground flex items-center gap-3 transition-colors"
                      >
                        <FileText size={18} /> Formato CSV
                      </button>
                      <button
                        onClick={() => handleExport("xlsx")}
                        className="w-full text-left px-5 py-3 text-base text-foreground hover:hover:bg-surface-hover hover:text-foreground flex items-center gap-3 transition-colors"
                      >
                        <FileSpreadsheet size={18} /> Formato Excel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-8">
                <Card className="p-4 md:p-8 bg-surface border-border h-[500px] md:h-[600px] flex flex-col shadow-md">
                  <h3 className="text-base font-medium text-muted uppercase tracking-wider mb-8">
                    Submissões por Exercício
                  </h3>

                  {aggregatedStats.length > 0 ? (
                    <div className="flex-1 min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={aggregatedStats}
                          margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#27272a"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="name"
                            stroke="#a1a1aa"
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                            dy={10}
                          />
                          <YAxis
                            stroke="#a1a1aa"
                            allowDecimals={false}
                            tick={{ fontSize: 12 }}
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
                            dataKey="value"
                            barSize={60}
                            radius={[6, 6, 0, 0]}
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
                                  radius={[6, 6, 0, 0]}
                                />
                              );
                            }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted space-y-4">
                      <BarChartIcon size={64} className="opacity-20" />
                      <p className="text-lg text-center">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 md:p-6">
          <div className="bg-background w-full max-w-5xl max-h-[90vh] rounded-xl border border-border flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-border bg-surface">
              <h3 className="text-xl md:text-2xl font-semibold text-foreground flex items-center gap-3">
                {isOwner ? (
                  <Users size={24} className="text-primary" />
                ) : (
                  <Clock size={24} className="text-primary" />
                )}
                {isOwner ? "Entregas dos Alunos" : "Histórico de Envios"}
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
            <div className="p-4 border-b border-border bg-surface/50 flex flex-col sm:flex-row items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-muted font-medium uppercase tracking-wider whitespace-nowrap">
                <Filter size={16} /> Filtros:
              </div>

              {/* Filtro de Aluno (Apenas Professor) */}
              {isOwner && (
                <Select
                  className="w-full sm:w-64 h-10 text-base"
                  value={selectedStudentFilter || ""}
                  onChange={(e) =>
                    setSelectedStudentFilter(e.target.value || null)
                  }
                >
                  <option value="">Todos os Alunos</option>
                  {classroom?.students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name ? `${s.name} (${s.email})` : s.email}
                    </option>
                  ))}
                </Select>
              )}

              {/* Filtro de Status (Novo) */}
              <Select
                className="w-full sm:w-48 h-10 text-base"
                value={selectedStatusFilter || ""}
                onChange={(e) =>
                  setSelectedStatusFilter(e.target.value || null)
                }
              >
                <option value="">Todos os Status</option>
                <option value="Accepted">Accepted</option>
                <option value="Wrong Answer">Wrong Answer</option>
                <option value="Runtime Error">Runtime Error</option>
                <option value="Time Limit Exceeded">Time Limit Exceeded</option>
                <option value="Compilation Error">Compilation Error</option>
              </Select>
            </div>

            {/* Lista com Scroll Horizontal no Mobile */}
            <div className="flex-1 overflow-auto p-0">
              <div className="min-w-[600px] md:min-w-full">
                <table className="w-full text-base text-left">
                  <thead className="text-sm text-muted uppercase bg-surface sticky top-0">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">Data</th>
                      <th className="px-6 py-4 font-semibold">Tempo</th>
                      <th className="px-6 py-4 font-semibold">Memória</th>
                      {isOwner ? (
                        <th className="px-6 py-4 font-semibold">Aluno</th>
                      ) : (
                        <th className="px-6 py-4 font-semibold">Entrega</th>
                      )}
                      <th className="px-6 py-4 text-right font-semibold">
                        Detalhes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {submissions
                      .filter(
                        (s) =>
                          (!selectedStudentFilter ||
                            s.user.id === selectedStudentFilter) &&
                          (!selectedStatusFilter ||
                            s.status === selectedStatusFilter),
                      )
                      .map((sub) => (
                        <tr
                          key={sub.id}
                          className="hover:bg-surface/50 transition-colors"
                        >
                          {/* ... tds de status, data, tempo, memória (mantém iguais) ... */}
                          <td className="px-6 py-4">{/* status */}</td>
                          <td className="px-6 py-4 text-foreground whitespace-nowrap">
                            {new Date(sub.createdAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-muted font-mono">
                            {sub.executionTime}ms
                          </td>
                          <td className="px-6 py-4 text-muted font-mono">
                            {sub.memoryUsage}KB
                          </td>

                          {isOwner ? (
                            <td className="px-6 py-4 text-foreground">
                              <div className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold">
                                  {sub.user?.email?.charAt(0)?.toUpperCase() ||
                                    "U"}
                                </div>
                                <span className="truncate max-w-[180px]">
                                  {sub.user?.name ||
                                    sub.user?.email ||
                                    "Conta Excluída"}
                                </span>
                              </div>
                            </td>
                          ) : (
                            <td className="px-6 py-4">
                              {sub.isDelivery ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 text-emerald-500 text-xs font-bold uppercase tracking-wider border border-emerald-500/20">
                                  <CheckCircle size={14} /> Entregue
                                </span>
                              ) : hasTeacher ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleMarkAsDelivery(sub.id)}
                                  className="h-8 text-xs whitespace-nowrap"
                                >
                                  Marcar Entrega
                                </Button>
                              ) : (
                                <span
                                  className="text-xs text-muted"
                                  title="Turma sem professor"
                                >
                                  Bloqueado
                                </span>
                              )}
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
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: DETALHES/NOTAS (OVERLAY) --- */}
      {(inspectingUser || showModal) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/90 backdrop-blur-sm p-4 md:p-6">
          <div className="bg-background w-full max-w-7xl h-[90vh] rounded-xl border border-border flex flex-col shadow-2xl overflow-hidden">
            {/* Header Inspeção */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-border bg-surface">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-foreground mb-1">
                  {isOwner && inspectingUser
                    ? `Avaliando: ${inspectingUser.name || inspectingUser.email}`
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

              {isOwner && (
                <div className="mt-6 border-t border-border pt-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-foreground">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    Logs de Atividade Suspeita
                  </h3>

                  {!activeSubmission?.activityLogs?.length ? (
                    <p className="text-sm text-muted">
                      Nenhuma atividade anormal detectada.
                    </p>
                  ) : (
                    <ul className="space-y-3 max-h-60 overflow-y-auto pr-2">
                      {activeSubmission.activityLogs.map(
                        (log: ActivityLog, index: number) => (
                          <li
                            key={index}
                            className="flex items-start gap-3 bg-surface p-3 rounded-md border border-border"
                          >
                            {log.action === "PASTE" ? (
                              <ClipboardPaste className="w-4 h-4 text-red-500 mt-1" />
                            ) : (
                              <Copy className="w-4 h-4 text-blue-500 mt-1" />
                            )}
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                Ação:{" "}
                                {log.action === "PASTE"
                                  ? "Colagem externa"
                                  : "Cópia de código"}
                              </p>
                              <p className="text-xs text-muted mt-0.5">
                                {log.details}
                              </p>
                              <p className="text-xs text-muted/70 mt-1">
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </p>
                            </div>
                          </li>
                        ),
                      )}
                    </ul>
                  )}
                </div>
              )}

              {isOwner &&
                currentProblem?.children &&
                currentProblem.children.length > 1 && (
                  <div className="flex items-center gap-2 px-4 md:px-6 py-3 border-b border-border bg-surface/50 overflow-x-auto no-scrollbar">
                    <span className="text-xs text-muted font-semibold uppercase tracking-wider whitespace-nowrap mr-2">
                      Questão:
                    </span>
                    {currentProblem.children.map((child, idx) => (
                      <button
                        key={child.id}
                        onClick={() => {
                          setActiveInspectionIndex(idx);
                          const sub = studentSubmissions[child.id];
                          if (sub) {
                            setGradingGrade(sub.grade ?? "");
                            setGradingComment(sub.teacherComment ?? "");
                          } else {
                            setGradingGrade("");
                            setGradingComment("");
                          }
                        }}
                        title={child.title}
                        className={cn(
                          "w-9 h-9 rounded-lg text-sm font-bold border-2 transition-all flex-none flex items-center justify-center",
                          activeInspectionIndex === idx
                            ? "bg-primary border-primary text-primary-foreground scale-110 shadow-lg"
                            : "bg-surface border-border text-muted hover:border-primary/50 hover:text-foreground",
                        )}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>
                )}
            </div>

            <div className="flex-1 flex flex-col lg:flex-row min-h-0">
              {/* Lado Esquerdo: Código */}
              <div className="flex-1 lg:border-r border-border flex flex-col min-h-[300px]">
                <div className="bg-surface p-3 border-b border-border text-sm text-muted flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {classroom?.subject === "CHEMISTRY" ? (
                      <Beaker size={18} />
                    ) : (
                      <FileCode size={18} />
                    )}
                    Visualizador de Resolução
                  </div>

                  {/* Navegação de arquivos na inspeção */}
                  {(activeSubmission?.files?.length || 0) > 1 && (
                    <div className="flex bg-background/20 rounded overflow-hidden">
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

                <div className="flex-1 relative bg-background">
                  {classroom?.subject === "CHEMISTRY" ? (
                    <MoleculeWorkspace
                      key={
                        activeSubmission?.id ||
                        selectedSubmission?.id ||
                        "viewer"
                      }
                      initialSmiles={
                        (isOwner &&
                          activeSubmission?.files[inspectFileIndex]?.content) ||
                        (!isOwner &&
                          selectedSubmission?.files[inspectFileIndex]
                            ?.content) ||
                        ""
                      }
                      initialMode={
                        displayProblem?.validationConfig?.expectedMode as any
                      }
                    />
                  ) : (
                    <Editor
                      height="100%"
                      width="100%"
                      language="python"
                      theme={monacoTheme}
                      value={
                        (isOwner &&
                          activeSubmission?.files[inspectFileIndex]?.content) ||
                        selectedSubmission?.files[inspectFileIndex]?.content ||
                        "// Código não disponível"
                      }
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 16,
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        accessibilitySupport: screenReaderMode ? "on" : "auto",
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Lado Direito: Feedback e Notas */}
              <div className="w-full lg:w-[450px] bg-surface flex flex-col p-6 overflow-y-auto border-t lg:border-t-0 lg:border-l border-border h-1/2 lg:h-full">
                <div className="space-y-8">
                  {/* Status Card */}
                  <Card className="bg-surface border-border p-5">
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
                    <h4 className="text-base font-bold text-foreground mb-3">
                      Saída / Logs
                    </h4>
                    <div className="bg-background rounded-lg p-4 text-sm font-mono text-foreground max-h-60 overflow-y-auto border border-border">
                      <pre>
                        {activeSubmission?.output ||
                          selectedSubmission?.output ||
                          "Sem saída."}
                      </pre>
                    </div>
                  </div>

                  {/* Área de Nota (Apenas Professor) */}
                  {isOwner && (
                    <div className="pt-8 border-t border-border space-y-6">
                      <h4 className="text-lg font-bold text-foreground flex items-center gap-2">
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
                          className="h-11 text-base disabled:opacity-50"
                          disabled={classroom.isArchived} // <-- Trava
                        />
                      </div>

                      <div className="space-y-2.5">
                        <label className="text-sm text-muted font-medium">
                          Comentários
                        </label>
                        <textarea
                          disabled={classroom.isArchived} // <-- Trava
                          className="w-full bg-background/20 border border-border rounded-lg p-3 text-base text-foreground resize-none h-32 focus:outline-none focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="Feedback para o aluno..."
                          value={gradingComment}
                          onChange={(e) => setGradingComment(e.target.value)}
                        />
                      </div>

                      <Button
                        className="w-full h-11 text-base"
                        disabled={classroom.isArchived} // <-- Trava
                        onClick={handleSaveGrade}
                      >
                        Salvar Avaliação
                      </Button>
                    </div>
                  )}

                  {/* Área de Visualização do Feedback (Apenas Aluno) */}
                  {!isOwner &&
                    (selectedSubmission?.grade != null ||
                      selectedSubmission?.teacherComment) && (
                      <div className="pt-8 border-t border-border space-y-6">
                        <h4 className="text-lg font-bold text-foreground flex items-center gap-2">
                          <GraduationCap size={20} className="text-primary" />{" "}
                          Feedback do Professor
                        </h4>

                        {selectedSubmission.grade != null && (
                          <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-between">
                            <span className="text-sm text-muted uppercase font-bold tracking-wider">
                              Nota Final
                            </span>
                            <span className="text-3xl font-bold text-primary">
                              {selectedSubmission.grade}
                            </span>
                          </div>
                        )}

                        {selectedSubmission.teacherComment && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-muted font-medium">
                              <MessageSquare size={16} /> Comentários:
                            </div>
                            <div className="p-4 bg-surface border border-border rounded-lg text-foreground text-sm leading-relaxed whitespace-pre-wrap">
                              {selectedSubmission.teacherComment}
                            </div>
                          </div>
                        )}
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
