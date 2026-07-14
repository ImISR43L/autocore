import { getSeedDataSource } from './seed-data-source';
import { seedSqlClassroom } from './seed-sql-classroom';

/**
 * Uso:
 *   npx tsx src/submissions/seeds/run-seed-classroom.ts <teacherId> [studentId]
 *
 * teacherId: UUID de um usuário já existente (vira o dono/professor da
 *            turma). studentId (opcional): UUID de outro usuário
 *            existente, já matriculado na turma criada — sem isso, a
 *            turma fica sem alunos e não dá pra testar o fluxo de
 *            submissão sem matricular alguém manualmente depois.
 *
 * Conecta direto no Postgres via seed-data-source.ts, sem subir o
 * AppModule inteiro (evita Redis/Throttler, que não têm relação com
 * este script e podem travar o processo indefinidamente).
 */
async function bootstrap() {
  const teacherId = process.argv[2];
  const studentId = process.argv[3];

  if (!teacherId) {
    console.error(
      'Uso: npx tsx src/submissions/seeds/run-seed-classroom.ts <teacherId> [studentId]',
    );
    process.exit(1);
  }

  const dataSource = await getSeedDataSource();

  try {
    const { classroom, sqlProblem, sqlModelingProblem } =
      await seedSqlClassroom(dataSource, teacherId, studentId);
    console.log(
      `Turma criada: ${(classroom as any).id} — código de convite: ${(classroom as any).code}`,
    );
    console.log(`Problema SQL criado: ${sqlProblem.id} (${sqlProblem.title})`);
    console.log(
      `Problema SQL_MODELING criado: ${sqlModelingProblem.id} (${sqlModelingProblem.title})`,
    );
  } catch (err) {
    console.error('Falha ao rodar o seed:', err);
    process.exitCode = 1;
  } finally {
    await dataSource.destroy();
  }
}

bootstrap();
