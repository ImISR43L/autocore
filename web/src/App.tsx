import { useState, useEffect } from "react";
import axios from "axios";
import Editor from "@monaco-editor/react"; // Importação do Monaco

interface Submission {
  id: number;
  code: string;
  language_id: number;
  stdin: string;
  stdout: string;
  status: string;
  created_at: string;
}

// Mapeamento para o Monaco entender qual sintaxe colorir
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
    defaultCode: "print(input('Digite algo: '))",
  },
  {
    id: 63,
    name: "JavaScript (Node.js 12.14)",
    defaultCode: "console.log(process.argv);",
  },
  {
    id: 54,
    name: "C++ (GCC 9.2.0)",
    defaultCode:
      '#include <iostream>\nusing namespace std;\nint main() {\n    string s;\n    cin >> s;\n    cout << "Ola " << s;\n    return 0;\n}',
  },
  {
    id: 51,
    name: "C# (Mono 6.6.0)",
    defaultCode:
      'using System;\nclass Program { static void Main() { Console.WriteLine("Hello C#"); } }',
  },
  {
    id: 60,
    name: "Go (1.13.5)",
    defaultCode:
      'package main\nimport "fmt"\nfunc main() { fmt.Println("Hello Go") }',
  },
];

function App() {
  const [languageId, setLanguageId] = useState<number>(71);
  const [code, setCode] = useState<string>(LANGUAGES[0].defaultCode);
  const [stdin, setStdin] = useState<string>("");
  const [output, setOutput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [history, setHistory] = useState<Submission[]>([]);

  const fetchHistory = async () => {
    try {
      const res = await axios.get("http://localhost:3000/submissions");
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
      const response = await axios.post("http://localhost:3000/submissions", {
        code,
        language_id: languageId,
        stdin,
      });
      const data = response.data;

      if (data.stdout) {
        try {
          setOutput(atob(data.stdout));
        } catch {
          setOutput(data.stdout);
        }
      } else if (data.stderr) {
        try {
          setOutput(`Erro:\n${atob(data.stderr)}`);
        } catch {
          setOutput(data.stderr);
        }
      } else if (data.compile_output) {
        try {
          setOutput(`Erro de Compilação:\n${atob(data.compile_output)}`);
        } catch {
          setOutput(data.compile_output);
        }
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
      {/* Header / Toolbar */}
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

      {/* Main Area: Split Screen */}
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
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>

        {/* Painel Lateral (Direita) */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#1e1e1e",
          }}
        >
          {/* Input */}
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
              placeholder="Entrada de dados aqui..."
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
            />
          </div>

          {/* Output */}
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

      {/* Footer / Histórico Colapsável (Simplificado para visualização) */}
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
