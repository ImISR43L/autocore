import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import Editor from "@monaco-editor/react";
import "../App.css";

interface TestCase {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

interface Parameter {
  name: string;
  type: string;
}

const DATA_TYPES = [
  { value: "int", label: "Inteiro (int)" },
  { value: "float", label: "Decimal (float)" },
  { value: "string", label: "Texto (string)" },
  { value: "boolean", label: "Booleano (bool)" },
  { value: "int[]", label: "Array de Inteiros (int[])" },
  { value: "string[]", label: "Array de Texto (string[])" },
];

export default function CreateProblem() {
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const navigate = useNavigate();
  const location = useLocation();

  // Dados Básicos
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [classroomId, setClassroomId] = useState<number | null>(null);

  // Configurações
  const [type, setType] = useState<"EXERCISE" | "EXAM">("EXERCISE");
  const [maxAttempts, setMaxAttempts] = useState<number | undefined>();
  const [deadline, setDeadline] = useState("");

  // --- NOVA SEÇÃO: ASSINATURA DA FUNÇÃO ---
  const [parameters, setParameters] = useState<Parameter[]>([
    { name: "arg1", type: "int" },
  ]);
  const [returnType, setReturnType] = useState("int");

  // Casos de Teste
  const [testCases, setTestCases] = useState<TestCase[]>([]);

  // Inputs Temporários para o Novo Caso de Teste (Um valor por parâmetro)
  const [currentInputs, setCurrentInputs] = useState<string[]>([""]);
  const [currentOutput, setCurrentOutput] = useState("");
  const [currentIsHidden, setCurrentIsHidden] = useState(false);

  const [loading, setLoading] = useState(false);

  const [timeLimit, setTimeLimit] = useState<number | "">("");

  useEffect(() => {
    if (location.state?.classroomId) {
      setClassroomId(location.state.classroomId);
    }
    // Lógica para edição viria aqui
  }, [location.state]);

  // Atualiza os inputs temporários quando os parâmetros mudam
  useEffect(() => {
    setCurrentInputs(new Array(parameters.length).fill(""));
  }, [parameters.length]);

  // --- GERENCIAMENTO DE PARÂMETROS ---
  const addParameter = () => {
    setParameters([
      ...parameters,
      { name: `arg${parameters.length + 1}`, type: "int" },
    ]);
  };

  const removeParameter = (index: number) => {
    if (parameters.length === 1) return;
    const newParams = [...parameters];
    newParams.splice(index, 1);
    setParameters(newParams);
  };

  const updateParameter = (
    index: number,
    field: keyof Parameter,
    value: string
  ) => {
    const newParams = [...parameters];
    newParams[index] = { ...newParams[index], [field]: value };
    setParameters(newParams);
  };

  // --- GERENCIAMENTO DE CASOS DE TESTE ---
  const handleAddTestCase = () => {
    if (!currentOutput) return toast.warning("Defina a saída esperada.");

    // Validação e Formatação para JSON (Uma linha por argumento)
    const formattedInputs: string[] = [];

    for (let i = 0; i < currentInputs.length; i++) {
      const rawVal = currentInputs[i];
      const paramType = parameters[i].type;

      try {
        // Tenta validar se é compatível com JSON
        // Ex: se o tipo é int, o usuário digitou 5 -> JSON.parse(5) ok
        // Ex: se o tipo é string, usuário digitou "ola" -> JSON.parse("ola") ok
        // Ex: se o usuário digitou ola (sem aspas) para string -> Erro, vamos avisar

        // Tratamento especial para strings simples sem aspas (opcional, mas ajuda UX)
        let valToParse = rawVal;
        if (paramType === "string" && !rawVal.startsWith('"')) {
          valToParse = `"${rawVal}"`;
        }

        JSON.parse(valToParse); // Apenas para testar se é válido
        formattedInputs.push(valToParse);
      } catch (e) {
        return toast.error(
          `Erro no parâmetro ${parameters[i].name}: Valor inválido para JSON. Se for texto, use aspas.`
        );
      }
    }

    // Une os inputs com quebra de linha (Formato esperado pelo WrapperGenerator)
    const finalInputString = formattedInputs.join("\n");

    setTestCases([
      ...testCases,
      {
        input: finalInputString,
        expectedOutput: currentOutput,
        isHidden: currentIsHidden,
      },
    ]);

    // Limpa
    setCurrentInputs(new Array(parameters.length).fill(""));
    setCurrentOutput("");
    setCurrentIsHidden(false);
  };

  const handleRemoveTestCase = (index: number) => {
    setTestCases(testCases.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!title || !description || !slug || !classroomId)
      return toast.warning("Preencha os campos obrigatórios.");
    setLoading(true);

    try {
      const token = localStorage.getItem("token");

      const payload = {
        title,
        description,
        slug,
        classroomId,
        type,
        maxAttempts: maxAttempts ? Number(maxAttempts) : undefined,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        // --- ADICIONE O TIMELIMIT AQUI ---
        timeLimit: type === "EXAM" && timeLimit ? Number(timeLimit) : undefined,
        // ---------------------------------
        parameters,
        returnType,
        testCases,
      };

      await axios.post(`${API_URL}/problems`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success("Exercício criado com sucesso!");
      navigate(`/class/${classroomId}`);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao criar exercício. Verifique o Slug.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="container"
      style={{ maxWidth: "900px", paddingBottom: "100px" }}
    >
      <button
        onClick={() => navigate(-1)}
        className="btn btn-ghost"
        style={{ marginBottom: "20px" }}
      >
        ← Voltar
      </button>

      <h1 style={{ borderBottom: "1px solid #333", paddingBottom: "15px" }}>
        Criar Novo Exercício
      </h1>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}
      >
        <div>
          <label className="form-label">Título</label>
          <input
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Soma de Dois Números"
          />
        </div>
        <div>
          <label className="form-label">Slug (URL única)</label>
          <input
            className="form-input"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="Ex: two-sum"
          />
        </div>
      </div>

      <div style={{ marginTop: "20px" }}>
        <label className="form-label">Descrição (Markdown)</label>
        <div
          style={{
            height: "300px",
            border: "1px solid #333",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          <Editor
            height="100%"
            defaultLanguage="markdown"
            theme="vs-dark"
            value={description}
            onChange={(val) => setDescription(val || "")}
          />
        </div>
      </div>

      {/* --- CONFIGURAÇÃO DA ASSINATURA DA FUNÇÃO --- */}
      <div
        className="card-box"
        style={{
          marginTop: "30px",
          background: "#1e1e1e",
          padding: "20px",
          borderRadius: "8px",
          border: "1px solid #333",
        }}
      >
        <h3 style={{ marginTop: 0, color: "#4caf50" }}>
          ⚙️ Assinatura da Função
        </h3>
        <p style={{ fontSize: "0.85rem", color: "#888", marginBottom: "15px" }}>
          Defina os parâmetros que a função do aluno receberá. Isso gerará o
          código base automaticamente.
        </p>

        {parameters.map((param, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              gap: "10px",
              marginBottom: "10px",
              alignItems: "center",
            }}
          >
            <span style={{ color: "#666", fontSize: "0.9rem" }}>
              Parâmetro {idx + 1}:
            </span>
            <input
              className="form-input"
              placeholder="Nome (ex: nums)"
              value={param.name}
              onChange={(e) => updateParameter(idx, "name", e.target.value)}
              style={{ width: "200px" }}
            />
            <select
              className="form-select"
              value={param.type}
              onChange={(e) => updateParameter(idx, "type", e.target.value)}
              style={{ width: "200px" }}
            >
              {DATA_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {parameters.length > 1 && (
              <button
                onClick={() => removeParameter(idx)}
                className="btn btn-danger"
                style={{ padding: "5px 10px" }}
              >
                X
              </button>
            )}
          </div>
        ))}

        <button
          onClick={addParameter}
          className="btn btn-secondary"
          style={{ marginTop: "10px", fontSize: "0.8rem" }}
        >
          + Adicionar Parâmetro
        </button>

        <div
          style={{
            marginTop: "20px",
            paddingTop: "15px",
            borderTop: "1px solid #333",
          }}
        >
          <label className="form-label">Tipo de Retorno da Função:</label>
          <select
            className="form-select"
            value={returnType}
            onChange={(e) => setReturnType(e.target.value)}
            style={{ width: "250px" }}
          >
            {DATA_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* --- CONFIGURAÇÃO DE CASOS DE TESTE --- */}
      <div
        className="card-box"
        style={{
          marginTop: "30px",
          background: "#1e1e1e",
          padding: "20px",
          borderRadius: "8px",
          border: "1px solid #333",
        }}
      >
        <h3 style={{ marginTop: 0, color: "#2196f3" }}>🧪 Casos de Teste</h3>
        <p style={{ fontSize: "0.85rem", color: "#888", marginBottom: "15px" }}>
          Adicione exemplos para validar o código. Use formato JSON (aspas em
          strings, colchetes em arrays).
        </p>

        <div
          style={{
            background: "#252526",
            padding: "15px",
            borderRadius: "6px",
            marginBottom: "20px",
          }}
        >
          <h4 style={{ margin: "0 0 10px 0", fontSize: "0.9rem" }}>
            Novo Caso de Teste
          </h4>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${parameters.length}, 1fr)`,
              gap: "10px",
              marginBottom: "10px",
            }}
          >
            {parameters.map((p, idx) => (
              <div key={idx}>
                <label className="form-label" style={{ fontSize: "0.8rem" }}>
                  {p.name} ({p.type})
                </label>
                <input
                  className="form-input"
                  value={currentInputs[idx] || ""}
                  onChange={(e) => {
                    const newInputs = [...currentInputs];
                    newInputs[idx] = e.target.value;
                    setCurrentInputs(newInputs);
                  }}
                  placeholder={
                    p.type.includes("[]")
                      ? "[1, 2]"
                      : p.type === "string"
                      ? '"texto"'
                      : "10"
                  }
                />
              </div>
            ))}
          </div>

          <div style={{ marginBottom: "10px" }}>
            <label className="form-label" style={{ fontSize: "0.8rem" }}>
              Saída Esperada (JSON)
            </label>
            <input
              className="form-input"
              value={currentOutput}
              onChange={(e) => setCurrentOutput(e.target.value)}
              placeholder="Ex: 9 ou [0, 1] ou true"
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "15px",
            }}
          >
            <input
              type="checkbox"
              id="hiddenCase"
              checked={currentIsHidden}
              onChange={(e) => setCurrentIsHidden(e.target.checked)}
            />
            <label
              htmlFor="hiddenCase"
              style={{ fontSize: "0.9rem", cursor: "pointer", color: "#ccc" }}
            >
              🔒 Caso de teste oculto (não mostrar ao aluno)
            </label>
          </div>

          <button
            onClick={handleAddTestCase}
            className="btn btn-primary"
            style={{ width: "100%" }}
          >
            Adicionar Caso
          </button>
        </div>

        {/* Lista de Casos Adicionados */}
        {testCases.length > 0 && (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Entrada</th>
                <th>Saída</th>
                <th>Tipo</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {testCases.map((tc, i) => (
                <tr key={i}>
                  <td
                    style={{ fontFamily: "monospace", whiteSpace: "pre-wrap" }}
                  >
                    {tc.input.replace(/\n/g, ", ")}
                  </td>
                  <td style={{ fontFamily: "monospace" }}>
                    {tc.expectedOutput}
                  </td>
                  <td>{tc.isHidden ? "🔒 Oculto" : "👁️ Visível"}</td>
                  <td>
                    <button
                      onClick={() => handleRemoveTestCase(i)}
                      className="btn btn-danger btn-sm"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div
        style={{
          marginTop: "30px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "20px",
        }}
      >
        <div>
          <label className="form-label">Tipo de Atividade</label>
          <select
            className="form-select"
            value={type}
            onChange={(e) => setType(e.target.value as any)}
          >
            <option value="EXERCISE">Exercício (Livre)</option>
            <option value="EXAM">Prova (Restrito)</option>
          </select>
        </div>
        <div>
          <label className="form-label">Tentativas (Prova)</label>
          <input
            type="number"
            className="form-input"
            placeholder="Ilimitado"
            value={maxAttempts || ""}
            onChange={(e) => setMaxAttempts(Number(e.target.value))}
            disabled={type === "EXERCISE"}
          />
        </div>
        <div>
          <label className="form-label">Duração (Minutos)</label>
          <input
            type="number"
            className="form-input"
            placeholder="Ex: 90"
            value={timeLimit}
            onChange={(e) => setTimeLimit(Number(e.target.value))}
            disabled={type === "EXERCISE"}
          />
        </div>
        <div>
          <label className="form-label">Prazo de Entrega</label>
          <input
            type="datetime-local"
            className="form-input"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>
      </div>

      <div style={{ marginTop: "40px", display: "flex", gap: "10px" }}>
        <button
          className="btn btn-primary"
          style={{ flex: 1, padding: "15px", fontSize: "1.1rem" }}
          onClick={handleCreate}
          disabled={loading}
        >
          {loading ? "Criando..." : "🚀 Criar Exercício"}
        </button>
      </div>
    </div>
  );
}
