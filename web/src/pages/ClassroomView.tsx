import { useState, useEffect } from "react";
import axios from "axios";
import Editor from "@monaco-editor/react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import "../App.css";

// Interfaces
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

// Mapa de Linguagens (Judge0 ID -> Monaco String)
const LANGUAGE_MAP: Record<number, string> = {
  71: "python",
  63: "javascript",
  62: "java",
  50: "c",
  54: "cpp",
  60: "go",
};

// Lista completa de Templates
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
    id: 62,
    name: "Java (OpenJDK 13.0.1)",
    defaultCode: `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        if (scanner.hasNextInt()) {\n            int a = scanner.nextInt();\n            int b = scanner.nextInt();\n            System.out.println(a + b);\n        }\n    }\n}`,
  },
  {
    id: 50,
    name: "C (GCC 9.2.0)",
    defaultCode: `#include <stdio.h>\n\nint main() {\n    int a, b;\n    if (scanf("%d %d", &a, &b) == 2) {\n        printf("%d", a + b);\n    }\n    return 0;\n}`,
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

  useEffect(() => {
    fetchClassroomData();
  }, [id]);

  const handleDeleteProblem = async () => {
    if (!selectedProblemId) return;
    if (!confirm("Tem certeza que deseja excluir este exercício?")) return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_URL}/problems/${selectedProblemId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Exercício excluído!");
      setSelectedProblemId(null);
      fetchClassroomData();
    } catch (error) {
      toast.error("Erro ao excluir.");
    }
  };

  const handleEditProblem = () => {
    if (!selectedProblemId || !classroom) return;
    const problem = classroom.problems.find((p) => p.id === selectedProblemId);
    if (!problem) return;

    navigate("/create-problem", {
      state: {
        classroomId: classroom.id,
        problemToEdit: problem,
      },
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
      if (res.data.status === "Accepted") toast.success("Solução Aceita!");
      else toast.error("Resposta Incorreta");
    } catch (error: any) {
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
      {/* Header */}
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

      {/* Toolbar */}
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

        {/* Ações do Professor */}
        {isOwner && selectedProblemId && (
          <div style={{ display: "flex", gap: "5px", marginLeft: "10px" }}>
            <button
              onClick={handleEditProblem}
              className="btn btn-secondary"
              title="Editar Exercício"
              style={{ padding: "8px 12px" }}
            >
              ✏️
            </button>
            <button
              onClick={handleDeleteProblem}
              className="btn btn-danger"
              title="Excluir Exercício"
              style={{ padding: "8px 12px" }}
            >
              🗑️
            </button>
          </div>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
          <select
            className="form-select"
            style={{ width: "auto" }}
            value={languageId}
            onChange={(e) => {
              const newId = Number(e.target.value);
              setLanguageId(newId);
              // Atualiza o código se houver um padrão para a linguagem selecionada
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
          >
            {loading ? "..." : "▶ Enviar"}
          </button>
        </div>
      </div>

      {/* Main Area */}
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
              <p className="ide-description">{currentProblem.description}</p>
            </>
          ) : (
            <p className="ide-description">
              Selecione um exercício para começar.
            </p>
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
