import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { GradingStrategy, GradingResult } from './grading-strategy.interface';
import { Submission } from '../entities/submission.entity';
import { Problem } from '../../problems/entities/problem.entity';

@Injectable()
export class SqlQueryGradingStrategy implements GradingStrategy {
  readonly mode = 'async' as const;

  constructor(
    @InjectQueue('sql-queue') private readonly sqlQueue: Queue,
  ) {}

  async grade(
    submission: Submission,
    problem: Problem,
  ): Promise<GradingResult> {
    const query = submission.files?.[0]?.content;

    if (!query || !query.trim()) {
      return {
        status: 'Compilation Error',
        score: 0,
        feedback: 'Nenhuma consulta SQL enviada.',
      };
    }

    if (!problem.sqlSchema) {
      return {
        status: 'Internal Error',
        score: 0,
        feedback: 'Gabarito inválido: schema de referência não configurado.',
      };
    }

    // Mesmo princípio do FIX (e) do ProgrammingGradingStrategy: o job
    // carrega só o id. Schema, seeds e result set esperado são lidos do
    // banco pelo SqlSubmissionsProcessor no momento da execução, para
    // não guardar uma cópia potencialmente desatualizada no Redis e para
    // não inflar o payload do job.
    await this.sqlQueue.add('grade-sql', {
      submissionId: submission.id,
    });

    return { status: 'Pending', score: 0, feedback: null };
  }
}
