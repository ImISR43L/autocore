import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase"; // Ajuste o caminho
import { toast } from "sonner";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

export function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Opcional: Verificar se o utilizador realmente tem uma sessão de recuperação ativa
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        toast.error(
          "Link inválido ou expirado. Solicite a recuperação novamente.",
        );
        navigate("/forgot-password");
      }
    });
  }, [navigate]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setIsLoading(true);
    try {
      // Como o utilizador entrou pelo link do email, ele já está autenticado nesta sessão.
      // O updateUser vai alterar a senha do utilizador logado no momento.
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      toast.success("Senha atualizada com sucesso!");
      navigate("/dashboard"); // Redireciona para o sistema
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao atualizar a senha.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 text-foreground">
      <div className="max-w-md w-full bg-surface border border-border rounded-xl shadow-2xl p-8 space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Criar Nova Senha</h2>
          <p className="text-muted text-sm mt-2">
            Por favor, insira a sua nova senha abaixo.
          </p>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <Input
            label="Nova Senha"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="h-12 bg-background"
          />
          <Input
            label="Confirmar Nova Senha"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="h-12 bg-background"
          />

          <Button type="submit" className="w-full h-12" isLoading={isLoading}>
            Atualizar Senha
          </Button>
        </form>
      </div>
    </div>
  );
}
