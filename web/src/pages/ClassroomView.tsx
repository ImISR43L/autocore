import { useState, useEffect } from "react";
import axios from "axios";
import Editor from "@monaco-editor/react";
import { useParams, useNavigate } from "react-router-dom";
import "../App.css"; // Importa o CSS global com as classes .ide-*

// Interfaces
interface Problem {
  id: string; // [CORREÇÃO] ID agora é string (UUID)
  title: string;
  description: string;
}

interface Classroom {
  id: number;
  name: string;
  code: string;
  owner: { id: number; email: string };
  problems: Problem[];
}

// Mapa de Linguagens (Judge0 ID -> Monaco String)
const LANGUAGE_MAP: Record<number, string> = {
  71: "python",
  63: "javascript",
  62: "java",
  50: "c",
  54: "cpp",
  60: "go",
};

const LANGUAGES = [
  {
    id: 71,
    name: "Python (3.8.1)",
    defaultCode: `import sys\n\n# Leia a entrada padrão\nline = sys.stdin.read().split()\nif len(line) >= 2:\n    a = int(line[0])\n    b = int(line[1])\n    print(a + b)`,
  },
  {
    id: 63,
    name: "JavaScript (Node.js 12.14)",
    defaultCode: `const fs = require('fs');\nconst input = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);\n\nif(input.length >= 2) {\n    const a = parseInt(input[0]);\n    const b = parseInt(input[1]);\n    console.log(a + b);\n}`,
  },
  {
    id: 54,
    name: "C++ (GCC 9.2.0)",
    defaultCode: `#include <iostream>\nusing namespace std;\n\nint main() {\n    int a, b;\n    if (cin >> a >> b) {\n        cout << (a + b);\n    }\n    return 0;\n}`,
  },
  {
    id: 60,
    name: "Go (1.13.5)",
    defaultCode: `package main\nimport (\n    "fmt"\n)\n\nfunc main() {\n    var a, b int\n    if _, err := fmt.Scan(&a, &b); err == nil {\n        fmt.Println(a + b)\n    }\n}`,
  },
];

export default function ClassroomView() {
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const { id } = useParams();
  const navigate = useNavigate();

  const [classroom, setClassroom] = useState<Classroom | null>(null);

  // [CORREÇÃO] State inicializado como string ou null
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(
    null
  );

  const [languageId, setLanguageId] = useState<number>(71);
  const [code, setCode] = useState<string>(LANGUAGES[0].defaultCode);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const getMyUserId = () => {
    const token = localStorage.getItem("token");
    if (!token) return null;
    try {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        window
          .atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(jsonPayload).sub;
    } catch (e) {
      return null;
    }
  };

  const isOwner = classroom?.owner?.id === getMyUserId();

  useEffect(() => {
    const fetchClassroomData = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API_URL}/classrooms/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setClassroom(res.data);

        // [CORREÇÃO] Seleciona o primeiro problema se existir (ID é string)
        if (res.data.problems && res.data.problems.length > 0) {
          setSelectedProblemId(res.data.problems[0].id);
        }
      } catch (error) {
        console.error("Erro ao carregar turma", error);
        alert("Erro ao carregar turma ou acesso negado.");
        navigate("/dashboard");
      }
    };
    fetchClassroomData();
  }, [id, navigate]);

  const submitSolution = async () => {
    if (!selectedProblemId) return alert("Selecione um problema!");
    setLoading(true);
    setVerdict(null);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_URL}/submissions`,
        {
          code,
          language_id: languageId,
          problem_id: selectedProblemId,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setVerdict(res.data.status);
    } catch (error: any) {
      setVerdict(
        "Erro: " + (error.response?.data?.message || "Falha na execução")
      );
    } finally {
      setLoading(false);
    }
  };

  if (!classroom) return <div className="container">Carregando turma...</div>;

  const currentProblem = classroom.problems.find(
    (p) => p.id === selectedProblemId
  );

  return (
    <div className="ide-container">
      {/* 1. Header (Estilo Page Header mas compacto) */}
      <div
        className="page-header"
        style={{ padding: "1rem 1.5rem", marginBottom: 0 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button
            onClick={() => navigate("/dashboard")}
            className="btn btn-ghost"
            style={{ padding: "0.2rem" }}
          >
            ← Voltar
          </button>
          <h2 className="page-title" style={{ fontSize: "1.2rem" }}>
            {classroom.name}
          </h2>
          {isOwner && <span className="class-code">{classroom.code}</span>}
        </div>

        {isOwner && (
          <button
            onClick={() =>
              navigate("/create-problem", {
                state: { classroomId: classroom.id },
              })
            }
            className="btn btn-primary"
          >
            + Novo Exercício
          </button>
        )}
      </div>

      {/* 2. Toolbar */}
      <div className="ide-toolbar">
        <select
          className="form-select"
          style={{ width: "auto", minWidth: "250px" }}
          value={selectedProblemId || ""}
          // [CORREÇÃO] Removemos Number(), pois o ID é string (UUID)
          onChange={(e) => setSelectedProblemId(e.target.value)}
        >
          {classroom.problems.length === 0 && (
            <option>Sem exercícios postados</option>
          )}
          {classroom.problems.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>

        <select
          className="form-select"
          style={{ width: "auto" }}
          value={languageId}
          onChange={(e) => {
            const newId = Number(e.target.value);
            setLanguageId(newId);
            const defaultCode = LANGUAGES.find(
              (l) => l.id === newId
            )?.defaultCode;
            if (defaultCode) setCode(defaultCode);
          }}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.id} value={lang.id}>
              {lang.name}
            </option>
          ))}
        </select>

        <button
          onClick={submitSolution}
          disabled={loading || !selectedProblemId}
          className="btn btn-primary"
          style={{ marginLeft: "auto" }}
        >
          {loading ? "Executando..." : "▶ Enviar Solução"}
        </button>
      </div>

      {/* 3. Grid Principal (Editor + Info) */}
      <div className="ide-main">
        <div className="ide-editor-panel">
          <Editor
            height="100%"
            // [CORREÇÃO] Usa o mapa para traduzir o ID numérico para string do Monaco
            language={LANGUAGE_MAP[languageId] || "plaintext"}
            theme="vs-dark"
            value={code}
            onChange={(val) => setCode(val || "")}
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              padding: { top: 16 },
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>

        <div className="ide-info-panel">
          {currentProblem ? (
            <>
              <h3 className="ide-info-title">{currentProblem.title}</h3>
              <p className="ide-description">{currentProblem.description}</p>
            </>
          ) : (
            <p className="ide-description">
              Selecione um exercício para começar.
            </p>
          )}

          {verdict && (
            <div
              className="ide-verdict"
              style={{
                borderColor:
                  verdict === "Accepted" ? "var(--success)" : "var(--error)",
                color:
                  verdict === "Accepted" ? "var(--success)" : "var(--error)",
              }}
            >
              <strong>Resultado:</strong> {verdict}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
