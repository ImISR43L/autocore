import { Logger } from '@nestjs/common';
import { Problem } from '../problems/entities/problem.entity';

export class WrapperGenerator {
  private static readonly logger = new Logger(WrapperGenerator.name);

  private static readonly UNSAFE_CHARS_REGEX =
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u3164]/g;

  private static readonly LANGUAGE_CONFIG: Record<
    number,
    { ext: string; standardName: string }
  > = {
    71: { ext: '.py', standardName: 'main.py' },
    63: { ext: '.js', standardName: 'index.js' },
    54: { ext: '.cpp', standardName: 'main.cpp' },
  };

  static apply(files: any[], problem: Problem, languageId: number): any[] {
    this.logger.log(`[log] Iniciando Wrapper para LangID: ${languageId}`);

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
      case 71:
        wrapperCode = this.generatePythonWrapper(problem);
        entryFile.content = `${entryFile.content}\n\n${wrapperCode}`;
        break;

      case 63:
        wrapperCode = this.generateJsWrapper(problem);
        entryFile.content = `${entryFile.content}\n\n${wrapperCode}`;
        break;

      case 54:
        if (!entryFile.content.includes('int main')) {
          wrapperCode = this.generateCppWrapper(problem);
          entryFile.content = `${entryFile.content}\n\n${wrapperCode}`;
        }
        break;
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
                sys.exit(1)
    except Exception as e:
        sys.exit(1)
`;
  }

  private static generateJsWrapper(problem: Problem): string {
    const params = problem.parameters || [];
    const typesArray = JSON.stringify(params.map((p) => p.type));

    return `
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
            process.exit(1);
        }
    }
} catch (e) {
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
string trim_quotes(string s) {
    while(!s.empty() && (s.back() == '\\r' || s.back() == '\\n' || s.back() == ' ')) s.pop_back();
    while(!s.empty() && (s.front() == '\\r' || s.front() == '\\n' || s.front() == ' ')) s.erase(0, 1);
    if(!s.empty() && (s.front() == '"' || s.front() == '\\'')) s.erase(0, 1);
    if(!s.empty() && (s.back() == '"' || s.back() == '\\'')) s.pop_back();
    return s;
}

string trim_brackets(string s) {
    while(!s.empty() && (s.back() == '\\r' || s.back() == '\\n' || s.back() == ' ')) s.pop_back();
    while(!s.empty() && (s.front() == '\\r' || s.front() == '\\n' || s.front() == ' ')) s.erase(0, 1);
    if(!s.empty() && s.front() == '[') s.erase(0, 1);
    if(!s.empty() && s.back() == ']') s.pop_back();
    return s;
}

template<typename T> void print_result(const T& t) { cout << t << endl; }
template<typename T> void print_result(const vector<T>& v) {
    cout << "[";
    for (size_t i = 0; i < v.size(); ++i) { cout << (T)v[i] << (i + 1 == v.size() ? "" : ", "); }
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
        while(!item.empty() && (item.front() == ' ' || item.front() == '\\r' || item.front() == '\\n')) item.erase(0, 1);
        while(!item.empty() && (item.back() == ' ' || item.back() == '\\r' || item.back() == '\\n')) item.pop_back();
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
        while(!item.empty() && (item.front() == ' ' || item.front() == '\\r' || item.front() == '\\n')) item.erase(0, 1);
        while(!item.empty() && (item.back() == ' ' || item.back() == '\\r' || item.back() == '\\n')) item.pop_back();
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
        while(!item.empty() && (item.front() == ' ' || item.front() == '\\r' || item.front() == '\\n')) item.erase(0, 1);
        while(!item.empty() && (item.back() == ' ' || item.back() == '\\r' || item.back() == '\\n')) item.pop_back();
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
        while(!item.empty() && (item.front() == ' ' || item.front() == '\\r' || item.front() == '\\n')) item.erase(0, 1);
        while(!item.empty() && (item.back() == ' ' || item.back() == '\\r' || item.back() == '\\n')) item.pop_back();
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

using namespace std;

${helpers}

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
        string current_token = "";
        bool in_quotes = false;
        int bracket_level = 0;
        
        for (char c : input_data) {
            if (c == '"' || c == '\\'') in_quotes = !in_quotes;
            else if (c == '[') bracket_level++;
            else if (c == ']') bracket_level--;
            
            if (c == ' ' && !in_quotes && bracket_level == 0) {
                if (!current_token.empty()) {
                    parts.push_back(current_token);
                    current_token = "";
                }
            } else {
                current_token += c;
            }
        }
        if (!current_token.empty()) parts.push_back(current_token);
    }

    if (parts.size() >= ${params.length}) {
        try {
            for(auto& p : parts) {
                while(!p.empty() && (p.back() == '\\r' || p.back() == '\\n' || p.back() == ' ')) p.pop_back();
                while(!p.empty() && (p.front() == '\\r' || p.front() == '\\n' || p.front() == ' ')) p.erase(0, 1);
            }
            
            ${decls}
            print_result(solve(${callArgs}));
            
        } catch (...) {
            return 1;
        }
    } else {
        return 1;
    }
    
    return 0;
}
`;
  }
}
