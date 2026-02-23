import { useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

export function useFormPersist(key: string, methods: UseFormReturn<any>) {
  const { watch, reset, getValues } = methods;
  const isHydratedRef = useRef(false);

  useEffect(() => {
    if (!isHydratedRef.current) {
      const savedData = localStorage.getItem(key);

      if (savedData) {
        try {
          const parsedData = JSON.parse(savedData);

          if (Object.keys(parsedData).length > 0) {
            const currentDefaults = getValues();
            const mergedData = { ...currentDefaults, ...parsedData };

            reset(mergedData);
            toast.info("Rascunho restaurado automaticamente.");
          }
        } catch (error) {
          console.error("Erro ao restaurar rascunho:", error);
          localStorage.removeItem(key);
        }
      }
      isHydratedRef.current = true;
    }

    const subscription = watch((value) => {
      localStorage.setItem(key, JSON.stringify(value));
    });

    return () => subscription.unsubscribe();
  }, [key, reset, watch, getValues]);

  const clearDraft = () => {
    localStorage.removeItem(key);
  };

  return { clearDraft };
}
