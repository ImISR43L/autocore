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
    let cleaned = text.replace(/\u0000/g, '').replace(/\r\n/g, '\n');
    if (cleaned.length > MAX_OUTPUT_LENGTH) {
      cleaned =
        cleaned.substring(0, MAX_OUTPUT_LENGTH) +
        '\n... (saída truncada por excesso de tamanho)';
    }
    return cleaned;
  }

  @Process('execute-code')
  async processCode(job: Job) {
    const { submissionId } = job.data;
    this.logger.log(`Processando submissão: ${submissionId}`);

    try {
      const submission = await this.submissionsRepository.findOne({
        where: { id: submissionId },
        relations: ['problem', 'user'],
      });

      if (!submission) {
        this.logger.warn(`Submissão ${submissionId} não encontrada.`);
        return;
      }

      submission.status = 'Processing';
      await this.submissionsRepository.save(submission);
      if (submission.user?.id) {
        this.submissionsGateway.server
          .to(`user-${submission.user.id}`)
          .emit('submission-finished', submission);
      }

      const fullProblem = await this.problemsRepository.findOne({
        where: { id: submission.problem.id },
        relations: ['testCases', 'classroom'],
      });

      if (!fullProblem) {
        this.logger.warn(`Problema ${submission.problem.id} não encontrado.`);
        return;
      }

      const langConfig = this.getLanguageConfig(submission.language_id);
      if (!langConfig) {
        submission.status = 'Internal Error';
        submission.stderr = 'Linguagem não suportada';
        await this.submissionsRepository.save(submission);
        return;
      }

      const langId = Number(submission.language_id);
      this.logger.warn(
        `[PROCESSOR] Iniciando Wrapper. LangID: ${langId} (Type: ${typeof langId})`,
      );

      let filesWithWrapper: any[] = [];
      try {
        if (!submission.files || !Array.isArray(submission.files)) {
          throw new Error(
            `submission.files inválido: ${JSON.stringify(submission.files)}`,
          );
        }

        filesWithWrapper = WrapperGenerator.apply(
          submission.files,
          fullProblem,
          langId,
        );
        this.logger.warn(
          `Wrapper aplicado com sucesso. Arquivos: ${filesWithWrapper.length}`,
        );
      } catch (wrapperError) {
        this.logger.warn(
          `ERRO FATAL NO WRAPPER: ${wrapperError.message}`,
          wrapperError.stack,
        );
        submission.status = 'Internal Error';
        submission.stderr = `Erro interno ao processar código: ${wrapperError.message}`;
        await this.submissionsRepository.save(submission);
        return; // Aborta para não enviar lixo ao executor
      }
      // -------------------------------------

      let finalVerdict = 'Accepted';
      let executionStdout = '';
      let executionStderr = '';

      const testCases = fullProblem.testCases || [];

      for (const testCase of testCases) {
        try {
          const copyInObj = filesWithWrapper.reduce(
            (acc, f) => {
              acc[f.name] = { content: f.content };
              return acc;
            },
            {} as Record<string, any>,
          );

          if (langId === 63) {
            // 63 = JavaScript
            copyInObj['package.json'] = { content: '{ "type": "module" }' };
          }

          const payload = {
            cmd: [
              {
                args: langConfig.runCommand,
                env: [
                  'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
                  'LANG=C.UTF-8',
                ],
                files: [
                  { content: testCase.input || '' }, // FD 0: stdin
                  { name: 'stdout', max: 10240 }, // FD 1: stdout
                  { name: 'stderr', max: 10240 }, // FD 2: stderr
                ],
                cpuLimit: 2000000000,
                clockLimit: 2000000000,
                memoryLimit: 512 * 1024 * 1024,
                procLimit: 50,
                copyIn: copyInObj,
              },
            ],
          };

          const executorUrl =
            process.env.EXECUTOR_URL || 'http://judge:5050/run';
          const response = await axios.post(executorUrl, payload);
          const result = response.data[0] as ExecutorResponse;

          // 1. Priorize a leitura de files['stdout'], fallback para result.stdout
          const rawOutput = result.files?.['stdout'] || result.stdout || '';
          const output = rawOutput.trim();
          const rawStderr = result.files?.['stderr'] || result.stderr || '';

          if (result.status === 'Internal Error' || result.error) {
            this.logger.warn(
              `[GO-JUDGE ERROR] ${result.status}: ${result.error}`,
            );
          }

          if (result.status !== 'Accepted') {
            finalVerdict = result.status;
            executionStderr += `[Caso ${testCase.id}] Erro: ${result.status}\n`;
            if (result.error) executionStderr += `Detalhes: ${result.error}\n`;

            // Use a variável corrigida rawStderr aqui
            if (rawStderr) executionStderr += `STDERR: ${rawStderr}\n`;
            break;
          }
          if (result.exitStatus !== 0) {
            finalVerdict = 'Run Time Error';
            executionStderr += `[Caso ${testCase.id}] Exit Code ${result.exitStatus}\n`;
            if (rawStderr) executionStderr += `${rawStderr}\n`;
            break;
          }

          const expected = testCase.expectedOutput.trim();

          if (output !== expected) {
            finalVerdict = 'Wrong Answer';

            // ALTERAÇÃO:
            // 1. O stdout guarda APENAS o que o código do aluno cuspiu (para o diff visual ficar limpo no "Seu Resultado")
            executionStdout = output;

            // 2. O stderr guarda os detalhes técnicos do erro para o aluno entender o contexto
            executionStderr += `Esperado: ${expected}\n`;
            executionStderr += `Obtido: ${output}\n`;
            // Adicione logs extras se houver (do Go-Judge)
            if (result.stderr)
              executionStderr += `\nLogs de Execução:\n${result.stderr}`;

            break; // Para na primeira falha
          }
        } catch (error) {
          this.logger.warn(
            `Erro na execução do caso de teste: ${error.message}`,
          );
          finalVerdict = 'Internal Error';
          executionStderr = `Erro de comunicação com o executor: ${error.message}`;
          break;
        }
      }

      if (finalVerdict === 'Accepted') {
        executionStdout = 'Todos os casos de teste foram aprovados!';
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
    } catch (criticalError) {
      this.logger.error(
        `FALHA CRÍTICA NO PROCESSAMENTO: ${criticalError.message}`,
        criticalError.stack,
      );
    }
  }

  private getLanguageConfig(languageId: number): LanguageConfig | null {
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
      case 53:
        return {
          fileName: 'main.cpp',
          runCommand: ['g++ main.cpp -o main && ./main'],
        };
      default:
        return null;
    }
  }
}
