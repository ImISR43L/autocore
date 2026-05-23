import React, { useState, useMemo } from "react";
import { Stage, Layer, Line, Circle, Text } from "react-konva";
import { useMoleculeStore } from "../store/useMoleculeStore";
import { ELEMENT_DATA } from "../utils/elements";
import { OrganicBondLine } from "./OrganicBondLine";
import { Atom } from "../types/molecule";
import { useCanvasTheme } from "../hooks/useCanvasTheme";

const BOND_LENGTH = 50;

export const OrganicCanvas: React.FC = () => {
  const theme = useCanvasTheme();
  const width = window.innerWidth - 220;
  const height = window.innerHeight;

  const allAtoms = useMoleculeStore((state) => state.atoms);
  const allBonds = useMoleculeStore((state) => state.bonds);

  const atoms = useMemo(() => {
    const filtered: Record<string, Atom> = {};
    for (const key in allAtoms) {
      if (allAtoms[key].x !== undefined) filtered[key] = allAtoms[key];
    }
    return filtered;
  }, [allAtoms]);

  const bonds = useMemo(() => {
    return allBonds.filter((b) => allAtoms[b.sourceId]?.x !== undefined);
  }, [allBonds, allAtoms]);

  const addOrganicConnection = useMoleculeStore(
    (state) => state.addOrganicConnection,
  );
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [endPos, setEndPos] = useState({ x: 0, y: 0 });
  const [hoveredAtomId, setHoveredAtomId] = useState<string | null>(null);
  const [hoveredBondId, setHoveredBondId] = useState<string | null>(null);
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const activePaletteElement = useMoleculeStore(
    (state) => state.activePaletteElement,
  );
  const modifyOrganicBond = useMoleculeStore(
    (state) => state.modifyOrganicBond,
  );
  const modifyOrganicAtom = useMoleculeStore(
    (state) => state.modifyOrganicAtom,
  );
  const addOrganicRing = useMoleculeStore((state) => state.addOrganicRing);
  const addFusedRing = useMoleculeStore((state) => state.addFusedRing);
  const removeAtom = useMoleculeStore((state) => state.removeAtom);

  const isElementTool = (tool: string | null) => {
    if (!tool) return false;
    return Object.keys(ELEMENT_DATA).includes(tool) && tool !== "DEFAULT";
  };

  const handleMouseDown = (e: any) => {
    if (e.target.name() === "UI_ELEMENT") return;
    const pos = e.target.getStage().getPointerPosition();

    if (activePaletteElement && activePaletteElement.startsWith("RING_")) {
      if (hoveredAtomId && atoms[hoveredAtomId])
        addOrganicRing(pos.x, pos.y, activePaletteElement, hoveredAtomId);
      else addOrganicRing(pos.x, pos.y, activePaletteElement);
      return;
    }

    setIsDrawing(true);
    if (hoveredAtomId && atoms[hoveredAtomId]) {
      const atom = atoms[hoveredAtomId];
      setStartPos({ x: atom.x!, y: atom.y! });
      setDragSourceId(atom.id);
    } else {
      setStartPos(pos);
      setDragSourceId(null);
    }
    setEndPos(pos);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing) return;
    const pos = e.target.getStage().getPointerPosition();
    let snappedToAtom = false;

    for (const atom of Object.values(atoms)) {
      if (atom.id === dragSourceId) continue;
      if (atom.x !== undefined && atom.y !== undefined) {
        const distToAtom = Math.hypot(atom.x - pos.x, atom.y - pos.y);
        if (distToAtom < 25) {
          setEndPos({ x: atom.x, y: atom.y });
          snappedToAtom = true;
          break;
        }
      }
    }

    if (!snappedToAtom) {
      const dx = pos.x - startPos.x;
      const dy = pos.y - startPos.y;
      const angle = Math.atan2(dy, dx);
      const snapAngle = Math.round(angle / (Math.PI / 6)) * (Math.PI / 6);
      const finalX = startPos.x + Math.cos(snapAngle) * BOND_LENGTH;
      const finalY = startPos.y + Math.sin(snapAngle) * BOND_LENGTH;
      setEndPos({ x: finalX, y: finalY });
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const dist = Math.hypot(endPos.x - startPos.x, endPos.y - startPos.y);
    if (dist > 10) {
      let targetAtomId: string | null = null;
      for (const atom of Object.values(atoms)) {
        if (atom.id === dragSourceId) continue;
        if (atom.x !== undefined && atom.y !== undefined) {
          const distanceToAtom = Math.hypot(
            atom.x - endPos.x,
            atom.y - endPos.y,
          );
          if (distanceToAtom < 5) {
            targetAtomId = atom.id;
            break;
          }
        }
      }
      addOrganicConnection(
        dragSourceId,
        targetAtomId,
        startPos.x,
        startPos.y,
        endPos.x,
        endPos.y,
      );
    }
    setDragSourceId(null);
  };

  return (
    <Stage
      width={width}
      height={height}
      style={{
        cursor: "crosshair",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <Layer>
        {bonds.map((bond) => {
          const s = atoms[bond.sourceId];
          const t = atoms[bond.targetId];

          if (
            !s ||
            !t ||
            s.x === undefined ||
            s.y === undefined ||
            t.x === undefined ||
            t.y === undefined
          )
            return null;

          let strokeColor = theme.foreground;
          let strokeWidth = 3;
          let dash: number[] | undefined = undefined;

          if (bond.order === 2) strokeWidth = 7;
          if (bond.order === 3) strokeWidth = 11;

          if (bond.stereo === "wedge") {
            strokeColor = theme.primary;
            strokeWidth = 6;
          } else if (bond.stereo === "dash") {
            strokeColor = theme.destructive;
            dash = [4, 4];
          }

          if (hoveredBondId === bond.id && activePaletteElement) {
            if (activePaletteElement.startsWith("RING_")) {
              strokeColor = theme.statusWarning;
            } else if (activePaletteElement === "ERASER") {
              strokeColor = theme.destructive;
            } else if (activePaletteElement.startsWith("BOND_")) {
              strokeColor = theme.primary;
            }
          }

          return (
            <OrganicBondLine
              key={bond.id}
              id={bond.id}
              s={{ x: s.x!, y: s.y! }}
              t={{ x: t.x!, y: t.y! }}
              order={bond.order}
              stereo={bond.stereo}
              strokeColor={strokeColor || "#888888"}
              strokeWidth={strokeWidth}
              dash={dash}
              onMouseDown={(e) => {
                e.cancelBubble = true;
                if (
                  activePaletteElement &&
                  activePaletteElement.startsWith("RING_")
                ) {
                  const stage = e.target.getStage();
                  if (!stage) return;
                  const pos = stage.getPointerPosition();
                  if (!pos) return;
                  addFusedRing(bond.id, activePaletteElement, pos.x, pos.y);
                } else if (activePaletteElement) {
                  modifyOrganicBond(bond.id, activePaletteElement);
                }
              }}
              onMouseEnter={() => setHoveredBondId(bond.id)}
              onMouseLeave={() => setHoveredBondId(null)}
            />
          );
        })}

        {Object.values(atoms)
          .filter(
            (a) => a.x !== undefined && a.y !== undefined && a.element !== "C",
          )
          .map((atom) => (
            <Circle
              key={`bg_${atom.id}`}
              x={atom.x!}
              y={atom.y!}
              radius={14}
              fill={theme.background}
              listening={false}
            />
          ))}

        {Object.values(atoms)
          .filter(
            (a) => a.x !== undefined && a.y !== undefined && a.element !== "C",
          )
          .map((atom) => {
            const color = ELEMENT_DATA[atom.element]?.color || theme.foreground;
            return (
              <Text
                key={`text_${atom.id}`}
                x={atom.x!}
                y={atom.y!}
                text={atom.element}
                fontSize={18}
                fontStyle="bold"
                fill={color}
                listening={false}
                offsetX={atom.element.length > 1 ? 10 : 6}
                offsetY={8}
              />
            );
          })}

        {Object.values(atoms)
          .filter((a) => a.x !== undefined && a.y !== undefined)
          .map((atom) => (
            <Circle
              key={`hit_${atom.id}`}
              x={atom.x!}
              y={atom.y!}
              radius={15}
              fill="transparent"
              onMouseDown={(e) => {
                if (activePaletteElement === "ERASER") {
                  e.cancelBubble = true;
                  removeAtom(atom.id);
                } else if (isElementTool(activePaletteElement)) {
                  e.cancelBubble = true;
                  modifyOrganicAtom(atom.id, activePaletteElement!);
                }
              }}
              onMouseEnter={(e) => {
                setHoveredAtomId(atom.id);
                const stage = e.target.getStage();
                if (
                  stage &&
                  (isElementTool(activePaletteElement) ||
                    activePaletteElement === "ERASER")
                ) {
                  stage.container().style.cursor = "pointer";
                }
              }}
              onMouseLeave={(e) => {
                setHoveredAtomId(null);
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = "crosshair";
              }}
            />
          ))}

        {isDrawing && (
          <Line
            points={[startPos.x, startPos.y, endPos.x, endPos.y]}
            stroke={theme.primary}
            strokeWidth={3}
            dash={[5, 5]}
          />
        )}

        {hoveredAtomId &&
          !isDrawing &&
          atoms[hoveredAtomId]?.x !== undefined && (
            <Circle
              x={atoms[hoveredAtomId].x!}
              y={atoms[hoveredAtomId].y!}
              radius={activePaletteElement?.startsWith("RING_") ? 10 : 6}
              fill={
                activePaletteElement === "ERASER"
                  ? theme.destructive
                  : theme.primary
              }
              opacity={0.6}
              listening={false}
            />
          )}
      </Layer>
    </Stage>
  );
};
