import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, label, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="text-xs font-medium text-muted uppercase tracking-wider">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            "flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-zinc-100",
            "placeholder:text-zinc-600",
            "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
            "transition-all disabled:cursor-not-allowed disabled:opacity-50",
            error &&
              "border-destructive focus:border-destructive focus:ring-destructive/20",
            className,
          )}
          {...props}
        />
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    );
  },
);
Input.displayName = "Input";
