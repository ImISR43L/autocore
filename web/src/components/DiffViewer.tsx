import React, { useMemo } from "react";
import * as Diff from "diff";
import { usePreferences } from "../contexts/PreferencesContext";

interface DiffViewerProps {
  expected: string;
  actual: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ expected, actual }) => {
  const { colorblindMode, theme } = usePreferences(); // <--- Hook

  // Lógica de Cores baseada no Modo
  const colors = useMemo(() => {
    const isDark = theme === "dark";

    switch (colorblindMode) {
      case "deuteranopia": // Azul (Correto) vs Laranja (Erro)
        return {
          bgRemoved: isDark
            ? "rgba(37, 99, 235, 0.3)"
            : "rgba(59, 130, 246, 0.2)",
          textRemoved: isDark ? "#bfdbfe" : "#1e40af", // blue-200 / blue-800
          bgAdded: isDark
            ? "rgba(234, 88, 12, 0.3)"
            : "rgba(249, 115, 22, 0.2)",
          textAdded: isDark ? "#fed7aa" : "#9a3412", // orange-200 / orange-800
          headerExpected: "#60a5fa", // blue-400
          headerActual: "#fb923c", // orange-400
        };
      case "tritanopia": // Ciano (Correto) vs Rosa (Erro)
        return {
          bgRemoved: isDark
            ? "rgba(8, 145, 178, 0.3)"
            : "rgba(6, 182, 212, 0.2)",
          textRemoved: isDark ? "#a5f3fc" : "#155e75",
          bgAdded: isDark ? "rgba(225, 29, 72, 0.3)" : "rgba(244, 63, 94, 0.2)",
          textAdded: isDark ? "#fecdd3" : "#9f1239",
          headerExpected: "#22d3ee",
          headerActual: "#fb7185",
        };
      case "achromatopsia": // Escala de Cinza + Estilos (Negrito/Sublinhado)
        return {
          bgRemoved: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.1)",
          textRemoved: isDark ? "#ffffff" : "#000000",
          bgAdded: isDark
            ? "rgba(128, 128, 128, 0.3)"
            : "rgba(128, 128, 128, 0.2)",
          textAdded: isDark ? "#d4d4d8" : "#52525b",
          headerExpected: isDark ? "#ffffff" : "#000000",
          headerActual: isDark ? "#a1a1aa" : "#52525b",
        };
      default: // Padrão (Verde vs Vermelho)
        return {
          bgRemoved: "rgba(22, 101, 52, 0.5)",
          textRemoved: "#dcfce7",
          bgAdded: "rgba(127, 29, 29, 0.5)",
          textAdded: "#fee2e2",
          headerExpected: "#4ade80",
          headerActual: "#f87171",
        };
    }
  }, [colorblindMode, theme]);

  // 1. Lógica de Pré-processamento (JSON e Formatação)
  const { formattedExpected, formattedActual, isJson } = useMemo(() => {
    try {
      // Tenta detectar se ambos são JSONs válidos
      const expObj = JSON.parse(expected);
      const actObj = JSON.parse(actual);
      return {
        formattedExpected: JSON.stringify(expObj, null, 2), // Formata com 2 espaços
        formattedActual: JSON.stringify(actObj, null, 2),
        isJson: true,
      };
    } catch (e) {
      // Se não for JSON, mantém o texto original
      return {
        formattedExpected: expected,
        formattedActual: actual,
        isJson: false,
      };
    }
  }, [expected, actual]);

  // 2. Gera o Diff (Usa diffLines para JSON para melhor leitura, diffChars para outros)
  const diffs = useMemo(() => {
    if (isJson) {
      return Diff.diffLines(formattedExpected, formattedActual);
    }
    return Diff.diffChars(formattedExpected, formattedActual);
  }, [formattedExpected, formattedActual, isJson]);

  // Renderizador de caracteres invisíveis (espaços/quebras)
  const renderContent = (text: string) => {
    if (isJson) return text; // Em JSON formatado, não mostramos bolinhas de espaço para não poluir
    return text.split("").map((char, index) => {
      if (char === " ")
        return (
          <span key={index} style={{ opacity: 0.3 }}>
            ·
          </span>
        );
      if (char === "\n")
        return (
          <span key={index} style={{ opacity: 0.3, userSelect: "none" }}>
            ↵{"\n"}
          </span>
        );
      return char;
    });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        marginTop: "8px",
        width: "100%",
        fontFamily: "monospace",
        fontSize: "12px",
      }}
    >
      {/* Cabeçalho */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          color: "#9ca3af",
          fontWeight: "bold",
          textTransform: "uppercase",
          fontSize: "10px",
        }}
      >
        <span>Comparação {isJson ? "(JSON Formatado)" : "(Texto Puro)"}</span>
        {!isJson && <span style={{ opacity: 0.5 }}>· Espaços visíveis</span>}
      </div>

      {/* Container Principal (Flexbox Forçado via Style) */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          border: "1px solid #374151",
          borderRadius: "6px",
          overflow: "hidden",
          backgroundColor: "#1e1e1e",
        }}
      >
        {/* LADO ESQUERDO: GABARITO (Verde) */}
        <div
          style={{
            width: "50%",
            borderRight: "1px solid #374151",
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <div
            style={{
              backgroundColor: "rgba(31, 41, 55, 0.8)",
              padding: "4px 8px",
              color: colors.headerExpected,
              borderBottom: "1px solid #374151",
              textAlign: "center",
              fontSize: "10px",
            }}
          >
            ESPERADO
          </div>
          <div
            style={{
              padding: "8px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              overflowY: "auto",
              maxHeight: "400px",
              lineHeight: "1.5",
            }}
          >
            {diffs.map((part, index) => {
              // Lado esquerdo mostra o original. Ignora o que foi "adicionado" pelo aluno.
              if (part.added) return null;

              const style: React.CSSProperties = part.removed
                ? {
                    backgroundColor: colors.bgRemoved, // <--- USO DA COR
                    color: colors.textRemoved, // <--- USO DA COR
                    textDecoration:
                      colorblindMode === "achromatopsia" || !isJson
                        ? "underline"
                        : "none", // Reforço visual
                    fontWeight: "bold",
                    border:
                      colorblindMode === "achromatopsia"
                        ? "1px solid white"
                        : "none",
                  } // Verde destaque
                : { color: "#6b7280", opacity: 0.7 }; // Texto comum apagado

              return (
                <span key={index} style={style}>
                  {renderContent(part.value)}
                </span>
              );
            })}
          </div>
        </div>

        {/* LADO DIREITO: ALUNO (Vermelho) */}
        <div
          style={{
            width: "50%",
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <div
            style={{
              backgroundColor: "rgba(31, 41, 55, 0.8)",
              padding: "4px 8px",
              color: colors.headerActual, // <--- USO DA COR
              borderBottom: "1px solid #374151",
              textAlign: "center",
              fontSize: "10px",
            }}
          >
            SEU RESULTADO
          </div>
          <div
            style={{
              padding: "8px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              overflowY: "auto",
              maxHeight: "400px",
              lineHeight: "1.5",
            }}
          >
            {diffs.map((part, index) => {
              // Lado direito mostra o input do aluno. Ignora o que foi "removido" (o que faltou).
              if (part.removed) return null;

              const style: React.CSSProperties = part.added
                ? {
                    backgroundColor: colors.bgAdded, // <--- USO DA COR
                    color: colors.textAdded, // <--- USO DA COR
                    fontWeight: "bold",
                    textDecoration:
                      colorblindMode === "achromatopsia"
                        ? "line-through"
                        : "none", // Reforço visual
                  } // Vermelho destaque
                : { color: "#d1d5db" }; // Texto comum normal

              return (
                <span key={index} style={style}>
                  {renderContent(part.value)}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legenda simples */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          justifyContent: "flex-end",
          fontSize: "10px",
          color: "#6b7280",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span
            style={{
              width: "8px",
              height: "8px",
              backgroundColor: colors.bgRemoved,
              borderRadius: "2px",
            }}
          ></span>
          <span>Esperado</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span
            style={{
              width: "8px",
              height: "8px",
              backgroundColor: colors.bgAdded,
              borderRadius: "2px",
            }}
          ></span>
          <span>Seu Output</span>
        </div>
      </div>
    </div>
  );
};
