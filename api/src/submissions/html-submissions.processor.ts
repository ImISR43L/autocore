import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Job } from 'bull';
import { Submission } from './entities/submission.entity';
import { SubmissionsGateway } from './submissions.gateway';
import { HtmlExecutorService } from '../html/html-executor.service';
import { HtmlValidatorService } from '../html/html-validator.service';
import type { HtmlValidationConfig } from '../html/html-rule.types';

/**
 * Processa só as submissões de HTML que HtmlGradingStrategy decidiu
 * enfileirar — na prática, as que têm ao menos uma regra `interaction`
 * (ver hasInteractionRules em html-rule.types.ts). Todo o resto de HTML
 * (structural/computedStyle/navigation) continua correndo inline dentro
 * do próprio POST /submissions, nunca passa por aqui.
 *
 * `concurrency: 2` no @Process abaixo é o motivo real de existir esta
 * fila: limita quantos Chromium/BrowserContext rodam ao mesmo tempo
 * contra o processo compartilhado do HtmlExecutorService, protegendo o
 * container de 1 CPU / 1.5G (ver compose.yaml) de um pico de submissões
 * simultâneas perto do prazo final. Sem isso, mover para fila só
 * adiaria o problema de recursos, não resolveria — o ganho de "fila"
 * está inteiro nesse limite de concorrência, não em rodar assíncrono
 * por si só. Ajustar esse número conforme os recursos reais do
 * ambiente (vale recalibrar junto com HARD_EXECUTION_TIMEOUT_MS em
 * HtmlExecutorService se mudar).
 */
@Processor('html-queue')
export class HtmlSubmissionsProcessor {
  private readonly logger = new Logger(HtmlSubmissionsProcessor.name);

  constructor(
    @InjectRepository(Submission)
    private submissionsRepository: Repository<Submission>,
    private submissionsGateway: SubmissionsGateway,
    private htmlExecutorService: HtmlExecutorService,
    private htmlValidatorService: HtmlValidatorService,
  ) {}

  @Process({ name: 'grade-html', concurrency: 2 })
  async handleGradeHtml(job: Job) {
    const { submissionId } = job.data;
    let submission: Submission | null = null;

    try {
      submission = await this.submissionsRepository.findOne({
        where: { id: submissionId },
        relations: ['problem', 'user'],
      });

      if (!submission) {
        this.logger.error(`Submissão ${submissionId} não encontrada.`);
        return;
      }

      const problem = submission.problem;
      const config = problem.validationConfig as HtmlValidationConfig;
      const files = Array.isArray(submission.files) ? submission.files : [];

      if (!config?.rules?.length) {
        submission.status = 'Runtime Error';
        submission.grade = 0;
        submission.output =
          'Gabarito inválido: nenhuma regra de validação definida.';
        await this.persistAndNotify(submission);
        return;
      }

      if (files.length === 0) {
        submission.status = 'Wrong Answer';
        submission.grade = 0;
        submission.output = 'Nenhum HTML foi enviado.';
        await this.persistAndNotify(submission);
        return;
      }

      const result = await this.htmlExecutorService.withStaticSite(
        files,
        undefined,
        (site) => this.htmlValidatorService.validateSubmission(site, config),
      );

      submission.status = result.status;
      submission.grade = result.score;
      submission.output = result.feedback ?? null;

      await this.persistAndNotify(submission);
    } catch (criticalError) {
      const err =
        criticalError instanceof Error
          ? criticalError
          : new Error(String(criticalError));
      this.logger.error(`Erro crítico: ${err.message}`, err.stack);

      // Mesmo padrão do FIX (c) do processor de Programming e do
      // SqlSubmissionsProcessor: nunca deixar a submissão presa em
      // 'Pending' indefinidamente por causa de um erro não previsto
      // (ex: Chromium crashou, container sem memória).
      if (submission) {
        try {
          submission.status = 'Internal Error';
          submission.grade = 0;
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

  private async persistAndNotify(submission: Submission): Promise<void> {
    await this.submissionsRepository.save(submission);

    if (submission.user?.id) {
      this.submissionsGateway.server
        .to(`user-${submission.user.id}`)
        .emit('submission-finished', submission);
    }
  }
}
