import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { Submission } from './entities/submission.entity';

// --- CORREÇÃO: Importe do módulo problems ---
import { Problem } from '../problems/entities/problem.entity';
import { TestCase } from '../problems/entities/test-case.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Submission, Problem, TestCase])],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
})
export class SubmissionsModule {}
