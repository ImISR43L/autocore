// src/types/molecule.ts

/**
 * Representa o tipo de ligação na grelha.
 * Essencial para validar as valências no motor químico.
 */
export enum BondOrder {
  SINGLE = 1,
  DOUBLE = 2,
  TRIPLE = 3,
}

/**
 * Define a estereoquímica da ligação.
 * Crucial para representar geometrias 3D (como octaédrica) num ecrã 2D.
 */
export enum StereoType {
  NONE = "none", // Ligação normal no plano
  WEDGE = "wedge", // Cunha cheia (a apontar para fora do ecrã)
  DASH = "dash", // Traço (a apontar para dentro do ecrã)
}

/**
 * Coordenadas axiais da malha hexagonal (Honeycomb).
 * Não guardamos píxeis (X, Y), mas sim a posição lógica no tabuleiro.
 */
export interface GridCoordinates {
  q: number; // Eixo Q (coluna axial)
  r: number; // Eixo R (linha axial)
}

/**
 * Representação de um único átomo (Nó do Grafo).
 */
export interface Atom {
  id: string;
  element: string;
  gridPosition: GridCoordinates; // Continua aqui para a inorgânica
  x?: number; // NOVO: Posição X em píxeis para o modo orgânico
  y?: number; // NOVO: Posição Y em píxeis para o modo orgânico
  charge: number;
  isotope?: number;
}

/**
 * Representação de uma ligação química (Aresta do Grafo).
 */
export interface Bond {
  id: string;
  sourceId: string; // ID do átomo de origem
  targetId: string; // ID do átomo de destino
  order: BondOrder; // Simples, dupla ou tripla
  stereo: StereoType; // Cunha, traço ou plana
}

/**
 * O estado completo do construtor.
 * É esta a estrutura que será enviada para o validador e para o backend.
 */
export interface MoleculeGraph {
  // Usamos um Record (Dicionário) para os átomos para permitir
  // uma busca ultra-rápida O(1) através do ID ao desenhar as ligações.
  atoms: Record<string, Atom>;

  // As ligações ficam num array simples para serem iteradas na renderização.
  bonds: Bond[];
}

export interface AtomNodeProps {
  atom: Atom;
}
