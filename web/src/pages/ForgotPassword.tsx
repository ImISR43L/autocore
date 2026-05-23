import { useState } from "react";
import { supabase } from "../lib/supabase"; // Ajuste o caminho para a sua instância do Supabase
import { toast } from "sonner";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Por favor, introduza o seu e-mail.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        // Redireciona o utilizador para a tela de criar nova senha após clicar no link do email
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast.success(
        "E-mail de recuperação enviado! Verifique a sua caixa de entrada.",
      );
      setEmail(""); // Limpa o campo
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao enviar o e-mail de recuperação.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 text-foreground">
      <div className="max-w-md w-full bg-surface border border-border rounded-xl shadow-2xl p-8 space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Recuperar Senha</h2>
          <p className="text-muted text-sm mt-2">
            Insira o seu e-mail e enviar-lhe-emos um link para redefinir a sua
            senha.
          </p>
        </div>

        <form onSubmit={handleResetPassword} className="space-y-4">
          <Input
            label="E-mail"
            type="email"
            placeholder="aluno@instituicao.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-12 bg-background"
          />

          <Button type="submit" className="w-full h-12" isLoading={isLoading}>
            Enviar Link de Recuperação
          </Button>
        </form>
      </div>
    </div>
  );
}
