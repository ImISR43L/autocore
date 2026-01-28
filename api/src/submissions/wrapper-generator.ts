import { Logger } from '@nestjs/common';
import { Problem } from '../problems/entities/problem.entity';

export class WrapperGenerator {
  private static readonly logger = new Logger(WrapperGenerator.name);

  // Regex de segurança
  private static readonly UNSAFE_CHARS_REGEX =
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u3164]/g;

  // Configuração de Extensão e Nome Padrão
  private static readonly LANGUAGE_CONFIG: Record<
    number,
    { ext: string; standardName: string }
  > = {
    71: { ext: '.py', standardName: 'main.py' }, // Python
    63: { ext: '.js', standardName: 'index.js' }, // Node.js
    54: { ext: '.cpp', standardName: 'main.cpp' }, // C++
  };

  static apply(files: any[], problem: Problem, languageId: number): any[] {
    this.logger.log(`[log] Iniciando Wrapper para LangID: ${languageId}`);
    this.logger.log(
      `[log] Arquivos recebidos: ${files.map((f) => f.name).join(', ')}`,
    );

    // 1. Sanitização
    const sanitizedFiles = files.map((file) => ({
      ...file,
      content: this.sanitize(file.content || ''),
    }));

    // 2. Identificação do Entry File
    const entryFileIndex = this.findEntryFileIndex(sanitizedFiles, languageId);

    if (entryFileIndex === -1) {
      this.logger.warn(
        `[WRAPPER-FAIL] Nenhum arquivo de entrada compatível encontrado para LangID ${languageId}`,
      );
      return sanitizedFiles;
    }

    const entryFile = sanitizedFiles[entryFileIndex];
    this.logger.log(
      `[log] Arquivo de entrada identificado: ${entryFile.name} (Original)`,
    );

    let wrapperCode = '';

    // 3. Renomeação e Injeção
    const config = this.LANGUAGE_CONFIG[languageId];
    if (config) {
      this.logger.log(
        `[log] Renomeando ${entryFile.name} para ${config.standardName}`,
      );
      entryFile.name = config.standardName;
    }

    switch (languageId) {
      case 71: // Python
        wrapperCode = this.generatePythonWrapper(problem);
        entryFile.content = `${entryFile.content}\n\n${wrapperCode}`;
        break;

      case 63: // JavaScript
        wrapperCode = this.generateJsWrapper(problem);
        entryFile.content = `${entryFile.content}\n\n${wrapperCode}`;
        break;

      case 54: // C++
        if (!entryFile.content.includes('int main')) {
          wrapperCode = this.generateCppWrapper(problem);
          entryFile.content = `${entryFile.content}\n\n${wrapperCode}`;
        } else {
          this.logger.warn(
            `[WRAPPER-SKIP] 'int main' detectado no código do aluno. Wrapper C++ ignorado.`,
          );
        }
        break;

      default:
        this.logger.warn(
          `[WRAPPER-FAIL] Sem gerador para LangID ${languageId}`,
        );
    }

    if (wrapperCode) {
      this.logger.log(`[log] Wrapper injetado com sucesso.`);
      this.logger.log(`[log] Tamanho do Wrapper: ${wrapperCode.length} chars`);
      this.logger.log(
        `[log] Final do arquivo:\n${entryFile.content.slice(-200)}`,
      );
    }

    sanitizedFiles[entryFileIndex] = entryFile;
    return sanitizedFiles;
  }

  private static sanitize(content: string): string {
    return content.replace(this.UNSAFE_CHARS_REGEX, '');
  }

  private static findEntryFileIndex(files: any[], langId: number): number {
    const config = this.LANGUAGE_CONFIG[langId];
    if (!config) return -1;
    // Busca flexível pela extensão
    return files.findIndex((f) => f.name.endsWith(config.ext));
  }

  private static generatePythonWrapper(problem: Problem): string {
    const params = problem.parameters || [];
    const argsParsing = params.map((p, index) => {
      if (p.type === 'int') return `int(parts[${index}])`;
      if (p.type === 'float') return `float(parts[${index}])`;
      if (p.type === 'boolean') return `parts[${index}].lower() == "true"`;
      return `parts[${index}]`;
    });

    return `
import sys

# --- Wrapper Injetado pelo Autocore ---
if __name__ == '__main__':
    try:
        input_data = sys.stdin.read().strip()
        if input_data:
            parts = input_data.replace(',', ' ').split()
            if len(parts) >= ${params.length}:
                result = solve(${argsParsing.join(', ')})
                print(result)
            else:
                print(f"Erro: Esperado ${params.length} argumentos, recebido {len(parts)}", file=sys.stderr)
                sys.exit(1) # <--- ADICIONE ISTO
        else:
             print("Aviso: Nenhuma entrada recebida no stdin", file=sys.stderr)
             # Opcional: sys.exit(1) aqui também se entrada for obrigatória
    except Exception as e:
        print(f"Erro de Execução no Wrapper: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1) # <--- ADICIONE ISTO (CRUCIAL)
`;
  }

  private static generateJsWrapper(problem: Problem): string {
    const params = problem.parameters || [];
    const argsParsing = params.map((p, index) => {
      if (p.type === 'int') return `parseInt(parts[${index}])`;
      if (p.type === 'float') return `parseFloat(parts[${index}])`;
      if (p.type === 'boolean')
        return `(parts[${index}].toLowerCase() === "true")`;
      return `parts[${index}]`;
    });

    // ALTERAÇÃO: Uso de 'import' e 'readFileSync' (ESM) em vez de 'require'
    return `
// --- Wrapper Injetado pelo Autocore ---
import { readFileSync } from 'fs';

try {
    const input = readFileSync(0, 'utf8').trim();
    if (input) {
        const parts = input.replace(/,/g, ' ').split(/\\s+/);
        if (parts.length >= ${params.length}) {
            const result = solve(${argsParsing.join(', ')});
            console.log(result);
        }
    }
} catch (e) {
    console.error("Erro de Execução:", e);
}
`;
  }

  private static generateCppWrapper(problem: Problem): string {
    const params = problem.parameters || [];

    const decls = params
      .map((p, i) => {
        const typeMap: Record<string, string> = {
          int: 'int',
          float: 'float',
          string: 'string',
          boolean: 'bool',
        };
        return `${typeMap[p.type] || 'string'} p${i};`;
      })
      .join('\n    ');

    const reads = params.map((_, i) => `cin >> p${i};`).join('\n    ');
    const callArgs = params.map((_, i) => `p${i}`).join(', ');

    return `
#include <iostream>
#include <string>
#include <vector>
#include <sstream>

using namespace std;

// --- Wrapper Injetado pelo Autocore ---
int main() {
    ${decls}
    if (${reads}) {
        cout << solve(${callArgs}) << endl;
    }
    return 0;
}
`;
  }
}
