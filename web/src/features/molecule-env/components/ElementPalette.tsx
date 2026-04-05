// src/components/ElementPalette.tsx
import React, { useState } from "react";
import { useMoleculeStore } from "../store/useMoleculeStore";
import { ELEMENT_DATA, ELEMENT_NAMES } from "../utils/elements";

export const ElementPalette: React.FC = () => {
  const mode = useMoleculeStore((state) => state.mode);
  const activeElement = useMoleculeStore((state) => state.activePaletteElement);
  const setActiveElement = useMoleculeStore((state) => state.setActiveElement);
  const isGridVisible = useMoleculeStore((state) => state.isGridVisible);
  const toggleGrid = useMoleculeStore((state) => state.toggleGrid);

  const [searchTerm, setSearchTerm] = useState("");

  // --- LÓGICA DO MODO INORGÂNICO ---
  const elementSymbols = Object.keys(ELEMENT_DATA).filter(
    (el) => el !== "DEFAULT",
  );
  const filteredSymbols = elementSymbols.filter((symbol) => {
    const search = searchTerm.toLowerCase();
    const name = (ELEMENT_NAMES[symbol] || "").toLowerCase();
    return symbol.toLowerCase().includes(search) || name.includes(search);
  });

  // --- LÓGICA DO MODO ORGÂNICO ---
  const organicHeteroatoms = ["C", "O", "N", "S", "P", "F", "Cl", "Br", "I"];
  const organicBonds = [
    { id: "BOND_SINGLE", icon: "╱", title: "Ligação Simples" },
    { id: "BOND_DOUBLE", icon: "═", title: "Ligação Dupla" },
    { id: "BOND_TRIPLE", icon: "≡", title: "Ligação Tripla" },
    { id: "BOND_WEDGE", icon: "◤", title: "Cunha (Frente)" },
    { id: "BOND_DASH", icon: "▤", title: "Traço (Trás)" },
  ];
  const organicRings = [
    { id: "RING_BENZENE", icon: "⬡", title: "Benzeno" },
    { id: "RING_CYCLOHEXANE", icon: "⬡", title: "Ciclohexano" },
    { id: "RING_CYCLOPENTANE", icon: "⬠", title: "Ciclopentano" },
  ];

  // Helper para desenhar botões genéricos com Tailwind
  const renderToolButton = (
    id: string,
    icon: string,
    title: string,
    isDestructive: boolean = false,
    fontSize: string = "text-xl",
  ) => {
    const isSelected = activeElement === id;
    const activeBg = isDestructive
      ? "bg-destructive text-destructive-foreground shadow-md shadow-destructive/20"
      : "bg-primary text-primary-foreground shadow-md shadow-primary/20";

    return (
      <button
        key={id}
        type="button"
        onClick={() => setActiveElement(id)}
        title={title}
        className={`w-[50px] h-[50px] rounded-lg flex-shrink-0 flex justify-center items-center font-bold transition-all duration-200 ${fontSize} ${
          isSelected
            ? `${activeBg} border-transparent`
            : "bg-background border border-border text-muted-foreground hover:text-foreground hover:border-muted"
        }`}
      >
        {icon}
      </button>
    );
  };

  // Helper para desenhar botões de átomos (Fundo fixo da Química, Borda dinâmica do Autocore)
  const renderAtomButton = (symbol: string) => {
    const isSelected = activeElement === symbol;
    const visual = ELEMENT_DATA[symbol] || ELEMENT_DATA["DEFAULT"];
    const fullName = ELEMENT_NAMES[symbol] || symbol;

    return (
      <button
        type="button"
        key={symbol}
        onClick={() => setActiveElement(symbol)}
        title={`${fullName} (${symbol})`}
        className={`w-[45px] h-[45px] rounded-full flex justify-center items-center font-bold cursor-pointer transition-all duration-200 ${
          symbol.length > 1 ? "text-sm" : "text-lg"
        }`}
        style={{
          backgroundColor: visual.color,
          color: visual.textColor,
          border: isSelected
            ? "3px solid rgb(var(--primary))"
            : "2px solid rgb(var(--background))",
          boxShadow: isSelected
            ? "0 0 12px color-mix(in srgb, rgb(var(--primary)) 60%, transparent)"
            : "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        {symbol}
      </button>
    );
  };

  return (
    <div className="absolute left-0 top-0 w-[220px] h-full bg-surface flex flex-col items-center py-5 px-2.5 border-r border-border z-[100] overflow-y-auto overflow-x-hidden shadow-xl">
      <h3 className="text-muted font-bold text-[11px] tracking-wider uppercase mb-3 w-full text-center">
        Ações
      </h3>
      {/* Adicionado o justify-items-center aqui em baixo 👇 */}
      <div className="grid grid-cols-2 gap-2.5 mb-5 w-full px-1 justify-items-center">
        {renderToolButton("CHARGE_PLUS", "+", "Carga Positiva")}
        {renderToolButton("CHARGE_MINUS", "-", "Carga Negativa")}
        {renderToolButton("ERASER", "🗑️", "Borracha", true)}

        <button
          onClick={toggleGrid}
          disabled={mode === "ORGANIC"}
          title={
            mode === "ORGANIC"
              ? "Grade desativada no modo orgânico"
              : isGridVisible
                ? "Ocultar Grade"
                : "Mostrar Grade"
          }
          /* 👇 Mudamos de w-full para w-[50px] para ficar quadrado como os outros */
          className={`w-[50px] h-[50px] rounded-lg border flex justify-center items-center text-xl transition-all duration-200 ${
            mode === "ORGANIC"
              ? "bg-surface-hover border-transparent text-muted cursor-not-allowed opacity-50"
              : isGridVisible
                ? "bg-primary border-transparent text-primary-foreground shadow-md shadow-primary/20"
                : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-muted cursor-pointer"
          }`}
        >
          {isGridVisible ? "👁️" : "🙈"}
        </button>
      </div>

      <hr className="w-4/5 border-t border-border my-2" />

      {/* RENDERIZAÇÃO CONDICIONAL BASEADA NO MODO */}
      {mode === "INORGANIC" ? (
        <>
          <h3 className="text-muted font-bold text-[11px] tracking-wider uppercase mb-3 mt-3 w-full text-center">
            Elementos
          </h3>
          <input
            type="text"
            placeholder="Buscar átomo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-[90%] p-2 mb-5 rounded-md border border-border outline-none bg-background text-foreground text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted"
          />
          <div className="grid grid-cols-3 gap-3 w-full justify-items-center">
            {filteredSymbols.map(renderAtomButton)}
            {filteredSymbols.length === 0 && (
              <span className="col-span-3 text-muted text-xs mt-2">
                Nenhum encontrado.
              </span>
            )}
          </div>
        </>
      ) : (
        <>
          <h3 className="text-muted font-bold text-[11px] tracking-wider uppercase mb-3 mt-3 w-full text-center">
            Ligações
          </h3>
          <div className="grid grid-cols-3 gap-2.5 mb-5 w-full px-1">
            {organicBonds.map((b) =>
              renderToolButton(b.id, b.icon, b.title, false, "text-2xl"),
            )}
          </div>

          <h3 className="text-muted font-bold text-[11px] tracking-wider uppercase mb-3 w-full text-center">
            Anéis
          </h3>
          <div className="grid grid-cols-3 gap-2.5 mb-5 w-full px-1">
            {organicRings.map((r) =>
              renderToolButton(r.id, r.icon, r.title, false, "text-[28px]"),
            )}
          </div>

          <h3 className="text-muted font-bold text-[11px] tracking-wider uppercase mb-3 w-full text-center">
            Heteroátomos
          </h3>
          <div className="grid grid-cols-3 gap-3 w-full justify-items-center mb-5">
            {organicHeteroatoms.map(renderAtomButton)}
          </div>
        </>
      )}
    </div>
  );
};
