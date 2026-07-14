import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Job } from 'bull';
import { Submission } from './entities/submission.entity';
import { SubmissionsGateway } from './submissions.gateway';
import { SqlExecutorService } from './sql/sql-executor.service';

interface SqlTestCaseLike {
  input: string | null;
  expectedOutput: string;
  isHidden?: boolean;
}

@Processor('sql-queue')
export class SqlSubmissionsProcessor {
  private readonly logger = new Logger(SqlSubmissionsProcessor.name);

  constructor(
    @InjectRepository(Submission)
    private submissionsRepository: Repository<Submission>,
    private submissionsGateway: SubmissionsGateway,
    private sqlExecutor: SqlExecutorService,
  ) {}

  @Process('grade-sql')
  async handleGradeSql(job: Job) {
    const { submissionId } = job.data;
    let submission: Submission | null = null;

    try {
      submission = await this.submissionsRepository.findOne({
        where: { id: submissionId },
        relations: ['problem', 'problem.testCases', 'user'],
      });

      if (!submission) {
        this.logger.error(`Submissão ${submissionId} não encontrada.`);
        return;
      }

      const problem = submission.problem;
      const query = submission.files?.[0]?.content || '';

      if (!problem.sqlSchema) {
        submission.status = 'Internal Error';
        submission.output =
          'Gabarito inválido: schema de referência não configurado.';
        await this.persistAndNotify(submission);
        return;
      }

      // Reaproveita a entidade TestCase existente (usada hoje por
      // Programming) redefinindo o sentido dos campos para SQL: `input`
      // passa a ser DML de seed opcional e específico deste caso (além
      // do sqlSchema base do Problem), `expectedOutput` passa a ser o
      // result set esperado serializado como JSON — um array de objetos,
      // ex: `[{"id":1,"nome":"Ana"}]`. Ambos os campos são `text` na
      // entidade real, então guardar uma string JSON em expectedOutput é
      // válido. `isHidden` já existente é respeitado abaixo, para não
      // vazar o gabarito de casos de teste ocultos no feedback de erro.
      const testCases: SqlTestCaseLike[] = problem.testCases?.length
        ? (problem.testCases as any)
        : [{ input: null, expectedOutput: '[]' }];

      let totalScore = 0;
      let finalStatus = 'Accepted';
      let firstErrorOutput: string | null = null;

      for (const testCase of testCases) {
        const result = await this.sqlExecutor.runQuery(
          problem.sqlSchema,
          testCase.input,
          query,
        );

        if (result.status !== 'Accepted') {
          finalStatus = result.status;
          firstErrorOutput = firstErrorOutput ?? result.error ?? 'Erro desconhecido.';
          break;
        }

        let expectedRows: Record<string, any>[];
        try {
          expectedRows = JSON.parse(testCase.expectedOutput || '[]');
        } catch {
          finalStatus = 'Internal Error';
          firstErrorOutput =
            'Gabarito inválido: expectedOutput não é um JSON válido.';
          break;
        }

        if (
          this.compareRows(
            result.rows || [],
            expectedRows,
            problem.sqlOrderSensitive,
          )
        ) {
          totalScore += 100 / testCases.length;
        } else {
          finalStatus = 'Wrong Answer';
          if (!firstErrorOutput) {
            // Test case oculto: não expor o result set esperado no
            // feedback, ou o aluno descobre o gabarito de um caso que o
            // professor deliberadamente escondeu só de errar a resposta.
            firstErrorOutput = testCase.isHidden
              ? 'O resultado da consulta não confere com o esperado em um caso de teste oculto.'
              : this.buildDiffMessage(result.rows || [], expectedRows);
          }
        }
      }

      submission.status = finalStatus;
      submission.grade = Math.round(totalScore);
      submission.output =
        finalStatus !== 'Accepted' ? firstErrorOutput : 'Sucesso!';

      await this.persistAndNotify(submission);
    } catch (criticalError) {
      const err =
        criticalError instanceof Error
          ? criticalError
          : new Error(String(criticalError));
      this.logger.error(`Erro crítico: ${err.message}`, err.stack);

      // Mesmo padrão do FIX (c) do processor de Programming: nunca deixar
      // a submissão presa em 'Pending' indefinidamente por causa de um
      // erro não previsto (ex: pool do sandbox indisponível).
      if (submission) {
        try {
          submission.status = 'Internal Error';
          submission.output =
            'Erro interno ao processar a submissão. Tente novamente ou contate o professor.';
          await this.persistAndNotify(submission);
        } catch (persistError) {
          this.logger.error(
            'Falha ao persistir Internal Error após erro crítico:',
            persistError,
          );
        }
      }

      throw criticalError;
    }
  }

  /**
   * Compara dois result sets. Normaliza cada linha ordenando as chaves
   * (para não depender da ordem de colunas retornada pelo driver) antes
   * de serializar para comparação. Se `orderSensitive` for false (default
   * dos exercícios sem ORDER BY exigido), compara os multisets de linhas
   * ordenando as duas listas antes — duas queries que retornam as mesmas
   * linhas em ordens diferentes são consideradas equivalentes.
   */
  private compareRows(
    actual: Record<string, any>[],
    expected: Record<string, any>[],
    orderSensitive: boolean,
  ): boolean {
    if (actual.length !== expected.length) return false;

    const normalizeRow = (row: Record<string, any>) =>
      JSON.stringify(
        Object.keys(row)
          .sort()
          .reduce((acc, key) => ({ ...acc, [key]: row[key] }), {}),
      );

    const a = actual.map(normalizeRow);
    const e = expected.map(normalizeRow);

    if (orderSensitive) {
      return a.every((row, i) => row === e[i]);
    }

    const sortedA = [...a].sort();
    const sortedE = [...e].sort();
    return sortedA.every((row, i) => row === sortedE[i]);
  }

  private buildDiffMessage(
    actual: Record<string, any>[],
    expected: Record<string, any>[],
  ): string {
    return `Esperado (${expected.length} linha(s)): ${JSON.stringify(expected).slice(0, 500)}\nRecebido (${actual.length} linha(s)): ${JSON.stringify(actual).slice(0, 500)}`;
  }

  private async persistAndNotify(submission: Submission): Promise<void> {
    await this.submissionsRepository.save(submission);

    if (submission.user?.id) {
      this.submissionsGateway.server
        .to(`user-${submission.user.id}`)
        .emit('submission-finished', submission);
    }
  }
}
