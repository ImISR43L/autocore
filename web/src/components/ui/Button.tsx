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
        "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed",
        {
          "bg-primary text-primary-foreground hover:bg-primary-dark shadow-sm":
            variant === "primary",
          "bg-surface-hover text-zinc-100 hover:bg-zinc-700 border border-border":
            variant === "secondary",
          "bg-transparent text-zinc-300 border border-border hover:bg-surface-hover hover:text-white":
            variant === "outline",
          "bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20":
            variant === "danger",
          "bg-transparent text-zinc-400 hover:text-white hover:bg-white/5":
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
