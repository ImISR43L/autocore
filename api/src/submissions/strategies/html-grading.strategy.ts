import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { GradingStrategy, GradingResult } from './grading-strategy.interface';
import { HtmlValidatorService } from '../../html/html-validator.service';
import { HtmlExecutorService } from '../../html/html-executor.service';
import {
  hasInteractionRules,
  type HtmlValidationConfig,
} from '../../html/html-rule.types';
import { Submission } from '../entities/submission.entity';
import { Problem } from '../../problems/entities/problem.entity';

@Injectable()
export class HtmlGradingStrategy implements GradingStrategy {
  // 'sync' continua sendo o comportamento PADRÃO/documental (ver
  // comentário em GradingStrategy.mode) — a decisão real de enfileirar
  // ou não acontece dentro de grade(), por submissão, não aqui.
  readonly mode = 'sync' as const;

  constructor(
    private readonly htmlExecutorService: HtmlExecutorService,
    private readonly htmlValidatorService: HtmlValidatorService,
    @InjectQueue('html-queue') private readonly htmlQueue: Queue,
  ) {}

  async grade(
    submission: Submission,
    problem: Problem,
  ): Promise<GradingResult> {
    const config = problem.validationConfig as HtmlValidationConfig;

    if (!config?.rules?.length) {
      return {
        status: 'Runtime Error',
        score: 0,
        feedback: 'Gabarito inválido: nenhuma regra de validação definida.',
      };
    }

    // FIX (engine): `files` já é `FileEntry[] | null` (ver comentário
    // anterior sobre SQL_MODELING) — Array.isArray cobre null/undefined
    // do mesmo jeito que antes.
    const files = Array.isArray(submission.files) ? submission.files : [];
    if (files.length === 0) {
      return {
        status: 'Wrong Answer',
        score: 0,
        feedback: 'Nenhum HTML foi enviado.',
      };
    }

    /**
     * ROTEAMENTO HÍBRIDO (custo-benefício de sync x fila): `interaction`
     * é a única categoria de regra cujo pior caso realmente pode levar
     * segundos (passos com `wait`, ver HtmlExecutorService) — estrutural,
     * computedStyle e navigation continuam na casa dos milissegundos.
     * Em vez de mover TODA correção de HTML para fila (pagando o custo
     * de fila/websocket até para o caso rápido, que é a maioria), só as
     * submissões que de fato contêm uma regra `interaction` são
     * enfileiradas — o resto continua exatamente como antes, síncrono.
     *
     * Isso só é possível porque SubmissionsService.routeToGradingStrategy
     * decide persistir (ou não) olhando o `status` retornado aqui, não
     * um `mode` fixo da classe inteira — ver comentário em
     * GradingStrategy.mode.
     */
    if (hasInteractionRules(config)) {
      await this.htmlQueue.add('grade-html', {
        submissionId: submission.id,
      });
      return { status: 'Pending', score: 0, feedback: null };
    }

    /**
     * FIX (engine, substitui o antigo buildDocument): antes, o CSS
     * enviado em arquivo separado era injetado à força como
     * `<style>{css}</style>` dentro do HTML antes de passar pro jsdom —
     * um workaround necessário porque o jsdom não resolvia
     * getComputedStyle() de qualquer forma, então "aplicar" o CSS via
     * injeção manual ou via <link> real dava no mesmo resultado (ruim).
     *
     * Agora o HtmlExecutorService serve TODOS os arquivos da submissão
     * como um site estático de verdade (cada nome de arquivo vira uma
     * URL de verdade). Se o aluno referenciar o CSS via
     * `<link rel="stylesheet" href="style.css">`, o browser carrega e
     * aplica normalmente — sem injeção manual. Isto é uma MUDANÇA DE
     * COMPORTAMENTO intencional: um HTML que "esquece" de linkar o CSS
     * enviado agora falha regras de computedStyle que dependam dele,
     * onde antes o CSS era aplicado de qualquer jeito. Isso é o
     * comportamento correto de um browser real e também mais justo
     * pedagogicamente (testa se o aluno sabe linkar CSS) — mas é
     * diferente do que existia antes, vale comunicar aos professores
     * que já têm exercícios de HTML+CSS em arquivos separados.
     */
    try {
      const result = await this.htmlExecutorService.withStaticSite(
        files,
        undefined, // entryPage: página padrão — cada regra pode pedir uma
        // página específica via `rule.page` (Fase 2), avaliado dentro do
        // próprio HtmlValidatorService via site.goTo().
        (site) => this.htmlValidatorService.validateSubmission(site, config),
      );

      return {
        status: result.status,
        score: result.score,
        feedback: result.feedback ?? null,
      };
    } catch (error) {
      return {
        status: 'Runtime Error',
        score: 0,
        feedback:
          'Erro interno ao processar o HTML: ' + (error as Error).message,
      };
    }
  }
}
