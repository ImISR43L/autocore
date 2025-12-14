import { useState, useEffect } from "react";
import axios from "axios";

// Interface para tipar os dados do histórico
interface Submission {
  id: number;
  code: string;
  stdout: string;
  status: string;
  created_at: string;
}

function App() {
  const [code, setCode] = useState<string>("print('Persistencia funcionando')");
  const [output, setOutput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [history, setHistory] = useState<Submission[]>([]);

  // Carrega histórico ao iniciar
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

  const runCode = async () => {
    setLoading(true);
    setOutput("");

    try {
      const response = await axios.post("http://localhost:3000/submissions", {
        code,
      });
      const data = response.data;

      // Lógica de exibição (mesma da fase anterior)
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
      } else {
        setOutput(`Status: ${data.status?.description}`);
      }

      // Atualiza a lista após execução bem-sucedida
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
        maxWidth: "800px",
        margin: "0 auto",
      }}
    >
      <h1>Autocore - Editor & Histórico</h1>

      {/* Área do Editor */}
      <div style={{ marginBottom: "1rem" }}>
        <textarea
          rows={5}
          style={{
            width: "100%",
            padding: "10px",
            backgroundColor: "#1e1e1e",
            color: "#d4d4d4",
          }}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </div>
      <button
        onClick={runCode}
        disabled={loading}
        style={{ padding: "10px 20px", cursor: "pointer" }}
      >
        {loading ? "Executando..." : "Executar e Salvar"}
      </button>

      {/* Área de Saída Atual */}
      <div
        style={{
          marginTop: "1rem",
          padding: "1rem",
          backgroundColor: "#f4f4f4",
          borderLeft: "4px solid #333",
        }}
      >
        <strong>Saída Atual:</strong>
        <pre>{output}</pre>
      </div>

      {/* Área de Histórico */}
      <div style={{ marginTop: "3rem" }}>
        <h3>Histórico Recente (Do Banco de Dados)</h3>
        {history.map((sub) => (
          <div
            key={sub.id}
            style={{ borderBottom: "1px solid #ccc", padding: "10px 0" }}
          >
            <small style={{ color: "#666" }}>
              {new Date(sub.created_at).toLocaleString()} - ID: {sub.id}
            </small>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <code>{sub.code.substring(0, 50)}...</code>
              <span
                style={{
                  backgroundColor:
                    sub.status === "Accepted" ? "#d4edda" : "#f8d7da",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontSize: "0.8rem",
                }}
              >
                {sub.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
