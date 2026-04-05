import { create } from "zustand";
import { Atom, Bond, BondOrder, StereoType } from "../types/molecule";
import {
  isChemistryValid,
  exportMolecule,
  importMoleculeFromSmiles,
} from "../engine/validation";

export type BuilderMode = "INORGANIC" | "ORGANIC";

interface MoleculeState {
  atoms: Record<string, Atom>;
  bonds: Bond[];
  selectedAtomId: string | null;
  activePaletteElement: string | null; // <-- NOVO: Elemento selecionado na paleta
  isGridVisible: boolean;
  dragPositions: Record<string, { x: number; y: number }>;
  mode: BuilderMode; // NOVO

  // Ações
  setActiveElement: (element: string) => void; // <-- NOVO: Ação para selecionar na paleta
  addAtomToGrid: (q: number, r: number) => void; // <-- NOVO: Ação para clicar na grade e adicionar
  updateAtomPosition: (id: string, q: number, r: number) => void;
  selectAtom: (id: string) => void;
  removeAtom: (id: string) => void;
  cycleBondOrder: (bondId: string) => void;
  removeBond: (id: string) => void;
  modifyAtomCharge: (id: string, delta: number) => void;
  toggleGrid: () => void;
  setAtomDragPosition: (
    id: string,
    pos: { x: number; y: number } | null,
  ) => void; // NOVO
  setMode: (mode: BuilderMode) => void;
  addOrganicConnection: (
    sourceId: string | null,
    targetId: string | null,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ) => void;
  modifyOrganicBond: (bondId: string, tool: string) => void;
  modifyOrganicAtom: (atomId: string, element: string) => void;
  addOrganicRing: (
    centerX: number,
    centerY: number,
    ringType: string,
    anchorAtomId?: string | null,
  ) => void;
  addFusedRing: (
    bondId: string,
    ringType: string,
    clickX: number,
    clickY: number,
  ) => void;
  exportCurrentMolecule: (format?: "molblock" | "smiles") => string | null;
  loadMoleculeFromSmiles: (smiles: string, targetMode?: BuilderMode) => void;
  clear: () => void;
  loadMoleculeFromState: (rawState: {
    atoms: Record<string, Atom>;
    bonds: Bond[];
    mode: BuilderMode;
  }) => void;
}

const isOccupied = (atoms: Record<string, Atom>, q: number, r: number) => {
  return Object.values(atoms).some(
    (a) => a.gridPosition.q === q && a.gridPosition.r === r,
  );
};

export const useMoleculeStore = create<MoleculeState>((set, get) => ({
  atoms: {},
  bonds: [],
  selectedAtomId: null,
  activePaletteElement: null, // Inicialmente nada selecionado
  isGridVisible: true,
  dragPositions: {},
  mode: "INORGANIC",

  setMode: (mode) => set({ mode }),

  // NOVO: Define qual elemento o utilizador quer desenhar
  setActiveElement: (element) =>
    set((state) => ({
      activePaletteElement:
        state.activePaletteElement === element ? null : element,
    })),

  addAtomToGrid: (q, r) =>
    set((state) => {
      const { activePaletteElement, atoms } = state;

      // Se não houver elemento, ou se a casa estiver ocupada, ignora
      if (!activePaletteElement || isOccupied(atoms, q, r)) return state;

      // CORREÇÃO: Impede que ferramentas sejam desenhadas como átomos
      const tools = ["ERASER", "CHARGE_PLUS", "CHARGE_MINUS"];
      if (tools.includes(activePaletteElement)) return state;

      const newId = `atom_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const newAtom: Atom = {
        id: newId,
        element: activePaletteElement,
        charge: 0,
        gridPosition: { q, r },
      };

      return {
        atoms: { ...atoms, [newId]: newAtom },
      };
    }),

  removeAtom: (id) =>
    set((state) => {
      // 1. Removemos o átomo do dicionário
      const { [id]: _, ...remainingAtoms } = state.atoms;

      // 2. Removemos todas as ligações que apontavam para esse átomo
      const remainingBonds = state.bonds.filter(
        (bond) => bond.sourceId !== id && bond.targetId !== id,
      );

      return {
        atoms: remainingAtoms,
        bonds: remainingBonds,
        // Se o átomo removido estava selecionado para uma ligação, limpamos a seleção
        selectedAtomId:
          state.selectedAtomId === id ? null : state.selectedAtomId,
      };
    }),

  updateAtomPosition: (id, q, r) =>
    set((state) => {
      const atom = state.atoms[id];
      if (!atom) return state;
      return {
        atoms: { ...state.atoms, [id]: { ...atom, gridPosition: { q, r } } },
      };
    }),

  selectAtom: (id) =>
    set((state) => {
      const { selectedAtomId, bonds, atoms } = state;

      if (selectedAtomId === id || !selectedAtomId) {
        return { selectedAtomId: id === selectedAtomId ? null : id };
      }

      // Verificar se já existe ligação
      const bondExists = bonds.some(
        (b) =>
          (b.sourceId === selectedAtomId && b.targetId === id) ||
          (b.sourceId === id && b.targetId === selectedAtomId),
      );
      if (bondExists) return { selectedAtomId: null };

      // Criar uma ligação temporária para teste
      const potentialBond: Bond = {
        id: `temp`,
        sourceId: selectedAtomId,
        targetId: id,
        order: BondOrder.SINGLE,
        stereo: StereoType.NONE,
      };

      // VALIDAR COM RDKit
      const validation = isChemistryValid(atoms, [...bonds, potentialBond]);

      if (!validation.valid) {
        alert(`Erro Químico: ${validation.error}`); // No futuro, use um Toast mais elegante
        return { selectedAtomId: null };
      }

      // Se for válido, adiciona de verdade
      const finalBond = { ...potentialBond, id: `bond_${Date.now()}` };
      return {
        bonds: [...bonds, finalBond],
        selectedAtomId: null,
      };
    }),

  setAtomDragPosition: (id, pos) =>
    set((state) => {
      // Se pos for null, o arrasto terminou, então removemos o átomo do dicionário
      if (pos === null) {
        const { [id]: _, ...remainingDrags } = state.dragPositions;
        return { dragPositions: remainingDrags };
      }
      // Caso contrário, atualizamos a posição em tempo real
      return { dragPositions: { ...state.dragPositions, [id]: pos } };
    }),

  cycleBondOrder: (bondId) =>
    set((state) => {
      const bondIndex = state.bonds.findIndex((b) => b.id === bondId);
      if (bondIndex === -1) return state;

      const currentBond = state.bonds[bondIndex];
      // Ciclo: 1 -> 2 -> 3 -> 1
      const nextOrder =
        currentBond.order >= 3 ? 1 : ((currentBond.order + 1) as BondOrder);

      // Criamos uma cópia das ligações com a nova ordem para validar
      const updatedBonds = [...state.bonds];
      updatedBonds[bondIndex] = { ...currentBond, order: nextOrder };

      // Validação Química com RDKit
      const validation = isChemistryValid(state.atoms, updatedBonds);
      if (!validation.valid) {
        alert(`Violação de Valência: ${validation.error}`);
        return state;
      }

      return { bonds: updatedBonds };
    }),

  removeBond: (id) =>
    set((state) => ({
      bonds: state.bonds.filter((bond) => bond.id !== id),
    })),

  modifyAtomCharge: (id, delta) =>
    set((state) => {
      const atom = state.atoms[id];
      if (!atom) return state;

      let newCharge = atom.charge + delta;

      // 1. TRAVA LÓGICA: Limites do mundo real (Evita +50 ou -50)
      // Para inorgânica, cargas de -4 a +4 cobrem 99% dos casos práticos
      const MAX_CHARGE = 4;
      const MIN_CHARGE = -4;

      if (newCharge > MAX_CHARGE) newCharge = MAX_CHARGE;
      if (newCharge < MIN_CHARGE) newCharge = MIN_CHARGE;

      // Se o limite impediu a mudança de ocorrer, nem precisamos chamar o RDKit
      if (newCharge === atom.charge) return state;

      // 2. TRAVA ESTRUTURAL (RDKit)
      const updatedAtoms = {
        ...state.atoms,
        [id]: { ...atom, charge: newCharge },
      };

      const validation = isChemistryValid(updatedAtoms, state.bonds);

      if (!validation.valid) {
        console.warn(
          `Carga estruturalmente rejeitada pelo RDKit: ${validation.error}`,
        );
        return state;
      }

      return { atoms: updatedAtoms };
    }),

  toggleGrid: () => set((state) => ({ isGridVisible: !state.isGridVisible })),

  addOrganicConnection: (sourceId, targetId, startX, startY, endX, endY) =>
    set((state) => {
      const newAtoms = { ...state.atoms };
      const newBonds = [...state.bonds];

      const genId = () =>
        `atom_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const bondId = `bond_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      let actualSourceId = sourceId;
      if (!actualSourceId) {
        actualSourceId = genId();
        newAtoms[actualSourceId] = {
          id: actualSourceId,
          element: "C",
          charge: 0,
          gridPosition: { q: 0, r: 0 },
          x: startX,
          y: startY,
        };
      }

      // CORREÇÃO: Se não houver targetId, criamos um novo. Se houver, usamos o existente!
      let actualTargetId = targetId;
      if (!actualTargetId) {
        actualTargetId = genId();
        newAtoms[actualTargetId] = {
          id: actualTargetId,
          element: "C",
          charge: 0,
          gridPosition: { q: 0, r: 0 },
          x: endX,
          y: endY,
        };
      }

      // Previne que o utilizador ligue o átomo a ele mesmo
      if (actualSourceId === actualTargetId) return state;

      // Previne a criação de ligações duplicadas se o ciclo já estiver fechado
      const bondExists = newBonds.some(
        (b) =>
          (b.sourceId === actualSourceId && b.targetId === actualTargetId) ||
          (b.sourceId === actualTargetId && b.targetId === actualSourceId),
      );

      if (!bondExists) {
        newBonds.push({
          id: bondId,
          sourceId: actualSourceId,
          targetId: actualTargetId,
          order: 1,
          stereo: StereoType.NONE, // ou 'none' se ainda não importou o Enum
        });
      }

      const validation = isChemistryValid(newAtoms, newBonds);
      if (!validation.valid) {
        alert(`Erro Químico: ${validation.error}`);
        return state; // Aborta a criação da linha se a valência estourar
      }

      return { atoms: newAtoms, bonds: newBonds };
    }),

  modifyOrganicBond: (bondId, tool) =>
    set((state) => {
      const bondIndex = state.bonds.findIndex((b) => b.id === bondId);
      if (bondIndex === -1) return state;

      // Se a ferramenta for a Borracha, removemos a ligação
      if (tool === "ERASER") {
        return { bonds: state.bonds.filter((b) => b.id !== bondId) };
      }

      const updatedBonds = [...state.bonds];
      const bond = { ...updatedBonds[bondIndex] };

      // Aplica as propriedades corretas com base na ferramenta
      switch (tool) {
        case "BOND_SINGLE":
          bond.order = 1;
          bond.stereo = StereoType.NONE;
          break;
        case "BOND_DOUBLE":
          bond.order = 2;
          bond.stereo = StereoType.NONE;
          break;
        case "BOND_TRIPLE":
          bond.order = 3;
          bond.stereo = StereoType.NONE;
          break;
        case "BOND_WEDGE":
          bond.order = 1;
          bond.stereo = StereoType.WEDGE;
          break;
        case "BOND_DASH":
          bond.order = 1;
          bond.stereo = StereoType.DASH;
          break;
        default:
          return state; // Se clicou com um átomo ou outra ferramenta, não faz nada
      }

      updatedBonds[bondIndex] = bond;
      const validation = isChemistryValid(state.atoms, updatedBonds);
      if (!validation.valid) {
        alert(`Violação de Valência: ${validation.error}`);
        return state; // Reverte se tentar fazer uma tripla num carbono que já tem outras ligações
      }

      return { bonds: updatedBonds };
    }),

  modifyOrganicAtom: (id, element) =>
    set((state) => {
      const atom = state.atoms[id];
      if (!atom) return state;

      const updatedAtoms = { ...state.atoms, [id]: { ...atom, element } };

      // NOVO: Validação Química
      const validation = isChemistryValid(updatedAtoms, state.bonds);
      if (!validation.valid) {
        alert(
          `Erro Químico: O elemento ${element} não suporta essa quantidade de ligações neste ponto. (${validation.error})`,
        );
        return state;
      }

      return { atoms: updatedAtoms };
    }),

  addOrganicRing: (centerX, centerY, ringType, anchorAtomId) =>
    set((state) => {
      const newAtoms = { ...state.atoms };
      const newBonds = [...state.bonds];
      const n = ringType === "RING_CYCLOPENTANE" ? 5 : 6;
      const BOND_LENGTH = 50;
      const radius = BOND_LENGTH / (2 * Math.sin(Math.PI / n));

      let Cx = centerX;
      let Cy = centerY;
      let startAngle = -Math.PI / 2; // Padrão: começa com a ponta para cima

      // --- NOVA LÓGICA: CRESCIMENTO PARA FORA EM ÁTOMOS ---
      if (anchorAtomId && state.atoms[anchorAtomId]) {
        const anchor = state.atoms[anchorAtomId];

        // 1. Encontra os vizinhos do átomo clicado
        const neighbors = state.bonds
          .filter(
            (b) => b.sourceId === anchorAtomId || b.targetId === anchorAtomId,
          )
          .map((b) =>
            b.sourceId === anchorAtomId
              ? state.atoms[b.targetId]
              : state.atoms[b.sourceId],
          )
          .filter((a) => a && a.x !== undefined && a.y !== undefined);

        let dx = 0;
        let dy = 1; // Se for um átomo solto, cresce para baixo por padrão

        // 2. Calcula o centro de massa dos vizinhos para saber onde está o "corpo"
        if (neighbors.length > 0) {
          let avgX = 0;
          let avgY = 0;
          for (const neighbor of neighbors) {
            avgX += neighbor.x!;
            avgY += neighbor.y!;
          }
          avgX /= neighbors.length;
          avgY /= neighbors.length;

          // 3. O vetor aponta do corpo para o átomo (para fora da molécula!)
          dx = anchor.x! - avgX;
          dy = anchor.y! - avgY;

          const len = Math.hypot(dx, dy);
          if (len > 0.001) {
            dx /= len;
            dy /= len;
          } else {
            dx = 0;
            dy = 1;
          }
        }

        // 4. O centro do novo anel fica na direção "para fora"
        Cx = anchor.x! + dx * radius;
        Cy = anchor.y! + dy * radius;

        // 5. O ângulo inicial é ajustado para que o primeiro vértice ligue perfeitamente no âncora
        startAngle = Math.atan2(anchor.y! - Cy, anchor.x! - Cx);
      }
      // ---------------------------------------------------

      const ringAtomIds: string[] = [];
      const timestamp = Date.now();

      for (let i = 0; i < n; i++) {
        // O primeiro átomo gerado reaproveita o átomo clicado
        if (i === 0 && anchorAtomId) {
          ringAtomIds.push(anchorAtomId);
          continue;
        }

        // Usa o ângulo inicial dinâmico e distribui os vértices
        const angle = startAngle + i * ((2 * Math.PI) / n);
        const id = `atom_${timestamp}_ring_${i}`;
        ringAtomIds.push(id);

        newAtoms[id] = {
          id,
          element: "C",
          charge: 0,
          gridPosition: { q: 0, r: 0 },
          x: Cx + radius * Math.cos(angle),
          y: Cy + radius * Math.sin(angle),
        };
      }

      for (let i = 0; i < n; i++) {
        const sourceId = ringAtomIds[i];
        const targetId = ringAtomIds[(i + 1) % n];
        let order = 1;
        if (ringType === "RING_BENZENE" && i % 2 === 0) order = 2;

        newBonds.push({
          id: `bond_${timestamp}_ring_${i}`,
          sourceId,
          targetId,
          order: order as BondOrder,
          stereo: StereoType.NONE,
        });
      }

      const validation = isChemistryValid(newAtoms, newBonds);
      if (!validation.valid) {
        alert(
          `Violação de Valência: Não é possível ramificar um anel aqui. (${validation.error})`,
        );
        return state;
      }

      return { atoms: newAtoms, bonds: newBonds };
    }),

  addFusedRing: (bondId, ringType, clickX, clickY) =>
    set((state) => {
      const bond = state.bonds.find((b) => b.id === bondId);
      if (!bond) return state;

      const atomA = state.atoms[bond.sourceId];
      const atomB = state.atoms[bond.targetId];
      if (
        !atomA ||
        !atomB ||
        atomA.x === undefined ||
        atomB.x === undefined ||
        atomA.y === undefined ||
        atomB.y === undefined
      )
        return state;

      const n = ringType === "RING_CYCLOPENTANE" ? 5 : 6;
      const dx = atomB.x - atomA.x;
      const dy = atomB.y - atomA.y;
      const L = Math.hypot(dx, dy); // Comprimento real da ligação clicada

      // 1. Ponto Médio da Ligação
      const Mx = atomA.x + dx / 2;
      const My = atomA.y + dy / 2;

      // 2. Vetor Normal (perpendicular à ligação)
      const nx = -dy / L;
      const ny = dx / L;

      // 3. Matemática do Polígono Regular
      const a = L / 2 / Math.tan(Math.PI / n); // Apótema (distância do centro ao meio da aresta)
      const R = L / (2 * Math.sin(Math.PI / n)); // Raio (distância do centro aos vértices)

      // 4. Os Dois Centros Possíveis
      const C1 = { x: Mx + nx * a, y: My + ny * a };
      const C2 = { x: Mx - nx * a, y: My - ny * a };

      // 5. Descobre qual centro está mais "livre" (aponta para fora)
      let minDist1 = Infinity;
      let minDist2 = Infinity;

      const otherAtoms = Object.values(state.atoms).filter(
        (a) => a.id !== atomA.id && a.id !== atomB.id && a.x !== undefined,
      );

      if (otherAtoms.length > 0) {
        // Mede a distância para o resto da molécula
        for (const a of otherAtoms) {
          const d1 = Math.hypot(a.x! - C1.x, a.y! - C1.y);
          const d2 = Math.hypot(a.x! - C2.x, a.y! - C2.y);
          if (d1 < minDist1) minDist1 = d1;
          if (d2 < minDist2) minDist2 = d2;
        }
      } else {
        // Se for o primeiro anel solto, cresce para o lado onde o utilizador clicou
        minDist1 = -Math.hypot(clickX - C1.x, clickY - C1.y);
        minDist2 = -Math.hypot(clickX - C2.x, clickY - C2.y);
      }

      // Escolhe o centro que está mais longe do resto da molécula (ou mais perto do clique)
      const C = minDist1 > minDist2 ? C1 : C2;

      // 6. Gera os vértices em torno do centro escolhido
      const newAtoms = { ...state.atoms };
      const newBonds = [...state.bonds];
      const ringAtomIds: string[] = [];
      const timestamp = Date.now();

      // O ângulo do centro para o ponto médio da ligação base
      const baseAngle = Math.atan2(My - C.y, Mx - C.x);

      for (let i = 0; i < n; i++) {
        // A matemática garante que i=0 e i=1 vão bater exatamente em cima do atomA e atomB
        const angle = baseAngle - Math.PI / n + i * ((2 * Math.PI) / n);
        let px = C.x + R * Math.cos(angle);
        let py = C.y + R * Math.sin(angle);

        let snappedId = null;

        // Verifica estritamente A e B primeiro para evitar erros de floating point
        if (Math.hypot(px - atomA.x, py - atomA.y) < 10) {
          snappedId = atomA.id;
        } else if (Math.hypot(px - atomB.x, py - atomB.y) < 10) {
          snappedId = atomB.id;
        } else {
          // Verifica outros átomos para fundir múltiplos anéis ao mesmo tempo (ex: Coroneno)
          for (const existingAtom of Object.values(newAtoms)) {
            if (existingAtom.x !== undefined && existingAtom.y !== undefined) {
              if (Math.hypot(existingAtom.x - px, existingAtom.y - py) < 15) {
                snappedId = existingAtom.id;
                break;
              }
            }
          }
        }

        if (snappedId) {
          ringAtomIds.push(snappedId);
        } else {
          const newId = `atom_${timestamp}_fused_${i}`;
          newAtoms[newId] = {
            id: newId,
            element: "C",
            charge: 0,
            gridPosition: { q: 0, r: 0 },
            x: px,
            y: py,
          };
          ringAtomIds.push(newId);
        }
      }

      // 7. Liga os vértices
      for (let i = 0; i < n; i++) {
        const id1 = ringAtomIds[i];
        const id2 = ringAtomIds[(i + 1) % n];

        // Ignora a ligação base que partilhamos
        if (
          (id1 === atomA.id && id2 === atomB.id) ||
          (id1 === atomB.id && id2 === atomA.id)
        ) {
          continue;
        }

        const bondExists = newBonds.some(
          (b) =>
            (b.sourceId === id1 && b.targetId === id2) ||
            (b.sourceId === id2 && b.targetId === id1),
        );

        if (!bondExists) {
          let order = 1;
          // Alterna ligações duplas no Benzeno
          if (ringType === "RING_BENZENE") {
            order = i % 2 === 0 ? 2 : 1;
          }

          newBonds.push({
            id: `bond_${timestamp}_fused_${i}`,
            sourceId: id1,
            targetId: id2,
            order: order as BondOrder,
            stereo: StereoType.NONE,
          });
        }
      }

      const validation = isChemistryValid(newAtoms, newBonds);
      if (!validation.valid) {
        alert(
          `Violação de Valência: Fusão química impossível neste local. (${validation.error})`,
        );
        return state;
      }

      return { atoms: newAtoms, bonds: newBonds };
    }),

  exportCurrentMolecule: (format = "smiles") => {
    const state = get(); // Pega o estado atual sem precisar de set()
    const { atoms, bonds, mode } = state;

    // 1. Filtra os átomos baseado na aba em que o utilizador está
    const filteredAtoms: Record<string, Atom> = {};
    for (const key in atoms) {
      if (mode === "ORGANIC" && atoms[key].x !== undefined) {
        filteredAtoms[key] = atoms[key];
      } else if (mode === "INORGANIC" && atoms[key].x === undefined) {
        filteredAtoms[key] = atoms[key];
      }
    }

    // 2. Filtra as ligações correspondentes
    const filteredBonds = bonds.filter(
      (b) => filteredAtoms[b.sourceId] && filteredAtoms[b.targetId],
    );

    if (Object.keys(filteredAtoms).length === 0) {
      alert("A tela está vazia!");
      return null;
    }

    // 3. Chama o motor de exportação
    return exportMolecule(filteredAtoms, filteredBonds, format);
  },

  loadMoleculeFromSmiles: (smiles, targetMode = "ORGANIC") => {
    const importedData = importMoleculeFromSmiles(smiles);

    if (importedData) {
      const finalAtoms = { ...importedData.atoms };

      // Se for inorgânico, removemos as coordenadas float para que o
      // InorganicCanvas reconheça que deve usar a grade (q, r)
      if (targetMode === "INORGANIC") {
        for (const key in finalAtoms) {
          finalAtoms[key].x = undefined; // Forçamos undefined em vez de usar `delete`
          finalAtoms[key].y = undefined;
        }
      }

      set({
        atoms: finalAtoms,
        bonds: importedData.bonds,
        mode: targetMode, // Setta o estado para INORGANIC (grade) ou ORGANIC
        selectedAtomId: null,
        activePaletteElement: null,
      });
    } else {
      console.warn(
        "Não foi possível renderizar a molécula a partir do SMILES fornecido.",
      );
    }
  },

  clear: () =>
    set({
      atoms: {},
      bonds: [],
      selectedAtomId: null,
      activePaletteElement: null,
      dragPositions: {},
    }),

  loadMoleculeFromState: (rawState) => {
    set({
      atoms: rawState.atoms || {},
      bonds: rawState.bonds || [],
      mode: rawState.mode || "ORGANIC",
      selectedAtomId: null,
      activePaletteElement: null,
      dragPositions: {}, // Limpa os arrastos
    });
  },
}));
