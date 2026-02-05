import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

export function useFormPersist(key: string, methods: UseFormReturn<any>) {
  const { watch, reset, getValues } = methods;

  useEffect(() => {
    // 1. Restaurar (Hydrate) ao montar
    const savedData = localStorage.getItem(key);

    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);

        // Verificação básica: se o rascunho estiver muito vazio, ignora
        if (Object.keys(parsedData).length > 0) {
          // Mescla com os valores atuais (defaults) para evitar que campos novos fiquem undefined
          const currentDefaults = getValues();
          const mergedData = { ...currentDefaults, ...parsedData };

          // O reset atualiza o formulário com os dados salvos
          reset(mergedData);
          toast.info("Rascunho restaurado automaticamente.");
        }
      } catch (error) {
        console.error("Erro ao restaurar rascunho:", error);
        localStorage.removeItem(key); // Limpa se estiver corrompido
      }
    }

    // 2. Salvar (Subscribe) a cada mudança
    const subscription = watch((value) => {
      // Pequeno delay ou debounce pode ser adicionado aqui se o form for muito pesado,
      // mas localStorage é síncrono e rápido o suficiente para texto.
      localStorage.setItem(key, JSON.stringify(value));
    });

    return () => subscription.unsubscribe();
  }, [key, reset, watch, getValues]);

  // Função para limpar manualmente (ex: após sucesso)
  const clearDraft = () => {
    localStorage.removeItem(key);
  };

  return { clearDraft };
}
