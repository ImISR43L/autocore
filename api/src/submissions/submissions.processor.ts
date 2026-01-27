import { Process, Processor, OnQueueActive } from '@nestjs/bull';
import { Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Job } from 'bull';
import { Submission } from './entities/submission.entity';
import { Problem } from '../problems/entities/problem.entity';
import { WrapperGenerator } from './wrapper-generator';
import axios from 'axios';
import { SubmissionsGateway } from './submissions.gateway';
import { CACHE_MANAGER } from '@nestjs/cache-manager'; // <--- Token
import type { Cache } from 'cache-manager'; // <--- Interface

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
}

const MAX_OUTPUT_LENGTH = 10000;

@Processor('submission-queue')
export class SubmissionsProcessor {
  private readonly logger = new Logger(SubmissionsProcessor.name);

  constructor(
    @InjectRepository(Submission)
    private submissionsRepository: Repository<Submission>,
    @InjectRepository(Problem)
    private problemsRepository: Repository<Problem>,
    private submissionsGateway: SubmissionsGateway,
    // INJEÇÃO DO CACHE
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.logger.log('SubmissionsProcessor (com Redis Cache) inicializado.');
  }

  private cleanOutput(text: string | undefined): string {
    if (!text) return '';
    let cleaned = text.replace(/\u0000/g, '');
    if (cleaned.length > MAX_OUTPUT_LENGTH) {
      cleaned =
        cleaned.substring(0, MAX_OUTPUT_LENGTH) +
        '\n... [Output Truncated by System]';
    }
    return cleaned;
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.debug(`[Job ${job.id}] Iniciado.`);
  }

  // --- MÉTODO AUXILIAR PARA CACHE DE PROBLEMAS ---
  private async getCachedProblem(problemId: string): Promise<Problem | null> {
    const cacheKey = `problem:${problemId}:full`;

    // 1. Tenta pegar do Redis
    const cached = await this.cacheManager.get<Problem>(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. Se não achar, pega do Banco
    const problem = await this.problemsRepository.findOne({
      where: { id: problemId },
      relations: ['testCases', 'classroom'], // Busca pesada
    });

    if (problem) {
      // 3. Salva no Redis por 1 hora (TTL 3600s)
      await this.cacheManager.set(cacheKey, problem, 3600);
    }

    return problem;
  }

  @Process({ name: 'execute-code', concurrency: 5 })
  async handleExecution(job: Job<{ submissionId: string }>) {
    const { submissionId } = job.data;

    // OTIMIZAÇÃO: Buscamos apenas a submissão e o ID do problema (query leve)
    // Não trazemos os testCases aqui para economizar banda do banco
    const submission = await this.submissionsRepository.findOne({
      where: { id: submissionId },
      relations: ['user', 'problem'],
    });

    if (!submission || !submission.problem) {
      this.logger.error(`Submissão ${submissionId} órfã ou sem problema.`);
      return;
    }

    // OTIMIZAÇÃO: Buscamos os dados pesados (Test Cases/Wrappers) via Cache
    const fullProblem = await this.getCachedProblem(submission.problem.id);

    if (!fullProblem) {
      this.logger.error(`Problema ${submission.problem.id} não encontrado.`);
      return;
    }

    submission.status = 'Processing';
    // Nota: salvamos apenas status, não precisamos re-salvar o objeto problem inteiro
    await this.submissionsRepository.save(submission);

    const { code, language_id } = submission;
    const langId = Number(language_id);
    const mockJudgeUrl = 'http://go-judge:5050';

    // Gera o código final usando os parâmetros cacheados
    const parameters = fullProblem.parameters || [];
    const fullCode = WrapperGenerator.generate(
      langId,
      parameters,
      fullProblem.returnType || 'void',
      code,
    );

    const languageConfig = this.getLanguageConfig(langId);
    let finalVerdict = 'Pending';
    let executionStdout = '';
    let executionStderr = '';

    const testCases = fullProblem.testCases || [];

    try {
      if (testCases.length === 0) {
        const payload = {
          cmd: [
            {
              args: languageConfig.runCommand,
              env: ['PATH=/usr/bin:/bin'],
              files: [
                { content: '' },
                { name: 'stdout', max: 10240 },
                { name: 'stderr', max: 10240 },
              ],
              cpuLimit: 10000000000,
              memoryLimit: 512 * 1024 * 1024,
              procLimit: 50,
              copyIn: {
                [languageConfig.fileName]: { content: fullCode },
              },
            },
          ],
        };
        const res = await axios.post<ExecutorResponse[]>(
          `${mockJudgeUrl}/run`,
          payload,
        );
        const result = res.data[0];
        if (result.exitStatus === 0) {
          finalVerdict = 'No Tests';
          executionStdout = result.files['stdout'] || '';
        } else {
          finalVerdict = 'Runtime Error';
          executionStderr = result.files['stderr'] || 'Erro desconhecido';
        }
      } else {
        this.logger.debug(
          `Executando ${testCases.length} testes (Cacheado)...`,
        );
        finalVerdict = 'Accepted';

        for (const tc of testCases) {
          const payload = {
            cmd: [
              {
                args: languageConfig.runCommand,
                env: ['PATH=/usr/bin:/bin'],
                files: [
                  { content: tc.input || '' },
                  { name: 'stdout', max: 10240 },
                  { name: 'stderr', max: 10240 },
                ],
                cpuLimit: 10000000000,
                memoryLimit: 512 * 1024 * 1024,
                procLimit: 50,
                copyIn: {
                  [languageConfig.fileName]: { content: fullCode },
                },
              },
            ],
          };

          const res = await axios.post<ExecutorResponse[]>(
            `${mockJudgeUrl}/run`,
            payload,
          );
          const result = res.data[0];

          if (result.status === 'Memory Limit Exceeded') {
            finalVerdict = 'Memory Limit Exceeded';
            executionStderr = 'Limite de memória excedido';
            break;
          }
          if (result.exitStatus !== 0) {
            finalVerdict = 'Runtime Error';
            executionStderr = result.files['stderr'] || '';
            break;
          }

          const actual = (result.files['stdout'] || '').trim();
          const expected = tc.expectedOutput.trim();

          if (actual !== expected) {
            finalVerdict = 'Wrong Answer';
            if (tc.isHidden) {
              executionStdout = 'Caso de teste oculto falhou.';
            } else {
              executionStdout = `Esperado: ${expected}\nObtido: ${actual}`;
            }
            break;
          }
        }
      }
    } catch (error: any) {
      this.logger.error(`Erro Sistema: ${error.message}`);
      finalVerdict = 'System Error';
      executionStderr = 'Falha ao contatar o Juiz.';
    }

    submission.status = finalVerdict;
    submission.stdout = this.cleanOutput(executionStdout);
    submission.stderr = this.cleanOutput(executionStderr);

    // Salva resultado
    const saved = await this.submissionsRepository.save(submission);

    // Notificações Socket.IO (Usa fullProblem do cache para saber a sala da turma)
    if (saved.user?.id) {
      this.submissionsGateway.server
        .to(`user-${saved.user.id}`)
        .emit('submission-finished', saved);
    }
    if (fullProblem.classroom?.id) {
      this.submissionsGateway.server
        .to(`classroom-${fullProblem.classroom.id}`)
        .emit('classroom-update', {
          type: 'submission',
          problemId: fullProblem.id,
        });
    }
  }

  private getLanguageConfig(languageId: number): LanguageConfig {
    switch (languageId) {
      case 71:
        return { fileName: 'main.py', runCommand: ['python3', 'main.py'] };
      case 63:
        return { fileName: 'index.js', runCommand: ['node', 'index.js'] };
      case 62:
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
      case 52:
        return {
          fileName: 'main.cpp',
          runCommand: ['g++ main.cpp -o main && ./main'],
        };
      default:
        return { fileName: 'main.py', runCommand: ['python3', 'main.py'] };
    }
  }
}
