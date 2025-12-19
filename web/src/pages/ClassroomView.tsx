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
  createdAt: string; // CORREÇÃO: Padrão camelCase
  user: { email: string };
  executionTime?: number;
}

const LANGUAGE_MAP: Record<number, string> = {
  71: "python",
  63: "javascript",
  62: "java",
  50: "c",
  54: "cpp",
  60: "go",
};

const LANGUAGES = [
  { id: 71, name: "Python (3.8.1)", defaultCode: `print("Hello World")` },
  {
    id: 63,
    name: "JavaScript (Node.js)",
    defaultCode: `console.log("Hello World");`,
  },
  {
    id: 62,
    name: "Java (OpenJDK 13.0.1)",
    defaultCode: `public class Main { public static void main(String[] args) { System.out.println("Hello"); } }`,
  },
  {
    id: 50,
    name: "C (GCC 9.2.0)",
    defaultCode: `#include <stdio.h>\nint main() { printf("Hello"); return 0; }`,
  },
  {
    id: 54,
    name: "C++ (GCC 9.2.0)",
    defaultCode: `#include <iostream>\nint main() { std::cout << "Hello"; return 0; }`,
  },
  {
    id: 60,
    name: "Go (1.13.5)",
    defaultCode: `package main\nimport "fmt"\nfunc main() { fmt.Println("Hello") }`,
  },
];

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
  const [verdict, setVerdict] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const [showSubmissions, setShowSubmissions] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

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
        {
          headers: { Authorization: `Bearer ${token}` },
        }
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

  useEffect(() => {
    if (!code) {
      const lang = LANGUAGES.find((l) => l.id === languageId);
      if (lang) setCode(lang.defaultCode);
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
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_URL}/submissions`,
        { code, language_id: languageId, problem_id: selectedProblemId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setVerdict(res.data.status);
      if (res.data.status === "Accepted") toast.success("Solução Aceite!");
      else toast.error("Resposta Incorreta");
    } catch (error) {
      setVerdict("Erro");
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
      {showSubmissions && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.8)",
            zIndex: 1000,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            style={{
              backgroundColor: "#1e1e1e",
              padding: "2rem",
              borderRadius: "8px",
              width: "80%",
              maxWidth: "800px",
              maxHeight: "80vh",
              overflowY: "auto",
              border: "1px solid #444",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "1rem",
              }}
            >
              <h2>Submissões: {currentProblem?.title}</h2>
              <button
                onClick={() => setShowSubmissions(false)}
                className="btn btn-secondary"
              >
                Fechar
              </button>
            </div>

            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid #444" }}>
                  <th style={{ padding: "10px" }}>Aluno</th>
                  <th style={{ padding: "10px" }}>Veredito</th>
                  <th style={{ padding: "10px" }}>Data</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub) => (
                  <tr key={sub.id} style={{ borderBottom: "1px solid #333" }}>
                    <td style={{ padding: "10px", color: "#ccc" }}>
                      {sub.user?.email || "Desconhecido"}
                    </td>
                    <td
                      style={{
                        padding: "10px",
                        fontWeight: "bold",
                        color:
                          sub.status === "Accepted" ? "#4caf50" : "#f44336",
                      }}
                    >
                      {sub.status}
                    </td>
                    <td style={{ padding: "10px", color: "#888" }}>
                      {new Date(sub.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {submissions.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      style={{ padding: "20px", textAlign: "center" }}
                    >
                      Nenhuma submissão encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
              title="Ver Submissões"
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
              className={`ide-verdict ${
                verdict === "Accepted" ? "accepted" : "error"
              }`}
            >
              <strong>Resultado:</strong> {verdict}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
