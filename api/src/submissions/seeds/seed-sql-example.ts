import { DataSource } from 'typeorm';
import { Problem, ProblemType } from '../../problems/entities/problem.entity';
import { TestCase } from '../../problems/entities/test-case.entity';
import { SubjectType } from '../../common/enums/subject-type.enum';

/**
 * Seed de exemplo: exercício "clientes que fizeram pelo menos um pedido".
 * Roda com `synchronize: true`, sem migration — só popula dados.
 *
 * Ajustar `classroomId` para uma turma existente antes de rodar.
 */
export async function seedSqlExample(
  dataSource: DataSource,
  classroomId: string,
) {
  const problemRepo = dataSource.getRepository(Problem);
  const testCaseRepo = dataSource.getRepository(TestCase);

  const problem = problemRepo.create({
    title: 'Clientes com pedidos',
    description:
      'Escreva uma consulta que retorne o id e o nome de todos os clientes ' +
      'que fizeram pelo menos um pedido, sem repetir clientes.',
    slug: 'clientes-com-pedidos',
    subject: SubjectType.SQL,
    type: ProblemType.EXERCISE,
    classroom: { id: classroomId } as any,
    sqlOrderSensitive: false,
    sqlSchema: `
      CREATE TABLE clientes (
        id INTEGER PRIMARY KEY,
        nome TEXT NOT NULL
      );

      CREATE TABLE pedidos (
        id INTEGER PRIMARY KEY,
        cliente_id INTEGER NOT NULL REFERENCES clientes(id),
        valor NUMERIC NOT NULL
      );
    `,
  });

  const savedProblem = await problemRepo.save(problem);

  // Test case único aqui, mas o desenho suporta múltiplos cenários — por
  // exemplo, um segundo test case com seed diferente (ex: cliente sem
  // nenhum pedido) para pegar aluno que usa LEFT JOIN sem filtrar NULL.
  const testCase = testCaseRepo.create({
    problem: savedProblem,
    isHidden: false,
    input: `
      INSERT INTO clientes (id, nome) VALUES
        (1, 'Ana'), (2, 'Bruno'), (3, 'Carla');

      INSERT INTO pedidos (id, cliente_id, valor) VALUES
        (1, 1, 100), (2, 1, 50), (3, 2, 200);
      -- Carla (id 3) não tem pedidos e não deve aparecer no resultado.
    `,
    expectedOutput: JSON.stringify([
      { id: 1, nome: 'Ana' },
      { id: 2, nome: 'Bruno' },
    ]),
  });

  await testCaseRepo.save(testCase);

  return savedProblem;
}
