import React, { useState, useEffect, useRef, useMemo } from "react";
import { Stage, Layer } from "react-konva";
import { GridLayer } from "./GridLayer";
import { AtomNode } from "./AtomNode";
import { BondLine } from "./BondLine";
import { useMoleculeStore } from "../store/useMoleculeStore";
import { gridMath } from "../utils/grid";
import { Atom } from "../types/molecule";

export const MoleculeCanvas: React.FC = () => {
  const stageRef = useRef<any>(null);
  const allAtoms = useMoleculeStore((state) => state.atoms);
  const allBonds = useMoleculeStore((state) => state.bonds);

  const atoms = useMemo(() => {
    const filtered: Record<string, Atom> = {};
    for (const key in allAtoms) {
      if (allAtoms[key].x === undefined) {
        filtered[key] = allAtoms[key];
      }
    }
    return filtered;
  }, [allAtoms]);

  const bonds = useMemo(() => {
    return allBonds.filter((b) => allAtoms[b.sourceId]?.x === undefined);
  }, [allBonds, allAtoms]);

  const activeElement = useMoleculeStore((state) => state.activePaletteElement);
  const addAtomToGrid = useMoleculeStore((state) => state.addAtomToGrid);
  const isGridVisible = useMoleculeStore((state) => state.isGridVisible);

  const [dimensions, setDimensions] = useState({
    width: window.innerWidth - 220,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth - 220,
        height: window.innerHeight,
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleStageClick = (e: any) => {
    if (!activeElement) return;
    if (e.target !== stageRef.current && e.target.name() !== "grid-polygon")
      return;

    const stage = stageRef.current;
    if (!stage) return;
    const pointerPosition = stage.getPointerPosition();
    if (!pointerPosition) return;

    const clickedHex = gridMath.pointToHex({
      x: pointerPosition.x,
      y: pointerPosition.y,
    });
    if (clickedHex) addAtomToGrid(clickedHex.q, clickedHex.r);
  };

  return (
    <>
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{
          cursor: activeElement ? "crosshair" : "grab",
        }}
        onClick={handleStageClick}
      >
        {isGridVisible && <GridLayer />}
        <Layer>
          {bonds.map((bond) => (
            <BondLine key={bond.id} bond={bond} />
          ))}
        </Layer>
        <Layer>
          {Object.values(atoms).map((atom) => (
            <AtomNode key={atom.id} atom={atom} />
          ))}
        </Layer>
      </Stage>
    </>
  );
};
