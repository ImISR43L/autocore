import { useState, useEffect } from "react";
import axios from "axios";
import Editor from "@monaco-editor/react";
import { useParams, useNavigate } from "react-router-dom";

// Interfaces
interface Problem {
  id: number;
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
  const { id } = useParams(); // ID da Turma na URL
  const navigate = useNavigate();

  // Estados
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [selectedProblemId, setSelectedProblemId] = useState<number | null>(
    null
  );

  const [languageId, setLanguageId] = useState<number>(71);
  const [code, setCode] = useState<string>(LANGUAGES[0].defaultCode);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // User ID do Token
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
          .map(function (c) {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join("")
      );
      return JSON.parse(jsonPayload).sub;
    } catch (e) {
      return null;
    }
  };

  const myId = getMyUserId();
  const isOwner = classroom?.owner?.id === myId;

  // Carregar Dados da Turma
  useEffect(() => {
    fetchClassroomData();
  }, [id]);

  const fetchClassroomData = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_URL}/classrooms/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setClassroom(res.data);

      if (res.data.problems && res.data.problems.length > 0) {
        setSelectedProblemId(res.data.problems[0].id);
      }
    } catch (error) {
      console.error("Erro ao carregar turma", error);
      alert("Erro ao carregar turma ou acesso negado.");
      navigate("/dashboard");
    }
  };

  const submitSolution = async () => {
    if (!selectedProblemId) return alert("Selecione um problema!");
    setLoading(true);
    setVerdict(null);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API_URL}/submissions`,
        {
          code,
          language_id: languageId,
          problem_id: selectedProblemId,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setVerdict(response.data.status);
    } catch (error: any) {
      setVerdict("Error: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  if (!classroom)
    return (
      <div style={{ color: "white", padding: "20px" }}>Carregando turma...</div>
    );

  const currentProblem = classroom.problems.find(
    (p) => p.id === selectedProblemId
  );

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        fontFamily: "sans-serif",
        backgroundColor: "#1e1e1e",
        color: "#fff",
      }}
    >
      {/* Header da Turma */}
      <div
        style={{
          padding: "10px 20px",
          backgroundColor: "#2d2d2d",
          borderBottom: "1px solid #444",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <button
            onClick={() => navigate("/dashboard")}
            style={{
              background: "none",
              border: "none",
              color: "#aaa",
              cursor: "pointer",
              fontSize: "1.2rem",
            }}
          >
            ←
          </button>
          <h2 style={{ margin: 0 }}>{classroom.name}</h2>
          {isOwner && (
            <span
              style={{
                backgroundColor: "#444",
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "0.8rem",
                color: "#aaa",
              }}
            >
              Código: {classroom.code}
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          {isOwner && (
            <button
              onClick={() =>
                navigate("/create-problem", {
                  state: { classroomId: classroom.id },
                })
              }
              style={{
                padding: "8px 15px",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              + Novo Exercício
            </button>
          )}
        </div>
      </div>

      {/* Toolbar IDE */}
      <div
        style={{
          padding: "10px 20px",
          borderBottom: "1px solid #333",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          backgroundColor: "#252526",
        }}
      >
        <select
          value={selectedProblemId || ""}
          onChange={(e) => setSelectedProblemId(Number(e.target.value))}
          style={{
            padding: "8px",
            borderRadius: "4px",
            backgroundColor: "#3c3c3c",
            color: "white",
            border: "1px solid #555",
            maxWidth: "250px",
          }}
        >
          {classroom.problems.length === 0 && (
            <option>Nenhum exercício postado</option>
          )}
          {classroom.problems.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>

        <select
          value={languageId}
          onChange={(e) => {
            const newId = Number(e.target.value);
            setLanguageId(newId);
            // Opcional: Atualizar código padrão ao trocar linguagem
            const defaultCode = LANGUAGES.find(
              (l) => l.id === newId
            )?.defaultCode;
            if (defaultCode) setCode(defaultCode);
          }}
          style={{
            padding: "8px",
            borderRadius: "4px",
            backgroundColor: "#3c3c3c",
            color: "white",
            border: "none",
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
          style={{
            padding: "8px 25px",
            cursor: "pointer",
            fontWeight: "bold",
            backgroundColor: loading ? "#555" : "#0e639c",
            color: "white",
            border: "none",
            borderRadius: "4px",
            marginLeft: "auto",
          }}
        >
          {loading ? "Julgando..." : "Enviar"}
        </button>
      </div>

      {/* Área Principal */}
      <div style={{ flex: 1, display: "flex" }}>
        {/* Editor */}
        <div style={{ flex: 2, borderRight: "1px solid #333" }}>
          <Editor
            height="100%"
            // CORREÇÃO: Usamos languageId que é o estado definido
            language={LANGUAGE_MAP[languageId] || "plaintext"}
            theme="vs-dark"
            value={code}
            onChange={(val) => setCode(val || "")}
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>

        {/* Painel Direito */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#1e1e1e",
            padding: "20px",
            overflowY: "auto",
          }}
        >
          <div style={{ marginBottom: "2rem" }}>
            {currentProblem ? (
              <>
                <h3
                  style={{
                    borderBottom: "1px solid #444",
                    paddingBottom: "10px",
                  }}
                >
                  {currentProblem.title}
                </h3>
                <p
                  style={{
                    lineHeight: "1.6",
                    color: "#ccc",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {currentProblem.description}
                </p>
              </>
            ) : (
              <p style={{ color: "#777" }}>
                Selecione um exercício ou aguarde o professor postar.
              </p>
            )}
          </div>

          <div style={{ marginTop: "auto", textAlign: "center" }}>
            {verdict && (
              <div
                style={{
                  padding: "15px",
                  borderRadius: "8px",
                  backgroundColor: "#2d2d2d",
                  border: `1px solid ${
                    verdict === "Accepted" ? "#4caf50" : "#f44336"
                  }`,
                }}
              >
                <h3
                  style={{
                    color: verdict === "Accepted" ? "#4caf50" : "#f44336",
                    margin: 0,
                  }}
                >
                  {verdict}
                </h3>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
