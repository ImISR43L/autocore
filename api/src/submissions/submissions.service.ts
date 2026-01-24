import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  RequestTimeoutException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';

import { CreateSubmissionDto } from './dto/create-submission.dto';
import { GradeSubmissionDto } from './dto/grade-submission.dto';
import { Submission } from './entities/submission.entity';
import { Problem, ProblemType } from '../problems/entities/problem.entity';
import { WrapperGenerator } from './wrapper-generator';

interface LanguageConfig {
  fileName: string;
  runCommand: string[];
}

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectRepository(Submission)
    private submissionsRepository: Repository<Submission>,
    @InjectRepository(Problem)
    private problemsRepository: Repository<Problem>,
  ) {}

  async getProblemStats(problemId: string) {
    const submissions = await this.submissionsRepository.find({
      where: { problem: { id: problemId } },
      select: ['status'],
    });

    let accepted = 0;
    let error = 0;

    submissions.forEach((sub) => {
      if (sub.status === 'Accepted') accepted++;
      else error++;
    });

    return [
      { name: 'Acertos', value: accepted, fill: '#4caf50' },
      { name: 'Erros', value: error, fill: '#f44336' },
    ];
  }

  async getTeacherStats(userId: number) {
    const problems = await this.problemsRepository.find({
      where: { classroom: { owner: { id: userId } } },
      select: ['id', 'title'],
    });

    const stats: { name: string; Accepted: number; Error: number }[] = [];

    for (const p of problems) {
      const subs = await this.submissionsRepository.find({
        where: { problem: { id: p.id } },
        select: ['status'],
      });
      let acc = 0;
      let err = 0;
      subs.forEach((s) => {
        if (s.status === 'Accepted') acc++;
        else err++;
      });
      if (subs.length > 0) {
        stats.push({ name: p.title, Accepted: acc, Error: err });
      }
    }
    return stats;
  }

  async grade(id: string, gradeDto: GradeSubmissionDto, userId: number) {
    const submission = await this.submissionsRepository.findOne({
      where: { id },
      relations: ['problem', 'problem.classroom', 'problem.classroom.owner'],
    });

    if (!submission) throw new NotFoundException('Submissão não encontrada');

    if (submission.problem?.classroom?.owner?.id !== userId) {
      throw new ForbiddenException('Apenas o professor pode avaliar.');
    }

    submission.grade = gradeDto.grade ?? null;
    submission.teacherComment = gradeDto.teacherComment ?? null;

    return this.submissionsRepository.save(submission);
  }

  async create(createSubmissionDto: CreateSubmissionDto, userId: number) {
    console.log('[DEBUG] === NOVA SUBMISSÃO (TIMEOUT PROTECTION) ===');
    const { code, language_id, problem_id } = createSubmissionDto;
    const langId = Number(language_id);

    try {
      const problem = await this.problemsRepository.findOne({
        where: { id: String(problem_id) },
        relations: ['testCases', 'classroom', 'classroom.owner'],
      });

      if (!problem) throw new NotFoundException('Problema não encontrado');

      const parameters = problem.parameters || [];
      const fullCode = WrapperGenerator.generate(
        langId,
        parameters,
        problem.returnType || 'void',
        code,
      );

      const languageConfig: LanguageConfig = this.getLanguageConfig(langId);
      const mockJudgeUrl = 'http://go-judge:5050';
      const testCases = problem.testCases || [];

      let finalVerdict = 'Pending';
      let executionStdout = '';
      let executionStderr = '';

      const casesToRun =
        testCases.length > 0 ? testCases : [{ input: '', expectedOutput: '' }];
      console.log(`[DEBUG] Executando ${casesToRun.length} casos.`);

      for (const [index, tc] of casesToRun.entries()) {
        const payload = {
          cmd: [
            {
              args: languageConfig.runCommand,
              env: ['PATH=/usr/bin:/bin:/usr/local/bin'],
              files: [
                { content: tc.input || '' },
                { name: 'stdout', max: 10240 },
                { name: 'stderr', max: 10240 },
              ],
              cpuLimit: 10000000000, // 10 Segundos (Dê folga para o startup)
              memoryLimit: 1024 * 1024 * 1024, // 1 GB (Previne o OOM Killer do Host)
              procLimit: 100,

              copyIn: {
                [languageConfig.fileName]: { content: fullCode },
              },
            },
          ],
        };

        try {
          // ADICIONADO: Timeout de 10 segundos para evitar travamento eterno (Pending)
          const res = await axios.post(`${mockJudgeUrl}/run`, payload, {
            timeout: 10000,
          });
          const result = res.data[0];

          if (result.status !== 'Accepted') {
            console.error(
              `[DEBUG] FALHA CASO ${index + 1}:`,
              JSON.stringify(result),
            );
          }

          if (result.status !== 'Accepted' || result.exitStatus !== 0) {
            finalVerdict =
              result.status === 'Accepted' ? 'Runtime Error' : result.status;
            executionStderr = result.files['stderr'] || '';

            if (!executionStderr && (result as any).error) {
              executionStderr = `System Error: ${(result as any).error}`;
            }
            break;
          }

          if (testCases.length > 0) {
            const actual = (result.files['stdout'] || '').trim();
            const expected = (tc.expectedOutput || '').trim();
            if (actual !== expected) {
              finalVerdict = 'Wrong Answer';
              executionStdout = `Esperado: ${expected}\nObtido: ${actual}`;
              break;
            }
          } else {
            finalVerdict = 'Accepted';
            executionStdout = result.files['stdout'] || '';
          }
        } catch (axiosError: any) {
          console.error('[DEBUG] ERRO AXIOS:', axiosError.message);
          if (axiosError.code === 'ECONNABORTED') {
            finalVerdict = 'Time Limit Exceeded (System)';
            executionStderr = 'O tempo limite de conexão com o Juiz expirou.';
          } else {
            finalVerdict = 'System Error';
            executionStderr = axiosError.message;
          }
          break;
        }
      }

      if (finalVerdict === 'Pending') {
        finalVerdict = 'Accepted';
      }

      console.log(`[DEBUG] Veredito Final: ${finalVerdict}`);

      const sub = this.submissionsRepository.create({
        code,
        language_id: langId,
        status: finalVerdict,
        stdout: executionStdout,
        stderr: executionStderr,
        problem,
        user: { id: userId },
      });

      return this.submissionsRepository.save(sub);
    } catch (error) {
      console.error('[DEBUG] ERRO CRÍTICO NA API:', error);
      throw error;
    }
  }

  async findAllByProblem(problemId: string) {
    return this.submissionsRepository.find({
      where: { problem: { id: problemId } },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findAll() {
    return this.submissionsRepository.find({ relations: ['problem', 'user'] });
  }

  async getClassroomStats(classroomId: number, userId: number) {
    return [];
  }

  private getLanguageConfig(languageId: number): LanguageConfig {
    switch (languageId) {
      case 71: // Python
        return {
          fileName: 'main.py',
          runCommand: ['python3', 'main.py'],
        };

      case 63: // JavaScript (Node)
        return {
          fileName: 'index.js',
          runCommand: ['node', 'index.js'],
        };

      case 62: // Java
        return {
          fileName: 'Main.java',
          runCommand: ['java', 'Main.java'],
        };

      case 60: // Go
      case 95:
        return {
          fileName: 'main.go',
          runCommand: ['go', 'run', 'main.go'],
        };

      case 50: // C
      case 48:
        return {
          fileName: 'main.c',
          runCommand: ['gcc main.c -o main && ./main'],
        };

      case 54: // C++
      case 52:
        return {
          fileName: 'main.cpp',
          runCommand: ['g++ main.cpp -o main && ./main'],
        };

      default:
        return {
          fileName: 'main.py',
          runCommand: ['python3', 'main.py'],
        };
    }
  }
}
