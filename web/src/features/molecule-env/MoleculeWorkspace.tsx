import { useEffect, useState } from "react";
import { MoleculeCanvas } from "./canvas/MoleculeCanvas";
import { OrganicCanvas } from "./canvas/OrganicCanvas";
import { useMoleculeStore } from "./store/useMoleculeStore";
import { ElementPalette } from "./components/ElementPalette";
import { initRDKit } from "./engine/rdkit";

export function MoleculeWorkspace() {
  const mode = useMoleculeStore((state) => state.mode);
  const setMode = useMoleculeStore((state) => state.setMode);
  const exportCurrentMolecule = useMoleculeStore(
    (state) => state.exportCurrentMolecule,
  );

  const [isEngineReady, setIsEngineReady] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);

  useEffect(() => {
    const startEngine = async () => {
      try {
        await initRDKit();
        setIsEngineReady(true);
      } catch (error) {
        console.error("Falha ao arrancar o motor:", error);
        setEngineError("Não foi possível carregar o motor de química.");
      }
    };

    startEngine();
  }, []);

  // Ecrã de erro caso o WASM falhe a carregar
  if (engineError) {
    return (
      <div className="w-screen h-screen bg-background flex justify-center items-center text-destructive">
        <h2 className="text-xl font-bold">{engineError}</h2>
      </div>
    );
  }

  // Ecrã de Loading enquanto o WASM não estiver pronto
  if (!isEngineReady) {
    return (
      <div className="w-screen h-screen bg-background flex flex-col justify-center items-center text-foreground">
        <h2 className="text-2xl font-bold mb-2">
          Inicializando Motor Autocore...
        </h2>
        <p className="text-muted">Carregando módulos de química estrutural</p>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-background relative">
      <ElementPalette />

      {/* Cabeçalho com Título e Chave de Seleção */}
      <div className="absolute top-5 left-[240px] z-10 flex items-center gap-8">
        <h1 className="text-foreground text-2xl font-bold m-0">Autocore</h1>

        {/* O Toggle Switch */}
        <div className="flex bg-surface rounded-full p-1 shadow-inner border border-border">
          <button
            onClick={() => setMode("INORGANIC")}
            className={`px-4 py-2 rounded-full border-none cursor-pointer font-bold text-sm transition-all duration-300 ${
              mode === "INORGANIC"
                ? "bg-primary text-primary-foreground shadow"
                : "bg-transparent text-muted hover:text-foreground"
            }`}
          >
            Inorgânica (Grade)
          </button>
          <button
            onClick={() => setMode("ORGANIC")}
            className={`px-4 py-2 rounded-full border-none cursor-pointer font-bold text-sm transition-all duration-300 ${
              mode === "ORGANIC"
                ? "bg-primary text-primary-foreground shadow"
                : "bg-transparent text-muted hover:text-foreground"
            }`}
          >
            Orgânica (Esqueleto)
          </button>
        </div>
      </div>

      {/* Renderização Condicional do Canvas */}
      {mode === "INORGANIC" ? <MoleculeCanvas /> : <OrganicCanvas />}

      {/* Botão de Ação usando os padrões do Autocore */}
      <button
        onClick={() => {
          const smiles = exportCurrentMolecule("smiles");
          if (smiles) {
            alert(
              `✅ Molécula exportada com sucesso!\n\nSMILES: ${smiles}\n\nEste texto seria enviado para o NestJS corrigir.`,
            );
            console.log("SMILES Gerado:", smiles);
          }
        }}
        className="absolute top-5 right-5 z-10 bg-primary text-primary-foreground hover:opacity-90 px-5 py-2.5 rounded-md font-bold shadow-lg transition-all"
      >
        Corrigir Exercício
      </button>
    </div>
  );
}
