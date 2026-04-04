// src/engine/validation.ts
import { getRDKit } from "./rdkit";
import { Atom, Bond } from "../types/molecule";

/**
 * Converte o estado atual do Grafo para um formato MolBlock V2000 estrito.
 */
const generateMolBlock = (
  atoms: Record<string, Atom>,
  bonds: Bond[],
): string => {
  const atomList = Object.values(atoms);
  const nAtoms = atomList.length;
  const nBonds = bonds.length;

  // Cabeçalho V2000 padrão (3 linhas rigorosas)
  let molBlock = `Autocore\n  RDKit 2D\n\n`;
  molBlock += `${nAtoms.toString().padStart(3, " ")}${nBonds.toString().padStart(3, " ")}  0  0  0  0  0  0  0  0  1 V2000\n`;

  // Seção de Átomos
  const atomIdToIndex: Record<string, number> = {};
  atomList.forEach((atom, index) => {
    atomIdToIndex[atom.id] = index + 1;

    let coordX = 0;
    let coordY = 0;

    // Proteção contra NaN e undefined
    if (
      typeof atom.x === "number" &&
      typeof atom.y === "number" &&
      !isNaN(atom.x) &&
      !isNaN(atom.y)
    ) {
      // Normalizamos dividindo por 50 (que é o nosso BOND_LENGTH).
      // Assim, as ligações no RDKit medem perfeitamente 1.0 Angstrom (geometria ideal!)
      coordX = atom.x / 50;
      coordY = -atom.y / 50;
    } else if (atom.gridPosition) {
      coordX = atom.gridPosition.q || 0;
      coordY = atom.gridPosition.r || 0;
    }

    const xStr = coordX.toFixed(4).padStart(10, " ");
    const yStr = coordY.toFixed(4).padStart(10, " ");
    const zStr = "0.0000".padStart(10, " ");
    const elementStr = atom.element.padEnd(3, " ");

    molBlock += `${xStr}${yStr}${zStr} ${elementStr} 0  0  0  0  0  0  0  0  0  0  0  0\n`;
  });

  // Seção de Ligações
  bonds.forEach((bond) => {
    const sIdx = atomIdToIndex[bond.sourceId];
    const tIdx = atomIdToIndex[bond.targetId];

    // Proteção: Se a ligação apontar para um átomo fantasma, ignora-a para não quebrar a string
    if (!sIdx || !tIdx) return;

    const sStr = sIdx.toString().padStart(3, " ");
    const tStr = tIdx.toString().padStart(3, " ");
    const orderStr = bond.order.toString().padStart(3, " ");

    molBlock += `${sStr}${tStr}${orderStr}  0  0  0  0\n`;
  });

  // Seção de Cargas
  atomList.forEach((atom, index) => {
    if (atom.charge && atom.charge !== 0) {
      const idx = String(index + 1).padStart(4, " ");
      const chg = String(atom.charge).padStart(4, " ");
      molBlock += `M  CHG  1${idx}${chg}\n`;
    }
  });

  molBlock += "M  END\n";
  return molBlock;
};

/**
 * Tenta criar uma molécula no RDKit. Se falhar, a ligação é quimicamente inválida.
 */
// src/engine/validation.ts (no final do ficheiro)

export const isChemistryValid = (
  atoms: Record<string, Atom>,
  bonds: Bond[],
): { valid: boolean; error?: string } => {
  // Moléculas vazias são sempre válidas
  if (Object.keys(atoms).length === 0) return { valid: true };

  // 1. Separa os ambientes (Workspaces)
  const orgAtoms: Record<string, Atom> = {};
  const inorgAtoms: Record<string, Atom> = {};

  for (const key in atoms) {
    if (atoms[key].x !== undefined) {
      orgAtoms[key] = atoms[key];
    } else {
      inorgAtoms[key] = atoms[key];
    }
  }

  const orgBonds = bonds.filter(
    (b) => orgAtoms[b.sourceId] && orgAtoms[b.targetId],
  );
  const inorgBonds = bonds.filter(
    (b) => inorgAtoms[b.sourceId] && inorgAtoms[b.targetId],
  );

  try {
    const RDKit = getRDKit();

    // 2. Valida o ambiente Orgânico (se houver moléculas lá)
    if (Object.keys(orgAtoms).length > 0) {
      const molBlockOrg = generateMolBlock(orgAtoms, orgBonds);
      try {
        const molOrg = RDKit.get_mol(molBlockOrg);
        if (!molOrg)
          return { valid: false, error: "Erro de Valência no modo Orgânico." };
        molOrg.delete();
      } catch (e) {
        console.error("RDKit rejeitou orgânica:", e);
        return {
          valid: false,
          error: "Geometria impossível no modo Orgânico.",
        };
      }
    }

    // 3. Valida o ambiente Inorgânico (se houver moléculas lá)
    if (Object.keys(inorgAtoms).length > 0) {
      const molBlockInorg = generateMolBlock(inorgAtoms, inorgBonds);
      try {
        const molInorg = RDKit.get_mol(molBlockInorg);
        if (!molInorg)
          return {
            valid: false,
            error: "Erro de Valência no modo Inorgânico.",
          };
        molInorg.delete();
      } catch (e) {
        console.error("RDKit rejeitou inorgânica:", e);
        return {
          valid: false,
          error: "Geometria impossível no modo Inorgânico.",
        };
      }
    }

    return { valid: true };
  } catch (globalError) {
    console.error("Erro fatal no validador:", globalError);
    return { valid: false, error: "Erro interno no motor de química." };
  }
};

export const exportMolecule = (
  atoms: Record<string, Atom>,
  bonds: Bond[],
  format: "molblock" | "smiles" = "smiles",
): string | null => {
  if (Object.keys(atoms).length === 0) return null;

  try {
    const molBlock = generateMolBlock(atoms, bonds);

    // Se o backend preferir o ficheiro V2000 completo, retorna logo aqui
    if (format === "molblock") return molBlock;

    // Caso contrário, pede ao RDKit para converter em SMILES
    const RDKit = getRDKit();
    const mol = RDKit.get_mol(molBlock);

    if (!mol) return null;

    const smiles = mol.get_smiles();
    mol.delete(); // Limpa a memória WASM

    return smiles;
  } catch (error) {
    console.error("Erro ao exportar a molécula:", error);
    return null;
  }
};
