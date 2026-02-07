import { forwardRef } from "react";
import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, label, error, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="text-xs font-medium text-muted uppercase tracking-wider">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={cn(
              "flex h-10 w-full appearance-none rounded-md border border-border bg-surface px-3 py-2 text-sm text-zinc-100",
              "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
              "disabled:cursor-not-allowed disabled:opacity-50 transition-all",
              error && "border-destructive",
              className,
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-zinc-500 pointer-events-none" />
        </div>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    );
  },
);
Select.displayName = "Select";
