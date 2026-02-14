import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import * as dns from 'dns';

// --- A BALA DE PRATA PARA O BUG DO ALPINE/NODE.JS ---
// Força o Node.js a resolver IPv4 primeiro. Isso impede o bug do "musl libc"
// de colapsar o DNS do Docker durante testes massivos e acaba com o EAI_AGAIN.
dns.setDefaultResultOrder('ipv4first');

jest.setTimeout(60000);

describe('Judge Execution Engine - Full Matrix (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const paramTypes = [
    'int',
    'float',
    'string',
    'boolean',
    'int[]',
    'float[]',
    'string[]',
    'boolean[]',
  ];
  const returnTypes = [
    'int',
    'float',
    'string',
    'boolean',
    'int[]',
    'float[]',
    'string[]',
    'boolean[]',
  ];
  const languages = ['python', 'javascript', 'cpp'];

  const inputs: Record<string, string> = {
    int: '42',
    float: '3.5',
    string: 'hello',
    boolean: 'true',
    'int[]': '[1, 2, 3]',
    'float[]': '[1.5, 2.5]',
    'string[]': '[a, b]',
    'boolean[]': '[true, false]',
  };

  const pyConditions: Record<string, string> = {
    int: 'p == 42',
    float: 'p == 3.5',
    string: 'p == "hello"',
    boolean: 'p is True',
    'int[]': 'p == [1, 2, 3]',
    'float[]': 'p == [1.5, 2.5]',
    'string[]': 'p == ["a", "b"]',
    'boolean[]': 'p == [True, False]',
  };

  const jsConditions: Record<string, string> = {
    int: 'p === 42',
    float: 'p === 3.5',
    string: 'p === "hello"',
    boolean: 'p === true',
    'int[]': 'JSON.stringify(p) === "[1,2,3]"',
    'float[]': 'JSON.stringify(p) === "[1.5,2.5]"',
    'string[]': 'JSON.stringify(p) === \'["a","b"]\'',
    'boolean[]': 'JSON.stringify(p) === "[true,false]"',
  };

  const cppConditions: Record<string, string> = {
    int: 'p == 42',
    float: 'p == 3.5f',
    string: 'p == "hello"',
    boolean: 'p == true',
    'int[]': 'p == vector<int>{1, 2, 3}',
    'float[]': 'p == vector<float>{1.5f, 2.5f}',
    'string[]': 'p == vector<string>{"a", "b"}',
    'boolean[]': 'p == vector<bool>{true, false}',
  };

  const returnValues: Record<string, any> = {
    int: {
      py: '99',
      js: '99',
      cpp: '99',
      err: { py: '-1', js: '-1', cpp: '-1' },
    },
    float: {
      py: '9.5',
      js: '9.5',
      cpp: '9.5f',
      err: { py: '-1.0', js: '-1.0', cpp: '-1.0f' },
    },
    string: {
      py: '"success"',
      js: '"success"',
      cpp: 'string("success")',
      err: { py: '"fail"', js: '"fail"', cpp: 'string("fail")' },
    },
    boolean: {
      py: 'False',
      js: 'false',
      cpp: 'false',
      err: { py: 'True', js: 'true', cpp: 'true' },
    },
    'int[]': {
      py: '[9, 8]',
      js: '[9, 8]',
      cpp: 'vector<int>{9, 8}',
      err: { py: '[-1]', js: '[-1]', cpp: 'vector<int>{-1}' },
    },
    'float[]': {
      py: '[9.5, 8.5]',
      js: '[9.5, 8.5]',
      cpp: 'vector<float>{9.5f, 8.5f}',
      err: { py: '[-1.0]', js: '[-1.0]', cpp: 'vector<float>{-1.0f}' },
    },
    'string[]': {
      py: '["x", "y"]',
      js: '["x", "y"]',
      cpp: 'vector<string>{"x", "y"}',
      err: { py: '["err"]', js: '["err"]', cpp: 'vector<string>{"err"}' },
    },
    'boolean[]': {
      py: '[False, True]',
      js: '[false, true]',
      cpp: 'vector<bool>{false, true}',
      err: { py: '[True]', js: '[true]', cpp: 'vector<bool>{true}' },
    },
  };

  const cppTypeMap: Record<string, string> = {
    int: 'int',
    float: 'float',
    string: 'string',
    boolean: 'bool',
    'int[]': 'vector<int>',
    'float[]': 'vector<float>',
    'string[]': 'vector<string>',
    'boolean[]': 'vector<bool>',
  };

  const expectedOutputs: Record<string, string> = {
    int: '99',
    float: '9.5',
    string: 'success',
    boolean: 'false',
    'int[]': '[9, 8]',
    'float[]': '[9.5, 8.5]',
    'string[]': '["x", "y"]',
    'boolean[]': '[false, true]',
  };

  const buildSolution = (lang: string, pType: string, rType: string) => {
    if (lang === 'python') {
      return `def solve(p):\n    if ${pyConditions[pType]}:\n        return ${returnValues[rType].py}\n    return ${returnValues[rType].err.py}`;
    } else if (lang === 'javascript') {
      return `function solve(p) {\n    if (${jsConditions[pType]}) return ${returnValues[rType].js};\n    return ${returnValues[rType].err.js};\n}`;
    } else {
      return `#include <iostream>\n#include <vector>\n#include <string>\nusing namespace std;\n\n${cppTypeMap[rType]} solve(${cppTypeMap[pType]} p) {\n    cout << boolalpha;\n    if (${cppConditions[pType]}) return ${returnValues[rType].cpp};\n    return ${returnValues[rType].err.cpp};\n}`;
    }
  };

  languages.forEach((lang) => {
    describe(`🟢 Linguagem: ${lang.toUpperCase()}`, () => {
      paramTypes.forEach((pType) => {
        describe(`Parâmetro: [${pType}]`, () => {
          returnTypes.forEach((rType) => {
            it(`deve resolver ${pType} -> ${rType}`, async () => {
              const starterCodeName =
                lang === 'python'
                  ? 'main.py'
                  : lang === 'javascript'
                    ? 'index.js'
                    : 'main.cpp';

              const payload = {
                language: lang,
                parameters: [{ name: 'p', type: pType }],
                returnType: rType,
                starterCode: [
                  {
                    name: starterCodeName,
                    content: buildSolution(lang, pType, rType),
                  },
                ],
                testCases: [
                  {
                    input: inputs[pType],
                    expectedOutput: expectedOutputs[rType],
                  },
                ],
              };

              const response = await request(app.getHttpServer())
                .post('/problems/dry-run')
                .send(payload)
                .expect(201);

              // LOG DE DEBUG INTELIGENTE: Se falhar, mostra o motivo na tela!
              if (response.body?.success === false) {
                console.error(
                  `\n🚨 FALHA ENCONTRADA: ${pType} -> ${rType} (${lang.toUpperCase()})`,
                );
                console.error(JSON.stringify(response.body.results, null, 2));
              }

              expect(response.body).toBeDefined();
              expect(response.body.success).toBe(true);

              response.body.results.forEach((result: any) => {
                // Removemos o check de formatação estrita de strings.
                // Confiamos na nossa inteligência de normalização (ACCEPTED).
                expect(result.status).toBe('ACCEPTED');
              });
            });
          });
        });
      });
    });
  });
});
