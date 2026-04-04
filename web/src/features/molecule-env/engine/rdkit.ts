// src/engine/rdkit.ts

declare global {
  interface Window {
    initRDKitModule: () => Promise<any>;
  }
}

let rdkitInstance: any = null;

export const initRDKit = async () => {
  if (rdkitInstance) return rdkitInstance;

  // Verificamos se o script do index.html já carregou a função no window
  if (!window.initRDKitModule) {
    throw new Error("O script RDKit_minimal.js não foi encontrado no window.");
  }

  try {
    // Inicializa o módulo apontando para o arquivo .wasm na pasta public
    const instance = await window.initRDKitModule();
    rdkitInstance = instance;
    console.log("⚛️ RDKit.js inicializado com sucesso!");
    return rdkitInstance;
  } catch (err) {
    console.error("Erro ao inicializar o RDKit.js:", err);
    throw err;
  }
};

export const getRDKit = () => {
  if (!rdkitInstance) {
    throw new Error("RDKit não inicializado.");
  }
  return rdkitInstance;
};
