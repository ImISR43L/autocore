import React from "react";
import { cn } from "../../lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  containerClassName?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    { className, containerClassName, children, label, error, ...props },
    ref,
  ) => {
    return (
      <div className={cn("flex flex-col gap-1.5 w-full", containerClassName)}>
        {label && (
          <label className="text-sm font-medium text-foreground">{label}</label>
        )}
        <div className="relative">
          <select
            className={cn(
              // Layout Básico e Reset
              "flex h-11 w-full appearance-none !bg-none items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",

              // Cores e Bordas (Design System Emerald/Zinc)
              "bg-surface border border-border text-foreground",
              "placeholder:text-muted focus:placeholder:text-muted",

              // Estados de Foco (Anel Emerald)
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",

              // Espaçamento para o ícone (não sobrepor texto longo)
              "pr-10",

              // Estados Desabilitados
              "disabled:cursor-not-allowed disabled:opacity-50",

              // Estado de Erro
              error &&
                "border-destructive focus:border-destructive focus:ring-destructive/20",

              className,
            )}
            ref={ref}
            {...props}
          >
            {children}
          </select>

          {/* Ícone Customizado (Centralizado verticalmente) */}
        </div>

        {error && (
          <span className="text-xs text-destructive animate-in slide-in-from-top-1">
            {error}
          </span>
        )}
      </div>
    );
  },
);
Select.displayName = "Select";

export { Select };
