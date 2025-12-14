import { useState, useEffect } from "react";
import axios from "axios";
import Editor from "@monaco-editor/react";

interface Submission {
  id: number;
  code: string;
  language_id: number;
  stdin: string;
  stdout: string;
  status: string;
  created_at: string;
}

const LANGUAGE_MAP: { [key: number]: string } = {
  71: "python",
  63: "javascript",
  54: "cpp",
  51: "csharp",
  60: "go",
};

const LANGUAGES = [
  {
    id: 71,
    name: "Python (3.8.1)",
    defaultCode: `print("Olá, mundo!")`, // Teste com acento
  },
  {
    id: 63,
    name: "JavaScript (Node.js 12.14)",
    defaultCode: `console.log("Olá do JavaScript!");`,
  },
  {
    id: 54,
    name: "C++ (GCC 9.2.0)",
    defaultCode: `#include <iostream>\nusing namespace std;\nint main() {\n    cout << "Olá do C++";\n    return 0;\n}`,
  },
  {
    id: 51,
    name: "C# (Mono 6.6.0)",
    defaultCode: `using System;\nclass Program { static void Main() { Console.WriteLine("Olá do C#"); } }`,
  },
  {
    id: 60,
    name: "Go (1.13.5)",
    defaultCode: `package main\nimport "fmt"\nfunc main() { fmt.Println("Olá do Go") }`,
  },
];

function App() {
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const [languageId, setLanguageId] = useState<number>(71);
  const [code, setCode] = useState<string>(LANGUAGES[0].defaultCode);
  const [stdin, setStdin] = useState<string>("");
  const [output, setOutput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [history, setHistory] = useState<Submission[]>([]);

  // CORREÇÃO: Função segura para decodificar Base64 com acentos (UTF-8)
  const decodeBase64 = (base64String: string) => {
    try {
      const binaryString = atob(base64String);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return new TextDecoder("utf-8").decode(bytes);
    } catch (e) {
      console.error("Erro na decodificação:", e);
      return base64String; // Retorna original se falhar
    }
  };

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

  const runCode = async () => {
    setLoading(true);
    setOutput("");
    try {
      const response = await axios.post(`${API_URL}/submissions`, {
        code,
        language_id: languageId,
        stdin,
      });
      const data = response.data;

      // CORREÇÃO: Usando a nova função decodeBase64 em vez de atob direto
      if (data.stdout) {
        setOutput(decodeBase64(data.stdout));
      } else if (data.stderr) {
        setOutput(`Erro:\n${decodeBase64(data.stderr)}`);
      } else if (data.compile_output) {
        setOutput(`Erro de Compilação:\n${decodeBase64(data.compile_output)}`);
      } else {
        setOutput(`Status: ${data.status?.description}`);
      }

      fetchHistory();
    } catch (error: any) {
      setOutput("Erro: " + error.message);
    } finally {
      setLoading(false);
    }
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
      {/* Header */}
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
          Autocore IDE
        </h2>

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
          onClick={runCode}
          disabled={loading}
          style={{
            padding: "8px 20px",
            cursor: "pointer",
            fontWeight: "bold",
            backgroundColor: loading ? "#555" : "#0e639c",
            color: "white",
            border: "none",
            borderRadius: "4px",
          }}
        >
          {loading ? "Executando..." : "▶ Run"}
        </button>
      </div>

      {/* Main Area */}
      <div style={{ flex: 1, display: "flex" }}>
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

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#1e1e1e",
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              borderBottom: "1px solid #333",
            }}
          >
            <div
              style={{
                padding: "5px 10px",
                backgroundColor: "#252526",
                fontSize: "0.8rem",
                fontWeight: "bold",
              }}
            >
              STDIN (Input)
            </div>
            <textarea
              style={{
                flex: 1,
                width: "100%",
                backgroundColor: "#1e1e1e",
                color: "#d4d4d4",
                border: "none",
                padding: "10px",
                resize: "none",
                outline: "none",
              }}
              placeholder="Entrada..."
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
            />
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div
              style={{
                padding: "5px 10px",
                backgroundColor: "#252526",
                fontSize: "0.8rem",
                fontWeight: "bold",
              }}
            >
              STDOUT (Console)
            </div>
            <pre
              style={{
                flex: 1,
                margin: 0,
                padding: "10px",
                overflow: "auto",
                fontFamily: "monospace",
                color: output.startsWith("Erro") ? "#f14c4c" : "#fff",
              }}
            >
              {output}
            </pre>
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
          Histórico Recente
        </h4>
        <div style={{ display: "flex", gap: "10px", overflowX: "auto" }}>
          {history.map((sub) => (
            <div
              key={sub.id}
              style={{
                minWidth: "200px",
                backgroundColor: "#333",
                padding: "10px",
                borderRadius: "4px",
                fontSize: "0.8rem",
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
                {
                  LANGUAGES.find((l) => l.id === sub.language_id)?.name.split(
                    " "
                  )[0]
                }
                <span
                  style={{
                    float: "right",
                    color: sub.status === "Accepted" ? "#4caf50" : "#f44336",
                  }}
                >
                  {sub.status}
                </span>
              </div>
              <div style={{ color: "#aaa" }}>
                ID: {sub.id} • {new Date(sub.created_at).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
