import React from "react";

interface LogViewerProps {
  content: string;
  type?: "info" | "error";
  height?: number | string;
}

export const LogViewer: React.FC<LogViewerProps> = ({
  content,
  type = "info",
  height = 300,
}) => {
  // Se não houver conteúdo, não renderiza nada
  if (!content) return null;

  return (
    <div
      style={{
        height: typeof height === "number" ? `${height}px` : height,
        width: "100%",
        backgroundColor:
          type === "error" ? "rgba(69, 10, 10, 0.1)" : "rgba(0, 0, 0, 0.3)",
        borderRadius: "4px",
        border:
          type === "error"
            ? "1px solid rgba(127, 29, 29, 0.3)"
            : "1px solid transparent",
        overflow: "hidden", // Garante que o container respeite a altura
        display: "flex",
        flexDirection: "column",
      }}
    >
      <pre
        style={{
          margin: 0,
          padding: "10px",
          fontFamily: "monospace",
          fontSize: "0.875rem", // text-sm
          whiteSpace: "pre-wrap", // Quebra linhas longas automaticamente
          wordBreak: "break-all", // Evita scroll horizontal infinito
          color: type === "error" ? "#fca5a5" : "#d1d5db", // Cores Tailwind (red-300 / gray-300)
          overflowY: "auto", // Scroll vertical nativo
          height: "100%",
          width: "100%",
        }}
      >
        {content}
      </pre>
    </div>
  );
};
