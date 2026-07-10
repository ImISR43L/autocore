import { Injectable } from '@nestjs/common';
import { GradingStrategy, GradingResult } from './grading-strategy.interface';
import { ChemistryService } from '../../chemistry/chemistry.service';
import { Submission } from '../entities/submission.entity';
import { Problem } from '../../problems/entities/problem.entity';

@Injectable()
export class ChemistryGradingStrategy implements GradingStrategy {
  readonly mode = 'sync' as const;

  constructor(private readonly chemistryService: ChemistryService) {}

  async grade(
    submission: Submission,
    problem: Problem,
  ): Promise<GradingResult> {
    const files = submission.files;
    const studentSmiles =
      Array.isArray(files) && files.length > 0 ? files[0].content || '' : '';
    const expectedSmiles = problem.validationConfig?.expectedSmiles || '';

    // Toda a complexidade do RDKit/WASM fica isolada dentro do
    // ChemistryService — se ele quebrar, só esta estratégia é afetada.
    const result = this.chemistryService.validateSubmission(
      studentSmiles,
      expectedSmiles,
    );

    return {
      status: result.status,
      score: result.score,
      feedback: result.feedback ?? null,
    };
  }
}
