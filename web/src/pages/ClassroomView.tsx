// web/src/pages/ClassroomView.tsx
import { useState, useEffect } from "react";
import axios from "axios";
import Editor from "@monaco-editor/react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/atom-one-dark.css";
import "../App.css";

interface Problem {
  id: string;
  title: string;
  description: string;
  slug: string;
  testCases?: any[];
}

interface Classroom {
  id: number;
  name: string;
  code: string;
  owner: { id: number; email: string };
  problems: Problem[];
}

interface Submission {
  id: string;
  status: string;
  code: string; // <--- Importante para inspeção
  stdout?: string; // <--- Importante para inspeção
  stderr?: string; // <--- Importante para inspeção
  createdAt: string;
  user: { email: string };
  executionTime?: number;
}

// Templates de Código (IO Corrigido)
const LANGUAGES = [
  {
    id: 71,
    name: "Python (3.8.1)",
    defaultCode: `import sys\n\n# Lê a entrada padrão\ninput_data = sys.stdin.read().split()\n\nif len(input_data) >= 2:\n    # Exemplo: Soma dois números\n    a = int(input_data[0])\n    b = int(input_data[1])\n    print(a + b)`,
  },
  {
    id: 63,
    name: "JavaScript (Node.js)",
    defaultCode: `const fs = require('fs');\nconst input = fs.readFileSync('/dev/stdin').toString().trim().split(/\\s+/);\n\n// Exemplo: Soma dois números\nconst a = parseInt(input[0]);\nconst b = parseInt(input[1]);\nconsole.log(a + b);`,
  },
  {
    id: 62,
    name: "Java (OpenJDK 13.0.1)",
    defaultCode: `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        if (scanner.hasNextInt()) {\n            int a = scanner.nextInt();\n            int b = scanner.nextInt();\n            System.out.println(a + b);\n        }\n        scanner.close();\n    }\n}`,
  },
  {
    id: 50,
    name: "C (GCC 9.2.0)",
    defaultCode: `#include <stdio.h>\n\nint main() {\n    int a, b;\n    if (scanf("%d %d", &a, &b) == 2) {\n        printf("%d", a + b);\n    }\n    return 0;\n}`,
  },
  {
    id: 54,
    name: "C++ (GCC 9.2.0)",
    defaultCode: `#include <iostream>\n\nint main() {\n    int a, b;\n    if (std::cin >> a >> b) {\n        std::cout << (a + b);\n    }\n    return 0;\n}`,
  },
  {
    id: 60,
    name: "Go (1.13.5)",
    defaultCode: `package main\nimport "fmt"\n\nfunc main() {\n    var a, b int\n    if _, err := fmt.Scan(&a, &b); err == nil {\n        fmt.Println(a + b)\n    }\n}`,
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

  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(
    null
  );
  const [languageId, setLanguageId] = useState<number>(71);
  const [code, setCode] = useState<string>("");

  // Estados de Execução (Feedback Imediato)
  const [verdict, setVerdict] = useState<string | null>(null);
  const [executionOutput, setExecutionOutput] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Estados de Histórico (Professor)
  const [showSubmissions, setShowSubmissions] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [inspectingSubmission, setInspectingSubmission] =
    useState<Submission | null>(null);

  const getMyUserId = () => {
    const token = localStorage.getItem("token");
    if (!token) return null;
    try {
      return JSON.parse(atob(token.split(".")[1])).sub;
    } catch {
      return null;
    }
  };

  const isOwner = classroom?.owner?.id === getMyUserId();

  const fetchClassroomData = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_URL}/classrooms/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setClassroom(res.data);

      if (res.data.problems?.length > 0 && !selectedProblemId) {
        setSelectedProblemId(res.data.problems[0].id);
      }
    } catch (error) {
      toast.error("Erro ao carregar turma.");
      navigate("/dashboard");
    }
  };

  const fetchSubmissions = async () => {
    if (!selectedProblemId) return;
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(
        `${API_URL}/submissions/problem/${selectedProblemId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSubmissions(res.data);
      setShowSubmissions(true);
    } catch (error) {
      toast.error("Erro ao carregar submissões.");
    }
  };

  useEffect(() => {
    fetchClassroomData();
  }, [id]);

  // Atualiza o template quando troca a linguagem
  useEffect(() => {
    const lang = LANGUAGES.find((l) => l.id === languageId);
    if (lang) {
      setCode(lang.defaultCode);
    }
  }, [languageId]);

  const handleDeleteProblem = async () => {
    if (!selectedProblemId || !confirm("Tem a certeza?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_URL}/problems/${selectedProblemId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Eliminado!");
      setSelectedProblemId(null);
      fetchClassroomData();
    } catch (error) {
      toast.error("Erro ao eliminar.");
    }
  };

  const handleEditProblem = () => {
    if (!selectedProblemId || !classroom) return;
    const problem = classroom.problems.find((p) => p.id === selectedProblemId);
    if (problem)
      navigate("/create-problem", {
        state: { classroomId: classroom.id, problemToEdit: problem },
      });
  };

  const submitSolution = async () => {
    if (!selectedProblemId) return toast.warning("Selecione um exercício!");
    setLoading(true);
    setVerdict(null);
    setExecutionOutput(null);
    setExecutionError(null);

    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_URL}/submissions`,
        { code, language_id: languageId, problem_id: selectedProblemId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = res.data;
      setVerdict(data.status);
      setExecutionOutput(data.stdout);
      setExecutionError(data.stderr);

      if (data.status === "Accepted") toast.success("Solução Aceite!");
      else toast.error("Resposta Incorreta ou Erro");
    } catch (error) {
      setVerdict("Erro de Comunicação");
      toast.error("Falha na submissão");
    } finally {
      setLoading(false);
    }
  };

  if (!classroom) return <div className="container">Carregando...</div>;
  const currentProblem = classroom.problems.find(
    (p) => p.id === selectedProblemId
  );

  return (
    <div className="ide-container">
      {/* MODAL DE LISTAGEM DE SUBMISSÕES */}
      {showSubmissions && (
        <div className="modal-overlay">
          <div className="modal-content large">
            <div className="modal-header">
              <h2>Submissões: {currentProblem?.title}</h2>
              <button
                onClick={() => setShowSubmissions(false)}
                className="btn btn-secondary"
              >
                Fechar
              </button>
            </div>

            <table className="custom-table">
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Veredito</th>
                  <th>Data</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub) => (
                  <tr key={sub.id}>
                    <td>{sub.user?.email || "Desconhecido"}</td>
                    <td>
                      <span
                        className={`status-badge ${
                          sub.status === "Accepted" ? "success" : "error"
                        }`}
                      >
                        {sub.status}
                      </span>
                    </td>
                    <td>{new Date(sub.createdAt).toLocaleString()}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => setInspectingSubmission(sub)}
                      >
                        🔍 Inspecionar
                      </button>
                    </td>
                  </tr>
                ))}
                {submissions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center">
                      Nenhuma submissão.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DE INSPEÇÃO DETALHADA */}
      {inspectingSubmission && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content x-large">
            <div className="modal-header">
              <h3>Inspecionando: {inspectingSubmission.user?.email}</h3>
              <button
                onClick={() => setInspectingSubmission(null)}
                className="btn btn-secondary"
              >
                Voltar
              </button>
            </div>

            <div className="inspection-grid">
              <div className="inspection-code">
                <h4 className="label">Código Submetido</h4>
                <Editor
                  height="50vh"
                  language={LANGUAGE_MAP[71]} // Idealmente salvar lang_id no DB e usar aqui
                  theme="vs-dark"
                  value={inspectingSubmission.code}
                  options={{ readOnly: true, minimap: { enabled: false } }}
                />
              </div>
              <div className="inspection-output">
                <div className="output-block">
                  <h4 className="label">Status</h4>
                  <div
                    className={`status-box ${
                      inspectingSubmission.status === "Accepted"
                        ? "success"
                        : "error"
                    }`}
                  >
                    {inspectingSubmission.status}
                  </div>
                </div>

                {inspectingSubmission.stderr && (
                  <div className="output-block">
                    <h4 className="label error">Erro (Stderr)</h4>
                    <pre className="code-block error">
                      {inspectingSubmission.stderr}
                    </pre>
                  </div>
                )}

                {inspectingSubmission.stdout && (
                  <div className="output-block">
                    <h4 className="label">Saída (Stdout)</h4>
                    <pre className="code-block">
                      {inspectingSubmission.stdout}
                    </pre>
                  </div>
                )}

                {!inspectingSubmission.stdout &&
                  !inspectingSubmission.stderr && (
                    <p className="text-muted">Sem saída gerada.</p>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HEADER DA PÁGINA */}
      <div
        className="page-header"
        style={{ padding: "1rem 1.5rem", marginBottom: 0 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button
            onClick={() => navigate("/dashboard")}
            className="btn btn-ghost"
          >
            ←
          </button>
          <h2 className="page-title" style={{ fontSize: "1.2rem" }}>
            {classroom.name}
          </h2>
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

      {/* TOOLBAR */}
      <div className="ide-toolbar">
        <select
          className="form-select"
          style={{ width: "auto", minWidth: "250px" }}
          value={selectedProblemId || ""}
          onChange={(e) => setSelectedProblemId(e.target.value)}
        >
          {classroom.problems.length === 0 && <option>Sem exercícios</option>}
          {classroom.problems.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>

        {isOwner && selectedProblemId && (
          <div style={{ display: "flex", gap: "5px", marginLeft: "10px" }}>
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
            <button
              onClick={fetchSubmissions}
              className="btn btn-primary"
              style={{ backgroundColor: "#555" }}
            >
              📊 Ver Submissões
            </button>
          </div>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
          <select
            className="form-select"
            style={{ width: "auto" }}
            value={languageId}
            onChange={(e) => setLanguageId(Number(e.target.value))}
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
          >
            {loading ? "..." : "▶ Enviar"}
          </button>
        </div>
      </div>

      {/* ÁREA PRINCIPAL (IDE) */}
      <div className="ide-main">
        <div className="ide-editor-panel">
          <Editor
            height="100%"
            language={LANGUAGE_MAP[languageId] || "plaintext"}
            theme="vs-dark"
            value={code}
            onChange={(val) => setCode(val || "")}
            options={{ minimap: { enabled: false }, automaticLayout: true }}
          />
        </div>

        {/* PAINEL DE INFORMAÇÕES E FEEDBACK DO ALUNO */}
        <div className="ide-info-panel">
          {currentProblem ? (
            <>
              <h3 className="ide-info-title">{currentProblem.title}</h3>
              <div className="ide-description markdown-body">
                <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                  {currentProblem.description}
                </ReactMarkdown>
              </div>
            </>
          ) : (
            <p className="ide-description">Selecione um exercício.</p>
          )}

          {verdict && (
            <div
              className={`ide-feedback-box ${
                verdict === "Accepted" ? "success" : "error"
              }`}
            >
              <div className="feedback-header">
                <strong>Resultado:</strong> {verdict}
              </div>

              {executionError && (
                <div className="feedback-section">
                  <span className="feedback-label">Erro:</span>
                  <pre className="feedback-code error">{executionError}</pre>
                </div>
              )}

              {executionOutput && verdict !== "Accepted" && (
                <div className="feedback-section">
                  <span className="feedback-label">Sua Saída:</span>
                  <pre className="feedback-code">{executionOutput}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
