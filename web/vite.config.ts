import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Aumenta o limite para 1.5MB.
    // Isso silencia o aviso de "chunks larger than 500kB" sem precisar quebrar o código de forma perigosa.
    chunkSizeWarningLimit: 1500,

    rollupOptions: {
      output: {
        manualChunks(id) {
          // Separa APENAS o Monaco Editor (que é gigante e seguro de isolar)
          if (
            id.includes("node_modules/monaco-editor") ||
            id.includes("node_modules/@monaco-editor")
          ) {
            return "monaco";
          }

          // Todo o resto (React, Recharts, Axios, etc) fica junto no 'vendor'.
          // Isso garante que o React esteja disponível quando o Recharts for carregar.
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
  },

  optimizeDeps: {
    exclude: ["@rdkit/rdkit"],
  },
});
