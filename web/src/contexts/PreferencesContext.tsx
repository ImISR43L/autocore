import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
type ColorblindMode = "none" | "deuteranopia" | "tritanopia" | "achromatopsia";
type FontSize = "sm" | "base" | "lg" | "xl";
type FontFamily = "standard" | "dyslexic"; // <--- ADIÇÃO

interface PreferencesState {
  theme: Theme;
  colorblindMode: ColorblindMode;
  fontSize: FontSize;
  fontFamily: FontFamily; // <--- ADIÇÃO
}

interface PreferencesContextType extends PreferencesState {
  setTheme: (theme: Theme) => void;
  setColorblindMode: (mode: ColorblindMode) => void;
  setFontSize: (size: FontSize) => void;
  setFontFamily: (font: FontFamily) => void; // <--- ADIÇÃO
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(
  undefined,
);

const defaultPreferences: PreferencesState = {
  theme: "dark",
  colorblindMode: "none",
  fontSize: "base",
  fontFamily: "standard", // <--- ADIÇÃO
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

    if (preferences.theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");

    if (preferences.colorblindMode === "none")
      root.removeAttribute("data-colorblind");
    else root.setAttribute("data-colorblind", preferences.colorblindMode);

    root.setAttribute("data-fontsize", preferences.fontSize);
    root.setAttribute("data-font", preferences.fontFamily); // <--- ADIÇÃO
  }, [preferences]);

  const setTheme = (theme: Theme) =>
    setPreferences((prev) => ({ ...prev, theme }));
  const setColorblindMode = (colorblindMode: ColorblindMode) =>
    setPreferences((prev) => ({ ...prev, colorblindMode }));
  const setFontSize = (fontSize: FontSize) =>
    setPreferences((prev) => ({ ...prev, fontSize }));
  const setFontFamily = (fontFamily: FontFamily) =>
    setPreferences((prev) => ({ ...prev, fontFamily })); // <--- ADIÇÃO

  return (
    <PreferencesContext.Provider
      value={{
        ...preferences,
        setTheme,
        setColorblindMode,
        setFontSize,
        setFontFamily,
      }}
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
