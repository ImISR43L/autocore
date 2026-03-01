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
    this.logger.log(`[log] Arquivos: ${files.map((f) => f.name).join(', ')}`);

    const sanitizedFiles = files.map((file) => ({
      ...file,
      content: this.sanitize(file.content || ''),
    }));

    const entryFileIndex = this.findEntryFileIndex(sanitizedFiles, languageId);

    if (entryFileIndex === -1) {
      this.logger.warn(`[WRAPPER-FAIL] Arquivo de entrada não encontrado.`);
      return sanitizedFiles;
    }

    const entryFile = sanitizedFiles[entryFileIndex];
    let wrapperCode = '';

    const config = this.LANGUAGE_CONFIG[languageId];
    if (config) entryFile.name = config.standardName;

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
          this.logger.warn(`[WRAPPER-SKIP] 'int main' detectado.`);
        }
        break;

      default:
        this.logger.warn(
          `[WRAPPER-FAIL] Sem gerador para LangID ${languageId}`,
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

    let index = files.findIndex((f) => f.name === config.standardName);

    if (index === -1) {
      index = files.findIndex((f) => f.name.endsWith(config.ext));
    }

    return index;
  }

  private static generatePythonWrapper(problem: Problem): string {
    const params = problem.parameters || [];
    const typesArray = params.map((p) => `"${p.type}"`).join(', ');

    return `
import sys
import re
import json
import ast

# --- Wrapper Injetado pelo Autocore (NORMALIZAÇÃO ESTRITA) ---
def parse_arg(raw, arg_type):
    if raw is None: return raw
    raw = str(raw).strip()
    
    if raw.startswith('"') and raw.endswith('"'): raw = raw[1:-1]
    elif raw.startswith("'") and raw.endswith("'"): raw = raw[1:-1]
    
    if arg_type == 'int': return int(raw)
    if arg_type == 'float': return float(raw)
    if arg_type == 'boolean': return raw.lower() == 'true'
    if arg_type == 'string': return raw
    
    if arg_type.endswith('[]'):
        try:
            return ast.literal_eval(raw)
        except (ValueError, SyntaxError):
            return []
        
    return raw

if __name__ == '__main__':
    try:
        input_data = sys.stdin.read().strip()
        if input_data:
            types = [${typesArray}]
            
            parts = [line.strip() for line in input_data.split('\\n') if line.strip()]
            
            if len(parts) < len(types):
                parts = re.findall(r'\\[.*?\\]|".*?"|\\'.*?\\'|\\S+', input_data)
                
            if len(parts) >= len(types):
                args = [parse_arg(parts[i], types[i]) for i in range(len(types))]
                
                result = solve(*args)
                
                if isinstance(result, list):
                    print(json.dumps(result))
                elif isinstance(result, bool):
                    print(str(result).lower())
                else:
                    print(result)
            else:
                print(f"Erro: Esperado {len(types)} argumentos, recebido {len(parts)}", file=sys.stderr)
                sys.exit(1)
        else:
             print("Aviso: Nenhuma entrada recebida no stdin", file=sys.stderr)
    except Exception as e:
        print(f"Erro de Execução no Wrapper: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
`;
  }

  private static generateJsWrapper(problem: Problem): string {
    const params = problem.parameters || [];
    const typesArray = JSON.stringify(params.map((p) => p.type));

    return `
// --- Wrapper Injetado pelo Autocore (NORMALIZAÇÃO ESTRITA) ---
import { readFileSync } from 'fs';

function parseArg(raw, type) {
    if (raw === undefined || raw === null) return raw;
    if (typeof raw !== 'string') return raw;
    
    raw = raw.trim();
    
    if (raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1);
    else if (raw.startsWith("'") && raw.endsWith("'")) raw = raw.slice(1, -1);

    if (type === 'int') return parseInt(raw, 10);
    if (type === 'float') return parseFloat(raw);
    if (type === 'boolean') return raw.toLowerCase() === 'true';
    if (type === 'string') return raw;
    
    if (type.endsWith('[]')) {
        try {
            if (!raw.includes('"') && type === 'string[]') {
                 raw = raw.replace(/'/g, '"');
            }
            return JSON.parse(raw);
        } catch(e) {
            return [];
        }
    }
    return raw;
}

try {
    const input = readFileSync(0, 'utf8').trim();
    if (input) {
        const types = ${typesArray};
        
        let parts = input.split(/\\r?\\n/).filter(line => line.trim() !== '');
        
        if (parts.length < types.length) {
            parts = input.match(/\\[.*?\\]|".*?"|'.*?'|\\S+/g) || [];
        }
        
        if (parts.length >= types.length) {
            const args = types.map((type, i) => parseArg(parts[i], type));
            
            const result = solve(...args);
            
            if (Array.isArray(result)) {
                console.log(JSON.stringify(result));
            } else {
                console.log(result);
            }
        } else {
            console.error(\`Erro: Esperado \${types.length} argumentos, recebido \${parts.length}\`);
            process.exit(1);
        }
    }
} catch (e) {
    console.error("Erro de Execução no Wrapper:", e);
    process.exit(1);
}
`;
  }

  private static generateCppWrapper(problem: Problem): string {
    const params = problem.parameters || [];

    const hasIntArray = params.some((p) => p.type === 'int[]');
    const hasFloatArray = params.some((p) => p.type === 'float[]');
    const hasStringArray = params.some((p) => p.type === 'string[]');
    const hasBooleanArray = params.some((p) => p.type === 'boolean[]');

    let helpers = `
// Helpers de Parsing e Limpeza
string trim_quotes(string s) {
    if(!s.empty() && (s.front() == '"' || s.front() == '\\'')) s.erase(0, 1);
    if(!s.empty() && (s.back() == '"' || s.back() == '\\'')) s.pop_back();
    return s;
}

string trim_brackets(string s) {
    if(!s.empty() && s.front() == '[') s.erase(0, 1);
    if(!s.empty() && s.back() == ']') s.pop_back();
    return s;
}

template<typename T> void print_result(const T& t) { cout << t << endl; }
template<typename T> void print_result(const vector<T>& v) {
    cout << "[";
    for (size_t i = 0; i < v.size(); ++i) { cout << v[i] << (i + 1 == v.size() ? "" : ", "); }
    cout << "]" << endl;
}
`;
    if (hasIntArray) {
      helpers += `
vector<int> parse_int_array(string raw) {
    vector<int> res;
    raw = trim_brackets(raw);
    if (raw.empty()) return res; // Impede loops em []
    stringstream ss(raw);
    string item;
    while(getline(ss, item, ',')) {
        while(!item.empty() && item.front() == ' ') item.erase(0, 1);
        if(!item.empty()) res.push_back(stoi(item));
    }
    return res;
}\n`;
    }
    if (hasFloatArray) {
      helpers += `
vector<double> parse_double_array(string raw) {
    vector<double> res;
    raw = trim_brackets(raw);
    if (raw.empty()) return res;
    stringstream ss(raw);
    string item;
    while(getline(ss, item, ',')) {
        while(!item.empty() && item.front() == ' ') item.erase(0, 1);
        if(!item.empty()) res.push_back(stod(item));
    }
    return res;
}\n`;
    }
    if (hasStringArray) {
      helpers += `
vector<string> parse_string_array(string raw) {
    vector<string> res;
    raw = trim_brackets(raw);
    if (raw.empty()) return res;
    stringstream ss(raw);
    string item;
    while(getline(ss, item, ',')) {
        while(!item.empty() && item.front() == ' ') item.erase(0, 1);
        if(!item.empty()) res.push_back(trim_quotes(item));
    }
    return res;
}\n`;
    }
    if (hasBooleanArray) {
      // Substituição explícita de vector<bool> por vector<int>
      helpers += `
vector<int> parse_boolean_array(string raw) {
    vector<int> res;
    raw = trim_brackets(raw);
    if (raw.empty()) return res;
    stringstream ss(raw);
    string item;
    while(getline(ss, item, ',')) {
        while(!item.empty() && item.front() == ' ') item.erase(0, 1);
        if(!item.empty()) res.push_back((item == "true" || item == "1") ? 1 : 0);
    }
    return res;
}\n`;
    }

    // Declarações que leem os parâmetros a partir de argumentos da linha de comando (argv)
    const decls = params
      .map((p, i) => {
        const arg = `string(argv[${i + 1}])`;
        if (p.type === 'int') return `int p${i} = stoi(${arg});`;
        if (p.type === 'float') return `double p${i} = stod(${arg});`;
        if (p.type === 'boolean')
          return `bool p${i} = (${arg} == "true" || ${arg} == "1");`;
        if (p.type === 'string') return `string p${i} = trim_quotes(${arg});`;
        if (p.type === 'int[]')
          return `vector<int> p${i} = parse_int_array(${arg});`;
        if (p.type === 'float[]')
          return `vector<double> p${i} = parse_double_array(${arg});`;
        if (p.type === 'string[]')
          return `vector<string> p${i} = parse_string_array(${arg});`;
        if (p.type === 'boolean[]')
          return `vector<int> p${i} = parse_boolean_array(${arg});`; // Usa vector<int>
        return `string p${i} = ${arg};`;
      })
      .join('\n            ');

    const callArgs = params.map((_, i) => `p${i}`).join(', ');

    return `
#include <iostream>
#include <string>
#include <vector>
#include <sstream>

using namespace std;

${helpers}

// --- Wrapper Injetado pelo Autocore (NORMALIZAÇÃO ESTRITA) ---
int main(int argc, char* argv[]) {
    // Remoção da dependência de std::cin para evitar problemas de TLE por EOF ausente.
    // O judge/executor deve passar os inputs separados como argumentos na execução (ex: ./main 0 0.0 '""' false '[]').
    
    if (argc - 1 < ${params.length}) {
        // Se os parâmetros forem injetados nativamente por texto pelo judge e os argv não existirem,
        // o código deve ser substituído antes da compilação.
        // Caso contrário, esta verificação protege contra Falha de Segmentação.
        cerr << "Erro: Esperado ${params.length} argumentos, mas foram passados " << (argc - 1) << endl;
        return 1;
    }

    try {
        // Declarar as variáveis e parsear valores
        ${decls}
        
        // Chamar solve(...) e passar o resultado para print_result(...)
        print_result(solve(${callArgs}));
        
    } catch (const exception& e) {
        cerr << "Erro de Execução no Wrapper (C++): " << e.what() << endl;
        return 1;
    }
    
    // Encerrar corretamente
    return 0;
}
`;
  }
}
