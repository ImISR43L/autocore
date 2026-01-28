import { Process, Processor, OnQueueActive } from '@nestjs/bull';
import { Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Job } from 'bull';
import { Submission, FileEntry } from './entities/submission.entity';
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
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.logger.log('SubmissionsProcessor (Multi-File) inicializado.');
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

  private async getCachedProblem(problemId: string): Promise<Problem | null> {
    const cacheKey = `problem:${problemId}:full`;
    const cached = await this.cacheManager.get<Problem>(cacheKey);
    if (cached) return cached;

    const problem = await this.problemsRepository.findOne({
      where: { id: problemId },
      relations: ['testCases', 'classroom'],
    });

    if (problem) {
      await this.cacheManager.set(cacheKey, problem, 3600);
    }
    return problem;
  }

  @Process({ name: 'execute-code', concurrency: 5 })
  async handleExecution(job: Job<{ submissionId: string }>) {
    const { submissionId } = job.data;

    const submission = await this.submissionsRepository.findOne({
      where: { id: submissionId },
      relations: ['user', 'problem'],
    });

    if (!submission || !submission.problem) {
      this.logger.error(`Submissão ${submissionId} inválida.`);
      return;
    }

    const fullProblem = await this.getCachedProblem(submission.problem.id);
    if (!fullProblem) return;

    submission.status = 'Processing';
    await this.submissionsRepository.save(submission);

    // --- NOVA LÓGICA MULTI-ARQUIVO ---
    const files = submission.files || []; // Agora pegamos a lista de arquivos
    const langId = Number(submission.language_id);
    const mockJudgeUrl = 'http://go-judge:5050';
    const languageConfig = this.getLanguageConfig(langId);

    // 1. Prepara o objeto copyIn (Mapa de Nome -> Conteúdo)
    const copyIn: Record<string, { content: string }> = {};

    // 2. Identifica o arquivo principal para aplicar o Wrapper
    // (Geralmente é main.py, index.js, etc., definido no languageConfig)
    let mainFileContent = '';

    // Procura o arquivo com o nome padrão da linguagem
    const mainFileEntry = files.find((f) => f.name === languageConfig.fileName);

    if (mainFileEntry) {
      mainFileContent = mainFileEntry.content;
    } else if (files.length > 0) {
      // Fallback: Se não achar "main.py", pega o primeiro arquivo
      mainFileContent = files[0].content;
    }

    // 3. Gera o código final com Wrapper (apenas para o arquivo principal)
    const parameters = fullProblem.parameters || [];
    const wrappedCode = WrapperGenerator.generate(
      langId,
      parameters,
      fullProblem.returnType || 'void',
      mainFileContent,
    );

    // 4. Monta o sistema de arquivos virtual
    // Primeiro, adiciona todos os arquivos auxiliares (sem wrapper)
    files.forEach((f) => {
      copyIn[f.name] = { content: f.content };
    });

    // Sobrescreve o arquivo principal com a versão "wrappada"
    copyIn[languageConfig.fileName] = { content: wrappedCode };

    // --- EXECUÇÃO (Copiado da versão otimizada anterior) ---
    let finalVerdict = 'Pending';
    let executionStdout = '';
    let executionStderr = '';
    const testCases = fullProblem.testCases || [];

    try {
      if (testCases.length === 0) {
        // Modo Sem Testes
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
              copyIn: copyIn, // <--- Enviamos todos os arquivos aqui
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
        // Modo Com Testes
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
                copyIn: copyIn, // <--- Enviamos todos os arquivos
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

    const saved = await this.submissionsRepository.save(submission);

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
