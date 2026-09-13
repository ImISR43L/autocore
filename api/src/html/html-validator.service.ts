import { Injectable, Logger } from '@nestjs/common';
import type { Page } from 'playwright';
import type { RenderedSite } from './html-executor.service';
import type { ValidationResult } from '../chemistry/chemistry.service';
import {
  HtmlRule,
  HtmlValidationConfig,
  StructuralHtmlRule,
  ComputedStyleHtmlRule,
  NavigationHtmlRule,
  InteractionHtmlRule,
  isComputedStyleRule,
  isNavigationRule,
  isInteractionRule,
} from './html-rule.types';

/**
 * FIX (engine): antes rodava contra um `document` do jsdom, que monta
 * árvore DOM mas não faz layout — `getComputedStyle()` era parcial e
 * não resolvia flex/grid/posicionamento real. Agora recebe uma
 * `RenderedSite` (Fase 2: Page + goTo) já servida por um Chromium de
 * verdade via HtmlExecutorService, então os mesmos tipos de regra
 * funcionam igual a antes, mas com CSS resolvido de verdade — e abre
 * espaço tanto para `computedStyle` quanto para `navigation` entre
 * páginas da própria submissão.
 *
 * Comportamento de `structural` mantido byte a byte com a versão jsdom:
 * mesmas mensagens, mesma lógica de mustExist/attribute/textContains,
 * incluindo o tratamento de expectedValue==="" como "só checar presença".
 */
@Injectable()
export class HtmlValidatorService {
  private readonly logger = new Logger(HtmlValidatorService.name);

  async validateSubmission(
    site: RenderedSite,
    config: HtmlValidationConfig,
  ): Promise<ValidationResult> {
    if (!config?.rules?.length) {
      return {
        status: 'Runtime Error',
        score: 0,
        feedback: 'Gabarito inválido: nenhuma regra de validação definida.',
      };
    }

    const passed: string[] = [];
    const failed: string[] = [];

    for (const rule of config.rules) {
      try {
        // FASE 2: toda regra pode fixar em qual página deve ser avaliada
        // via `rule.page` — `goTo` só navega de verdade se a página
        // atual for diferente (ver comentário em RenderedSite.goTo).
        // Regras sem `page` continuam avaliadas na página de entrada,
        // exatamente como antes da Fase 2.
        await site.goTo(rule.page);

        if (isComputedStyleRule(rule)) {
          await this.evaluateComputedStyleRule(site.page, rule, passed, failed);
        } else if (isNavigationRule(rule)) {
          await this.evaluateNavigationRule(site, rule, passed, failed);
        } else if (isInteractionRule(rule)) {
          await this.evaluateInteractionRule(site, rule, passed, failed);
        } else {
          await this.evaluateStructuralRule(site.page, rule, passed, failed);
        }
      } catch (error) {
        // Um seletor inválido (ex: sintaxe CSS quebrada), uma página
        // referenciada que não existe na submissão, ou erro pontual
        // numa regra não deve derrubar a correção inteira — vira falha
        // só daquela regra, igual ao comportamento anterior (jsdom
        // também tratava "elemento não encontrado" como falha de regra,
        // nunca como exceção fatal).
        this.logger.warn(`Erro ao avaliar regra "${rule.description}":`, error);
        failed.push(
          `✘ "${rule.description}": erro ao avaliar a regra (${
            (error as Error).message
          }).`,
        );
      }
    }

    const total = config.rules.length;
    const score = Math.round((passed.length / total) * 100);
    const status = failed.length === 0 ? 'Accepted' : 'Wrong Answer';

    const feedback = [
      ...passed,
      ...(failed.length ? ['', '--- Erros encontrados ---', ...failed] : []),
    ].join('\n');

    return { status, score, feedback };
  }

  private async evaluateStructuralRule(
    page: Page,
    rule: StructuralHtmlRule,
    passed: string[],
    failed: string[],
  ): Promise<void> {
    await this.assertLocator(
      page,
      rule.selector,
      rule.description,
      {
        mustExist: rule.mustExist,
        attribute: rule.attribute,
        expectedValue: rule.expectedValue,
        textContains: rule.textContains,
      },
      passed,
      failed,
    );
  }

  /**
   * NOVO (Fase 3): executa a sequência de `steps` de uma regra de
   * interação e, ao final, reaproveita EXATAMENTE a mesma lógica de
   * asserção de uma regra estrutural (`assertLocator`) — uma checagem
   * "depois de clicar/digitar" não é conceitualmente diferente de uma
   * checagem "direto na carga da página", só acontece num momento
   * diferente. Extrair esse helper compartilhado evita duplicar
   * mustExist/attribute/textContains numa segunda cópia que divergiria
   * da primeira com o tempo.
   *
   * Cada passo falho (elemento não encontrado pro `click`/`type`) já
   * encerra a regra como falha — não faz sentido continuar uma
   * sequência de interação depois que um passo no meio não pôde ser
   * executado.
   */
  private async evaluateInteractionRule(
    site: RenderedSite,
    rule: InteractionHtmlRule,
    passed: string[],
    failed: string[],
  ): Promise<void> {
    for (const step of rule.steps) {
      if (step.action === 'wait') {
        // Teto de 2000ms por passo já garantido no schema (Zod/validador
        // server-side) antes de chegar aqui.
        await site.page.waitForTimeout(step.ms);
        continue;
      }

      // Estreitado aqui pro TS: fora deste `if`, `step` já não pode mais
      // ser o ramo "wait" — click e type são os únicos que restam, e os
      // dois têm `selector`. Feito num `if/else` em vez de ternário de
      // propósito: um ternário só estreita dentro da própria expressão,
      // não no restante do bloco onde `step.selector` é usado de novo
      // (na mensagem de erro logo abaixo).
      const locator = site.page.locator(step.selector).first();
      if ((await locator.count()) === 0) {
        failed.push(
          `✘ "${rule.description}": elemento "${step.selector}" (passo "${step.action}") não encontrado.`,
        );
        return;
      }

      if (step.action === 'click') {
        await locator.click();
      } else {
        // pressSequentially (não `fill`) dispara eventos de teclado de
        // verdade (keydown/input/keyup por caractere) — importa porque
        // o objetivo desta regra é testar JS vanilla reagindo a
        // digitação de verdade (ex: um listener em "input"), não só
        // colocar um valor no campo silenciosamente.
        await locator.pressSequentially(step.text);
      }
    }

    await this.assertLocator(
      site.page,
      rule.assertSelector,
      rule.description,
      {
        mustExist: rule.assertMustExist,
        attribute: rule.assertAttribute,
        expectedValue: rule.assertExpectedValue,
        textContains: rule.assertTextContains,
      },
      passed,
      failed,
    );
  }

  /**
   * Lógica de asserção compartilhada entre regra estrutural (Fase 1) e
   * a checagem final de uma regra de interação (Fase 3) — comportamento
   * idêntico ao `evaluateStructuralRule` original, só extraído pra não
   * duplicar entre os dois usos.
   */
  private async assertLocator(
    page: Page,
    selector: string,
    description: string,
    opts: {
      mustExist?: boolean;
      attribute?: string;
      expectedValue?: string;
      textContains?: string;
    },
    passed: string[],
    failed: string[],
  ): Promise<void> {
    const locator = page.locator(selector).first();
    const exists = (await locator.count()) > 0;

    if (opts.mustExist === false) {
      if (!exists) {
        passed.push(`✔ "${description}": elemento ausente conforme esperado.`);
      } else {
        failed.push(`✘ "${description}": elemento não deveria existir.`);
      }
      return;
    }

    if (!exists) {
      failed.push(`✘ "${description}": elemento "${selector}" não encontrado.`);
      return;
    }

    if (opts.attribute !== undefined) {
      const attrValue = await locator.getAttribute(opts.attribute);
      const hasExpectedValue =
        opts.expectedValue !== undefined && opts.expectedValue !== '';

      if (hasExpectedValue) {
        if (attrValue === opts.expectedValue) {
          passed.push(
            `✔ "${description}": atributo "${opts.attribute}" correto.`,
          );
        } else {
          failed.push(
            `✘ "${description}": esperado ${opts.attribute}="${opts.expectedValue}", encontrado "${attrValue}".`,
          );
        }
      } else if (attrValue !== null) {
        passed.push(
          `✔ "${description}": atributo "${opts.attribute}" presente.`,
        );
      } else {
        failed.push(
          `✘ "${description}": atributo "${opts.attribute}" ausente.`,
        );
      }
      return;
    }

    if (opts.textContains !== undefined) {
      const text = (await locator.textContent()) ?? '';
      if (text.includes(opts.textContains)) {
        passed.push(`✔ "${description}": texto encontrado.`);
      } else {
        failed.push(
          `✘ "${description}": texto esperado "${opts.textContains}" não encontrado em "${selector}".`,
        );
      }
      return;
    }

    passed.push(`✔ "${description}": elemento encontrado.`);
  }

  private async evaluateComputedStyleRule(
    page: Page,
    rule: ComputedStyleHtmlRule,
    passed: string[],
    failed: string[],
  ): Promise<void> {
    const locator = page.locator(rule.selector).first();
    if ((await locator.count()) === 0) {
      failed.push(
        `✘ "${rule.description}": elemento "${rule.selector}" não encontrado.`,
      );
      return;
    }

    const actualValue = await locator.evaluate(
      (el, property) => getComputedStyle(el).getPropertyValue(property),
      rule.property,
    );

    if (actualValue.trim() === rule.expectedValue.trim()) {
      passed.push(
        `✔ "${rule.description}": propriedade "${rule.property}" correta.`,
      );
    } else {
      failed.push(
        `✘ "${rule.description}": esperado ${rule.property}="${rule.expectedValue}", computado "${actualValue}".`,
      );
    }
  }

  /**
   * NOVO (Fase 2): clica em `rule.selector` (já estamos na página
   * `rule.page`, ver `site.goTo` em validateSubmission) e confere se a
   * navegação resultante caiu em `rule.expectedPage`. `page.url()` é
   * comparado como caminho relativo ao FAKE_ORIGIN — nunca como URL
   * completa, porque a origem em si (https://submission.local) não tem
   * nenhum significado pro professor que escreveu a regra, só o nome do
   * arquivo importa.
   */
  private async evaluateNavigationRule(
    site: RenderedSite,
    rule: NavigationHtmlRule,
    passed: string[],
    failed: string[],
  ): Promise<void> {
    const locator = site.page.locator(rule.selector).first();
    if ((await locator.count()) === 0) {
      failed.push(
        `✘ "${rule.description}": elemento "${rule.selector}" não encontrado.`,
      );
      return;
    }

    try {
      await Promise.all([
        site.page.waitForNavigation({ waitUntil: 'load' }),
        locator.click(),
      ]);
    } catch {
      failed.push(
        `✘ "${rule.description}": o clique em "${rule.selector}" não resultou em navegação.`,
      );
      return;
    }

    const resultingPath = decodeURIComponent(
      new URL(site.page.url()).pathname.replace(/^\/+/, ''),
    );

    if (resultingPath === rule.expectedPage) {
      passed.push(
        `✔ "${rule.description}": navegação levou à página "${rule.expectedPage}" corretamente.`,
      );
    } else {
      failed.push(
        `✘ "${rule.description}": esperado ir para "${rule.expectedPage}", terminou em "${resultingPath}".`,
      );
    }
  }
}
