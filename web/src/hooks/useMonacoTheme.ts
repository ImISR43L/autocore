// web/src/hooks/useMonacoTheme.ts
import { useEffect } from "react";
import { useMonaco } from "@monaco-editor/react";
import { usePreferences } from "../contexts/PreferencesContext";

export function useMonacoTheme() {
  const monaco = useMonaco();
  const { colorblindMode, theme } = usePreferences();

  useEffect(() => {
    if (!monaco) return;

    const isDark = theme === "dark";

    // 1. Definir Temas Personalizados
    // Deuteranopia (Ênfase em Azul/Laranja)
    monaco.editor.defineTheme("deuteranopia-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "60a5fa" }, // Azul claro
        { token: "string", foreground: "fb923c" }, // Laranja
        { token: "number", foreground: "e879f9" }, // Roxo/Rosa
        { token: "comment", foreground: "9ca3af" },
      ],
      colors: { "editor.background": "#111827" }, // bg-gray-900
    });

    monaco.editor.defineTheme("deuteranopia-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "2563eb" }, // Azul mais forte
        { token: "string", foreground: "ea580c" }, // Laranja escuro
      ],
      colors: {},
    });

    // Tritanopia (Ênfase em Ciano/Rosa)
    monaco.editor.defineTheme("tritanopia-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "22d3ee" }, // Ciano
        { token: "string", foreground: "fb7185" }, // Rosa
        { token: "number", foreground: "ffffff" },
      ],
      colors: { "editor.background": "#111827" },
    });

    // Achromatopsia (Alto Contraste Monocromático)
    monaco.editor.defineTheme("achromatopsia-dark", {
      base: "hc-black",
      inherit: true,
      rules: [],
      colors: {
        "editor.selectionBackground": "#ffffff40",
        "editor.background": "#000000",
      },
    });

    monaco.editor.defineTheme("achromatopsia-light", {
      base: "hc-black", // Mantém hc-black ou ajusta para hc-light se disponível, mas 'vs' costuma ser melhor base
      inherit: true,
      rules: [], // Adicionar regras de negrito/itálico para sintaxe se necessário
      colors: {
        "editor.background": "#ffffff",
        "editor.foreground": "#000000",
      },
    });

    // 2. Selecionar o Tema Ativo
    let themeToSet = isDark ? "vs-dark" : "vs";

    if (colorblindMode === "deuteranopia") {
      themeToSet = isDark ? "deuteranopia-dark" : "deuteranopia-light";
    } else if (colorblindMode === "tritanopia") {
      themeToSet = "tritanopia-dark"; // (Assumindo dark como base principal para dev)
    } else if (colorblindMode === "achromatopsia") {
      themeToSet = isDark ? "achromatopsia-dark" : "achromatopsia-light";
    }

    monaco.editor.setTheme(themeToSet);
  }, [monaco, colorblindMode, theme]);
}
