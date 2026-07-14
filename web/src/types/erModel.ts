// Espelha ErModel* em submission.entity.ts (backend). Mudar um lado sem
// o outro quebra a submissão/leitura do diagrama silenciosamente — são
// dois arquivos que precisam ficar em sincronia manual.

export interface ErAttribute {
  name: string;
  isPK: boolean;
  isFK: boolean;
  type?: string;
}

export interface ErEntity {
  id: string;
  name: string;
  attributes: ErAttribute[];
  position?: { x: number; y: number };
}

export type ErCardinality = "1:1" | "1:N" | "N:M";

export interface ErRelationship {
  id: string;
  from: string;
  to: string;
  cardinality: ErCardinality;
  name?: string;
}

export interface ErModel {
  entities: ErEntity[];
  relationships: ErRelationship[];
}

export const EMPTY_ER_MODEL: ErModel = { entities: [], relationships: [] };
