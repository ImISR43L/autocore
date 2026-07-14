import { DataSource } from 'typeorm';
import { Problem, ProblemType } from '../../problems/entities/problem.entity';
import { SubjectType } from '../../common/enums/subject-type.enum';
import type { ErModel } from '../entities/submission.entity';

/**
 * Seed de exemplo: exercício de modelagem conceitual de uma biblioteca.
 * Diferente de seed-sql-example.ts, não usa TestCase (SQL_MODELING não
 * tem correção automática na Fase 2a — o gabarito aqui serve de
 * referência visual pro professor durante a correção manual).
 *
 * O domínio foi escolhido para demonstrar as duas cardinalidades mais
 * comuns em exercícios de DER na mesma modelagem:
 *   - Autor N:M Livro (um livro pode ter vários autores, um autor pode
 *     ter escrito vários livros — clássico caso que exige entidade
 *     associativa quando o aluno for daí para o modelo lógico/físico).
 *   - Livro 1:N Empréstimo (um livro pode ser emprestado várias vezes
 *     ao longo do tempo, cada empréstimo se refere a um único livro).
 */
export async function seedSqlModelingExample(
  dataSource: DataSource,
  classroomId: string,
) {
  const problemRepo = dataSource.getRepository(Problem);

  const referenceModel: ErModel = {
    entities: [
      {
        id: 'autor',
        name: 'Autor',
        attributes: [
          { name: 'id', isPK: true, isFK: false, type: 'INTEGER' },
          { name: 'nome', isPK: false, isFK: false, type: 'TEXT' },
        ],
        position: { x: 80, y: 80 },
      },
      {
        id: 'livro',
        name: 'Livro',
        attributes: [
          { name: 'id', isPK: true, isFK: false, type: 'INTEGER' },
          { name: 'titulo', isPK: false, isFK: false, type: 'TEXT' },
          { name: 'isbn', isPK: false, isFK: false, type: 'TEXT' },
        ],
        position: { x: 400, y: 80 },
      },
      {
        id: 'emprestimo',
        name: 'Emprestimo',
        attributes: [
          { name: 'id', isPK: true, isFK: false, type: 'INTEGER' },
          { name: 'livro_id', isPK: false, isFK: true, type: 'INTEGER' },
          { name: 'data_emprestimo', isPK: false, isFK: false, type: 'DATE' },
          { name: 'data_devolucao', isPK: false, isFK: false, type: 'DATE' },
        ],
        position: { x: 400, y: 320 },
      },
    ],
    relationships: [
      {
        id: 'autor-livro',
        from: 'autor',
        to: 'livro',
        cardinality: 'N:M',
        name: 'escreve',
      },
      {
        id: 'livro-emprestimo',
        from: 'livro',
        to: 'emprestimo',
        cardinality: '1:N',
        name: 'é emprestado em',
      },
    ],
  };

  const problem = problemRepo.create({
    title: 'Modelagem de uma Biblioteca',
    description:
      'Modele o domínio de uma biblioteca simples: livros, autores e ' +
      'empréstimos.\n\n' +
      '- Um livro pode ter mais de um autor, e um autor pode ter escrito ' +
      'mais de um livro.\n' +
      '- Cada empréstimo se refere a um único livro, mas um mesmo livro ' +
      'pode ser emprestado várias vezes ao longo do tempo.\n\n' +
      'Desenhe as entidades, seus atributos (marcando chaves primárias e ' +
      'estrangeiras) e os relacionamentos com a cardinalidade correta.',
    slug: 'modelagem-de-uma-biblioteca',
    subject: SubjectType.SQL_MODELING,
    type: ProblemType.EXERCISE,
    classroom: { id: classroomId } as any,
    referenceModel,
  });

  return problemRepo.save(problem);
}
