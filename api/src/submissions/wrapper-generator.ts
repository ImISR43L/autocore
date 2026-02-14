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
    return files.findIndex((f) => f.name.endsWith(config.ext));
  }

  private static generatePythonWrapper(problem: Problem): string {
    const params = problem.parameters || [];
    const typesArray = params.map((p) => `"${p.type}"`).join(', ');

    return `
import sys
import re
import json

# --- Wrapper Injetado pelo Autocore (NORMALIZAÇÃO ESTrita) ---
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
        if raw.startswith('['): raw = raw[1:]
        if raw.endswith(']'): raw = raw[:-1]
        inner = raw.strip()
        
        if not inner: return []
        items = [x.strip() for x in inner.split(',')]
        base_type = arg_type[:-2]
        
        if base_type == 'int': return [int(x) for x in items if x]
        if base_type == 'float': return [float(x) for x in items if x]
        if base_type == 'boolean': return [x.lower() == 'true' for x in items if x]
        return items
        
    return raw

if __name__ == '__main__':
    try:
        input_data = sys.stdin.read().strip()
        if input_data:
            types = [${typesArray}]
            
            # Estratégia 1: Parse linha a linha (Preserva espaços internos)
            parts = [line.strip() for line in input_data.split('\\n') if line.strip()]
            
            # Estratégia 2: Regex Tokenizer caso tudo venha na mesma linha
            if len(parts) < len(types):
                parts = re.findall(r'\\[.*?\\]|".*?"|\\'.*?\\'|\\S+', input_data)
                
            if len(parts) >= len(types):
                args = [parse_arg(parts[i], types[i]) for i in range(len(types))]
                
                # Executa o código do aluno
                result = solve(*args)
                
                # Trata a saída adequadamente
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
    raw = raw.trim();
    
    if (raw.startsWith('"') && raw.endswith('"')) raw = raw.slice(1, -1);
    else if (raw.startsWith("'") && raw.endswith("'")) raw = raw.slice(1, -1);

    if (type === 'int') return parseInt(raw, 10);
    if (type === 'float') return parseFloat(raw);
    if (type === 'boolean') return raw.toLowerCase() === 'true';
    if (type === 'string') return raw;
    
    if (type.endsWith('[]')) {
        if (raw.startsWith('[')) raw = raw.slice(1);
        if (raw.endsWith(']')) raw = raw.slice(0, -1);
        let inner = raw.trim();
        
        if (!inner) return [];
        let items = inner.split(',').map(x => x.trim()).filter(x => x !== '');
        let baseType = type.slice(0, -2);
        
        if (baseType === 'int') return items.map(x => parseInt(x, 10));
        if (baseType === 'float') return items.map(x => parseFloat(x));
        if (baseType === 'boolean') return items.map(x => x.toLowerCase() === 'true');
        return items;
    }
    return raw;
}

try {
    const input = readFileSync(0, 'utf8').trim();
    if (input) {
        const types = ${typesArray};
        
        // Estratégia 1: Parse linha a linha
        let parts = input.split(/\\r?\\n/).filter(line => line.trim() !== '');
        
        // Estratégia 2: Fallback Regex
        if (parts.length < types.length) {
            parts = input.match(/\\[.*?\\]|".*?"|'.*?'|\\S+/g) || [];
        }
        
        if (parts.length >= types.length) {
            const args = types.map((type, i) => parseArg(parts[i], type));
            
            // Invoca a função do usuário de forma segura
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
vector<float> parse_float_array(string raw) {
    vector<float> res;
    raw = trim_brackets(raw);
    stringstream ss(raw);
    string item;
    while(getline(ss, item, ',')) {
        while(!item.empty() && item.front() == ' ') item.erase(0, 1);
        if(!item.empty()) res.push_back(stof(item));
    }
    return res;
}\n`;
    }
    if (hasStringArray) {
      helpers += `
vector<string> parse_string_array(string raw) {
    vector<string> res;
    raw = trim_brackets(raw);
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
      helpers += `
vector<bool> parse_boolean_array(string raw) {
    vector<bool> res;
    raw = trim_brackets(raw);
    stringstream ss(raw);
    string item;
    while(getline(ss, item, ',')) {
        while(!item.empty() && item.front() == ' ') item.erase(0, 1);
        if(!item.empty()) res.push_back(item == "true" || item == "1");
    }
    return res;
}\n`;
    }

    const decls = params
      .map((p, i) => {
        if (p.type === 'int') return `int p${i} = stoi(parts[${i}]);`;
        if (p.type === 'float') return `float p${i} = stof(parts[${i}]);`;
        if (p.type === 'boolean')
          return `bool p${i} = (parts[${i}] == "true" || parts[${i}] == "1");`;
        if (p.type === 'string')
          return `string p${i} = trim_quotes(parts[${i}]);`;
        if (p.type === 'int[]')
          return `vector<int> p${i} = parse_int_array(parts[${i}]);`;
        if (p.type === 'float[]')
          return `vector<float> p${i} = parse_float_array(parts[${i}]);`;
        if (p.type === 'string[]')
          return `vector<string> p${i} = parse_string_array(parts[${i}]);`;
        if (p.type === 'boolean[]')
          return `vector<bool> p${i} = parse_boolean_array(parts[${i}]);`;
        return `string p${i} = parts[${i}];`;
      })
      .join('\n            ');

    const callArgs = params.map((_, i) => `p${i}`).join(', ');

    return `
#include <iostream>
#include <string>
#include <vector>
#include <sstream>
#include <regex>

using namespace std;

${helpers}

// --- Wrapper Injetado pelo Autocore (NORMALIZAÇÃO ESTRITA) ---
int main() {
    string input_data, line;
    while (getline(cin, line)) {
        if (!line.empty()) {
            if (!input_data.empty()) input_data += "\\n";
            input_data += line;
        }
    }
    
    if (input_data.empty()) return 0;

    vector<string> parts;
    stringstream ss(input_data);
    while(getline(ss, line, '\\n')) {
        parts.push_back(line);
    }

    if (parts.size() < ${params.length}) {
        parts.clear();
        regex re(R"(\\[.*?\\]|\\".*?\\"|'.*?'|\\S+)");
        sregex_iterator next(input_data.begin(), input_data.end(), re);
        sregex_iterator end;
        while (next != end) {
            parts.push_back(next->str());
            next++;
        }
    }

    if (parts.size() >= ${params.length}) {
        try {
            // Conversão Rigorosa (Strong Typing)
            ${decls}
            
            // Impressão genérica segura para arrays e primitivos
            print_result(solve(${callArgs}));
            
        } catch (const exception& e) {
            cerr << "Erro de Execução no Wrapper (C++): " << e.what() << endl;
            return 1;
        }
    } else {
        cerr << "Erro: Esperado ${params.length} argumentos" << endl;
        return 1;
    }
    
    return 0;
}
`;
  }
}
