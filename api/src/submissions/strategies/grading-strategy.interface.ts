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
  | 'Pending'
  | 'Awaiting Manual Review';

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
 * Programação e SQL dependem de sandbox externo e são assíncronas (fila
 * do Bull).
 *
 * - mode 'sync'  → grade() retorna o GradingResult final, pronto para persistir.
 * - mode 'async' → grade() apenas enfileira o job e retorna { status: 'Pending' };
 *                  quem persiste o resultado final é o Processor correspondente.
 *
 * 'Awaiting Manual Review' (Fase 2 — modelagem conceitual de SQL) é
 * DIFERENTE de 'Pending': Pending significa "processando, resultado sai
 * sozinho em breve"; Awaiting Manual Review significa "aguardando um
 * professor avaliar manualmente, indefinidamente". Tratar os dois como o
 * mesmo status faria o `persistAndNotify` (mode sync) emitir
 * 'submission-finished' com nota 0 pro aluno, como se já tivesse
 * terminado — falso.
 */
export interface GradingStrategy {
  readonly mode: 'sync' | 'async';
  grade(submission: Submission, problem: Problem): Promise<GradingResult>;
}
