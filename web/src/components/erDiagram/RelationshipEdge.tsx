import { BaseEdge, EdgeLabelRenderer, getBezierPath } from "@xyflow/react";
import type { EdgeProps } from "@xyflow/react";
import { cn } from "../../lib/utils";
import type { ErCardinality } from "../../types/erModel";

export interface RelationshipEdgeData extends Record<string, unknown> {
  cardinality: ErCardinality;
  name?: string;
}

export function RelationshipEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps) {
  const { cardinality, name } = (data || {}) as RelationshipEdgeData;
  const [fromSide, toSide] = (cardinality || "1:N").split(":");

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Posições dos rótulos de cardinalidade: perto de cada ponta, não no
  // meio — é assim que brModelo e ferramentas de DER tradicionalmente
  // mostram "1" de um lado e "N" do outro, em vez de um "1:N" único e
  // ambíguo sobre qual lado é qual.
  const fromLabelX = sourceX + (labelX - sourceX) * 0.25;
  const fromLabelY = sourceY + (labelY - sourceY) * 0.25;
  const toLabelX = targetX + (labelX - targetX) * 0.25;
  const toLabelY = targetY + (labelY - targetY) * 0.25;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          strokeWidth: selected ? 2.5 : 1.5,
          stroke: selected ? "rgb(var(--primary))" : "rgb(var(--border))",
        }}
      />
      <EdgeLabelRenderer>
        <CardinalityLabel x={fromLabelX} y={fromLabelY} value={fromSide} />
        <CardinalityLabel x={toLabelX} y={toLabelY} value={toSide} />
        {name && (
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "none",
            }}
            className="text-[10px] font-medium text-muted bg-surface/90 px-1.5 py-0.5 rounded border border-border"
          >
            {name}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}

function CardinalityLabel({
  x,
  y,
  value,
}: {
  x: number;
  y: number;
  value: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
        pointerEvents: "none",
      }}
      className={cn(
        "text-xs font-bold text-primary bg-surface px-1 rounded",
      )}
    >
      {value}
    </div>
  );
}
