import React from "react";

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-4 last:mb-0 last:border-0 last:pb-0">
      <div>
        <h3 className="text-lg font-semibold text-zinc-100">{title}</h3>
        {description && <p className="text-sm text-zinc-400">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
