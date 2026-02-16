// web/src/hooks/useMonacoTheme.ts
import { useEffect, useState } from "react";
import { useMonaco } from "@monaco-editor/react";
import { usePreferences } from "../contexts/PreferencesContext";

export function useMonacoTheme() {
  const monaco = useMonaco();
  const { colorblindMode, theme } = usePreferences();
  // Estado para armazenar o nome do tema ativo
  const [activeTheme, setActiveTheme] = useState(
    theme === "dark" ? "vs-dark" : "vs",
  );

  useEffect(() => {
    if (!monaco) return;

    const isDark = theme === "dark";

    // --- DEFINIÇÃO DE TEMAS ESCUROS (DARK) ---
    monaco.editor.defineTheme("deuteranopia-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "60a5fa" },
        { token: "string", foreground: "fb923c" },
        { token: "number", foreground: "e879f9" },
        { token: "comment", foreground: "9ca3af" },
      ],
      colors: { "editor.background": "#111827" },
    });

    monaco.editor.defineTheme("tritanopia-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "22d3ee" },
        { token: "string", foreground: "fb7185" },
        { token: "number", foreground: "ffffff" },
      ],
      colors: { "editor.background": "#111827" },
    });

    monaco.editor.defineTheme("achromatopsia-dark", {
      base: "hc-black",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#000000",
        "editor.foreground": "#ffffff",
        "editor.selectionBackground": "#ffffff40",
      },
    });

    // --- DEFINIÇÃO DE TEMAS CLAROS (LIGHT) ---
    monaco.editor.defineTheme("deuteranopia-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "2563eb" },
        { token: "string", foreground: "ea580c" },
        { token: "number", foreground: "c026d3" },
      ],
      colors: { "editor.background": "#ffffff" },
    });

    monaco.editor.defineTheme("tritanopia-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "0891b2" },
        { token: "string", foreground: "e11d48" },
      ],
      colors: { "editor.background": "#ffffff" },
    });

    monaco.editor.defineTheme("achromatopsia-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "comment", foreground: "000000", fontStyle: "italic" },
        { token: "keyword", foreground: "000000", fontStyle: "bold" },
        { token: "string", foreground: "333333", fontStyle: "underline" },
      ],
      colors: {
        "editor.background": "#ffffff",
        "editor.foreground": "#000000",
      },
    });

    // --- SELEÇÃO DO TEMA ---
    let themeToSet = isDark ? "vs-dark" : "vs";

    if (colorblindMode === "deuteranopia") {
      themeToSet = isDark ? "deuteranopia-dark" : "deuteranopia-light";
    } else if (colorblindMode === "tritanopia") {
      themeToSet = isDark ? "tritanopia-dark" : "tritanopia-light";
    } else if (colorblindMode === "achromatopsia") {
      themeToSet = isDark ? "achromatopsia-dark" : "achromatopsia-light";
    }

    // Aplica e atualiza o estado
    monaco.editor.setTheme(themeToSet);
    setActiveTheme(themeToSet);
  }, [monaco, colorblindMode, theme]);

  return activeTheme; // <--- O PULO DO GATO: Retorna o nome do tema!
}
