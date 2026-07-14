import { Injectable } from '@nestjs/common';
import { GradingStrategy, GradingResult } from './grading-strategy.interface';
import {
  HtmlValidatorService,
  HtmlValidationConfig,
} from '../../html/html-validator.service';
import { Submission } from '../entities/submission.entity';
import { Problem } from '../../problems/entities/problem.entity';

interface SubmissionFile {
  name: string;
  content: string;
}

@Injectable()
export class HtmlGradingStrategy implements GradingStrategy {
  readonly mode = 'sync' as const;

  constructor(private readonly htmlValidatorService: HtmlValidatorService) {}

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

    const document = this.buildDocument(submission.files);
    const result = this.htmlValidatorService.validateSubmission(
      document,
      config,
    );

    return {
      status: result.status,
      score: result.score,
      feedback: result.feedback ?? null,
    };
  }

  /**
   * FIX (d): a implementação anterior fazia `files[0].content` e ignorava
   * silenciosamente qualquer outro arquivo enviado. Se um exercício algum
   * dia pedir HTML + CSS em arquivos separados, o CSS nunca era validado.
   *
   * Aqui: identificamos o arquivo .html (ou o primeiro, por segurança) e,
   * se existir um arquivo .css entre os enviados, injetamos seu conteúdo
   * como <style> antes de passar para o JSDOM. Isso permite que regras de
   * validação baseadas em propriedades CSS computadas continuem funcionando
   * mesmo com os arquivos separados.
   *
   * FIX (Fase 2): `| null` adicionado à assinatura. Submission.files
   * passou a ser `FileEntry[] | null` (submissões de SQL_MODELING não
   * têm arquivos, usam `modelData`). HTML nunca vai receber null de
   * verdade — problem.subject sempre roteia pra esta strategy só quando
   * é HTML — mas o compilador não sabe disso a partir do tipo da coluna,
   * então o parâmetro precisa aceitar o union inteiro. `Array.isArray`
   * já tratava null e undefined da mesma forma (ambos retornam false),
   * então o comportamento em runtime não muda em nada.
   */
  private buildDocument(files: SubmissionFile[] | null | undefined): string {
    if (!Array.isArray(files) || files.length === 0) return '';

    const htmlFile =
      files.find((f) => f.name?.toLowerCase().endsWith('.html')) ?? files[0];
    const cssFile = files.find((f) => f.name?.toLowerCase().endsWith('.css'));

    let html = htmlFile?.content || '';

    if (cssFile?.content) {
      const styleTag = `<style>${cssFile.content}</style>`;
      html = html.includes('</head>')
        ? html.replace('</head>', `${styleTag}</head>`)
        : `${styleTag}${html}`;
    }

    return html;
  }
}
