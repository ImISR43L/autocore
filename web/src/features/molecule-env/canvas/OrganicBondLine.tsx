import React from "react";
import { Line, Group } from "react-konva";

interface OrganicBondLineProps {
  id: string;
  s: { x: number; y: number };
  t: { x: number; y: number };
  order: number | string; // Permite string vinda do JSON
  stereo?: string | number; // Permite string vinda do JSON
  strokeColor: string;
  strokeWidth?: number; // Adicionado!
  dash?: number[]; // Adicionado!
  onMouseDown?: (e: any) => void;
  onMouseEnter?: (e: any) => void;
  onMouseLeave?: (e: any) => void;
}

export const OrganicBondLine: React.FC<OrganicBondLineProps> = ({
  id,
  s,
  t,
  order,
  stereo,
  strokeColor,
  strokeWidth = 3, // Valor por defeito
  dash,
  ...events
}) => {
  // 1. Cálculos Geométricos Base
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  const len = Math.hypot(dx, dy);

  if (len === 0) return null;

  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;

  // 2. Proteção de Tipagem (Converte tudo para formato seguro)
  const stereoStr = String(stereo || "").toLowerCase();
  const orderNum = Number(order || 1);

  // 3. Renderização de Estereoquímica
  if (stereoStr === "wedge" || stereoStr === "1") {
    const endTaper = 5;
    return (
      <Group {...events} listening={true} hitStrokeWidth={15}>
        <Line
          points={[
            s.x,
            s.y,
            t.x + nx * endTaper,
            t.y + ny * endTaper,
            t.x - nx * endTaper,
            t.y - ny * endTaper,
          ]}
          fill={strokeColor}
          closed={true}
          lineJoin="round"
        />
      </Group>
    );
  } else if (stereoStr === "dash" || stereoStr === "2") {
    const numDashes = 8;
    const startTaper = 1;
    const endTaper = 5;
    const dashes: React.ReactNode[] = [];

    for (let i = 0; i < numDashes; i++) {
      const progress = i / (numDashes - 1);
      const centerX = s.x + dx * progress;
      const centerY = s.y + dy * progress;
      const currentTaper = startTaper + (endTaper - startTaper) * progress;

      dashes.push(
        <Line
          key={`${id}_dash_${i}`}
          points={[
            centerX + nx * currentTaper,
            centerY + ny * currentTaper,
            centerX - nx * currentTaper,
            centerY - ny * currentTaper,
          ]}
          stroke={strokeColor}
          strokeWidth={2}
          lineCap="butt"
          listening={false}
        />,
      );
    }

    return (
      <Group {...events} listening={true} hitStrokeWidth={15}>
        <Line
          points={[s.x, s.y, t.x, t.y]}
          stroke="transparent"
          strokeWidth={15}
        />
        {dashes}
      </Group>
    );
  }

  // 4. Ordem da Ligação (Dupla, Tripla)
  if (orderNum === 2) {
    const offset = 3;
    return (
      <Group {...events} listening={true}>
        <Line
          points={[s.x, s.y, t.x, t.y]}
          stroke="transparent"
          strokeWidth={15}
          hitStrokeWidth={15}
        />
        <Line
          points={[
            s.x + nx * offset,
            s.y + ny * offset,
            t.x + nx * offset,
            t.y + ny * offset,
          ]}
          stroke={strokeColor}
          strokeWidth={2}
        />
        <Line
          points={[
            s.x - nx * offset,
            s.y - ny * offset,
            t.x - nx * offset,
            t.y - ny * offset,
          ]}
          stroke={strokeColor}
          strokeWidth={2}
        />
      </Group>
    );
  } else if (orderNum === 3) {
    const offset = 4;
    return (
      <Group {...events} listening={true}>
        <Line
          points={[s.x, s.y, t.x, t.y]}
          stroke="transparent"
          strokeWidth={15}
          hitStrokeWidth={15}
        />
        <Line
          points={[s.x, s.y, t.x, t.y]}
          stroke={strokeColor}
          strokeWidth={2}
        />
        <Line
          points={[
            s.x + nx * offset,
            s.y + ny * offset,
            t.x + nx * offset,
            t.y + ny * offset,
          ]}
          stroke={strokeColor}
          strokeWidth={2}
        />
        <Line
          points={[
            s.x - nx * offset,
            s.y - ny * offset,
            t.x - nx * offset,
            t.y - ny * offset,
          ]}
          stroke={strokeColor}
          strokeWidth={2}
        />
      </Group>
    );
  }

  // 5. Padrão: Ligação Simples
  return (
    <Line
      points={[s.x, s.y, t.x, t.y]}
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      dash={dash}
      lineCap="round"
      hitStrokeWidth={15}
      {...events}
    />
  );
};
