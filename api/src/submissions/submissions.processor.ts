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
import { SubjectType } from '../common/enums/subject-type.enum';
import { ChemistryService } from '../chemistry/chemistry.service';

interface LanguageConfig {
  fileName: string;
  runCommand: string[];
}

interface ExecutorResponse {
  status: string;
  exitStatus: number;
  files: Record<string, string>;
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

  constructor(
    @InjectRepository(Submission)
    private submissionsRepository: Repository<Submission>,
    @InjectRepository(Problem)
    private problemsRepository: Repository<Problem>,
    private submissionsGateway: SubmissionsGateway,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private chemistryService: ChemistryService,
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
   */
  private compareOutputs(actual: string, expected: string): boolean {
    if (!actual && !expected) return true;
    if (!actual || !expected) {
      this.logger.debug(
        `[COMPARE] Falha por vazio. Actual: "${actual}", Expected: "${expected}"`,
      );
      return false;
    }

    // 1. Limpeza básica
    const clean = (s: string) =>
      s
        .trim()
        .replace(/\r\n/g, '\n')
        .replace(/[\u200B-\u200D\uFEFF]/g, '');
    const a = clean(actual);
    const e = clean(expected);

    if (a === e) return true;

    // 2. Comparação Linha a Linha
    const aLines = a.split('\n').map((l) => l.trimEnd());
    const eLines = e.split('\n').map((l) => l.trimEnd());
    if (
      aLines.length === eLines.length &&
      aLines.every((line, i) => line === eLines[i])
    ) {
      return true;
    }

    // 3. Comparação Semântica (JSON)
    try {
      const objA = JSON.parse(a);
      const objE = JSON.parse(e);
      if (JSON.stringify(objA) === JSON.stringify(objE)) return true;
    } catch {
      // Ignora erro
    }

    // 4. Normalização Canônica (Agressiva)
    const normalize = (str: string) => {
      return str
        .replace(/\s+/g, '') // Remove TODOS os espaços/newlines
        .replace(/[\u2018\u2019]/g, "'") // Padroniza Smart Quotes Simples
        .replace(/[\u201C\u201D]/g, '"') // Padroniza Smart Quotes Duplas
        .replace(/'/g, '"') // Transforma aspas simples em duplas
        .replace(/\(/g, '[') // Tupla -> Array
        .replace(/\)/g, ']')
        .replace(/\bTrue\b/g, 'true') // Python Booleans
        .replace(/\bFalse\b/g, 'false')
        .replace(/\bNone\b/g, 'null')
        .replace(/;$/, '');
    };

    const normA = normalize(a);
    const normE = normalize(e);

    if (normA === normE) return true;

    // LOG DE DIAGNÓSTICO (Aparecerá no terminal do docker compose)
    this.logger.debug(`[COMPARE FAIL]
      Raw Actual:   ${JSON.stringify(actual)}
      Raw Expected: ${JSON.stringify(expected)}
      Norm Actual:  ${normA}
      Norm Expected: ${normE}
    `);

    return false;
  }

  @Process('grade')
  async handleGrade(job: Job) {
    const { submissionId, files, language, timeLimit, memoryLimit } = job.data;

    try {
      const submission = await this.submissionsRepository.findOne({
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

      if (fullProblem.subject === SubjectType.CHEMISTRY) {
        // Extrai o SMILES dependendo de como o React envia os dados (string simples ou array de ficheiros)
        let studentSmiles = '';
        if (Array.isArray(files) && files.length > 0) {
          studentSmiles = files[0].content || '';
        } else if (typeof files === 'string') {
          studentSmiles = files;
        }

        const expectedSmiles =
          fullProblem.validationConfig?.expectedSmiles || '';

        // Chama o motor químico (RDKit)
        const result = this.chemistryService.validateSubmission(
          studentSmiles,
          expectedSmiles,
        );

        // Atualiza os dados da submissão com o veredicto
        submission.status = result.status;
        submission.grade = result.score;

        // @ts-ignore
        submission.output = result.feedback;
        // @ts-ignore
        submission.executionTime = 0; // Motor local resolve quase instantaneamente
        // @ts-ignore
        submission.memoryUsage = 0;

        await this.submissionsRepository.save(submission);

        // Notifica o frontend via WebSocket que a correção terminou
        if (submission.user?.id) {
          this.submissionsGateway.server
            .to(`user-${submission.user.id}`)
            .emit('submission-finished', submission);
        }

        return; // O return impede que o código continue para o Go-Judge!
      }

      const langConfig = this.getLanguageConfig(language);
      if (!langConfig) {
        this.logger.error(`[DEBUG] Linguagem ${language} não suportada.`);
        submission.status = 'Internal Error';
        // @ts-ignore
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
        // @ts-ignore
        submission.output = `Erro no Wrapper: ${wrapperError.message}`;
        await this.submissionsRepository.save(submission);
        return;
      }

      let totalGrade = 0;
      let maxTime = 0;
      let maxMemory = 0;
      let firstErrorOutput: string | null = null;
      let finalStatus = 'Accepted';

      for (const [index, testCase] of fullProblem.testCases.entries()) {
        const copyIn = {};
        filesToRun.forEach((f) => {
          copyIn[f.name] = { content: f.content };
        });

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
            res.status === 'Nonzero Exit Status' ? 'Runtime Error' : res.status;

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

      submission.status = finalStatus;
      submission.grade = Math.round(totalGrade);
      // @ts-ignore
      submission.executionTime = Math.floor(maxTime / 1000000);
      // @ts-ignore
      submission.memoryUsage = Math.floor(maxMemory / 1024);
      // @ts-ignore
      submission.output =
        finalStatus !== 'Accepted' ? firstErrorOutput : 'Sucesso!';

      await this.submissionsRepository.save(submission);

      if (submission.user?.id) {
        this.submissionsGateway.server
          .to(`user-${submission.user.id}`)
          .emit('submission-finished', submission);
      }
    } catch (criticalError) {
      this.logger.error(
        `[DEBUG] Erro Crítico: ${criticalError.message}`,
        criticalError.stack,
      );
      throw criticalError;
    }
  }

  private getLanguageConfig(languageId: number): LanguageConfig | null {
    switch (languageId) {
      case 71: // Python
        return {
          fileName: 'main.py',
          runCommand: ['python3', '-u', 'main.py'],
        };
      case 63: // Node.js
        return { fileName: 'index.js', runCommand: ['node', 'index.js'] };
      case 62: // Java
        return { fileName: 'Main.java', runCommand: ['java', 'Main.java'] };
      case 60:
      case 95:
        return { fileName: 'main.go', runCommand: ['go', 'run', 'main.go'] };
      case 50:
      case 48:
        return {
          fileName: 'main.c',
          runCommand: ['gcc main.c -o main && ./main'],
        };
      case 54:
        return {
          fileName: 'main.cpp',
          runCommand: ['g++ main.cpp -o main && ./main'],
        };
      default:
        return null;
    }
  }
}
