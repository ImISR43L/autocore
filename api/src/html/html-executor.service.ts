import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright';

export interface StaticFile {
  name: string;
  content: string;
}

// Origem falsa usada como base para todas as navegações. Não é um
// servidor de verdade — é só o "endereço" que o roteador abaixo reconhece
// para decidir se serve um arquivo da submissão ou aborta a requisição.
const FAKE_ORIGIN = 'https://submission.local';
const DEFAULT_PAGE = 'index.html';

// Timeout do Playwright para navegação/ações individuais (cliques,
// esperas por seletor, etc. quando a Fase 3 - `interaction` - existir).
const ACTION_TIMEOUT_MS = 5_000;

// Teto para a execução inteira (subir contexto + navegar + rodar todas
// as regras), imposto por fora do Playwright. Mesmo papel do
// STATEMENT_TIMEOUT_MS no SqlExecutorService: um backstop que força o
// encerramento mesmo se alguma operação específica não respeitar seu
// próprio timeout individual.
//
// FASE 3: subiu de 10s pra 20s. Regras de `interaction` podem legitimamente
// somar até 5s de `wait` CADA (teto do schema, ver html-rule.types.ts) —
// um gabarito com 2-3 regras de interação já aproximaria o teto antigo
// mesmo sem nada de errado acontecendo. Isso é um número a recalibrar se
// os exercícios de interação crescerem; o valor real que protege o
// processo Chromium compartilhado continua sendo o teto de `wait` por
// regra no schema, não este timeout — este é só o backstop de última
// instância.
const HARD_EXECUTION_TIMEOUT_MS = 20_000;

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
};

export interface RenderedSite {
  page: Page;
  /**
   * Navega para `pageName` (nome de arquivo da submissão) SE a página
   * atual já não for essa — comparado contra `page.url()` de verdade a
   * cada chamada, nunca uma variável de cache local. Isso importa porque
   * uma regra de `navigation` pode mudar a página atual via clique
   * (fora do controle deste helper); se `goTo` confiasse numa variável
   * própria, ficaria sem saber que a página mudou e pularia a navegação
   * da PRÓXIMA regra por engano, mesmo estando na página errada.
   *
   * Ausência de `pageName` (undefined) sempre resolve pra DEFAULT_PAGE.
   */
  goTo(pageName?: string): Promise<void>;
}

@Injectable()
export class HtmlExecutorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HtmlExecutorService.name);
  private browser: Browser | null = null;
  // Evita duas requisições concorrentes relançando o Chromium ao mesmo
  // tempo se ele cair no meio de um pico de submissões — a segunda
  // chamada espera a mesma Promise da primeira em vez de subir um
  // segundo processo à toa.
  private relaunchPromise: Promise<Browser> | null = null;

  async onModuleInit() {
    this.browser = await this.launchBrowser();
  }

  async onModuleDestroy() {
    await this.browser?.close().catch(() => {});
  }

  /**
   * FIX (robustez): antes, `this.browser` era criado uma única vez em
   * onModuleInit e usado direto em `withStaticSite` sem checar se ainda
   * estava vivo. Se o Chromium morresse por qualquer motivo depois disso
   * — OOM do container, o processo travando, ou (o caso mais comum em
   * dev) um restart de hot-reload chamando `onModuleDestroy` — TODA
   * submissão seguinte falhava para sempre com
   * "Target page, context or browser has been closed", até alguém
   * reiniciar o container manualmente. `getBrowser()` verifica
   * `isConnected()` antes de cada uso e relança sozinho se necessário,
   * em vez de depender de reinício externo.
   */
  private async getBrowser(): Promise<Browser> {
    if (this.browser?.isConnected()) {
      return this.browser;
    }

    if (!this.relaunchPromise) {
      this.logger.warn(
        'Browser Chromium desconectado ou nunca iniciado — relançando.',
      );
      this.relaunchPromise = this.launchBrowser().finally(() => {
        this.relaunchPromise = null;
      });
    }

    this.browser = await this.relaunchPromise;
    return this.browser;
  }

  private async launchBrowser(): Promise<Browser> {
    // Um único processo Chromium para toda a aplicação — equivalente ao
    // Pool de conexões do SqlExecutorService. O recurso caro (subir o
    // processo do browser) é compartilhado entre submissões; o que é
    // efêmero e descartado por execução é o BrowserContext (equivalente
    // ao schema Postgres criado/destruído por chamada), nunca o processo
    // inteiro.
    //
    // executablePath: em produção/dev via Docker, a imagem é Alpine
    // (musl libc) — o Chromium que o Playwright baixaria sozinho é
    // compilado pra glibc e não roda aí. O Dockerfile instala o
    // Chromium do próprio apk e expõe o caminho via
    // PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH; lido explicitamente aqui em
    // vez de confiar só na env var interna do Playwright, que muda de
    // nome/comportamento entre versões. `undefined` (fora do Docker,
    // ex.: rodando testes fora de container) deixa o Playwright usar o
    // Chromium que ele mesmo baixou via `npx playwright install`.
    return await chromium.launch({
      headless: true,
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      args: [
        // Sem isto, o Chromium tenta usar o sandbox de kernel do
        // próprio SO (namespaces/seccomp) e falha em containers sem
        // capacidades extras — diferente do go-judge, este serviço não
        // é (e não deveria ser) `privileged`. O isolamento real de
        // "código do aluno rodando aqui" já vem do bloqueio de rede via
        // context.route() e do BrowserContext efêmero, não do sandbox
        // de SO do Chromium.
        '--no-sandbox',
        // /dev/shm padrão do Docker (64MB) é pequeno demais pro
        // Chromium em uso prolongado — sem isto ele derruba a aba
        // silenciosamente sob carga. Usa /tmp em vez de shm.
        '--disable-dev-shm-usage',
      ],
    });
  }

  /**
   * Sobe um BrowserContext isolado, serve os arquivos da submissão como
   * um site estático (sem porta real — via interceptação de rota) e
   * entrega ao `run` um `RenderedSite`: a Page já navegada até
   * `entryPage` (ou a página padrão) e um `goTo()` para navegar entre as
   * páginas da própria submissão durante a avaliação das regras (Fase 2
   * — multi-página). Contexto sempre descartado ao final.
   *
   * Sandboxing:
   *  - Bloqueio de rede por padrão: o roteador só responde a requisições
   *    para FAKE_ORIGIN cujo caminho bate com um arquivo da própria
   *    submissão. Qualquer outra coisa — CDN externo referenciado pelo
   *    aluno, fetch() para qualquer domínio real, e também qualquer
   *    tentativa de navegar/redirecionar pra fora do site estático via
   *    `<a href="https://...">` — é abortada. Whitelist, não blacklist:
   *    mesma filosofia do READ_ONLY_QUERY_PATTERN do SQL.
   *  - Timeout duplo: Playwright tem seu timeout por ação
   *    (ACTION_TIMEOUT_MS); por cima, um teto duro
   *    (HARD_EXECUTION_TIMEOUT_MS) força o encerramento do contexto
   *    mesmo se algo no meio do caminho escapar do timeout individual.
   *  - `context.close()` sempre roda no finally; falha de cleanup vira
   *    warning, nunca é lançada — não deve mascarar o resultado real da
   *    correção (mesmo padrão de cleanupSchema no SqlExecutorService).
   */
  async withStaticSite<T>(
    files: StaticFile[],
    entryPage: string | undefined,
    run: (site: RenderedSite) => Promise<T>,
  ): Promise<T> {
    const browser = await this.getBrowser();
    const fileMap = this.buildFileMap(files);
    const context = await browser.newContext({ javaScriptEnabled: true });

    try {
      await context.route('**/*', (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== FAKE_ORIGIN) {
          return route.abort();
        }
        const path = this.pathFromUrl(url);
        const file = fileMap.get(path);
        if (!file) {
          return route.abort();
        }
        const ext = path.split('.').pop() ?? '';
        return route.fulfill({
          status: 200,
          contentType: CONTENT_TYPES[ext] ?? 'application/octet-stream',
          body: file.content,
        });
      });

      const page = await context.newPage();
      page.setDefaultTimeout(ACTION_TIMEOUT_MS);
      page.setDefaultNavigationTimeout(ACTION_TIMEOUT_MS);

      // FASE 3: uma regra de `interaction` pode clicar em algo que
      // dispara `alert()`/`confirm()`/`prompt()` no JS do aluno — sem um
      // handler registrado, o Playwright trava esperando alguém
      // responder ao diálogo (que nunca vem, é headless). `dismiss()`
      // sempre, incondicionalmente: não tentamos interpretar a
      // intenção do aluno com o diálogo, só garantir que a correção
      // nunca fique presa nele. Registrado aqui, antes de qualquer
      // navegação, cobre também diálogos disparados no carregamento
      // inicial da página (fora do escopo de `interaction`).
      page.on('dialog', (dialog) => {
        dialog.dismiss().catch(() => {
          // Diálogo pode já ter sido resolvido por outra rota — não é
          // um erro que deva propagar e derrubar a correção.
        });
      });

      const goTo = async (pageName?: string): Promise<void> => {
        const target =
          pageName && fileMap.has(pageName) ? pageName : DEFAULT_PAGE;
        if (!fileMap.has(target)) {
          throw new Error(`Página "${target}" não encontrada na submissão.`);
        }
        // Comparado contra o estado real do browser (page.url()), nunca
        // uma variável local — ver comentário na interface RenderedSite.
        const currentPath = this.currentPagePath(page);
        if (currentPath === target) return;
        await page.goto(`${FAKE_ORIGIN}/${target}`, { waitUntil: 'load' });
      };

      await goTo(entryPage);

      return await this.withHardTimeout(
        run({ page, goTo }),
        HARD_EXECUTION_TIMEOUT_MS,
      );
    } finally {
      try {
        await context.close();
      } catch (err) {
        this.logger.warn(
          'Falha ao fechar contexto do browser (não crítico):',
          err,
        );
      }
    }
  }

  private currentPagePath(page: Page): string {
    try {
      return this.pathFromUrl(new URL(page.url()));
    } catch {
      // page.url() antes da primeira navegação é "about:blank" — não é
      // uma URL do nosso FAKE_ORIGIN, então cai aqui e força a primeira
      // navegação de qualquer forma (nunca casa com um nome de arquivo).
      return '';
    }
  }

  private pathFromUrl(url: URL): string {
    return decodeURIComponent(url.pathname.replace(/^\/+/, '')) || DEFAULT_PAGE;
  }

  private buildFileMap(files: StaticFile[]): Map<string, StaticFile> {
    const map = new Map<string, StaticFile>();
    for (const file of files) {
      if (!file?.name) continue;
      map.set(file.name.replace(/^\/+/, ''), file);
    }
    // Sem "index.html" explícito entre os arquivos, o primeiro .html
    // enviado vira a porta de entrada — mesmo fallback que o antigo
    // HtmlGradingStrategy.buildDocument() já fazia
    // (files.find(.html) ?? files[0]).
    if (!map.has(DEFAULT_PAGE)) {
      const firstHtml = files.find((f) =>
        f.name?.toLowerCase().endsWith('.html'),
      );
      if (firstHtml) map.set(DEFAULT_PAGE, firstHtml);
    }
    return map;
  }

  private async withHardTimeout<T>(
    promise: Promise<T>,
    ms: number,
  ): Promise<T> {
    let timer!: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('Tempo limite de execução excedido.')),
        ms,
      );
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
