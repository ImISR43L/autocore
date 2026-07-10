import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { GradingStrategy, GradingResult } from './grading-strategy.interface';
import { Submission } from '../entities/submission.entity';
import { Problem } from '../../problems/entities/problem.entity';

@Injectable()
export class ProgrammingGradingStrategy implements GradingStrategy {
  readonly mode = 'async' as const;

  constructor(
    @InjectQueue('submission-queue') private readonly submissionsQueue: Queue,
  ) {}

  async grade(
    submission: Submission,
    problem: Problem,
  ): Promise<GradingResult> {
    // FIX (e): a versão anterior também enviava `testCases: problem.testCases`
    // no payload do job, mas o SubmissionsProcessor sempre re-busca a
    // Submission do banco com `relations: ['problem.testCases']` e usa essa
    // cópia — o valor enviado aqui nunca era lido. Removido para:
    //   1) não inflar o payload guardado no Redis pelo Bull;
    //   2) evitar uma segunda fonte de verdade que poderia ficar
    //      desatualizada se os testCases mudassem entre o enqueue e a
    //      execução do job.
    await this.submissionsQueue.add('grade', {
      submissionId: submission.id,
      files: submission.files,
      language: submission.languageId,
      timeLimit: problem.timeLimit,
      memoryLimit: problem.memoryLimit,
    });

    // Resultado só fica pronto quando o Processor termina o job; aqui
    // devolvemos um estado transitório para a submissão já ser salva
    // como "Pending" e o aluno ver feedback imediato de que foi recebida.
    return { status: 'Pending', score: 0, feedback: null };
  }
}
