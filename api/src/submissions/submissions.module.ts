import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { Submission } from './entities/submission.entity';
// Importe as novas entidades
import { Problem } from './entities/problem.entity';
import { TestCase } from './entities/test-case.entity';

@Module({
  // CORREÇÃO: Registre as 3 entidades aqui
  imports: [TypeOrmModule.forFeature([Submission, Problem, TestCase])],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
})
export class SubmissionsModule {}
