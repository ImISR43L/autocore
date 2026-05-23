import React from "react";
import { Line, Group } from "react-konva";
import { Bond } from "../types/molecule";
import { CustomHex } from "../utils/grid";
import { useMoleculeStore } from "../store/useMoleculeStore";
import { useCanvasTheme } from "../hooks/useCanvasTheme";

export const BondLine: React.FC<{ bond: Bond }> = ({ bond }) => {
  const theme = useCanvasTheme();
  const sourceAtom = useMoleculeStore((state) => state.atoms[bond.sourceId]);
  const targetAtom = useMoleculeStore((state) => state.atoms[bond.targetId]);
  const cycleBondOrder = useMoleculeStore((state) => state.cycleBondOrder);
  const activePaletteElement = useMoleculeStore(
    (state) => state.activePaletteElement,
  );
  const removeBond = useMoleculeStore((state) => state.removeBond);
  const dragPositions = useMoleculeStore((state) => state.dragPositions);

  if (!sourceAtom || !targetAtom) return null;

  // 👇 CORREÇÃO 1: Conversão Numérica Explícita.
  // Garante que o CustomHex nunca receba strings vindas do JSON da Submissão.
  const sHex = new CustomHex({
    q: Number(sourceAtom.gridPosition?.q || 0),
    r: Number(sourceAtom.gridPosition?.r || 0),
  });
  const tHex = new CustomHex({
    q: Number(targetAtom.gridPosition?.q || 0),
    r: Number(targetAtom.gridPosition?.r || 0),
  });

  // Proteção extra com navegação segura (?.) e fallback de 0
  const s = dragPositions?.[sourceAtom.id] || {
    x: sHex.x || 0,
    y: sHex.y || 0,
  };
  const t = dragPositions?.[targetAtom.id] || {
    x: tHex.x || 0,
    y: tHex.y || 0,
  };

  const dx = t.x - s.x;
  const dy = t.y - s.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // 👇 CORREÇÃO 2: Prevenção de Divisão por Zero (que geraria NaN e esconderia a linha)
  const nx = dist === 0 ? 0 : -dy / dist;
  const ny = dist === 0 ? 0 : dx / dist;
  const gap = 6;

  const orderNum = Number(bond.order) || 1;

  // 👇 CORREÇÃO 3: Blindagem de Cor CSS do Modal.
  // Se o Modal forçar a geração de um hsl() ou var() quebrado, substituímos pelo cinza metálico clássico
  let strokeColor = theme?.mutedForeground || "#a1a1aa";
  if (
    strokeColor.replace(/\s/g, "") === "hsl()" ||
    strokeColor.startsWith("var(")
  ) {
    strokeColor = "#a1a1aa";
  }

  const renderLine = (offset: number, key: string) => (
    <Line
      key={key}
      points={[
        s.x + nx * offset,
        s.y + ny * offset,
        t.x + nx * offset,
        t.y + ny * offset,
      ]}
      stroke={strokeColor}
      strokeWidth={4}
      lineCap="round"
      perfectDrawEnabled={false}
    />
  );

  const handleBondClick = () => {
    if (activePaletteElement === "ERASER") removeBond(bond.id);
    else cycleBondOrder(bond.id);
  };

  return (
    <Group
      onClick={handleBondClick}
      onMouseEnter={(e) => {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = "pointer";
      }}
      onMouseLeave={(e) => {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = "default";
      }}
    >
      <Line
        points={[s.x, s.y, t.x, t.y]}
        stroke="transparent"
        strokeWidth={15}
      />
      {orderNum === 1 && renderLine(0, "single")}
      {orderNum === 2 && (
        <>
          {renderLine(gap / 2, "d1")}
          {renderLine(-gap / 2, "d2")}
        </>
      )}
      {orderNum === 3 && (
        <>
          {renderLine(0, "t1")}
          {renderLine(gap, "t2")}
          {renderLine(-gap, "t3")}
        </>
      )}
    </Group>
  );
};
