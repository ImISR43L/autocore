import { useEffect, useState } from "react";
import { MoleculeCanvas } from "./canvas/MoleculeCanvas";
import { OrganicCanvas } from "./canvas/OrganicCanvas";
import { useMoleculeStore } from "./store/useMoleculeStore";
import { ElementPalette } from "./components/ElementPalette";
import { initRDKit } from "./engine/rdkit";

interface MoleculeWorkspaceProps {
  initialSmiles?: string;
  initialMode?: "ORGANIC" | "INORGANIC";
  initialRawState?: any;
}

export function MoleculeWorkspace({
  initialSmiles,
  initialMode,
  initialRawState,
}: MoleculeWorkspaceProps) {
  const mode = useMoleculeStore((state) => state.mode);
  const setMode = useMoleculeStore((state) => state.setMode);
  const loadMoleculeFromSmiles = useMoleculeStore(
    (state) => state.loadMoleculeFromSmiles,
  );
  const loadMoleculeFromState = useMoleculeStore(
    (state) => state.loadMoleculeFromState,
  );
  const clear = useMoleculeStore((state) => state.clear);

  const [isEngineReady, setIsEngineReady] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [loadedSmiles, setLoadedSmiles] = useState<string | null>(null);
  const [loadedRawState, setLoadedRawState] = useState<any>(null);

  // 1. Inicializa o Motor (ESTE É O EFFECT QUE TINHA SIDO APAGADO)
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

  // 2. Lida com os dados do banco / atualização
  useEffect(() => {
    if (!isEngineReady) return;

    // Se temos um estado de JSON bruto salvo no banco (Coordenadas perfeitas do professor)
    if (initialRawState && loadedRawState !== initialRawState) {
      loadMoleculeFromState(initialRawState);
      setLoadedRawState(initialRawState);
      setLoadedSmiles(initialSmiles || ""); // Sincroniza
    }
    // Fallback para exercícios antigos que só tinham SMILES
    else if (
      !initialRawState &&
      initialSmiles &&
      loadedSmiles !== initialSmiles
    ) {
      loadMoleculeFromSmiles(initialSmiles, initialMode);
      setLoadedSmiles(initialSmiles);
    }
    // Tela limpa
    else if (
      !initialSmiles &&
      !initialRawState &&
      loadedSmiles === null &&
      loadedRawState === null
    ) {
      clear();
      if (initialMode) setMode(initialMode);
      setLoadedSmiles("");
      setLoadedRawState("");
    }
  }, [
    isEngineReady,
    initialSmiles,
    initialMode,
    initialRawState,
    loadedSmiles,
    loadedRawState,
    loadMoleculeFromSmiles,
    loadMoleculeFromState,
    setMode,
    clear,
  ]);

  if (engineError) {
    return (
      <div className="w-full h-full bg-background flex justify-center items-center text-destructive">
        <h2 className="text-xl font-bold">{engineError}</h2>
      </div>
    );
  }

  if (!isEngineReady) {
    return (
      <div className="w-full h-full bg-background flex flex-col justify-center items-center text-foreground">
        <h2 className="text-xl font-bold mb-2">Inicializando RDKit...</h2>
        <p className="text-muted text-sm">
          Carregando módulos de química estrutural
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-hidden bg-background relative flex">
      <div className="relative z-10 w-[220px] flex-shrink-0 h-full">
        <ElementPalette />
      </div>

      <div className="flex-1 relative h-full">
        <div className="absolute top-4 left-6 z-10">
          <div className="flex bg-surface rounded-full p-1 shadow-md border border-border">
            <button
              type="button"
              onClick={() => setMode("INORGANIC")}
              className={`px-4 py-1.5 rounded-full border-none cursor-pointer font-bold text-xs transition-all duration-300 ${
                mode === "INORGANIC"
                  ? "bg-primary text-primary-foreground shadow"
                  : "bg-transparent text-muted hover:text-foreground"
              }`}
            >
              Grade (Inorgânica)
            </button>
            <button
              type="button"
              onClick={() => setMode("ORGANIC")}
              className={`px-4 py-1.5 rounded-full border-none cursor-pointer font-bold text-xs transition-all duration-300 ${
                mode === "ORGANIC"
                  ? "bg-primary text-primary-foreground shadow"
                  : "bg-transparent text-muted hover:text-foreground"
              }`}
            >
              Esqueleto (Orgânica)
            </button>
          </div>
        </div>

        <div className="absolute inset-0">
          {mode === "INORGANIC" ? <MoleculeCanvas /> : <OrganicCanvas />}
        </div>
      </div>
    </div>
  );
}
