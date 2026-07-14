import { Injectable } from '@nestjs/common';
import { GradingStrategy, GradingResult } from './grading-strategy.interface';
import { Submission } from '../entities/submission.entity';
import { Problem } from '../../problems/entities/problem.entity';

/**
 * Não corrige nada — só marca a submissão como aguardando um professor.
 * A correção de verdade acontece pelo fluxo que já existe em
 * SubmissionsService.grade() (PATCH /submissions/:id/grade), o mesmo
 * usado hoje para dar nota manual a qualquer submissão.
 *
 * Trocar esta estratégia por um corretor automático de DER no futuro é
 * só registrar a nova estratégia no lugar desta no Map de
 * SubmissionsService — nenhuma outra linha muda.
 */
@Injectable()
export class ManualGradingStrategy implements GradingStrategy {
  readonly mode = 'sync' as const;

  async grade(
    _submission: Submission,
    _problem: Problem,
  ): Promise<GradingResult> {
    return {
      status: 'Awaiting Manual Review',
      score: 0,
      feedback: null,
    };
  }
}
