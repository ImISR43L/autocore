import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
type ColorblindMode = "none" | "deuteranopia" | "tritanopia" | "achromatopsia";
type FontSize = "sm" | "base" | "lg" | "xl"; // <--- ADIÇÃO

interface PreferencesState {
  theme: Theme;
  colorblindMode: ColorblindMode;
  fontSize: FontSize; // <--- ADIÇÃO
}

interface PreferencesContextType extends PreferencesState {
  setTheme: (theme: Theme) => void;
  setColorblindMode: (mode: ColorblindMode) => void;
  setFontSize: (size: FontSize) => void; // <--- ADIÇÃO
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(
  undefined,
);

const defaultPreferences: PreferencesState = {
  theme: "dark",
  colorblindMode: "none",
  fontSize: "base", // <--- ADIÇÃO
};

export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [preferences, setPreferences] = useState<PreferencesState>(() => {
    const stored = localStorage.getItem("autocore_prefs");
    return stored
      ? { ...defaultPreferences, ...JSON.parse(stored) }
      : defaultPreferences;
  });

  useEffect(() => {
    localStorage.setItem("autocore_prefs", JSON.stringify(preferences));

    const root = document.documentElement;

    // Aplicação da Polaridade
    if (preferences.theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Aplicação do Espectro de Daltonismo
    if (preferences.colorblindMode === "none") {
      root.removeAttribute("data-colorblind");
    } else {
      root.setAttribute("data-colorblind", preferences.colorblindMode);
    }

    // Aplicação do Tamanho da Fonte
    root.setAttribute("data-fontsize", preferences.fontSize);
  }, [preferences]);

  const setTheme = (theme: Theme) =>
    setPreferences((prev) => ({ ...prev, theme }));
  const setColorblindMode = (colorblindMode: ColorblindMode) =>
    setPreferences((prev) => ({ ...prev, colorblindMode }));
  const setFontSize = (fontSize: FontSize) =>
    setPreferences((prev) => ({ ...prev, fontSize }));

  return (
    <PreferencesContext.Provider
      value={{ ...preferences, setTheme, setColorblindMode, setFontSize }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context)
    throw new Error(
      "usePreferences deve ser usado dentro de um PreferencesProvider",
    );
  return context;
}
