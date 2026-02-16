// src/components/ThemeToggle.tsx
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [lightMode, setLightMode] = useState(() => {
    return localStorage.getItem("a11y_lightMode") === "true";
  });

  useEffect(() => {
    localStorage.setItem("a11y_lightMode", String(lightMode));
    if (lightMode) {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }
  }, [lightMode]);

  return (
    <button
      onClick={() => setLightMode(!lightMode)}
      className="fixed bottom-24 right-8 z-[9999] flex h-12 w-12 items-center justify-center rounded-full bg-surface border border-border shadow-xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      title={
        lightMode ? "Alternar para Modo Escuro" : "Alternar para Modo Claro"
      }
    >
      {lightMode ? (
        <Sun size={20} className="text-amber-500" />
      ) : (
        <Moon size={20} className="text-zinc-300" />
      )}
    </button>
  );
}
