import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Submission } from './entities/submission.entity';
import { Problem } from '../problems/entities/problem.entity';
import { SubmissionsProcessor } from './submissions.processor';
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

    // Registro da Fila Específica
    BullModule.registerQueue({
      name: 'submission-queue',
    }),

    ProblemsModule,
    AuthModule,
    UsersModule,
    ChemistryModule,
    HtmlModule,
  ],
  controllers: [SubmissionsController],
  providers: [
    SubmissionsService,
    SubmissionsProcessor,
    SubmissionsGateway,
    ChemistryGradingStrategy,
    HtmlGradingStrategy,
    ProgrammingGradingStrategy,
  ],
})
export class SubmissionsModule {}
