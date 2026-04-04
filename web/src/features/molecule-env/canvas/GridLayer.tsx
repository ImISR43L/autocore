import React, { useState, useEffect } from "react";
import { Layer, RegularPolygon } from "react-konva";
import { getVisualGrid, HEX_RADIUS } from "../utils/grid";
import { useCanvasTheme } from "../hooks/useCanvasTheme";

export const GridLayer: React.FC = () => {
  const theme = useCanvasTheme(); // <-- Injetando o tema processado
  const [grid, setGrid] = useState(() =>
    getVisualGrid(window.innerWidth - 220, window.innerHeight),
  );

  useEffect(() => {
    const handleResize = () => {
      setGrid(getVisualGrid(window.innerWidth - 220, window.innerHeight));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <Layer listening={false}>
      {grid.toArray().map((hex, i) => (
        <RegularPolygon
          key={i}
          x={hex.x}
          y={hex.y}
          sides={6}
          radius={HEX_RADIUS}
          stroke={theme.border} // <-- Cor viva!
          strokeWidth={1}
        />
      ))}
    </Layer>
  );
};
