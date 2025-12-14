import { useState, useEffect } from "react";
import axios from "axios";

interface Submission {
  id: number;
  code: string;
  language_id: number;
  stdin: string;
  stdout: string;
  status: string;
  created_at: string;
}

// Configuração das linguagens suportadas
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
      '#include <iostream>\nint main() { std::cout << "Hello C++"; return 0; }',
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
      // Envia codigo, linguagem E input
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
        padding: "2rem",
        fontFamily: "monospace",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      <h1>Autocore IDE</h1>

      <div style={{ marginBottom: "1rem", display: "flex", gap: "1rem" }}>
        <select
          value={languageId}
          onChange={(e) => handleLanguageChange(Number(e.target.value))}
          style={{ padding: "8px", fontSize: "1rem" }}
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
            flexGrow: 1,
            fontWeight: "bold",
          }}
        >
          {loading ? "Executando..." : "▶ RODAR CÓDIGO"}
        </button>
      </div>

      <div style={{ display: "flex", gap: "1rem", height: "400px" }}>
        <div style={{ flex: 2, display: "flex", flexDirection: "column" }}>
          <label>
            <strong>Source Code:</strong>
          </label>
          <textarea
            style={{
              flex: 1,
              padding: "10px",
              backgroundColor: "#1e1e1e",
              color: "#d4d4d4",
              fontFamily: "monospace",
            }}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <label>
              <strong>Custom Input (Stdin):</strong>
            </label>
            <textarea
              style={{ flex: 1, padding: "10px", backgroundColor: "#f0f0f0" }}
              placeholder="Digite aqui dados de entrada..."
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
            />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <label>
              <strong>Output:</strong>
            </label>
            <pre
              style={{
                flex: 1,
                padding: "10px",
                backgroundColor: "#333",
                color: "#fff",
                overflow: "auto",
                margin: 0,
              }}
            >
              {output}
            </pre>
          </div>
        </div>
      </div>

      <div style={{ marginTop: "3rem" }}>
        <h3>Histórico de Execuções</h3>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.9rem",
          }}
        >
          <thead>
            <tr style={{ textAlign: "left", backgroundColor: "#eee" }}>
              <th style={{ padding: "8px" }}>Lang</th>
              <th>Preview</th>
              <th>Status</th>
              <th>Input</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {history.map((sub) => {
              const langName =
                LANGUAGES.find((l) => l.id === sub.language_id)?.name ||
                sub.language_id;
              return (
                <tr key={sub.id} style={{ borderBottom: "1px solid #ddd" }}>
                  <td style={{ padding: "8px" }}>{langName}</td>
                  <td>
                    <code>{sub.code.substring(0, 30)}...</code>
                  </td>
                  <td>{sub.status}</td>
                  <td>{sub.stdin ? "Sim" : "-"}</td>
                  <td>{new Date(sub.created_at).toLocaleTimeString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
