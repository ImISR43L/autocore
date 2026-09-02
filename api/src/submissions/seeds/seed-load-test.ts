import { DataSource } from 'typeorm';
import { Classroom } from '../../classrooms/entities/classroom.entity';
import { User } from '../../users/entities/user.entity';
import { Problem, ProblemType } from '../../problems/entities/problem.entity';
import { TestCase } from '../../problems/entities/test-case.entity';
import { SubjectType } from '../../common/enums/subject-type.enum';

function randomJoinCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/**
 * Cria UMA turma com TRÊS problemas de matérias diferentes dentro dela
 * (HTML, PROGRAMMING, SQL) — só pra fins de teste de carga. Isso só é
 * possível porque ProblemsService.create() nunca valida subject do
 * problema contra subject da turma (a trava que existe hoje é só em
 * duplicate(), não em create()) — não reflete um fluxo real de uso pela
 * UI, é um atalho deliberado pra não precisar de 3 turmas separadas
 * neste script.
 *
 * Cada problema tem gabarito conhecido, pra o load-test conseguir
 * enviar uma resposta correta e medir o caminho feliz completo
 * (fila -> correção -> veredito), não só "a API aceitou rápido".
 */
export async function seedLoadTest(dataSource: DataSource, teacherId: string) {
  const classroomRepo = dataSource.getRepository(Classroom);
  const userRepo = dataSource.getRepository(User);
  const problemRepo = dataSource.getRepository(Problem);
  const testCaseRepo = dataSource.getRepository(TestCase);

  const teacher = await userRepo.findOne({ where: { id: teacherId } as any });
  if (!teacher) throw new Error(`Professor ${teacherId} não encontrado.`);

  const classroom = await classroomRepo.save(
    classroomRepo.create({
      name: 'Teste de Carga (load-test)',
      code: randomJoinCode(),
      subject: SubjectType.PROGRAMMING,
      owner: teacher,
      students: [],
    } as any),
  );

  const classroomId = (classroom as any).id;

  // --- HTML ---
  const htmlProblem = await problemRepo.save(
    problemRepo.create({
      title: 'Load Test HTML',
      description: 'Página com um <h1>.',
      slug: 'load-test-html',
      subject: SubjectType.HTML,
      type: ProblemType.EXERCISE,
      classroom: { id: classroomId } as any,
      validationConfig: {
        rules: [
          {
            selector: 'h1',
            description: 'Deve existir um <h1> na página.',
            mustExist: true,
          },
        ],
      },
    }),
  );

  // --- PROGRAMMING ---
  // ASSUNÇÃO: não tenho wrapper-generator.ts, então não sei ao certo como
  // `parameters`/`returnType` viram um script executável de verdade.
  // parameters: [] deveria fazer o WrapperGenerator não embrulhar nada e
  // rodar o arquivo como está (estilo maratona: lê stdin, escreve
  // stdout) — se essa assunção estiver errada, o pior caso é a resposta
  // "correta" vir como Wrong Answer/Compilation Error, o que ainda seria
  // uma medição válida de timing/concorrência, só não do caminho feliz.
  const programmingProblem = await problemRepo.save(
    problemRepo.create({
      title: 'Load Test Programming',
      description: 'Lê dois inteiros e imprime a soma.',
      slug: 'load-test-programming',
      subject: SubjectType.PROGRAMMING,
      type: ProblemType.EXERCISE,
      classroom: { id: classroomId } as any,
      parameters: [],
      returnType: 'void',
      timeLimit: 2000,
      memoryLimit: 128,
      starterCode: [
        { name: 'main.py', content: 'a, b = map(int, input().split())\nprint(a + b)' },
      ],
    }),
  );
  await testCaseRepo.save(
    testCaseRepo.create({
      problem: programmingProblem,
      input: '2 3',
      expectedOutput: '5',
      isHidden: false,
    }),
  );

  // --- SQL ---
  // Mesmo domínio do seed-sql-example.ts (clientes/pedidos), duplicado
  // aqui de propósito para este script não depender de outro seed —
  // load-test deve poder rodar isolado.
  const sqlProblem = await problemRepo.save(
    problemRepo.create({
      title: 'Load Test SQL',
      description: 'Clientes com pelo menos um pedido.',
      slug: 'load-test-sql',
      subject: SubjectType.SQL,
      type: ProblemType.EXERCISE,
      classroom: { id: classroomId } as any,
      sqlOrderSensitive: false,
      sqlSchema: `
        CREATE TABLE clientes (id INTEGER PRIMARY KEY, nome TEXT NOT NULL);
        CREATE TABLE pedidos (
          id INTEGER PRIMARY KEY,
          cliente_id INTEGER NOT NULL REFERENCES clientes(id),
          valor NUMERIC NOT NULL
        );
      `,
    }),
  );
  await testCaseRepo.save(
    testCaseRepo.create({
      problem: sqlProblem,
      input: `
        INSERT INTO clientes (id, nome) VALUES (1, 'Ana'), (2, 'Bruno'), (3, 'Carla');
        INSERT INTO pedidos (id, cliente_id, valor) VALUES (1, 1, 100), (2, 1, 50), (3, 2, 200);
      `,
      expectedOutput: JSON.stringify([
        { id: 1, nome: 'Ana' },
        { id: 2, nome: 'Bruno' },
      ]),
      isHidden: false,
    }),
  );

  return {
    classroom,
    htmlProblem,
    programmingProblem,
    sqlProblem,
  };
}
