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
  if (!logs && status === "Pending") {
    return (
      <div className="flex items-center justify-center p-8 text-gray-500 bg-[#161616] rounded-lg border border-[#333] border-dashed">
        <Terminal size={24} className="mr-2 animate-pulse" />
        <span>Aguardando execução...</span>
      </div>
    );
  }

  // Define cores baseadas no status
  const getStatusColor = () => {
    switch (status) {
      case "Accepted":
        return "border-green-500/50 bg-green-500/5";
      case "Compilation Error":
      case "Runtime Error":
        return "border-red-500/50 bg-red-500/5";
      case "Wrong Answer":
        return "border-yellow-500/50 bg-yellow-500/5";
      default:
        return "border-[#333] bg-[#161616]";
    }
  };

  const getHeaderIcon = () => {
    switch (status) {
      case "Accepted":
        return <CheckCircle className="text-green-500" size={18} />;
      case "Compilation Error":
      case "Runtime Error":
        return <AlertCircle className="text-red-500" size={18} />;
      case "Wrong Answer":
        return <AlertTriangle className="text-yellow-500" size={18} />;
      default:
        return <Terminal className="text-gray-400" size={18} />;
    }
  };

  // Processa linha a linha para colorir erros específicos
  const renderLogLines = () => {
    if (!logs)
      return (
        <span className="text-gray-500 italic">Sem output disponível.</span>
      );

    return logs.split("\n").map((line, i) => {
      // Estilização simples de sintaxe para logs
      let className = "text-gray-300"; // Padrão

      if (
        line.includes("Error:") ||
        line.includes("Exception") ||
        line.includes("❌")
      ) {
        className = "text-red-400 font-bold";
      } else if (line.includes("Warning:") || line.includes("AVISO")) {
        className = "text-yellow-400";
      } else if (line.trim().startsWith("Linha") || line.includes('File "')) {
        className = "text-blue-400 underline decoration-blue-400/30";
      } else if (line.includes("Output Esperado:")) {
        className = "text-green-400";
      } else if (line.includes("Seu Output:")) {
        className = "text-red-400";
      }

      return (
        <div
          key={i}
          className={`${className} font-mono text-sm py-0.5 whitespace-pre-wrap break-words`}
        >
          {line}
        </div>
      );
    });
  };

  return (
    <div
      className={`rounded-lg border ${getStatusColor()} overflow-hidden transition-colors duration-300`}
    >
      {/* Cabeçalho do Log */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#333] bg-[#111]">
        {getHeaderIcon()}
        <span className="font-semibold text-sm text-gray-200">
          {status === "Accepted"
            ? "Resultado da Execução"
            : "Log de Erro / Debug"}
        </span>
      </div>

      {/* Corpo do Log (Console) */}
      <div className="p-4 bg-[#0a0a0a] max-h-[300px] overflow-y-auto custom-scrollbar">
        {renderLogLines()}
      </div>
    </div>
  );
}
