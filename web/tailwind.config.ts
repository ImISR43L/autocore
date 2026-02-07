/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#09090b", // Zinc 950
        surface: "#18181b", // Zinc 900
        "surface-hover": "#27272a", // Zinc 800
        border: "#27272a", // Zinc 800

        primary: {
          DEFAULT: "#10b981", // Emerald 500
          dark: "#059669", // Emerald 600
          foreground: "#ffffff",
        },

        destructive: {
          DEFAULT: "#ef4444", // Red 500
          foreground: "#ffffff",
        },

        muted: {
          DEFAULT: "#a1a1aa", // Zinc 400
          foreground: "#52525b", // Zinc 600
        },
      },
    },
  },
  plugins: [],
};
