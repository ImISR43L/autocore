// src/engine/validation.ts
import { getRDKit } from "./rdkit";
import { Atom, Bond, StereoType } from "../types/molecule";

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

export const importMoleculeFromSmiles = (
  smiles: string,
): { atoms: Record<string, Atom>; bonds: Bond[] } | null => {
  if (!smiles) return null;

  try {
    const RDKit = getRDKit();
    const mol = RDKit.get_mol(smiles);
    if (!mol) return null;

    if (mol.set_new_coords) {
      mol.set_new_coords();
    }

    const molBlock = mol.get_molblock();
    mol.delete();

    if (!molBlock) return null;

    const lines = molBlock.split(/\r?\n/);
    if (lines.length < 4) return null;

    const countsLine = lines[3];
    const numAtoms = parseInt(countsLine.substring(0, 3).trim(), 10);
    const numBonds = parseInt(countsLine.substring(3, 6).trim(), 10);

    const newAtoms: Record<string, Atom> = {};
    const newBonds: Bond[] = [];
    const timestamp = Date.now();

    for (let i = 0; i < numAtoms; i++) {
      const line = lines[4 + i];
      if (!line) continue;

      const xStr = line.substring(0, 10).trim();
      const yStr = line.substring(10, 20).trim();
      const symbol = line.substring(31, 34).trim();

      const x = parseFloat(xStr) * 50 + 400;
      const y = -parseFloat(yStr) * 50 + 300;

      const size = 25;

      const q = Math.round(((Math.sqrt(3) / 3) * x - (1 / 3) * y) / size);
      const r = Math.round(((2 / 3) * y) / size);

      const id = `atom_${timestamp}_loaded_${i}`;
      newAtoms[id] = {
        id,
        element: symbol || "C",
        charge: 0,
        gridPosition: { q, r },
        x,
        y,
      };
    }

    const bondStartIndex = 4 + numAtoms;
    for (let i = 0; i < numBonds; i++) {
      const line = lines[bondStartIndex + i];
      if (!line) continue;

      const atom1Idx = parseInt(line.substring(0, 3).trim(), 10) - 1;
      const atom2Idx = parseInt(line.substring(3, 6).trim(), 10) - 1;
      const bondOrder = parseInt(line.substring(6, 9).trim(), 10);

      const sourceId = `atom_${timestamp}_loaded_${atom1Idx}`;
      const targetId = `atom_${timestamp}_loaded_${atom2Idx}`;

      newBonds.push({
        id: `bond_${timestamp}_loaded_${i}`,
        sourceId,
        targetId,
        order: bondOrder >= 1 && bondOrder <= 3 ? bondOrder : 1,
        stereo: StereoType.NONE,
      });
    }

    return { atoms: newAtoms, bonds: newBonds };
  } catch (error) {
    console.error("Erro ao importar molécula do SMILES:", error);
    return null;
  }
};
