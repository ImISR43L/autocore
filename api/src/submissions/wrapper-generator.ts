import { ParameterDefinition } from '../problems/entities/problem.entity';

export class WrapperGenerator {
  static generate(
    languageId: number,
    params: ParameterDefinition[],
    returnType: string,
    userCode: string,
  ): string {
    switch (languageId) {
      case 71:
        return this.python(params, userCode);
      case 63:
        return this.javascript(params, userCode);
      case 62:
        return this.java(params, returnType, userCode);
      case 54:
        return this.cpp(params, returnType, userCode);
      // Adicionar outros conforme necessário
      default:
        return userCode;
    }
  }

  // --- PYTHON: Usa json.loads para ler qualquer estrutura ---
  private static python(
    params: ParameterDefinition[],
    userCode: string,
  ): string {
    const args = params.map((p, i) => `arg${i}`).join(', ');

    // CORREÇÃO: Aumentado para 8 espaços para alinhar dentro do segundo 'if'
    const readers = params
      .map((p, i) => `        arg${i} = json.loads(lines[${i}])`)
      .join('\n');

    return `
import sys
import json

${userCode}

if __name__ == "__main__":
    lines = sys.stdin.read().splitlines()
    # Filtra linhas vazias que podem vir do final do input
    lines = [l for l in lines if l.strip() != ""]
    
    if len(lines) >= ${params.length}:
${readers}
        result = solve(${args})
        print(json.dumps(result) if not isinstance(result, str) else result)
`;
  }

  // --- JAVASCRIPT: Usa JSON.parse ---
  private static javascript(
    params: ParameterDefinition[],
    userCode: string,
  ): string {
    const args = params.map((p, i) => `arg${i}`).join(', ');
    const readers = params
      .map((p, i) => `    const arg${i} = JSON.parse(lines[${i}]);`)
      .join('\n');

    return `
const fs = require('fs');

${userCode}

try {
    const input = fs.readFileSync(0, 'utf-8').trim();
    if(!input) return;
    const lines = input.split('\\n');
    
${readers}
    
    const result = solve(${args});
    console.log(typeof result === 'object' ? JSON.stringify(result) : result);
} catch(e) { console.error(e); }
`;
  }

  // --- C++: Parser manual simples para vetores [1,2,3] ---
  private static cpp(
    params: ParameterDefinition[],
    returnType: string,
    userCode: string,
  ): string {
    const typeMap = {
      int: 'int',
      float: 'float',
      string: 'std::string',
      boolean: 'bool',
      'int[]': 'std::vector<int>',
      'string[]': 'std::vector<std::string>',
    };

    // Gera as variáveis e leituras
    let readers = '';
    let callArgs = '';

    params.forEach((p, i) => {
      const cppType = typeMap[p.type] || 'int';
      callArgs += (i > 0 ? ', ' : '') + `arg${i}`;

      if (p.type.endsWith('[]')) {
        // Lógica simples para ler vetor formato "[1,2,3]"
        readers += `
    ${cppType} arg${i};
    std::string line${i};
    std::getline(std::cin, line${i});
    arg${i} = parseVector<${p.type === 'int[]' ? 'int' : 'std::string'}>(line${i});
            `;
      } else {
        // Tipos primitivos
        readers += `
    ${cppType} arg${i};
    if (std::cin.peek() == '\\n') std::cin.ignore(); 
    std::cin >> arg${i};
            `;
      }
    });

    const printResult = returnType.endsWith('[]')
      ? `for(size_t i=0; i<result.size(); ++i) std::cout << (i==0?"[":",") << result[i]; std::cout << "]";`
      : `std::cout << result;`;

    return `
#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <algorithm>

// Helper para parsear "[1,2,3]"
template <typename T>
std::vector<T> parseVector(std::string s) {
    std::vector<T> res;
    s.erase(remove(s.begin(), s.end(), '['), s.end());
    s.erase(remove(s.begin(), s.end(), ']'), s.end());
    std::stringstream ss(s);
    std::string item;
    while (std::getline(ss, item, ',')) {
        if(item.empty()) continue;
        std::stringstream conv(item);
        T val; conv >> val;
        res.push_back(val);
    }
    return res;
}

${userCode}

int main() {
${readers}
    auto result = solve(${callArgs});
    ${printResult}
    return 0;
}
`;
  }

  // --- JAVA: Scanner + Parse manual ---
  private static java(
    params: ParameterDefinition[],
    returnType: string,
    userCode: string,
  ): string {
    const typeMap = {
      int: 'int',
      float: 'float',
      string: 'String',
      boolean: 'boolean',
      'int[]': 'int[]',
      'string[]': 'String[]',
    };

    // Precisamos envelopar o código do usuário (Solution class) dentro do Main ou vice-versa
    // Estratégia: O usuário escreve 'class Solution { ... }'
    // Nós criamos 'public class Main { ... }' que chama Solution.

    let readers = '';
    let callArgs = '';

    params.forEach((p, i) => {
      const javaType = typeMap[p.type] || 'int';
      callArgs += (i > 0 ? ', ' : '') + `arg${i}`;

      if (p.type.endsWith('[]')) {
        readers += `
            String line${i} = scanner.nextLine();
            ${javaType} arg${i} = parseArray${p.type === 'int[]' ? 'Int' : 'Str'}(line${i});
             `;
      } else {
        // Leituras primitivas
        let nextMethod = 'next()';
        if (p.type === 'int') nextMethod = 'nextInt()';
        if (p.type === 'float') nextMethod = 'nextFloat()';
        if (p.type === 'boolean') nextMethod = 'nextBoolean()';

        readers += `
            ${javaType} arg${i} = scanner.${nextMethod};
            if (scanner.hasNextLine()) scanner.nextLine(); // consume newline
             `;
      }
    });

    return `
import java.util.*;

${userCode}

public class Main {
    // Helpers para parsear "[1,2,3]"
    private static int[] parseArrayInt(String s) {
        s = s.replace("[", "").replace("]", "");
        if (s.trim().isEmpty()) return new int[0];
        String[] parts = s.split(",");
        int[] res = new int[parts.length];
        for(int i=0; i<parts.length; i++) res[i] = Integer.parseInt(parts[i].trim());
        return res;
    }

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        try {
            ${readers}
            
            Solution sol = new Solution();
            System.out.println(sol.solve(${callArgs}));
        } catch(Exception e) {
            // e.printStackTrace();
        }
        scanner.close();
    }
}
`;
  }
}
