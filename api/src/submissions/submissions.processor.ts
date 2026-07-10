import { Process, Processor } from '@nestjs/bull';
import { Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Job } from 'bull';
import { Submission } from './entities/submission.entity';
import { Problem } from '../problems/entities/problem.entity';
import { WrapperGenerator } from './wrapper-generator';
import axios from 'axios';
import { SubmissionsGateway } from './submissions.gateway';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { LANGUAGE_CONFIG } from './language-config';

interface ExecutorResponse {
  status: string;
  exitStatus: number;
  files: Record<string, string>;
  /**
   * Presente quando o comando pede `copyOutCached` em vez de `copyOut`.
   * Mapeia nome do arquivo -> ID de referência no cache do Go-Judge
   * (geralmente mantido em /dev/shm). Ver `compileIfNeeded`.
   */
  fileIds?: Record<string, string>;
  stdout?: string;
  stderr?: string;
  error?: string;
  time?: number;
  memory?: number;
}

@Processor('submission-queue')
export class SubmissionsProcessor {
  private readonly logger = new Logger(SubmissionsProcessor.name);
  private readonly executorUrl =
    process.env.EXECUTOR_URL || 'http://go-judge:5050/run';
  // Base para a API de gerenciamento de arquivos em cache do Go-Judge
  // (convenção REST: DELETE {base}/file/{fileId}), derivada removendo o
  // sufixo /run da URL de execução.
  private readonly executorBaseUrl = this.executorUrl.replace(/\/run\/?$/, '');

  constructor(
    @InjectRepository(Submission)
    private submissionsRepository: Repository<Submission>,
    @InjectRepository(Problem)
    private problemsRepository: Repository<Problem>,
    private submissionsGateway: SubmissionsGateway,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private cleanLog(text: string | undefined, languageId?: number): string {
    if (!text) return '';
    let cleaned = text
      .replace(/\u0000/g, '')
      .replace(/\/w\//g, '')
      .replace(/\/sandbox\//g, '')
      .replace(/\/tmp\//g, '');

    if (languageId === 71) {
      cleaned = cleaned.replace(/File "wrapper-generator.ts".*\n/g, '');
      cleaned = cleaned.replace(/File "main.py"/g, 'No seu código');
      cleaned = cleaned.replace(
        /Traceback \(most recent call last\):\n\s*File ".*wrapper.*",.*\n/g,
        '',
      );
    }
    return cleaned.trim();
  }

  /**
   * Compara a saída obtida com a esperada de forma robusta e LOGA as diferenças.
   *
   * FIX (f): a normalização anterior era agressiva demais — removia TODO
   * espaço em branco e convertia cegamente parênteses em colchetes, o que
   * fazia uma tupla `(1, 2)` e uma lista `[1, 2]` serem consideradas
   * equivalentes, mascarando um erro de tipo real que o professor
   * provavelmente queria cobrar. Também podia colapsar strings distintas
   * que só coincidiam depois de remover todos os espaços (ex: "a b" vs "ab").
   *
   * Novo critério, mais conservador:
   *   1) Igualdade exata (após limpeza de BOM/CRLF).
   *   2) Igualdade linha a linha (tolera \r\n vs \n e espaços no fim da linha).
   *   3) Igualdade semântica via JSON.parse (bom para saídas estruturadas).
   *   4) Normalização leve: colapsa espaços/tabs repetidos em um único
   *      espaço (sem removê-los por completo), unifica aspas tipográficas,
   *      e converte literais Python (True/False/None) para seus
   *      equivalentes JSON — sem mexer em parênteses/colchetes, porque
   *      tupla e lista continuam sendo tipos diferentes.
   */
  private compareOutputs(actual: string, expected: string): boolean {
    if (!actual && !expected) return true;
    if (!actual || !expected) {
      this.logger.debug(
        `[COMPARE] Falha por vazio. Actual: "${actual}", Expected: "${expected}"`,
      );
      return false;
    }

    const clean = (s: string) =>
      s
        .trim()
        .replace(/\r\n/g, '\n')
        .replace(/[\u200B-\u200D\uFEFF]/g, '');
    const a = clean(actual);
    const e = clean(expected);

    if (a === e) return true;

    const aLines = a.split('\n').map((l) => l.trimEnd());
    const eLines = e.split('\n').map((l) => l.trimEnd());
    if (
      aLines.length === eLines.length &&
      aLines.every((line, i) => line === eLines[i])
    ) {
      return true;
    }

    try {
      const objA = JSON.parse(a);
      const objE = JSON.parse(e);
      if (JSON.stringify(objA) === JSON.stringify(objE)) return true;
    } catch {
      // Ignora erro
    }

    const normalize = (str: string) => {
      return str
        .split('\n')
        .map((line) =>
          line
            .trim()
            // Colapsa espaços/tabs repetidos em um único espaço — NÃO
            // remove todo espaço em branco, para não confundir strings
            // com espaçamento diferente e conteúdo diferente.
            .replace(/[ \t]+/g, ' '),
        )
        .join('\n')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/\bTrue\b/g, 'true')
        .replace(/\bFalse\b/g, 'false')
        .replace(/\bNone\b/g, 'null')
        .replace(/;$/, '');
    };

    const normA = normalize(a);
    const normE = normalize(e);

    if (normA === normE) return true;

    this.logger.debug(`[COMPARE FAIL]
      Raw Actual:   ${JSON.stringify(actual)}
      Raw Expected: ${JSON.stringify(expected)}
      Norm Actual:  ${normA}
      Norm Expected: ${normE}
    `);

    return false;
  }

  /**
   * FIX (b): a versão anterior compilava C/C++ dentro do próprio comando de
   * execução (`gcc main.c -o main && ./main`), repetido a cada test case.
   * Dois problemas:
   *   1) Um erro de compilação virava "Nonzero Exit Status" no Go-Judge,
   *      que o código mapeava direto para 'Runtime Error' — o aluno via
   *      "erro de execução" quando na verdade o código nem compilou.
   *   2) Recompilava o mesmo código N vezes (uma por test case), gastando
   *      CPU do sandbox à toa.
   *
   * Agora, para linguagens com `compileCommand`, compilamos uma única vez
   * antes do loop. Se falhar, o status vira explicitamente
   * 'Compilation Error' e paramos ali.
   *
   * CORREÇÃO IMPORTANTE (apontada em revisão): o binário compilado NÃO é
   * mais solicitado via `copyOut` (que embutiria o executável inteiro como
   * string no campo `files` da resposta — ruim para payload e para
   * encoding de dados binários em JSON). Em vez disso, usamos
   * `copyOutCached`, que instrui o Go-Judge a manter o binário no seu
   * próprio cache (tipicamente /dev/shm) e devolver apenas um ID de
   * referência no campo `fileIds` da resposta. Esse ID é reaproveitado no
   * `copyIn` de cada execução de test case (`{ fileId: "..." }`), e o
   * Go-Judge resolve o binário internamente — sem re-serializar o
   * conteúdo a cada chamada.
   */
  private async compileIfNeeded(
    compileCommand: string[],
    binaryName: string,
    sourceFiles: { name: string; content: string }[],
  ): Promise<
    { success: true; fileId: string } | { success: false; errorOutput: string }
  > {
    const copyIn: Record<string, { content: string }> = {};
    sourceFiles.forEach((f) => {
      copyIn[f.name] = { content: f.content };
    });

    const compilePayload = {
      cmd: [
        {
          args: compileCommand,
          env: ['PATH=/usr/bin:/bin:/usr/local/bin'],
          files: [
            { content: '' },
            { name: 'stdout', max: 10240 },
            { name: 'stderr', max: 10240 },
          ],
          cpuLimit: 10_000_000_000, // 10s de margem para compilação
          memoryLimit: 256 * 1024 * 1024,
          procLimit: 64,
          copyIn,
          // Pede para o binário ficar em cache no próprio Go-Judge, em vez
          // de ser embutido como texto na resposta (ver comentário acima).
          copyOutCached: [binaryName],
        },
      ],
    };

    const response = await axios.post(this.executorUrl, compilePayload);
    const res = (response.data as ExecutorResponse[])[0];

    const fileId = res.fileIds?.[binaryName];

    if (res.status !== 'Accepted' || !fileId) {
      const errorOutput =
        this.cleanLog(res.error || res.files?.stderr || res.files?.stdout) ||
        'Falha na compilação.';
      return { success: false, errorOutput };
    }

    return { success: true, fileId };
  }

  /**
   * Remove do cache do Go-Judge o binário compilado depois que todos os
   * test cases já rodaram (ou depois de uma falha), para não deixar
   * arquivos acumulando em /dev/shm. Best-effort: falha aqui não deve
   * derrubar a correção da submissão, só é logada.
   */
  private async cleanupCachedFile(fileId: string): Promise<void> {
    try {
      await axios.delete(`${this.executorBaseUrl}/file/${fileId}`);
    } catch (error) {
      this.logger.debug(
        `[DEBUG] Falha ao limpar arquivo em cache ${fileId} (não crítico):`,
        error,
      );
    }
  }

  @Process('grade')
  async handleGrade(job: Job) {
    const { submissionId, files, language, timeLimit, memoryLimit } = job.data;

    let submission: Submission | null = null;

    try {
      submission = await this.submissionsRepository.findOne({
        where: { id: submissionId },
        relations: [
          'problem',
          'problem.testCases',
          'user',
          'problem.classroom',
        ],
      });

      if (!submission) {
        this.logger.error(`[DEBUG] Submissão ${submissionId} não encontrada.`);
        return;
      }

      const fullProblem = submission.problem;

      const langConfig = LANGUAGE_CONFIG[language];
      if (!langConfig) {
        this.logger.error(`[DEBUG] Linguagem ${language} não suportada.`);
        submission.status = 'Internal Error';
        submission.output = 'Linguagem não suportada.';
        await this.submissionsRepository.save(submission);
        return;
      }

      let filesToRun: { name: string; content: string }[] = [];
      try {
        const inputFiles = Array.isArray(files)
          ? files
          : [{ name: langConfig.fileName, content: files }];
        filesToRun = WrapperGenerator.apply(inputFiles, fullProblem, language);
      } catch (wrapperError) {
        submission.status = 'Compilation Error';
        submission.output = `Erro no Wrapper: ${wrapperError.message}`;
        await this.submissionsRepository.save(submission);
        return;
      }

      // FIX (b): compila uma única vez, antes do loop de test cases, para
      // linguagens compiladas (C/C++). Linguagens interpretadas seguem
      // direto para a execução.
      let compiledBinary: { name: string; fileId: string } | null = null;

      if (langConfig.compileCommand && langConfig.compiledBinaryName) {
        const compileResult = await this.compileIfNeeded(
          langConfig.compileCommand,
          langConfig.compiledBinaryName,
          filesToRun,
        );

        if (!compileResult.success) {
          submission.status = 'Compilation Error';
          submission.output = compileResult.errorOutput;
          await this.submissionsRepository.save(submission);

          if (submission.user?.id) {
            this.submissionsGateway.server
              .to(`user-${submission.user.id}`)
              .emit('submission-finished', submission);
          }
          return;
        }

        compiledBinary = {
          name: langConfig.compiledBinaryName,
          fileId: compileResult.fileId,
        };
      }

      let totalGrade = 0;
      let maxTime = 0;
      let maxMemory = 0;
      let firstErrorOutput: string | null = null;
      let finalStatus = 'Accepted';

      try {
        for (const testCase of fullProblem.testCases) {
          const copyIn = {};

          if (compiledBinary) {
            // Linguagem compilada: referencia o binário já em cache no
            // Go-Judge pelo fileId, em vez de reenviar o conteúdo do
            // executável a cada test case.
            copyIn[compiledBinary.name] = { fileId: compiledBinary.fileId };
          } else {
            filesToRun.forEach((f) => {
              copyIn[f.name] = { content: f.content };
            });
          }

          const inputContent = testCase.input || '';

          const runPayload = {
            cmd: [
              {
                args: langConfig.runCommand,
                env: [
                  'PATH=/usr/bin:/bin:/usr/local/bin',
                  'LANG=en_US.UTF-8',
                  'PYTHONUNBUFFERED=1',
                ],
                files: [
                  { content: inputContent },
                  { name: 'stdout', max: 10240 },
                  { name: 'stderr', max: 10240 },
                ],
                cpuLimit: timeLimit ? timeLimit * 1000000 : 2000000000,
                memoryLimit: memoryLimit
                  ? memoryLimit * 1024 * 1024
                  : 128 * 1024 * 1024,
                procLimit: 64,
                copyIn: copyIn,
              },
            ],
          };

          const response = await axios.post(this.executorUrl, runPayload);
          const res = (response.data as ExecutorResponse[])[0];

          const executedTimeMs = Math.floor((res.time || 0) / 1000000);
          const executedMemMb = Math.floor((res.memory || 0) / (1024 * 1024));

          if (res.status === 'Accepted') {
            if (timeLimit && executedTimeMs > timeLimit) {
              res.status = 'Time Limit Exceeded';
            } else if (memoryLimit && executedMemMb > memoryLimit) {
              res.status = 'Memory Limit Exceeded';
            }
          }

          if (res.status !== 'Accepted') {
            finalStatus =
              res.status === 'Nonzero Exit Status'
                ? 'Runtime Error'
                : res.status;

            const rawError =
              res.error ||
              res.files?.stderr ||
              res.files?.stdout ||
              'Erro desconhecido (sem output)';

            if (!firstErrorOutput) {
              if (res.status === 'Time Limit Exceeded') {
                firstErrorOutput = `Tempo limite excedido (${executedTimeMs}ms / ${timeLimit}ms). O código demorou muito para executar ou entrou em loop infinito.`;
              } else if (res.status === 'Memory Limit Exceeded') {
                firstErrorOutput = `Memória limite excedida (${executedMemMb}MB / ${memoryLimit}MB).`;
              } else {
                firstErrorOutput = this.cleanLog(rawError, language);
              }
            }
            break;
          }

          const runStdout = this.cleanLog(res.files['stdout']);
          const expected = testCase.expectedOutput || '';

          if (this.compareOutputs(runStdout, expected)) {
            totalGrade += 100 / fullProblem.testCases.length;
          } else {
            finalStatus = 'Wrong Answer';
            if (!firstErrorOutput) {
              firstErrorOutput = `Esperado: ${expected.trim()}\nRecebido: ${runStdout.trim()}`;
            }
          }

          const timeNs = res.time || 0;
          const memBytes = res.memory || 0;
          if (timeNs > maxTime) maxTime = timeNs;
          if (memBytes > maxMemory) maxMemory = memBytes;
        }
      } finally {
        // Libera o binário do cache do Go-Judge independentemente do
        // resultado (sucesso, Wrong Answer, TLE, break antecipado etc.),
        // para não acumular arquivos em /dev/shm entre submissões.
        if (compiledBinary) {
          await this.cleanupCachedFile(compiledBinary.fileId);
        }
      }

      submission.status = finalStatus;
      submission.grade = Math.round(totalGrade);
      submission.executionTime = Math.floor(maxTime / 1000000);
      submission.memoryUsage = Math.floor(maxMemory / 1024);
      submission.output =
        finalStatus !== 'Accepted' ? firstErrorOutput : 'Sucesso!';

      await this.submissionsRepository.save(submission);

      if (submission.user?.id) {
        this.submissionsGateway.server
          .to(`user-${submission.user.id}`)
          .emit('submission-finished', submission);
      }
    } catch (criticalError) {
      const err =
        criticalError instanceof Error
          ? criticalError
          : new Error(String(criticalError));
      this.logger.error(`[DEBUG] Erro Crítico: ${err.message}`, err.stack);

      // FIX (c): a versão anterior só relançava a exceção sem tocar no
      // status da submissão. Se o Bull não tivesse retry configurado (ou
      // esgotasse as tentativas), a submissão ficava presa em 'Pending'
      // para sempre — o aluno via a tela girando indefinidamente, sem
      // nenhum feedback de que algo deu errado.
      //
      // Agora, best-effort: se conseguimos identificar a submissão, ela é
      // marcada como 'Internal Error' e o aluno é notificado. Ainda assim
      // relançamos a exceção depois, para que a política de retry/alerta
      // do Bull continue funcionando normalmente — se uma nova tentativa
      // for bem-sucedida, ela sobrescreve este status com o resultado real.
      if (submission) {
        try {
          submission.status = 'Internal Error';
          submission.output =
            'Erro interno ao processar a submissão. Tente novamente ou contate o professor.';
          await this.submissionsRepository.save(submission);

          if (submission.user?.id) {
            this.submissionsGateway.server
              .to(`user-${submission.user.id}`)
              .emit('submission-finished', submission);
          }
        } catch (persistError) {
          this.logger.error(
            '[DEBUG] Falha ao persistir Internal Error após erro crítico:',
            persistError,
          );
        }
      }

      throw criticalError;
    }
  }
}
