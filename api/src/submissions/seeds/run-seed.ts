import { getSeedDataSource } from './seed-data-source';
import { seedSqlExample } from './seed-sql-example';

/**
 * Roda o seed conectando direto no Postgres via seed-data-source.ts —
 * não sobe o AppModule inteiro (evita depender de Redis/Throttler, que
 * não tem nada a ver com popular dados e só adiciona risco de travar).
 *
 * Uso: npx tsx src/submissions/seeds/run-seed.ts <classroomId>
 */
async function bootstrap() {
  const classroomId = process.argv[2];

  if (!classroomId) {
    console.error(
      'Uso: npx tsx src/submissions/seeds/run-seed.ts <classroomId>',
    );
    process.exit(1);
  }

  const dataSource = await getSeedDataSource();

  try {
    const problem = await seedSqlExample(dataSource, classroomId);
    console.log(
      `Problema criado com sucesso: ${problem.id} (${problem.title})`,
    );
  } catch (err) {
    console.error('Falha ao rodar o seed:', err);
    process.exitCode = 1;
  } finally {
    await dataSource.destroy();
  }
}

bootstrap();
