import {
  Process,
  Processor,
  OnQueueActive,
  OnQueueFailed,
  OnQueueCompleted,
} from '@nestjs/bull';
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

  @Process('grade')
  async handleGrade(job: Job) {
    const { submissionId, files, language, timeLimit, memoryLimit } = job.data;

    try {
      // Carrega a submissão COM as relações necessárias (user, problem) para uso no WebSocket
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
      const langConfig = this.getLanguageConfig(language);
      if (!langConfig) {
        this.logger.error(`[DEBUG] Linguagem ${language} não suportada.`);
        submission.status = 'Internal Error';
        // @ts-ignore
        submission.output = 'Linguagem não suportada.';
        await this.submissionsRepository.save(submission);
        return;
      }

      // Wrapper Generator
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

      // Execução no Go-Judge
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
                'PYTHONUNBUFFERED=1', // Força saída imediata (sem buffer)
              ],
              files: [
                { content: inputContent },
                { name: 'stdout', max: 10240 }, // FD 1: STDOUT
                { name: 'stderr', max: 10240 }, // FD 2: STDERR
              ],
              cpuLimit: (timeLimit || 2) * 1000000000,
              memoryLimit: (memoryLimit || 128) * 1024 * 1024,
              procLimit: 64,
              copyIn: copyIn, // Arquivos do código fonte
            },
          ],
        };

        const response = await axios.post(this.executorUrl, runPayload);
        const res = (response.data as ExecutorResponse[])[0];

        if (res.status !== 'Accepted') {
          finalStatus =
            res.status === 'Nonzero Exit Status' ? 'Runtime Error' : res.status;

          const rawError =
            res.error ||
            res.files?.stderr ||
            res.files?.stdout ||
            'Erro desconhecido (sem output)';

          if (!firstErrorOutput) {
            firstErrorOutput = this.cleanLog(rawError, language);
          }
          break;
        }

        const runStdout = this.cleanLog(res.files['stdout']);
        const expected = testCase.expectedOutput?.trim() || '';

        if (runStdout.trim() === expected) {
          totalGrade += 100 / fullProblem.testCases.length;
        } else {
          finalStatus = 'Wrong Answer';
          if (!firstErrorOutput) {
            firstErrorOutput = `Esperado: ${expected}\nRecebido: ${runStdout.trim()}`;
          }
        }

        const timeNs = res.time || 0;
        const memBytes = res.memory || 0;
        if (timeNs > maxTime) maxTime = timeNs;
        if (memBytes > maxMemory) maxMemory = memBytes;
      }

      // Atualiza o objeto submission
      submission.status = finalStatus;
      submission.grade = Math.round(totalGrade);
      // @ts-ignore
      submission.executionTime = Math.floor(maxTime / 1000000);
      // @ts-ignore
      submission.memoryUsage = Math.floor(maxMemory / 1024);
      // @ts-ignore
      submission.output =
        finalStatus !== 'Accepted' ? firstErrorOutput : 'Sucesso!';

      // Salva no banco (mas não sobrescreve a variável 'submission' que tem as relações)
      await this.submissionsRepository.save(submission);

      // CORREÇÃO WEBSOCKET: Usa o objeto 'submission' original que tem o 'user' carregado
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
          runCommand: ['python3', '-u', 'main.py'], // -u para unbuffered
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
