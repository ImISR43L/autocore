import {
  ForbiddenException,
  Injectable,
  NotFoundException,
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

interface ExecutorResponse {
  status: string;
  exitStatus: number;
  files: Record<string, string>;
  stdout?: string;
  stderr?: string;
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
    const { code, language_id, problem_id } = createSubmissionDto;

    const langId = Number(language_id);

    const problem = await this.problemsRepository.findOne({
      where: { id: String(problem_id) },
      // CORREÇÃO: 'parameters' removido daqui pois é uma coluna, não uma relação
      relations: ['testCases', 'classroom', 'classroom.owner'],
    });

    if (!problem) throw new NotFoundException('Problema não encontrado');

    if (problem.type === ProblemType.EXAM) {
      const now = new Date();
      if (
        problem.startedAt &&
        problem.timeLimit &&
        now.getTime() - problem.startedAt.getTime() >
          problem.timeLimit * 60 * 1000
      ) {
        throw new ForbiddenException('Tempo de prova esgotado.');
      }
      if (problem.maxAttempts) {
        const count = await this.submissionsRepository.count({
          where: { problem: { id: String(problem.id) }, user: { id: userId } },
        });
        if (count >= problem.maxAttempts) {
          throw new ForbiddenException('Limite de tentativas excedido.');
        }
      }
    }

    if (problem.deadline && new Date() > problem.deadline) {
      if (problem.classroom.owner.id !== userId) {
        throw new ForbiddenException('O prazo de entrega já encerrou.');
      }
    }

    // A coluna parameters é carregada automaticamente com a entidade
    const parameters = problem.parameters || [];

    const fullCode = WrapperGenerator.generate(
      langId,
      parameters,
      problem.returnType || 'void',
      code,
    );

    const languageConfig: LanguageConfig = this.getLanguageConfig(langId);

    let finalVerdict = 'Pending';
    let executionStdout = '';
    let executionStderr = '';

    const testCases = problem.testCases || [];
    if (testCases.length === 0) {
      try {
        const payload = {
          cmd: languageConfig.runCommand,
          files: [
            {
              name: languageConfig.fileName,
              content: fullCode,
            },
          ],
        };
        const res = await axios.post<ExecutorResponse>(
          `${mockJudgeUrl}/run`,
          payload,
        );
        if (res.data.exitStatus === 0) {
          finalVerdict = 'Accepted';
          executionStdout = res.data.files['stdout.txt'] || '';
        } else {
          finalVerdict = 'Runtime Error';
          executionStderr = res.data.files['stderr.txt'] || 'Erro desconhecido';
        }
      } catch (error: unknown) {
        console.error(error);
        finalVerdict = 'System Error';
        executionStderr = 'Falha ao contatar o Juiz.';
      }
    } else {
      finalVerdict = 'Accepted';

      for (const tc of testCases) {
        const payload = {
          cmd: languageConfig.runCommand,
          files: [
            {
              name: languageConfig.fileName,
              content: fullCode,
            },
          ],
          stdin: tc.input,
        };

        try {
          const res = await axios.post<ExecutorResponse>(
            `${mockJudgeUrl}/run`,
            payload,
          );
          const data = res.data;

          if (data.exitStatus !== 0) {
            finalVerdict = 'Runtime Error';
            executionStderr = data.files['stderr.txt'] || '';
            break;
          }

          const actualOutput = (data.files['stdout.txt'] || '').trim();
          const expectedOutput = tc.expectedOutput.trim();

          if (actualOutput !== expectedOutput) {
            finalVerdict = 'Wrong Answer';
            executionStdout = `Esperado: ${expectedOutput}\nObtido: ${actualOutput}`;
            break;
          }
        } catch (error: unknown) {
          console.error(error);
          finalVerdict = 'Internal Error';
          if (axios.isAxiosError(error) && error.response) {
            executionStderr = `Erro do Juiz: ${error.response.status}`;
          } else if (error instanceof Error) {
            executionStderr = error.message;
          } else {
            executionStderr = 'Falha desconhecida na comunicação.';
          }
          break;
        }
      }
    }

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
