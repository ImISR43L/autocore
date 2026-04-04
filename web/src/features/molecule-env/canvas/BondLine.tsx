import React from "react";
import { Line, Group } from "react-konva";
import { Bond, BondOrder } from "../types/molecule";
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

  const sHex = new CustomHex({
    q: sourceAtom.gridPosition.q,
    r: sourceAtom.gridPosition.r,
  });
  const tHex = new CustomHex({
    q: targetAtom.gridPosition.q,
    r: targetAtom.gridPosition.r,
  });

  const s = dragPositions[sourceAtom.id] || { x: sHex.x, y: sHex.y };
  const t = dragPositions[targetAtom.id] || { x: tHex.x, y: tHex.y };

  const dx = t.x - s.x;
  const dy = t.y - s.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const nx = -dy / dist;
  const ny = dx / dist;
  const gap = 6;

  const renderLine = (offset: number, key: string) => (
    <Line
      key={key}
      points={[
        s.x + nx * offset,
        s.y + ny * offset,
        t.x + nx * offset,
        t.y + ny * offset,
      ]}
      stroke={theme.mutedForeground}
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
      {bond.order === BondOrder.SINGLE && renderLine(0, "single")}
      {bond.order === BondOrder.DOUBLE && (
        <>
          {renderLine(gap / 2, "d1")}
          {renderLine(-gap / 2, "d2")}
        </>
      )}
      {bond.order === BondOrder.TRIPLE && (
        <>
          {renderLine(0, "t1")}
          {renderLine(gap, "t2")}
          {renderLine(-gap, "t3")}
        </>
      )}
    </Group>
  );
};
