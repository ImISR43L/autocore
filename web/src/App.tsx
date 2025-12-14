import { useState, useEffect } from "react";
import axios from "axios";
import Editor from "@monaco-editor/react";

interface Submission {
  id: number;
  code: string;
  language_id: number;
  status: string;
  created_at: string;
  problem: {
    id: number;
    title: string;
  };
}

const LANGUAGE_MAP: { [key: number]: string } = {
  71: "python",
  63: "javascript",
  54: "cpp",
  51: "csharp",
  60: "go",
};

// Problemas disponíveis (Idealmente viriam de uma API GET /problems)
const PROBLEMS = [
  {
    id: 1,
    title: "1. Soma Simples",
    description:
      "Leia dois valores inteiros e imprima a soma deles. Exemplo de Entrada: '5 5'. Saída Esperada: '10'.",
  },
  // Você pode adicionar mais aqui depois de criar no banco
];

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

function App() {
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

  const [languageId, setLanguageId] = useState<number>(71);
  const [problemId, setProblemId] = useState<number>(1);
  const [code, setCode] = useState<string>(LANGUAGES[0].defaultCode);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [history, setHistory] = useState<Submission[]>([]);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_URL}/submissions`);
      setHistory(res.data);
    } catch (error) {
      console.error("Erro ao buscar histórico", error);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleLanguageChange = (id: number) => {
    setLanguageId(id);
    const lang = LANGUAGES.find((l) => l.id === id);
    if (lang) setCode(lang.defaultCode);
  };

  const submitSolution = async () => {
    setLoading(true);
    setVerdict(null);
    try {
      // Agora enviamos o problem_id em vez de stdin
      const response = await axios.post(`${API_URL}/submissions`, {
        code,
        language_id: languageId,
        problem_id: problemId,
      });

      const data = response.data;
      setVerdict(data.status); // Ex: "Accepted", "Wrong Answer"

      fetchHistory();
    } catch (error: any) {
      setVerdict("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper para cor do status
  const getStatusColor = (status: string | null) => {
    if (!status) return "#fff";
    if (status === "Accepted") return "#4caf50"; // Verde
    if (status === "Wrong Answer") return "#f44336"; // Vermelho
    return "#ff9800"; // Laranja (Outros erros)
  };

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
      {/* Toolbar */}
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
        <h2 style={{ margin: 0, marginRight: "auto", fontSize: "1.2rem" }}>
          Autocore Judge
        </h2>

        {/* Seletor de Problema */}
        <select
          value={problemId}
          onChange={(e) => setProblemId(Number(e.target.value))}
          style={{
            padding: "8px",
            borderRadius: "4px",
            backgroundColor: "#3c3c3c",
            color: "white",
            border: "1px solid #555",
          }}
        >
          {PROBLEMS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>

        {/* Seletor de Linguagem */}
        <select
          value={languageId}
          onChange={(e) => handleLanguageChange(Number(e.target.value))}
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
          disabled={loading}
          style={{
            padding: "8px 25px",
            cursor: "pointer",
            fontWeight: "bold",
            backgroundColor: loading ? "#555" : "#0e639c",
            color: "white",
            border: "none",
            borderRadius: "4px",
          }}
        >
          {loading ? "Julgando..." : "Enviar Solução"}
        </button>
      </div>

      {/* Área Principal */}
      <div style={{ flex: 1, display: "flex" }}>
        {/* Editor (Esquerda) */}
        <div style={{ flex: 2, borderRight: "1px solid #333" }}>
          <Editor
            height="100%"
            theme="vs-dark"
            language={LANGUAGE_MAP[languageId]}
            value={code}
            onChange={(value) => setCode(value || "")}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              automaticLayout: true,
            }}
          />
        </div>

        {/* Painel de Informações (Direita) */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#1e1e1e",
            padding: "20px",
          }}
        >
          {/* Descrição do Problema */}
          <div style={{ marginBottom: "2rem" }}>
            <h3
              style={{ borderBottom: "1px solid #444", paddingBottom: "10px" }}
            >
              {PROBLEMS.find((p) => p.id === problemId)?.title}
            </h3>
            <p style={{ lineHeight: "1.6", color: "#ccc" }}>
              {PROBLEMS.find((p) => p.id === problemId)?.description}
            </p>
          </div>

          {/* Área de Veredito */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {verdict && (
              <div
                style={{
                  padding: "20px",
                  borderRadius: "8px",
                  backgroundColor: "#2d2d2d",
                  border: `2px solid ${getStatusColor(verdict)}`,
                  textAlign: "center",
                  width: "80%",
                }}
              >
                <h2 style={{ color: getStatusColor(verdict), margin: 0 }}>
                  {verdict}
                </h2>
                <small
                  style={{ color: "#888", marginTop: "10px", display: "block" }}
                >
                  {verdict === "Accepted"
                    ? "Parabéns! Todos os casos de teste passaram."
                    : "Verifique sua lógica e tente novamente."}
                </small>
              </div>
            )}
            {!verdict && !loading && (
              <div style={{ color: "#555", textAlign: "center" }}>
                Envie seu código para ver o resultado.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Histórico */}
      <div
        style={{
          height: "150px",
          overflowY: "auto",
          borderTop: "1px solid #333",
          backgroundColor: "#252526",
          padding: "10px",
        }}
      >
        <h4 style={{ margin: "0 0 10px 0", fontSize: "0.9rem", color: "#ccc" }}>
          Histórico de Submissões
        </h4>
        <div style={{ display: "flex", gap: "10px", overflowX: "auto" }}>
          {history.map((sub) => (
            <div
              key={sub.id}
              style={{
                minWidth: "220px",
                backgroundColor: "#333",
                padding: "10px",
                borderRadius: "4px",
                fontSize: "0.8rem",
              }}
            >
              <div
                style={{
                  fontWeight: "bold",
                  marginBottom: "5px",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>ID: {sub.id}</span>
                <span style={{ color: getStatusColor(sub.status) }}>
                  {sub.status}
                </span>
              </div>
              <div style={{ color: "#aaa", fontSize: "0.75rem" }}>
                {sub.problem?.title || "Problema " + (sub.problem as any)?.id}{" "}
                <br />
                {new Date(sub.created_at).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
