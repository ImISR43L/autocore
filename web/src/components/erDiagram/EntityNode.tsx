import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { KeyRound, Link2 } from "lucide-react";
import { cn } from "../../lib/utils";
import type { ErAttribute } from "../../types/erModel";

export interface EntityNodeData extends Record<string, unknown> {
  name: string;
  attributes: ErAttribute[];
}

const handleStyle =
  "!w-2.5 !h-2.5 !bg-primary !border-2 !border-background opacity-0 group-hover:opacity-100 transition-opacity";

export function EntityNode({ data, selected }: NodeProps) {
  const { name, attributes } = data as EntityNodeData;

  return (
    <div
      className={cn(
        "group min-w-[200px] rounded-lg border-2 bg-surface shadow-lg overflow-hidden transition-colors",
        selected ? "border-primary shadow-primary/20" : "border-border",
      )}
    >
      {/* As 4 handles permitem puxar uma conexão de qualquer lado do
          nó — o React Flow decide sozinho o handle mais próximo do
          destino ao renderizar a aresta. */}
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        className={handleStyle}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className={handleStyle}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className={handleStyle}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className={handleStyle}
      />

      <div className="bg-primary/10 border-b border-border px-3 py-2">
        <span className="text-sm font-bold text-foreground truncate block">
          {name || "Entidade sem nome"}
        </span>
      </div>

      <div className="divide-y divide-border/60">
        {attributes.length === 0 && (
          <div className="px-3 py-2 text-xs text-muted italic">
            Sem atributos
          </div>
        )}
        {attributes.map((attr, idx) => (
          <div
            key={idx}
            className="px-3 py-1.5 flex items-center gap-2 text-xs"
          >
            <span className="w-4 flex-none flex items-center justify-center">
              {attr.isPK && (
                <KeyRound size={12} className="text-amber-500" />
              )}
              {attr.isFK && !attr.isPK && (
                <Link2 size={12} className="text-sky-500" />
              )}
            </span>
            <span
              className={cn(
                "font-mono flex-1 truncate",
                attr.isPK ? "font-bold text-foreground" : "text-muted",
              )}
            >
              {attr.name || "(sem nome)"}
            </span>
            {attr.type && (
              <span className="text-[10px] text-muted/70 font-mono">
                {attr.type}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
