import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { seedLoadTest } from './seed-load-test';

/**
 * Uso:
 *   npx ts-node -r tsconfig-paths/register \
 *     src/submissions/seeds/run-seed-load-test.ts <teacherId>
 *
 * Imprime um bloco JSON pronto pra colar no load-test/.env do outro
 * script (classroomId, code, e os três problemIds).
 */
async function bootstrap() {
  const teacherId = process.argv[2];

  if (!teacherId) {
    console.error(
      'Uso: npx ts-node -r tsconfig-paths/register src/submissions/seeds/run-seed-load-test.ts <teacherId>',
    );
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    const { classroom, htmlProblem, programmingProblem, sqlProblem } =
      await seedLoadTest(dataSource, teacherId);

    console.log('\n--- Cole isto no load-test/.env ---\n');
    console.log(`CLASSROOM_ID=${(classroom as any).id}`);
    console.log(`CLASSROOM_CODE=${(classroom as any).code}`);
    console.log(`HTML_PROBLEM_ID=${htmlProblem.id}`);
    console.log(`PROGRAMMING_PROBLEM_ID=${programmingProblem.id}`);
    console.log(`SQL_PROBLEM_ID=${sqlProblem.id}`);
    console.log('\n------------------------------------\n');
  } catch (err) {
    console.error('Falha ao rodar o seed:', err);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

bootstrap();
