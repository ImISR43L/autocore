import {
  Process,
  Processor,
  OnQueueActive,
  OnQueueFailed,
  OnQueueCompleted,
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Job } from 'bull';
import { Submission } from './entities/submission.entity';
import { Problem } from '../problems/entities/problem.entity';
import { WrapperGenerator } from './wrapper-generator';
import axios from 'axios';
import { SubmissionsGateway } from './submissions.gateway';

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

@Processor('submissions')
export class SubmissionsProcessor {
  private readonly logger = new Logger(SubmissionsProcessor.name);

  constructor(
    @InjectRepository(Submission)
    private submissionsRepository: Repository<Submission>,
    @InjectRepository(Problem)
    private problemsRepository: Repository<Problem>,
    private submissionsGateway: SubmissionsGateway,
  ) {
    this.logger.log('SubmissionsProcessor inicializado e aguardando jobs...');
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.debug(
      `[Job ${job.id}] Iniciado. Dados: ${JSON.stringify(job.data)}`,
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    this.logger.debug(`[Job ${job.id}] Concluído com sucesso.`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: any) {
    this.logger.error(`[Job ${job.id}] FALHOU: ${error.message}`, error.stack);
  }

  @Process('execute-code')
  async handleExecution(job: Job<{ submissionId: string }>) {
    const { submissionId } = job.data;
    this.logger.debug(`[Job ${job.id}] Buscando submissão ID: ${submissionId}`);

    // 1. Recupera a submissão e o problema
    const submission = await this.submissionsRepository.findOne({
      where: { id: submissionId },
      relations: ['problem', 'problem.testCases', 'user', 'problem.classroom'],
    });

    if (!submission) {
      this.logger.error(`[Job ${job.id}] Submissão não encontrada no banco.`);
      return;
    }
    if (!submission.problem) {
      this.logger.error(`[Job ${job.id}] Problema associado não encontrado.`);
      return;
    }

    // Atualiza status para Processing
    this.logger.debug(`[Job ${job.id}] Atualizando status para Processing...`);
    submission.status = 'Processing';
    await this.submissionsRepository.save(submission);

    const { problem, code, language_id } = submission;
    const langId = Number(language_id);
    const mockJudgeUrl = 'http://go-judge:5050';

    this.logger.debug(
      `[Job ${job.id}] Gerando Wrapper para linguagem ${langId}...`,
    );

    // 2. Gera o código final com Wrapper
    const parameters = problem.parameters || [];
    const fullCode = WrapperGenerator.generate(
      langId,
      parameters,
      problem.returnType || 'void',
      code,
    );
    const languageConfig = this.getLanguageConfig(langId);
    let finalVerdict = 'Pending';
    let executionStdout = '';
    let executionStderr = '';
    const testCases = problem.testCases || [];

    // === EXECUÇÃO ===
    try {
      if (testCases.length === 0) {
        this.logger.debug(
          `[Job ${job.id}] Executando sem casos de teste (Modo Simples)...`,
        );

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

        this.logger.debug(
          `[Job ${job.id}] Resposta do Go-Judge (Simples): ExitStatus ${result.exitStatus}`,
        );

        if (result.exitStatus === 0) {
          finalVerdict = 'Accepted';
          executionStdout = result.files['stdout'] || '';
        } else {
          finalVerdict = 'Runtime Error';
          executionStderr = result.files['stderr'] || 'Erro desconhecido';
        }
      } else {
        this.logger.debug(
          `[Job ${job.id}] Executando ${testCases.length} casos de teste...`,
        );
        finalVerdict = 'Accepted';

        for (const [index, tc] of testCases.entries()) {
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

          this.logger.verbose(`[Job ${job.id}] Enviando Caso ${index + 1}...`);
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
      this.logger.error(
        `[Job ${job.id}] Erro de execução (Axios/Sistema): ${error.message}`,
      );
      finalVerdict = 'System Error';
      executionStderr = 'Falha ao contatar o Juiz.';
    }

    // 3. Salva o resultado final
    this.logger.log(`[Job ${job.id}] Veredito Final: ${finalVerdict}`);
    submission.status = finalVerdict;
    submission.stdout = executionStdout;
    submission.stderr = executionStderr;

    const saved = await this.submissionsRepository.save(submission);

    if (saved.user?.id) {
      this.submissionsGateway.server
        .to(`user-${saved.user.id}`)
        .emit('submission-finished', saved);
    }

    if (submission.problem.classroom?.id) {
      this.submissionsGateway.server
        .to(`classroom-${submission.problem.classroom.id}`)
        .emit('classroom-update', {
          type: 'submission',
          problemId: submission.problem.id,
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
