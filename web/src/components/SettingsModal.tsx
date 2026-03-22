import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePreferences } from "../contexts/PreferencesContext";
import { Settings, X, AlertTriangle } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";

export function SettingsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();
  const {
    theme,
    setTheme,
    colorblindMode,
    setColorblindMode,
    fontSize,
    setFontSize,
    fontFamily,
    setFontFamily,
  } = usePreferences();

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm(
      "Tem certeza absoluta que deseja excluir sua conta? Esta ação é irreversível e apagará todos os seus dados, turmas matriculadas e submissões.",
    );

    if (!confirmDelete) return;

    setIsDeleting(true);
    try {
      await api.delete("/users/me");

      await supabase.auth.signOut();

      toast.success("Conta excluída com sucesso.");
      setIsOpen(false);
      navigate("/login", { replace: true });
    } catch (error: any) {
      console.error("Erro ao deletar conta:", error);
      toast.error(
        error.response?.data?.message ||
          "Não foi possível excluir a conta no momento.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[9999] flex h-12 w-12 items-center justify-center rounded-full bg-surface border border-border shadow-xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        title="Preferências e Acessibilidade"
      >
        <Settings size={20} className="text-foreground" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg bg-background border border-border p-6 shadow-2xl relative">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">
            Acessibilidade e Aparência
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-5">
          {/* Polaridade de Tema */}
          <div>
            <label className="block mb-1.5 text-sm font-medium text-foreground">
              Tema Visual
            </label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as any)}
              className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-md text-foreground text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer"
            >
              <option value="light">Claro</option>
              <option value="dark">Escuro</option>
            </select>
          </div>

          {/* Espectro de Daltonismo */}
          <div>
            <label className="block mb-1.5 text-sm font-medium text-foreground">
              Modo para Daltônicos
            </label>
            <select
              value={colorblindMode}
              onChange={(e) => setColorblindMode(e.target.value as any)}
              className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-md text-foreground text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer"
            >
              <option value="none">Padrão (Nenhum)</option>
              <option value="deuteranopia">
                Deuteranopia / Protanopia (Azul e Laranja)
              </option>
              <option value="tritanopia">Tritanopia (Ciano e Rosa)</option>
              <option value="achromatopsia">
                Acromatopsia (Alto Contraste Escala de Cinza)
              </option>
            </select>
          </div>

          {/* Tamanho da Fonte */}
          <div>
            <label className="block mb-1.5 text-sm font-medium text-foreground">
              Tamanho da Fonte
            </label>
            <select
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value as any)}
              className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-md text-foreground text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer"
            >
              <option value="sm">Pequena</option>
              <option value="base">Padrão</option>
              <option value="lg">Grande</option>
              <option value="xl">Muito Grande</option>
            </select>
          </div>

          {/* Tipografia */}
          <div>
            <label className="block mb-1.5 text-sm font-medium text-foreground">
              Fonte (Tipografia)
            </label>
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value as any)}
              className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-md text-foreground text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer"
            >
              <option value="standard">Padrão (Inter)</option>
              <option value="dyslexic">OpenDyslexic (Foco em Dislexia)</option>
            </select>
          </div>

          <div className="pt-6 mt-6 border-t border-border">
            <h3 className="text-sm font-bold text-red-500 mb-2 flex items-center gap-2">
              <AlertTriangle size={16} />
              Zona de Risco
            </h3>
            <p className="text-xs text-muted mb-4">
              A exclusão da conta é permanente. Todos os seus dados pessoais,
              submissões e histórico serão apagados.
            </p>
            <button
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="w-full py-2.5 px-4 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 transition-colors rounded-md text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? "Processando..." : "Excluir Minha Conta Permanente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
