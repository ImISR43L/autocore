export interface LanguageConfig {
  /** Identificador textual usado em `problem.allowedLanguages` (ex: definido pelo professor). */
  slug: string;
  fileName: string;
  /** Comando de execução. Para linguagens compiladas, roda o binário já compilado. */
  runCommand: string[];
  /**
   * Comando de compilação, executado uma única vez antes do loop de test
   * cases (ver FIX (b) no submissions.processor.ts). Ausente em linguagens
   * interpretadas.
   */
  compileCommand?: string[];
  /** Nome do binário gerado pela compilação, usado para copiar entre steps do sandbox. */
  compiledBinaryName?: string;
}

/**
 * FIX (a): antes existiam DOIS mapas de linguagem divergentes — um em
 * submissions.service.ts (usado para validar `problem.allowedLanguages`,
 * conhecia apenas Python/JS/C++) e outro em submissions.processor.ts (usado
 * para executar, conhecia também Java/Go/C). Resultado: um aluno podia
 * submeter Java/Go/C sem passar pela checagem de linguagem permitida da
 * questão, porque o mapa de validação simplesmente não sabia que esses IDs
 * existiam.
 *
 * Agora existe uma única fonte de verdade, importada nos dois lugares.
 */
export const LANGUAGE_CONFIG: Record<number, LanguageConfig> = {
  71: {
    slug: 'python',
    fileName: 'main.py',
    runCommand: ['python3', '-u', 'main.py'],
  },
  63: {
    slug: 'javascript',
    fileName: 'index.js',
    runCommand: ['node', 'index.js'],
  },
  62: {
    slug: 'java',
    fileName: 'Main.java',
    runCommand: ['java', 'Main.java'],
  },
  60: {
    slug: 'go',
    fileName: 'main.go',
    runCommand: ['go', 'run', 'main.go'],
  },
  95: {
    slug: 'go',
    fileName: 'main.go',
    runCommand: ['go', 'run', 'main.go'],
  },
  50: {
    slug: 'c',
    fileName: 'main.c',
    compileCommand: ['gcc', 'main.c', '-o', 'main'],
    compiledBinaryName: 'main',
    runCommand: ['./main'],
  },
  48: {
    slug: 'c',
    fileName: 'main.c',
    compileCommand: ['gcc', 'main.c', '-o', 'main'],
    compiledBinaryName: 'main',
    runCommand: ['./main'],
  },
  54: {
    slug: 'cpp',
    fileName: 'main.cpp',
    compileCommand: ['g++', 'main.cpp', '-o', 'main'],
    compiledBinaryName: 'main',
    runCommand: ['./main'],
  },
};
