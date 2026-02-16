import React, { useMemo } from "react";
import * as Diff from "diff";
// Removemos o hook usePreferences e useMemo de cores, pois o CSS agora resolve isso.

interface DiffViewerProps {
  expected: string;
  actual: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ expected, actual }) => {
  // 1. Lógica de Processamento (Mantida Intacta)
  const { formattedExpected, formattedActual, isJson } = useMemo(() => {
    try {
      const expObj = JSON.parse(expected);
      const actObj = JSON.parse(actual);
      return {
        formattedExpected: JSON.stringify(expObj, null, 2),
        formattedActual: JSON.stringify(actObj, null, 2),
        isJson: true,
      };
    } catch (e) {
      return {
        formattedExpected: expected,
        formattedActual: actual,
        isJson: false,
      };
    }
  }, [expected, actual]);

  const diffs = useMemo(() => {
    if (isJson) return Diff.diffLines(formattedExpected, formattedActual);
    return Diff.diffChars(formattedExpected, formattedActual);
  }, [formattedExpected, formattedActual, isJson]);

  // Função auxiliar para renderização (Mantida)
  const renderContent = (text: string) => {
    if (isJson) return text;
    return text;
  };

  return (
    <div className="diff-container">
      {/* Container Principal */}
      <div className="diff-box">
        {/* LADO ESQUERDO: ESPERADO */}
        <div className="diff-panel">
          <div className="diff-header diff-text-expected">ESPERADO</div>
          <div className="diff-content">
            {diffs.map((part, index) => {
              // Se foi adicionado (está só no atual), não mostra aqui no esperado
              if (part.added) return null;

              return (
                <span
                  key={index}
                  className={
                    part.removed ? "diff-token-expected" : "opacity-70"
                  }
                >
                  {renderContent(part.value)}
                </span>
              );
            })}
          </div>
        </div>

        {/* LADO DIREITO: SEU RESULTADO */}
        <div className="diff-panel">
          <div className="diff-header diff-text-actual">SEU RESULTADO</div>
          <div className="diff-content">
            {diffs.map((part, index) => {
              // Se foi removido (estava no esperado mas não no atual), não mostra aqui
              if (part.removed) return null;

              return (
                <span
                  key={index}
                  className={part.added ? "diff-token-actual" : "opacity-70"}
                >
                  {renderContent(part.value)}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex justify-end gap-4 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-[1px] bg-[rgb(var(--status-success))] opacity-50"></span>
          <span>Esperado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-[1px] bg-[rgb(var(--status-error))] opacity-50"></span>
          <span>Seu Output</span>
        </div>
      </div>
    </div>
  );
};
