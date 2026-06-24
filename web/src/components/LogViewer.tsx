import {
  AlertCircle,
  CheckCircle,
  Terminal,
  AlertTriangle,
} from "lucide-react";

interface LogViewerProps {
  logs: string;
  status:
    | "Pending"
    | "Accepted"
    | "Wrong Answer"
    | "Time Limit Exceeded"
    | "Compilation Error"
    | "Runtime Error"
    | "Memory Limit Exceeded";
}

export default function LogViewer({ logs, status }: LogViewerProps) {
  // Estado de Carregamento
  if (!logs && status === "Pending") {
    return (
      <div className="log-container log-status-pending flex items-center justify-center p-8">
        <Terminal size={24} className="mr-2 animate-pulse" />
        <span>Aguardando execução...</span>
      </div>
    );
  }

  // 1. Determinar classe do Container
  const getContainerClass = () => {
    switch (status) {
      case "Accepted":
        return "log-status-accepted";
      case "Compilation Error":
      case "Runtime Error":
      case "Memory Limit Exceeded":
      case "Time Limit Exceeded":
        return "log-status-error";
      case "Wrong Answer":
        return "log-status-warning";
      default:
        return "log-status-default";
    }
  };

  // 2. Determinar Ícone e sua classe
  const renderHeaderIcon = () => {
    switch (status) {
      case "Accepted":
        return <CheckCircle className="log-icon-success" size={18} />;
      case "Compilation Error":
      case "Runtime Error":
      case "Memory Limit Exceeded":
      case "Time Limit Exceeded":
        return <AlertCircle className="log-icon-error" size={18} />;
      case "Wrong Answer":
        return <AlertTriangle className="log-icon-warning" size={18} />;
      default:
        return <Terminal className="log-icon-default" size={18} />;
    }
  };

  // 3. Renderizar linhas com classes semânticas
  const renderLogLines = () => {
    if (!logs)
      return (
        <span className="text-gray-500 italic">Sem output disponível.</span>
      );

    return logs.split("\n").map((line, i) => {
      let lineClass = "log-text-default";

      // Lógica de detecção de erros/avisos
      if (
        line.includes("Error:") ||
        line.includes("Exception") ||
        line.includes("❌") ||
        line.trim().startsWith("✘")
      ) {
        lineClass = "log-text-error";
      } else if (line.trim().startsWith("✔")) {
        lineClass = "log-text-success";
      } else if (line.includes("Warning:") || line.includes("AVISO")) {
        lineClass = "log-text-warning";
      } else if (line.trim().startsWith("Linha") || line.includes('File "')) {
        lineClass = "log-text-info";
      } else if (
        line.includes("Output Esperado:") ||
        line.includes("Correto")
      ) {
        lineClass = "log-text-success";
      } else if (line.includes("Seu Output:") || line.includes("Errado")) {
        lineClass = "log-text-error";
      }

      return (
        <div key={i} className={`log-line ${lineClass}`}>
          {line}
        </div>
      );
    });
  };

  return (
    <div className={`log-container ${getContainerClass()}`}>
      {/* Cabeçalho */}
      <div className="log-header">
        {renderHeaderIcon()}
        <span>
          {status === "Accepted"
            ? "Resultado da Execução"
            : status === "Pending"
              ? "Processando..."
              : "Log de Erro / Debug"}
        </span>
      </div>

      {/* Conteúdo */}
      <div className="log-content">{renderLogLines()}</div>
    </div>
  );
}
