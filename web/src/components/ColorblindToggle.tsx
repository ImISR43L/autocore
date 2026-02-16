import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function ColorblindToggle() {
  const [isColorblindMode, setIsColorblindMode] = useState(() => {
    return localStorage.getItem("a11y_colorblind") === "true";
  });

  useEffect(() => {
    localStorage.setItem("a11y_colorblind", String(isColorblindMode));
    if (isColorblindMode) {
      document.documentElement.setAttribute("data-accessibility", "colorblind");
    } else {
      document.documentElement.removeAttribute("data-accessibility");
    }
  }, [isColorblindMode]);

  return (
    <button
      onClick={() => setIsColorblindMode(!isColorblindMode)}
      className="fixed bottom-24 right-24 z-[9999] flex h-12 w-12 items-center justify-center rounded-full bg-surface border border-border shadow-xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      title={
        isColorblindMode ? "Desativar Modo Daltônico" : "Ativar Modo Daltônico"
      }
    >
      {isColorblindMode ? (
        <Eye size={20} className="text-primary" />
      ) : (
        <EyeOff size={20} className="text-muted" />
      )}
    </button>
  );
}
