// src/canvas/OrganicBondLine.tsx
import React from "react";
import { Line, Group } from "react-konva";
import { BondOrder, StereoType } from "../types/molecule";

interface OrganicBondLineProps {
  id: string;
  s: { x: number; y: number };
  t: { x: number; y: number };
  order: BondOrder;
  stereo: StereoType;
  strokeColor: string;
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
  ...events // <-- CORREÇÃO 1: Adicionei o 'id' aqui!
}) => {
  // 1. Cálculos Geométricos Base
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  const len = Math.hypot(dx, dy);

  if (len === 0) return null;

  // Vetor unitário
  const ux = dx / len;
  const uy = dy / len;

  // Vetor normal (perpendicular)
  const nx = -uy;
  const ny = ux;

  // 2. Renderização de Estereoquímica (Geometria Realista)

  if (stereo === StereoType.WEDGE) {
    // WEDGE (Cunha): Triângulo preenchido
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
  } else if (stereo === StereoType.DASH) {
    // DASH (Traço): Série de barras paralelas e perpendiculares
    const numDashes = 8;
    const startTaper = 1;
    const endTaper = 5;

    // <-- CORREÇÃO 2: Substituí JSX.Element[] por React.ReactNode[]
    const dashes: React.ReactNode[] = [];

    for (let i = 0; i < numDashes; i++) {
      const progress = i / (numDashes - 1);
      const centerX = s.x + dx * progress;
      const centerY = s.y + dy * progress;
      const currentTaper = startTaper + (endTaper - startTaper) * progress;

      dashes.push(
        <Line
          key={`${id}_dash_${i}`} // O 'id' agora existe para ser usado na key!
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

  // B. Ordem da Ligação (Dupla, Tripla)
  if (order === 2) {
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
  } else if (order === 3) {
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

  // C. Padrão: Ligação Simples
  return (
    <Line
      points={[s.x, s.y, t.x, t.y]}
      stroke={strokeColor}
      strokeWidth={3}
      lineCap="round"
      hitStrokeWidth={15}
      {...events}
    />
  );
};
