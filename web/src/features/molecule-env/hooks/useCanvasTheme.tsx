import { useState, useEffect } from "react";

// Converte o formato do Tailwind "212 212 216" para "rgb(212, 212, 216)" que o Canvas entende
const getRgb = (varName: string) => {
  const val = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return val ? `rgb(${val.replace(/\s+/g, ", ")})` : undefined;
};

export const useCanvasTheme = () => {
  const [theme, setTheme] = useState({
    border: "#444444",
    primary: "#3498db",
    background: "#ecf0f1",
    foreground: "#2c3e50",
    mutedForeground: "#cccccc",
    destructive: "#e74c3c",
    statusWarning: "#f39c12",
  });

  useEffect(() => {
    const updateTheme = () => {
      setTheme({
        border: getRgb("--border") || "#444444",
        primary: getRgb("--primary") || "#3498db",
        background: getRgb("--background") || "#ecf0f1",
        foreground: getRgb("--foreground") || "#2c3e50",
        mutedForeground: getRgb("--muted-foreground") || "#cccccc",
        destructive: getRgb("--destructive") || "#e74c3c",
        statusWarning: getRgb("--status-warning") || "#f39c12",
      });
    };

    // Puxa as cores corretas logo que o Canvas for montado
    updateTheme();

    // Ouve as mudanças de tema no HTML (Botão de Dark Mode ou Daltonismo)
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-colorblind"],
    });

    return () => observer.disconnect();
  }, []);

  return theme;
};
