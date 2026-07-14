import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Submission } from './entities/submission.entity';
import { Problem } from '../problems/entities/problem.entity';
import { SubmissionsProcessor } from './submissions.processor';
import { SqlSubmissionsProcessor } from './sql-submissions.processor';
import { SubmissionsGateway } from './submissions.gateway';
import { getSecret } from '../common/utils/secrets.util';
import { ProblemsModule } from '../problems/problems.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { ChemistryModule } from '../chemistry/chemistry.module';
import { HtmlModule } from 'src/html/html.module';
import { ExamAccessGrant } from '../exam-access/entities/exam-access-grant.entity';
import { ChemistryGradingStrategy } from './strategies/chemistry-grading.strategy';
import { HtmlGradingStrategy } from './strategies/html-grading.strategy';
import { ProgrammingGradingStrategy } from './strategies/programming-grading.strategy';
import { SqlQueryGradingStrategy } from './strategies/sql-query-grading.strategy';
import { SqlExecutorService } from './sql/sql-executor.service';
import { SqlDryRunController } from './sql-dry-run.controller';
import { ManualGradingStrategy } from './strategies/manual-grading.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([Submission, Problem, ExamAccessGrant]),

    BullModule.forRootAsync({
      useFactory: () => ({
        redis: {
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: getSecret('REDIS_PASSWORD', 'redis_password'),
        },
      }),
    }),

    // Registro das Filas Específicas.
    // sql-queue é separada de submission-queue de propósito: o motor de
    // execução é outro (Postgres efêmero vs Go-Judge), e um pico de
    // submissões de SQL não deve competir por workers/recursos com a
    // correção de código.
    BullModule.registerQueue(
      { name: 'submission-queue' },
      { name: 'sql-queue' },
    ),

    ProblemsModule,
    AuthModule,
    UsersModule,
    ChemistryModule,
    HtmlModule,
  ],
  controllers: [SubmissionsController, SqlDryRunController],
  providers: [
    SubmissionsService,
    SubmissionsProcessor,
    SqlSubmissionsProcessor,
    SubmissionsGateway,
    ChemistryGradingStrategy,
    HtmlGradingStrategy,
    ProgrammingGradingStrategy,
    SqlQueryGradingStrategy,
    SqlExecutorService,
    ManualGradingStrategy,
  ],
})
export class SubmissionsModule {}
