// src/utils/grid.ts
import { defineHex, Grid, rectangle, Orientation } from "honeycomb-grid";

export const HEX_RADIUS = 30;

export class CustomHex extends defineHex({
  dimensions: HEX_RADIUS,
  orientation: Orientation.POINTY,
}) {}

// 1. Instância matemática infinita (usada apenas para calcular posições dos átomos)
export const gridMath = new Grid(CustomHex);

// 2. Função que gera a grelha visual com base no tamanho EXATO da tela naquele momento
export const getVisualGrid = (width: number, height: number) => {
  const hexWidth = Math.sqrt(3) * HEX_RADIUS;
  const hexHeight = 2 * HEX_RADIUS;
  const verticalSpacing = hexHeight * 0.75;

  // CORREÇÃO: Margem aumentada para +5 garante que não faltam hexágonos no fundo
  const cols = Math.ceil(width / hexWidth) + 5;
  const rows = Math.ceil(height / verticalSpacing) + 5;

  return new Grid(CustomHex, rectangle({ width: cols, height: rows }));
};
