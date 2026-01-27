import { Process, Processor, OnQueueActive } from '@nestjs/bull';
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

@Processor('submission-queue')
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

  private cleanOutput(text: string | undefined): string {
    if (!text) return '';
    return text.replace(/\u0000/g, '');
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.debug(`[Job ${job.id}] Iniciado.`);
  }

  // OTIMIZAÇÃO: Concurrency definido para 5.
  // Isso permite processar 5 alunos ao mesmo tempo, em vez de 1 por 1 (serial).
  @Process({ name: 'execute-code', concurrency: 5 })
  async handleExecution(job: Job<{ submissionId: string }>) {
    const { submissionId } = job.data;

    const submission = await this.submissionsRepository.findOne({
      where: { id: submissionId },
      relations: ['problem', 'problem.testCases', 'user', 'problem.classroom'],
    });

    if (!submission || !submission.problem) return;

    submission.status = 'Processing';
    await this.submissionsRepository.save(submission);

    const { problem, code, language_id } = submission;
    const langId = Number(language_id);
    const mockJudgeUrl = 'http://go-judge:5050';

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

    try {
      if (testCases.length === 0) {
        // --- MODO SEM TESTES ---
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

        if (result.exitStatus === 0) {
          finalVerdict = 'No Tests';
          executionStdout = result.files['stdout'] || '';
        } else {
          finalVerdict = 'Runtime Error';
          executionStderr = result.files['stderr'] || 'Erro desconhecido';
        }
      } else {
        // --- MODO COM TESTES ---
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

    this.logger.log(`[Job ${job.id}] Veredito Final: ${finalVerdict}`);

    submission.status = finalVerdict;
    submission.stdout = this.cleanOutput(executionStdout);
    submission.stderr = this.cleanOutput(executionStderr);

    const saved = await this.submissionsRepository.save(submission);

    // Notificações
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
