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
    const submissions = await this.submissionsRepository.find({
      where: {
        problem: {
          classroom: {
            owner: { id: userId },
          },
        },
      },
      relations: ['problem'],
      select: ['id', 'status', 'problem'],
    });

    const statsMap = new Map<
      string,
      { name: string; Accepted: number; Error: number }
    >();

    submissions.forEach((sub) => {
      const problemTitle = sub.problem.title;
      if (!statsMap.has(problemTitle)) {
        statsMap.set(problemTitle, {
          name: problemTitle,
          Accepted: 0,
          Error: 0,
        });
      }
      const entry = statsMap.get(problemTitle);
      if (entry) {
        if (sub.status === 'Accepted') entry.Accepted += 1;
        else entry.Error += 1;
      }
    });

    return Array.from(statsMap.values());
  }

  async getClassroomStats(classroomId: number, userId: number) {
    const submissions = await this.submissionsRepository.find({
      where: {
        problem: {
          classroom: {
            id: classroomId,
            owner: { id: userId },
          },
        },
      },
      relations: ['problem'],
      select: ['id', 'status', 'problem'],
    });

    const statsMap = new Map<
      string,
      { name: string; Accepted: number; Error: number }
    >();

    submissions.forEach((sub) => {
      const problemTitle = sub.problem.title;
      if (!statsMap.has(problemTitle)) {
        statsMap.set(problemTitle, {
          name: problemTitle,
          Accepted: 0,
          Error: 0,
        });
      }
      const entry = statsMap.get(problemTitle);
      if (entry) {
        if (sub.status === 'Accepted') entry.Accepted += 1;
        else entry.Error += 1;
      }
    });

    return Array.from(statsMap.values());
  }

  async grade(id: string, gradeDto: GradeSubmissionDto, userId: number) {
    const submission = await this.submissionsRepository.findOne({
      where: { id },
      relations: ['problem', 'problem.classroom', 'problem.classroom.owner'],
    });

    if (!submission) throw new NotFoundException('Submissão não encontrada');

    if (submission.problem.classroom.owner.id !== userId) {
      throw new ForbiddenException(
        'Apenas o professor desta turma pode avaliar.',
      );
    }

    if (gradeDto.grade !== undefined) submission.grade = gradeDto.grade;
    if (gradeDto.teacherComment !== undefined)
      submission.teacherComment = gradeDto.teacherComment;

    return this.submissionsRepository.save(submission);
  }

  async create(createSubmissionDto: CreateSubmissionDto, userId: number) {
    const { code, language_id, problem_id } = createSubmissionDto;

    const problem = await this.problemsRepository.findOne({
      where: { id: problem_id },
      relations: ['testCases', 'classroom', 'classroom.owner'],
    });

    if (!problem) throw new NotFoundException('Exercício não encontrado');

    if (problem.classroom.owner.id === userId) {
      throw new ForbiddenException(
        'Professores não devem enviar soluções para análise, apenas alunos.',
      );
    }

    // --- Lógica de Prova ---
    if (problem.type === ProblemType.EXAM) {
      if (problem.maxAttempts) {
        const attempts = await this.submissionsRepository.count({
          where: { problem: { id: problem.id }, user: { id: userId } },
        });
        if (attempts >= problem.maxAttempts) {
          throw new ForbiddenException(`Limite de tentativas excedido.`);
        }
      }

      if (problem.timeLimit) {
        if (!problem.startedAt) {
          throw new ForbiddenException(
            'A prova ainda não foi iniciada pelo professor.',
          );
        }
        const now = new Date().getTime();
        const startTime = new Date(problem.startedAt).getTime();
        const limitMs = problem.timeLimit * 60 * 1000;
        const endTime = startTime + limitMs;

        if (now > endTime + 30000) {
          throw new ForbiddenException('O tempo da prova acabou.');
        }
      }
    }

    if (problem.deadline && new Date() > new Date(problem.deadline)) {
      throw new ForbiddenException(`Prazo encerrado.`);
    }

    let finalVerdict = 'Accepted';
    let executionStdout: string | null = null;
    let executionStderr: string | null = null;

    const params =
      problem.parameters?.length > 0
        ? problem.parameters
        : ([
            { name: 'a', type: 'int' },
            { name: 'b', type: 'int' },
          ] as any);

    const returnType = problem.returnType || 'string';

    const codeToRun = WrapperGenerator.generate(
      language_id,
      params,
      returnType,
      code,
    );

    const judgeUrl =
      process.env.JUDGE0_URL || 'http://judge0-server:2358/submissions';

    if (problem.testCases?.length > 0) {
      for (const testCase of problem.testCases) {
        try {
          const payload = {
            source_code: Buffer.from(codeToRun).toString('base64'),
            language_id: language_id,
            stdin: Buffer.from(testCase.input).toString('base64'),
            expected_output: Buffer.from(testCase.expectedOutput).toString(
              'base64',
            ),
          };

          const response = await axios.post(
            `${judgeUrl}?base64_encoded=true&wait=true`,
            payload,
            { headers: { 'Content-Type': 'application/json' } },
          );

          const result = response.data;

          if (result.status.id !== 3) {
            finalVerdict = result.status.description;

            executionStdout = result.stdout
              ? Buffer.from(result.stdout, 'base64').toString()
              : null;

            // --- MELHORIA AQUI ---
            // Captura erros de execução padrão
            executionStderr = result.stderr
              ? Buffer.from(result.stderr, 'base64').toString()
              : null;

            // Captura erros de compilação
            if (result.compile_output) {
              const compileErr = Buffer.from(
                result.compile_output,
                'base64',
              ).toString();
              executionStderr = executionStderr
                ? executionStderr + '\n' + compileErr
                : compileErr;
            }

            // Captura MENSAGENS DE ERRO do sistema (ex: sandbox falhou)
            if (result.message) {
              const sysErr = `System Error: ${result.message}`;
              executionStderr = executionStderr
                ? executionStderr + '\n' + sysErr
                : sysErr;
            }
            // ---------------------

            break;
          }
        } catch (e) {
          console.error('Erro ao conectar com Judge0:', e.message);
          finalVerdict = 'Execution Error';
          executionStderr = 'Falha de comunicação com o servidor de execução.';
          break;
        }
      }
    }

    const sub = this.submissionsRepository.create({
      code,
      language_id,
      status: finalVerdict,
      stdout: executionStdout,
      stderr: executionStderr,
      problem,
      user: { id: userId } as any,
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
}
