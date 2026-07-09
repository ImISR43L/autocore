// tailwind.config.ts
import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"], // <--- ADIÇÃO
      },
      colors: {
        background: "rgb(var(--background) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-hover": "rgb(var(--surface-hover) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",

        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          dark: "rgb(var(--primary-dark) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
        },

        destructive: {
          DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
          foreground: "rgb(var(--destructive-foreground) / <alpha-value>)",
        },

        // Adicionados na auditoria de acessibilidade: sem eles, o
        // ClassroomView.tsx (e possivelmente outros componentes) usava
        // cores cruas do Tailwind (emerald-500, amber-500, etc.) para
        // sinalizar sucesso/erro/aviso — nunca remapeadas por modo de
        // daltonismo e sem variação por tema claro/escuro, já que essas
        // não passavam pelo sistema de variáveis do index.css.
        success: {
          DEFAULT: "rgb(var(--status-success) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "rgb(var(--status-warning) / <alpha-value>)",
        },

        muted: {
          DEFAULT: "rgb(var(--muted) / <alpha-value>)",
          foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [typography],
} satisfies Config;
