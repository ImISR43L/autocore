import type { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "icon";
  isLoading?: boolean;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  isLoading = false,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || isLoading}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        {
          "bg-primary text-primary-foreground hover:bg-primary-dark shadow-sm":
            variant === "primary",
          "bg-surface-hover text-foreground hover:bg-surface-hover border border-border":
            variant === "secondary",
          "bg-transparent text-foregroundborder border-border hover:bg-surface-hover hover:text-foreground":
            variant === "outline",
          "bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20":
            variant === "danger",
          "bg-transparent text-muted hover:text-foreground hover:bg-white/5":
            variant === "ghost",

          "h-8 px-3 text-xs": size === "sm",
          "h-10 px-4 py-2 text-sm": size === "md",
          "h-9 w-9 p-0": size === "icon",
        },
        className,
      )}
      {...props}
    >
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
