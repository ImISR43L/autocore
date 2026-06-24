import { Injectable, Logger } from '@nestjs/common';
import { JSDOM } from 'jsdom';
import type { ValidationResult } from '../chemistry/chemistry.service';

interface HtmlRule {
  selector: string;
  description: string;
  attribute?: string;
  expectedValue?: string;
  textContains?: string;
  mustExist?: boolean;
}

export interface HtmlValidationConfig {
  rules: HtmlRule[];
}

@Injectable()
export class HtmlValidatorService {
  private readonly logger = new Logger(HtmlValidatorService.name);

  validateSubmission(
    studentHtml: string,
    config: HtmlValidationConfig,
  ): ValidationResult {
    if (!studentHtml?.trim()) {
      return {
        status: 'Wrong Answer',
        score: 0,
        feedback: 'Nenhum HTML foi enviado.',
      };
    }

    if (!config?.rules?.length) {
      return {
        status: 'Runtime Error',
        score: 0,
        feedback: 'Gabarito inválido: nenhuma regra de validação definida.',
      };
    }

    try {
      const dom = new JSDOM(studentHtml);
      const document = dom.window.document;

      const passed: string[] = [];
      const failed: string[] = [];

      for (const rule of config.rules) {
        const element = document.querySelector(rule.selector);

        // Regra de existência
        if (rule.mustExist === false) {
          if (!element) {
            passed.push(
              `✔ "${rule.description}": elemento ausente conforme esperado.`,
            );
          } else {
            failed.push(
              `✘ "${rule.description}": elemento não deveria existir.`,
            );
          }
          continue;
        }

        if (!element) {
          failed.push(
            `✘ "${rule.description}": elemento "${rule.selector}" não encontrado.`,
          );
          continue;
        }

        // Regra de atributo
        if (rule.attribute !== undefined) {
          const attrValue = element.getAttribute(rule.attribute);
          // Trata string vazia como "nenhum valor esperado", pois o editor de
          // regras salva o campo como "" quando o professor só quer checar
          // presença (e não exige literalmente um atributo vazio, ex: href="").
          const hasExpectedValue =
            rule.expectedValue !== undefined && rule.expectedValue !== '';
          if (hasExpectedValue) {
            if (attrValue === rule.expectedValue) {
              passed.push(
                `✔ "${rule.description}": atributo "${rule.attribute}" correto.`,
              );
            } else {
              failed.push(
                `✘ "${rule.description}": esperado ${rule.attribute}="${rule.expectedValue}", encontrado "${attrValue}".`,
              );
            }
          } else {
            // Só verifica presença do atributo
            if (attrValue !== null) {
              passed.push(
                `✔ "${rule.description}": atributo "${rule.attribute}" presente.`,
              );
            } else {
              failed.push(
                `✘ "${rule.description}": atributo "${rule.attribute}" ausente.`,
              );
            }
          }
          continue;
        }

        // Regra de conteúdo de texto
        if (rule.textContains !== undefined) {
          const text = element.textContent ?? '';
          if (text.includes(rule.textContains)) {
            passed.push(`✔ "${rule.description}": texto encontrado.`);
          } else {
            failed.push(
              `✘ "${rule.description}": texto esperado "${rule.textContains}" não encontrado em "${rule.selector}".`,
            );
          }
          continue;
        }

        // Só presença do elemento
        passed.push(`✔ "${rule.description}": elemento encontrado.`);
      }

      const total = config.rules.length;
      const score = Math.round((passed.length / total) * 100);
      const status = failed.length === 0 ? 'Accepted' : 'Wrong Answer';

      const feedback = [
        ...passed,
        ...(failed.length ? ['', '--- Erros encontrados ---', ...failed] : []),
      ].join('\n');

      return { status, score, feedback };
    } catch (error) {
      this.logger.error('Erro na validação HTML:', error);
      return {
        status: 'Runtime Error',
        score: 0,
        feedback: 'Erro interno ao processar o HTML.',
      };
    }
  }
}
