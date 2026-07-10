import { Submission } from '../entities/submission.entity';
import { Problem } from '../../problems/entities/problem.entity';

export type GradingStatus =
  | 'Accepted'
  | 'Wrong Answer'
  | 'Runtime Error'
  | 'Compilation Error'
  | 'Time Limit Exceeded'
  | 'Memory Limit Exceeded'
  | 'Internal Error'
  | 'Pending';

export interface GradingResult {
  status: GradingStatus;
  score: number;
  feedback?: string | null;
}

/**
 * Contrato único para todos os motores de correção.
 *
 * `mode` existe porque nem toda correção tem o mesmo perfil de custo:
 * HTML e Química são baratas e resolvidas na própria requisição (sync);
 * Programação depende do Go-Judge e é sempre assíncrona (fila do Bull).
 *
 * - mode 'sync'  → grade() retorna o GradingResult final, pronto para persistir.
 * - mode 'async' → grade() apenas enfileira o job e retorna { status: 'Pending' };
 *                  quem persiste o resultado final é o SubmissionsProcessor.
 */
export interface GradingStrategy {
  readonly mode: 'sync' | 'async';
  grade(submission: Submission, problem: Problem): Promise<GradingResult>;
}
